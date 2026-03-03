---
title: Use Existing Dockerfile
category: infra
severity: error
modality: must
tags: [docker, dockerfile, container, build]
stack: [docker, devops]
scope: [infra, devops]
---

# Use Existing Dockerfile

MUST NOT create a new Dockerfile if one already exists in the project.

## Rules

- Check for existing Dockerfile before creating one
- Modify the existing Dockerfile when changes are needed
- Use multi-stage builds for optimal image size
- Keep the existing base image unless there is a justified reason to change
- Preserve existing build arguments, environment variables, and entrypoint

## Good Example

```dockerfile
# Existing Dockerfile — modify in place
FROM harbor.company.com/base/maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY . .
RUN mvn -B clean package -DskipTests

FROM harbor.company.com/base/openjdk:21-jdk-slim
WORKDIR /app
COPY --from=build /app/infra/target/infra*.jar /app.jar

ENV TZ Europe/Istanbul
ENTRYPOINT ["java", "-XX:+UseG1GC", "-jar", "/app.jar"]
```

## Bad Example

```dockerfile
# Creating a SECOND Dockerfile when one already exists
# Dockerfile.new — WRONG, modify the existing Dockerfile instead

FROM ubuntu:latest
RUN apt-get update && apt-get install -y openjdk-21-jdk
COPY target/*.jar /app.jar
CMD ["java", "-jar", "/app.jar"]
```
