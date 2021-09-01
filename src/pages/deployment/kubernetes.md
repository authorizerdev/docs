---
title: kubernetes
layout: ../../layouts/Main.astro
---

Helm chart for Authorizer deployment is coming soon.

Till that you can use [docker image](https://hub.docker.com/repository/docker/lakhansamani/authorizer) to deploy with following configuration. It includes

- [Workload](https://kubernetes.io/docs/concepts/workloads/)
- [Service](https://kubernetes.io/docs/concepts/services-networking/)
- [Nginx](https://docs.nginx.com/nginx-ingress-controller/installation/installation-with-helm/)
- [Cert manager](https://github.com/jetstack/cert-manager)

## Step 1: Create Cluster

- Create Kubernetes cluster on your preferred provider. Some popular ones are
  - [Google Kubernetes Engine(GKE)](https://www.google.com/search?q=GKe&oq=GKe&aqs=chrome..69i57j0i67l4j69i60l3.1133j0j7&sourceid=chrome&ie=UTF-8)
  - [Amazon Elastic Kubernetes Service(EKS)](https://docs.aws.amazon.com/eks/index.html)

## Step 2: Install nginx ingress

In your kubernetes cluster install nginx using helm chart. Here are the [docs](https://docs.nginx.com/nginx-ingress-controller/installation/installation-with-helm/)

## Step 3: Add Authorizer Service and Workload

Copy following into `authorizer.yml` file and update the required variables

> Note: Replace your domain, database strings and other environment variables. For more environment variables check [here](/core/env)

```yml
---
apiVersion: v1
kind: Service
metadata:
  name: authorizer
spec:
  selector:
    app: authorizer
  ports:
    - port: 80
      name: http
      targetPort: 8080
  type: ClusterIP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authorizer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: authorizer
  template:
    metadata:
      labels:
        app: authorizer
    spec:
      containers:
        - name: authorizer
          image: lakhansamani/authorizer:latest
          ports:
            - containerPort: 8080
          env:
            - name: ENV
              value: production
            - name: GIN_MODE
              value: "release"
            - name: DATABASE_URL
              value: "YOUR_DATA BASE URL"
            - name: DATABASE_TYPE
              value: "DATABASE TYPE postgres/mysql/sqlite"
            - name: ADMIN_SECRET
              value: "YOUR_ADMIN_SECRET"
            - name: JWT_SECRET
              value: "SOME_RANDOM_STRING"
            - name: JWT_TYPE
              value: "HS256"
          imagePullPolicy: Always
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
  namespace: cert-manager
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: lakhan@contentment.org
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    certmanager.k8s.io/acme-challenge-type: http01
    acme.cert-manager.io/http01-edit-in-place: "true"
    kubernetes.io/ingress.class: nginx
  generation: 1
  name: authorizer
  namespace: default
spec:
  rules:
    - host: YOUR_DOMAIN
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: authorizer
                port:
                  number: 80
  tls:
    - hosts:
        - YOUR_DOMAIN
      secretName: authorizer-tls
```

Run `kubectl apply -f authorizer.yml` to install authorizer.

> Note add `A` record for the domain you have configured above with IP of your nginx load balancer and wait for the cert manager to complete the challenge and generate the SSL certificate for your domain.
