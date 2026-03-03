package io.rulebound;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class RuleboundClient implements AutoCloseable {

    private final String serverUrl;
    private final String apiKey;
    private final HttpClient httpClient;

    public RuleboundClient(String apiKey, String serverUrl) {
        this.apiKey = apiKey;
        this.serverUrl = serverUrl.replaceAll("/$", "");
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public RuleboundClient(String apiKey) {
        this(apiKey, "http://localhost:3001");
    }

    public ValidationReport validate(String code, String language, String project) throws Exception {
        String body = String.format(
                "{\"code\":\"%s\",\"language\":\"%s\",\"project\":\"%s\"}",
                escapeJson(code), escapeJson(language), escapeJson(project));

        String response = post("/v1/validate", body);
        return parseReport(response);
    }

    public ValidationReport validatePlan(String plan) throws Exception {
        String body = String.format("{\"plan\":\"%s\"}", escapeJson(plan));
        String response = post("/v1/validate", body);
        return parseReport(response);
    }

    public String getRulesRaw(String stack, String category) throws Exception {
        StringBuilder query = new StringBuilder("/v1/rules?");
        if (stack != null) query.append("stack=").append(stack).append("&");
        if (category != null) query.append("category=").append(category);
        return get(query.toString());
    }

    public String syncRules(String project, String stack) throws Exception {
        StringBuilder query = new StringBuilder("/v1/sync?");
        if (project != null) query.append("project=").append(project).append("&");
        if (stack != null) query.append("stack=").append(stack);
        return get(query.toString());
    }

    public String getCompliance(String projectId) throws Exception {
        return get("/v1/compliance/" + projectId);
    }

    private String post(String path, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(serverUrl + path))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("User-Agent", "rulebound-java/0.1.0")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new RuleboundException("API error " + response.statusCode() + ": " + response.body());
        }

        return response.body();
    }

    private String get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(serverUrl + path))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("User-Agent", "rulebound-java/0.1.0")
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() >= 400) {
            throw new RuleboundException("API error " + response.statusCode() + ": " + response.body());
        }

        return response.body();
    }

    private static ValidationReport parseReport(String json) {
        // Minimal JSON parsing without external dependencies
        // In production, use Jackson or Gson
        return new ValidationReport(json);
    }

    private static String escapeJson(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    @Override
    public void close() {
        // HttpClient doesn't need explicit close in Java 11+
    }

    public static class RuleboundException extends Exception {
        public RuleboundException(String message) {
            super(message);
        }
    }

    public static class ValidationReport {
        private final String rawJson;

        public ValidationReport(String rawJson) {
            this.rawJson = rawJson;
        }

        public String getRawJson() {
            return rawJson;
        }

        public boolean isPassed() {
            return rawJson.contains("\"status\":\"PASSED\"");
        }

        public boolean isFailed() {
            return rawJson.contains("\"status\":\"FAILED\"");
        }

        @Override
        public String toString() {
            return rawJson;
        }
    }
}
