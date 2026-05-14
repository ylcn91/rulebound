---
title: No Latest Tag in Docker Images
category: infra
severity: error
modality: must
tags: [docker, versioning, reproducibility, container]
stack: [docker, devops]
scope: [infra, devops]
---

# No Latest Tag in Docker Images

MUST NOT use `:latest` tag in Dockerfiles or deployment manifests.

## Rules

- Always pin specific version tags for base images
- Use SHA digest for critical production base images
- Tag application images with git SHA or semantic version
- Never use `:latest` in Kubernetes manifests or docker-compose files

## Good Example

```dockerfile
FROM eclipse-temurin:21.0.4_7-jdk-alpine AS build
FROM node:22.11.0-alpine AS frontend
FROM postgres:17.2-alpine
```

```yaml
# k8s deployment
containers:
  - name: app
    image: registry.company.com/app:v2.3.1
```

## Bad Example

```dockerfile
FROM openjdk:latest
FROM node:latest
FROM postgres:latest
```
