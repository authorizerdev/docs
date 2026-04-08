---
sidebar_position: 3
title: Kubernetes
---

# Kubernetes (v2)

This guide shows how to deploy **Authorizer v2** on Kubernetes using the **CLI-only configuration model**.
Instead of configuring env vars that the server reads directly, we pass **CLI flags** through the container `args`.

If you are migrating from v1, compare with [Kubernetes](../deployment/kubernetes) and the [Migration v1 to v2](../migration/v1-to-v2) guide.

---

## 1. Prerequisites

- A Kubernetes cluster (GKE, EKS, AKS, k3s, etc.).
- Container image for **Authorizer v2** built with:

```dockerfile
# Official image listens on 8080 (HTTP) and 8081 (metrics); see Dockerfile EXPOSE comments.
ENTRYPOINT ["./authorizer"]
CMD []
```

- Optional:
  - Ingress controller (for example nginx).
  - cert-manager for automatic TLS.

---

## 2. Deployment manifest (v2-style)

Below is an example `Deployment` + `Service` + `Ingress` setup.
The key difference vs v1: **we pass configuration as CLI flags in `args`**.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authorizer-v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: authorizer-v2
  template:
    metadata:
      labels:
        app: authorizer-v2
    spec:
      containers:
        - name: authorizer-v2
          image: your-registry/authorizer:v2
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 8081
              name: metrics
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: authorizer-secrets
                  key: database-url
            - name: CLIENT_ID
              valueFrom:
                secretKeyRef:
                  name: authorizer-secrets
                  key: client-id
            - name: CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: authorizer-secrets
                  key: client-secret
            - name: ADMIN_SECRET
              valueFrom:
                secretKeyRef:
                  name: authorizer-secrets
                  key: admin-secret
          args:
            - "--env=production"
            - "--http-port=8080"
            - "--metrics-port=8081"
            - "--metrics-host=0.0.0.0"
            - "--rate-limit-rps=30"
            - "--rate-limit-burst=20"
            - "--rate-limit-fail-closed=false"
            - "--database-type=postgres"
            - "--database-url=$(DATABASE_URL)"
            - "--client-id=$(CLIENT_ID)"
            - "--client-secret=$(CLIENT_SECRET)"
            - "--admin-secret=$(ADMIN_SECRET)"
            - "--jwt-type=RS256"
            # Example: mount keys from files or use env and expand here
            - "--enable-login-page=true"
            - "--enable-playground=false"
            - "--enable-graphql-introspection=false"
---
apiVersion: v1
kind: Service
metadata:
  name: authorizer-v2
spec:
  selector:
    app: authorizer-v2
  ports:
    - port: 80
      name: http
      targetPort: 8080
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: authorizer-v2
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
    - host: YOUR_DOMAIN
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: authorizer-v2
                port:
                  number: 80
  tls:
    - hosts:
        - YOUR_DOMAIN
      secretName: authorizer-v2-tls
```

> **Note:** Use Kubernetes `Secret` resources for sensitive values and reference them via `env` + `args` as shown.

### Ports: `containerPort`, Services, and Ingress {#k8s-ports-services}

- Declare **both** `containerPort: 8080` and **`8081`** on the pod so the API contract matches the image (`EXPOSE 8080 8081` in the Dockerfile). This is documentation for humans and tooling; it does not by itself expose traffic to the internet.
- The **`Service`** that backs your **Ingress** (or cloud load balancer) should forward **only** the app port (**80 → 8080** in the example above). **Do not** add `8081` to that same public-facing `Service` or `Ingress`.
- For Prometheus, scrape **`8081`** via the **pod network** or a **separate ClusterIP `Service`** (below). Set **`--metrics-host=0.0.0.0`** in `args` so the metrics listener accepts connections from other pods; without it, metrics stay on container loopback and in-cluster scrapes will fail.

**Summary:** expose **both** ports on the **Pod**; expose **only HTTP (8080)** to clients via Ingress/LB; keep **metrics (8081)** internal to the cluster.

### Metrics (Prometheus)

The app serves **`/metrics` on a second HTTP listener** on port **`8081`**. In Kubernetes, **`--metrics-host=0.0.0.0`** is usually required so Prometheus can scrape the pod IP. **Do not** put port `8081` on an internet-facing `Ingress`. Use a `ServiceMonitor`, PodMonitor, or a dedicated **ClusterIP** `Service` and scrape config only. If Prometheus runs on the **same host** as a bare binary (not K8s), you can keep the default **`127.0.0.1`** for metrics instead.

Optional internal `Service` for metrics (ClusterIP only):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: authorizer-v2-metrics
spec:
  selector:
    app: authorizer-v2
  ports:
    - port: 8081
      targetPort: metrics
      name: metrics
  type: ClusterIP
```

Apply the manifest:

```bash
kubectl apply -f authorizer-v2.yaml
```

---

## 3. Managing configuration changes

Because all configuration is now expressed as **CLI flags**:

- To change a setting (for example enable playground), update the **`args`** list.
- Then run:

```bash
kubectl apply -f authorizer-v2.yaml
kubectl rollout restart deployment authorizer-v2
```

You no longer update server config via `_update_env` or dashboard; those are deprecated in v2.

For a full list of available flags, see:

- [Server Configuration (v2)](../core/server-config)
- `./build/server --help` in the container image
