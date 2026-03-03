---
title: Redis Connection Pool Required
category: infra
severity: error
modality: must
tags: [redis, connection-pool, performance, cache]
stack: [java, spring-boot, redis]
scope: [backend, infra]
---

# Redis Connection Pool Required

All Redis connections MUST use connection pooling.

## Rules

- Use connection pooling (Jedis Pool or Lettuce) — never create raw connections per request
- Configure pool size based on expected workload (min-idle, max-active, max-idle)
- Set connection and read timeouts to prevent hanging
- Use Spring Data Redis with proper pool configuration
- Monitor pool metrics (active, idle, waiters) via actuator

## Good Example

```yaml
# application.yml
spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      timeout: 2000ms
      jedis:
        pool:
          max-active: 16
          max-idle: 8
          min-idle: 4
          max-wait: 2000ms
```

```java
@Configuration
public class RedisConfig {
    @Bean
    public JedisPoolConfig jedisPoolConfig() {
        var config = new JedisPoolConfig();
        config.setMaxTotal(16);
        config.setMaxIdle(8);
        config.setMinIdle(4);
        config.setMaxWaitMillis(2000);
        config.setTestOnBorrow(true);
        return config;
    }

    @Bean
    public JedisConnectionFactory jedisConnectionFactory(JedisPoolConfig poolConfig) {
        var config = new RedisStandaloneConfiguration();
        config.setHostName(redisHost);
        config.setPort(redisPort);
        return new JedisConnectionFactory(config,
            JedisClientConfiguration.builder().usePooling().poolConfig(poolConfig).build());
    }
}
```

## Bad Example

```java
// Creating a new Jedis connection per request — connection leak, no pooling
public String getValue(String key) {
    Jedis jedis = new Jedis("localhost", 6379);
    String value = jedis.get(key);
    jedis.close(); // easily forgotten, causes connection leak
    return value;
}
```
