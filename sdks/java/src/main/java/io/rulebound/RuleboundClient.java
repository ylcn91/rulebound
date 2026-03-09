package io.rulebound;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public class RuleboundClient implements AutoCloseable {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .setSerializationInclusion(JsonInclude.Include.NON_NULL);

    private final String serverUrl;
    private final String apiKey;
    private final HttpClient httpClient;

    public RuleboundClient(String apiKey, String serverUrl) {
        this(apiKey, serverUrl, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());
    }

    public RuleboundClient(String apiKey) {
        this(apiKey, "http://localhost:3001");
    }

    public RuleboundClient(String apiKey, String serverUrl, HttpClient httpClient) {
        this.apiKey = Objects.requireNonNull(apiKey, "apiKey");
        this.serverUrl = Objects.requireNonNull(serverUrl, "serverUrl").replaceAll("/$", "");
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
    }

    public ValidationReport validate(ValidationRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/validate", null, request, new TypeReference<>() {});
    }

    public ValidationReport validate(String code, String language, String project) throws IOException, InterruptedException {
        return validate(new ValidationRequest(code, null, language, project, null, null));
    }

    public ValidationReport validatePlan(String plan) throws IOException, InterruptedException {
        return validate(new ValidationRequest(null, plan, null, null, null, null));
    }

    public ListResponse<Rule> listRules(RuleListOptions options) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/rules", options == null ? null : options.toQuery(), null, new TypeReference<>() {});
    }

    public List<Rule> getRules(RuleListOptions options) throws IOException, InterruptedException {
        return listRules(options).data();
    }

    public Rule getRule(String ruleId) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/rules/" + encodePath(ruleId), null, null, new TypeReference<DataResponse<Rule>>() {}).data();
    }

    public Rule createRule(RuleCreateRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/rules", null, request, new TypeReference<DataResponse<Rule>>() {}).data();
    }

    public Rule updateRule(String ruleId, RuleUpdateRequest request) throws IOException, InterruptedException {
        return requestJson("PUT", "/v1/rules/" + encodePath(ruleId), null, request, new TypeReference<DataResponse<Rule>>() {}).data();
    }

    public DeleteResult deleteRule(String ruleId) throws IOException, InterruptedException {
        return requestJson("DELETE", "/v1/rules/" + encodePath(ruleId), null, null, new TypeReference<DataResponse<DeleteResult>>() {}).data();
    }

    public ListResponse<Project> listProjects() throws IOException, InterruptedException {
        return requestJson("GET", "/v1/projects", null, null, new TypeReference<>() {});
    }

    public Project getProject(String projectId) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/projects/" + encodePath(projectId), null, null, new TypeReference<DataResponse<Project>>() {}).data();
    }

    public Project createProject(ProjectCreateRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/projects", null, request, new TypeReference<DataResponse<Project>>() {}).data();
    }

    public Project updateProject(String projectId, ProjectUpdateRequest request) throws IOException, InterruptedException {
        return requestJson("PUT", "/v1/projects/" + encodePath(projectId), null, request, new TypeReference<DataResponse<Project>>() {}).data();
    }

    public DeleteResult deleteProject(String projectId) throws IOException, InterruptedException {
        return requestJson("DELETE", "/v1/projects/" + encodePath(projectId), null, null, new TypeReference<DataResponse<DeleteResult>>() {}).data();
    }

    public ListResponse<AuditEntry> listAudit(AuditListOptions options) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/audit", options == null ? null : options.toQuery(), null, new TypeReference<>() {});
    }

    public List<AuditEntry> getAudit(AuditListOptions options) throws IOException, InterruptedException {
        return listAudit(options).data();
    }

    public AuditEntry createAudit(AuditCreateRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/audit", null, request, new TypeReference<DataResponse<AuditEntry>>() {}).data();
    }

    public String exportAudit(AuditListOptions options) throws IOException, InterruptedException {
        return requestText("GET", "/v1/audit/export", options == null ? null : options.toQuery(), null);
    }

    public ComplianceData getCompliance(String projectId, String since, Integer limit) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "since", since);
        putIfPresent(query, "limit", limit);
        return requestJson("GET", "/v1/compliance/" + encodePath(projectId), query, null, new TypeReference<DataResponse<ComplianceData>>() {}).data();
    }

    public ComplianceData getCompliance(String projectId) throws IOException, InterruptedException {
        return getCompliance(projectId, null, null);
    }

    public ComplianceSnapshot createComplianceSnapshot(String projectId, ComplianceSnapshotRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/compliance/" + encodePath(projectId) + "/snapshot", null, request, new TypeReference<DataResponse<ComplianceSnapshot>>() {}).data();
    }

    public SyncResponse syncRules(SyncOptions options) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/sync", options == null ? null : options.toQuery(), null, new TypeReference<>() {});
    }

    public SyncAckResult ackSync(SyncAckRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/sync/ack", null, request, new TypeReference<DataResponse<SyncAckResult>>() {}).data();
    }

    public List<ApiToken> listTokens(String orgId) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "org_id", orgId);
        return requestJson("GET", "/v1/tokens", query, null, new TypeReference<DataResponse<List<ApiToken>>>() {}).data();
    }

    public CreatedApiToken createToken(TokenCreateRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/tokens", null, request, new TypeReference<DataResponse<CreatedApiToken>>() {}).data();
    }

    public DeleteResult deleteToken(String tokenId) throws IOException, InterruptedException {
        return requestJson("DELETE", "/v1/tokens/" + encodePath(tokenId), null, null, new TypeReference<DataResponse<DeleteResult>>() {}).data();
    }

    public List<TopViolation> getTopViolations(AnalyticsReadOptions options) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/analytics/top-violations", options == null ? null : options.toQuery(), null, new TypeReference<DataResponse<List<TopViolation>>>() {}).data();
    }

    public AnalyticsTrend getAnalyticsTrend(String projectId, String interval, Integer limit) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "project_id", projectId);
        putIfPresent(query, "interval", interval);
        putIfPresent(query, "limit", limit);
        return requestJson("GET", "/v1/analytics/trend", query, null, new TypeReference<DataResponse<AnalyticsTrend>>() {}).data();
    }

    public List<AnalyticsCategoryBreakdown> getCategoryBreakdown(String projectId, String since) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "project_id", projectId);
        putIfPresent(query, "since", since);
        return requestJson("GET", "/v1/analytics/category-breakdown", query, null, new TypeReference<DataResponse<List<AnalyticsCategoryBreakdown>>>() {}).data();
    }

    public List<AnalyticsSourceStat> getSourceStats(String projectId, String since) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "project_id", projectId);
        putIfPresent(query, "since", since);
        return requestJson("GET", "/v1/analytics/source-stats", query, null, new TypeReference<DataResponse<List<AnalyticsSourceStat>>>() {}).data();
    }

    public List<WebhookEndpoint> listWebhookEndpoints(String orgId) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "org_id", orgId);
        return requestJson("GET", "/v1/webhooks/endpoints", query, null, new TypeReference<DataResponse<List<WebhookEndpoint>>>() {}).data();
    }

    public WebhookEndpoint getWebhookEndpoint(String endpointId) throws IOException, InterruptedException {
        return requestJson("GET", "/v1/webhooks/endpoints/" + encodePath(endpointId), null, null, new TypeReference<DataResponse<WebhookEndpoint>>() {}).data();
    }

    public WebhookEndpoint createWebhookEndpoint(WebhookEndpointCreateRequest request) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/webhooks/endpoints", null, request, new TypeReference<DataResponse<WebhookEndpoint>>() {}).data();
    }

    public WebhookEndpoint updateWebhookEndpoint(String endpointId, WebhookEndpointUpdateRequest request) throws IOException, InterruptedException {
        return requestJson("PUT", "/v1/webhooks/endpoints/" + encodePath(endpointId), null, request, new TypeReference<DataResponse<WebhookEndpoint>>() {}).data();
    }

    public DeleteResult deleteWebhookEndpoint(String endpointId) throws IOException, InterruptedException {
        return requestJson("DELETE", "/v1/webhooks/endpoints/" + encodePath(endpointId), null, null, new TypeReference<DataResponse<DeleteResult>>() {}).data();
    }

    public DeliveryResult testWebhookEndpoint(String endpointId) throws IOException, InterruptedException {
        return requestJson("POST", "/v1/webhooks/endpoints/" + encodePath(endpointId) + "/test", null, null, new TypeReference<DataResponse<DeliveryResult>>() {}).data();
    }

    public List<WebhookDelivery> listWebhookDeliveries(String endpointId, Integer limit) throws IOException, InterruptedException {
        Map<String, String> query = new LinkedHashMap<>();
        putIfPresent(query, "endpoint_id", endpointId);
        putIfPresent(query, "limit", limit);
        return requestJson("GET", "/v1/webhooks/deliveries", query, null, new TypeReference<DataResponse<List<WebhookDelivery>>>() {}).data();
    }

    private <T> T requestJson(
            String method,
            String path,
            Map<String, String> query,
            Object body,
            TypeReference<T> typeReference
    ) throws IOException, InterruptedException {
        HttpResponse<String> response = send(method, path, query, body);
        return MAPPER.readValue(response.body(), typeReference);
    }

    private String requestText(String method, String path, Map<String, String> query, Object body) throws IOException, InterruptedException {
        return send(method, path, query, body).body();
    }

    private HttpResponse<String> send(String method, String path, Map<String, String> query, Object body) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(serverUrl + path + buildQuery(query)))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("User-Agent", "rulebound-java/0.1.0")
                .timeout(Duration.ofSeconds(30));

        if (body == null) {
            if ("GET".equals(method) || "DELETE".equals(method)) {
                builder.method(method, HttpRequest.BodyPublishers.noBody());
            } else {
                builder.method(method, HttpRequest.BodyPublishers.ofString(""));
            }
        } else {
            builder.method(method, HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(body)));
        }

        HttpResponse<String> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new RuleboundException("API error " + response.statusCode(), response.statusCode(), response.body());
        }
        return response;
    }

    private static String buildQuery(Map<String, String> query) {
        if (query == null || query.isEmpty()) {
            return "";
        }

        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, String> entry : query.entrySet()) {
            if (entry.getValue() == null || entry.getValue().isBlank()) {
                continue;
            }
            parts.add(URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8) + "="
                    + URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8));
        }
        return parts.isEmpty() ? "" : "?" + String.join("&", parts);
    }

    private static void putIfPresent(Map<String, String> map, String key, String value) {
        if (value != null && !value.isBlank()) {
            map.put(key, value);
        }
    }

    private static void putIfPresent(Map<String, String> map, String key, Integer value) {
        if (value != null) {
            map.put(key, Integer.toString(value));
        }
    }

    private static String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    @Override
    public void close() {
        // HttpClient does not require explicit shutdown.
    }

    public record DataResponse<T>(T data) {}

    public record ListResponse<T>(List<T> data, Integer total) {}

    public record DeleteResult(boolean deleted) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Rule(
            String id,
            String ruleSetId,
            String title,
            String content,
            String category,
            String severity,
            String modality,
            List<String> tags,
            List<String> stack,
            boolean isActive,
            int version,
            String createdAt,
            String updatedAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RuleCreateRequest(
            String title,
            String content,
            String category,
            String severity,
            String modality,
            List<String> tags,
            List<String> stack,
            String ruleSetId
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RuleUpdateRequest(
            String title,
            String content,
            String category,
            String severity,
            String modality,
            List<String> tags,
            List<String> stack,
            Boolean isActive,
            String changeNote
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RuleListOptions(
            String stack,
            String category,
            String tag,
            @JsonProperty("q") String query,
            Integer limit,
            Integer offset
    ) {
        public Map<String, String> toQuery() {
            Map<String, String> values = new LinkedHashMap<>();
            putIfPresent(values, "stack", stack);
            putIfPresent(values, "category", category);
            putIfPresent(values, "tag", tag);
            putIfPresent(values, "q", query);
            putIfPresent(values, "limit", limit);
            putIfPresent(values, "offset", offset);
            return values;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Project(
            String id,
            String orgId,
            String name,
            String slug,
            String repoUrl,
            List<String> stack,
            String createdAt,
            String updatedAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ProjectCreateRequest(String name, String slug, String repoUrl, List<String> stack) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ProjectUpdateRequest(String name, String slug, String repoUrl, List<String> stack) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ValidationRequest(
            String code,
            String plan,
            String language,
            String project,
            String task,
            Boolean useLlm
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ValidationResult(
            String ruleId,
            String ruleTitle,
            String severity,
            String modality,
            String status,
            String reason,
            String suggestedFix
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ValidationSummary(int pass, int violated, int notCovered) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ValidationReport(
            String task,
            int rulesMatched,
            int rulesTotal,
            List<ValidationResult> results,
            ValidationSummary summary,
            String status
    ) {
        public boolean passed() {
            return "PASSED".equals(status);
        }

        public boolean blocked() {
            return "FAILED".equals(status);
        }

        public List<ValidationResult> violations() {
            return results == null ? List.of() : results.stream().filter(result -> "VIOLATED".equals(result.status())).toList();
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AuditEntry(
            String id,
            String orgId,
            String projectId,
            String userId,
            String action,
            String ruleId,
            String status,
            Map<String, Object> metadata,
            String createdAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AuditCreateRequest(
            String orgId,
            String projectId,
            String userId,
            String action,
            String ruleId,
            String status,
            Map<String, Object> metadata
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AuditListOptions(
            String orgId,
            String projectId,
            String action,
            String since,
            String until,
            Integer limit,
            Integer offset
    ) {
        public Map<String, String> toQuery() {
            Map<String, String> values = new LinkedHashMap<>();
            putIfPresent(values, "org_id", orgId);
            putIfPresent(values, "project_id", projectId);
            putIfPresent(values, "action", action);
            putIfPresent(values, "since", since);
            putIfPresent(values, "until", until);
            putIfPresent(values, "limit", limit);
            putIfPresent(values, "offset", offset);
            return values;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ComplianceTrend(
            int score,
            int passCount,
            int violatedCount,
            int notCoveredCount,
            String date
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ComplianceData(String projectId, Integer currentScore, List<ComplianceTrend> trend) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ComplianceSnapshot(
            String id,
            String projectId,
            int score,
            int passCount,
            int violatedCount,
            int notCoveredCount,
            String snapshotAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ComplianceSnapshotRequest(Integer score, Integer passCount, Integer violatedCount, Integer notCoveredCount) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SyncMeta(int total, String versionHash, String syncedAt) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SyncResponse(List<Rule> data, SyncMeta meta) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SyncOptions(String project, String stack, String since) {
        public Map<String, String> toQuery() {
            Map<String, String> values = new LinkedHashMap<>();
            putIfPresent(values, "project", project);
            putIfPresent(values, "stack", stack);
            putIfPresent(values, "since", since);
            return values;
        }
    }

    public record SyncAckRequest(String projectId, String ruleVersionHash) {}

    public record SyncAckResult(boolean synced) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ApiToken(
            String id,
            String orgId,
            String userId,
            String name,
            String tokenPrefix,
            List<String> scopes,
            String expiresAt,
            String lastUsedAt,
            String createdAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TokenCreateRequest(String orgId, String userId, String name, List<String> scopes, String expiresAt) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreatedApiToken(
            String id,
            String name,
            String token,
            String prefix,
            List<String> scopes,
            String expiresAt,
            String createdAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record AnalyticsReadOptions(String projectId, String since, Integer limit) {
        public Map<String, String> toQuery() {
            Map<String, String> values = new LinkedHashMap<>();
            putIfPresent(values, "project_id", projectId);
            putIfPresent(values, "since", since);
            putIfPresent(values, "limit", limit);
            return values;
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TopViolation(String ruleId, int count) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AnalyticsTrend(String projectId, String interval, List<ComplianceTrend> trend) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AnalyticsCategoryBreakdown(String action, int count) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AnalyticsSourceStat(String status, int count) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WebhookEndpoint(
            String id,
            String orgId,
            String url,
            List<String> events,
            boolean isActive,
            String description,
            String createdAt,
            String updatedAt,
            String secret,
            String secretPrefix
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WebhookEndpointCreateRequest(String orgId, String url, String secret, List<String> events, String description) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WebhookEndpointUpdateRequest(String url, String secret, List<String> events, String description, Boolean isActive) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WebhookDelivery(
            String id,
            String endpointId,
            String event,
            Map<String, Object> payload,
            String status,
            Integer responseCode,
            String responseBody,
            Integer attempts,
            String nextRetryAt,
            String createdAt
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record DeliveryResult(boolean success, Integer statusCode, String error) {}

    public static class RuleboundException extends RuntimeException {
        private final int statusCode;
        private final String body;

        public RuleboundException(String message, int statusCode, String body) {
            super(message + ": " + body);
            this.statusCode = statusCode;
            this.body = body;
        }

        public int getStatusCode() {
            return statusCode;
        }

        public String getBody() {
            return body;
        }
    }
}
