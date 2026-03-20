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
ENTRYPOINT ["./build/server"]
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
