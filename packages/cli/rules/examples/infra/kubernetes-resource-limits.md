---
title: Kubernetes Resource Limits Required
category: infra
severity: error
modality: must
tags: [kubernetes, k8s, resources, limits, requests]
stack: [kubernetes, devops]
scope: [infra, devops]
---

# Kubernetes Resource Limits Required

All containers MUST define CPU and memory requests and limits.

## Rules

- Every container must have `resources.requests` and `resources.limits`
- Set memory limits to prevent OOMKill cascading
- Set CPU requests for proper scheduling
- Define readiness and liveness probes
- Use resource quotas per namespace

## Good Example

```yaml
containers:
  - name: api
    image: registry.company.com/api:v1.2.3
    resources:
      requests:
        memory: "256Mi"
        cpu: "250m"
      limits:
        memory: "512Mi"
        cpu: "500m"
    readinessProbe:
      httpGet:
        path: /actuator/health/readiness
        port: 8080
      initialDelaySeconds: 10
      periodSeconds: 5
    livenessProbe:
      httpGet:
        path: /actuator/health/liveness
        port: 8080
      initialDelaySeconds: 30
      periodSeconds: 10
```

## Bad Example

```yaml
containers:
  - name: api
    image: registry.company.com/api:latest
    # No resource limits — can consume entire node
    # No probes — unhealthy pods keep receiving traffic
```
