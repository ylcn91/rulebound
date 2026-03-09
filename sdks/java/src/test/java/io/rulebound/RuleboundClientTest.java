package io.rulebound;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Queue;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuleboundClientTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private HttpServer server;

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void validateAndRules() throws Exception {
        MockServer mockServer = startServer(List.of(
                new MockReply(200, "{\"task\":\"Validate auth flow\",\"rulesMatched\":1,\"rulesTotal\":1,\"results\":[],\"summary\":{\"pass\":1,\"violated\":0,\"notCovered\":0},\"status\":\"PASSED\"}", "application/json"),
                new MockReply(200, "{\"data\":[{\"id\":\"rule-1\",\"ruleSetId\":\"set-1\",\"title\":\"No eval\",\"content\":\"Avoid eval\",\"category\":\"security\",\"severity\":\"error\",\"modality\":\"must\",\"tags\":[\"security\"],\"stack\":[\"typescript\"],\"isActive\":true,\"version\":2,\"createdAt\":\"2026-03-08T10:00:00Z\",\"updatedAt\":\"2026-03-08T10:00:00Z\"}],\"total\":1}", "application/json"),
                new MockReply(200, "{\"data\":{\"deleted\":true}}", "application/json")
        ));

        RuleboundClient client = new RuleboundClient("test-api-key", mockServer.baseUrl());

        RuleboundClient.ValidationReport report = client.validate(
                new RuleboundClient.ValidationRequest(null, "Implement OAuth callback", null, "rulebound", null, true)
        );
        RuleboundClient.ListResponse<RuleboundClient.Rule> rules = client.listRules(
                new RuleboundClient.RuleListOptions("typescript", null, null, "eval", 10, null)
        );
        RuleboundClient.DeleteResult deleted = client.deleteRule("rule-1");

        assertEquals("/v1/validate", mockServer.requests().get(0).path());
        assertEquals("Implement OAuth callback", mockServer.requests().get(0).jsonBody().get("plan"));
        assertEquals("/v1/rules?stack=typescript&q=eval&limit=10", mockServer.requests().get(1).path());
        assertEquals("PASSED", report.status());
        assertEquals(1, rules.total());
        assertTrue(deleted.deleted());
    }

    @Test
    void projectsAuditAndExport() throws Exception {
        MockServer mockServer = startServer(List.of(
                new MockReply(200, "{\"data\":[],\"total\":0}", "application/json"),
                new MockReply(201, "{\"data\":{\"id\":\"proj-1\",\"orgId\":\"org-1\",\"name\":\"Rulebound\",\"slug\":\"rulebound\",\"repoUrl\":\"https://github.com/rulebound/rulebound\",\"stack\":[\"typescript\"],\"createdAt\":\"2026-03-08T10:00:00Z\",\"updatedAt\":\"2026-03-08T10:00:00Z\"}}", "application/json"),
                new MockReply(200, "{\"data\":[{\"id\":\"audit-1\",\"orgId\":\"org-1\",\"projectId\":\"proj-1\",\"userId\":\"user-1\",\"action\":\"rule.created\",\"ruleId\":\"rule-1\",\"status\":\"SUCCESS\",\"metadata\":{\"actor\":\"sdk-test\"},\"createdAt\":\"2026-03-08T10:00:00Z\"}],\"total\":1}", "application/json"),
                new MockReply(200, "id,action\n1,rule.created\n", "text/csv")
        ));

        RuleboundClient client = new RuleboundClient("test-api-key", mockServer.baseUrl());

        RuleboundClient.ListResponse<RuleboundClient.Project> projects = client.listProjects();
        RuleboundClient.Project created = client.createProject(
                new RuleboundClient.ProjectCreateRequest("Rulebound", "rulebound", "https://github.com/rulebound/rulebound", List.of("typescript"))
        );
        RuleboundClient.ListResponse<RuleboundClient.AuditEntry> audit = client.listAudit(
                new RuleboundClient.AuditListOptions("org-1", "proj-1", null, null, null, 5, null)
        );
        String csv = client.exportAudit(new RuleboundClient.AuditListOptions("org-1", null, null, null, null, 20, null));

        assertEquals("/v1/projects", mockServer.requests().get(0).path());
        assertEquals("rulebound", mockServer.requests().get(1).jsonBody().get("slug"));
        assertEquals("/v1/audit?org_id=org-1&project_id=proj-1&limit=5", mockServer.requests().get(2).path());
        assertEquals("/v1/audit/export?org_id=org-1&limit=20", mockServer.requests().get(3).path());
        assertEquals(0, projects.total());
        assertEquals("org-1", created.orgId());
        assertEquals(1, audit.total());
        assertTrue(csv.contains("rule.created"));
    }

    @Test
    void complianceSyncTokensAnalyticsAndWebhooks() throws Exception {
        MockServer mockServer = startServer(List.of(
                new MockReply(200, "{\"data\":{\"projectId\":\"proj-1\",\"currentScore\":93,\"trend\":[{\"score\":93,\"passCount\":9,\"violatedCount\":1,\"notCoveredCount\":0,\"date\":\"2026-03-08T00:00:00Z\"}]}}", "application/json"),
                new MockReply(201, "{\"data\":{\"id\":\"snap-1\",\"projectId\":\"proj-1\",\"score\":95,\"passCount\":10,\"violatedCount\":0,\"notCoveredCount\":0,\"snapshotAt\":\"2026-03-08T12:00:00Z\"}}", "application/json"),
                new MockReply(200, "{\"data\":[{\"id\":\"rule-1\",\"ruleSetId\":\"set-1\",\"title\":\"No eval\",\"content\":\"Avoid eval\",\"category\":\"security\",\"severity\":\"error\",\"modality\":\"must\",\"tags\":[\"security\"],\"stack\":[\"typescript\"],\"isActive\":true,\"version\":2,\"createdAt\":\"2026-03-08T10:00:00Z\",\"updatedAt\":\"2026-03-08T10:00:00Z\"}],\"meta\":{\"total\":1,\"versionHash\":\"abc123\",\"syncedAt\":\"2026-03-08T12:00:00Z\"}}", "application/json"),
                new MockReply(200, "{\"data\":{\"synced\":true}}", "application/json"),
                new MockReply(200, "{\"data\":[{\"id\":\"token-1\",\"orgId\":\"org-1\",\"userId\":\"user-1\",\"name\":\"CI token\",\"tokenPrefix\":\"rb_123456\",\"scopes\":[\"read\"],\"expiresAt\":null,\"lastUsedAt\":null,\"createdAt\":\"2026-03-08T10:00:00Z\"}]}", "application/json"),
                new MockReply(200, "{\"data\":[{\"ruleId\":\"rule-1\",\"count\":4}]}", "application/json"),
                new MockReply(200, "{\"data\":[{\"id\":\"wh-1\",\"orgId\":\"org-1\",\"url\":\"https://hooks.example.com/rulebound\",\"events\":[\"violation.detected\"],\"isActive\":true,\"description\":\"Production\",\"secretPrefix\":\"whsec_ab...\",\"createdAt\":\"2026-03-08T10:00:00Z\",\"updatedAt\":\"2026-03-08T10:00:00Z\"}]}", "application/json"),
                new MockReply(200, "{\"data\":{\"success\":true,\"statusCode\":200}}", "application/json"),
                new MockReply(200, "{\"data\":[{\"id\":\"delivery-1\",\"endpointId\":\"wh-1\",\"event\":\"test\",\"status\":\"delivered\",\"responseCode\":200,\"attempts\":1,\"createdAt\":\"2026-03-08T10:00:00Z\"}]}", "application/json")
        ));

        RuleboundClient client = new RuleboundClient("test-api-key", mockServer.baseUrl());

        RuleboundClient.ComplianceData compliance = client.getCompliance("proj-1", "2026-03-01T00:00:00Z", 5);
        RuleboundClient.ComplianceSnapshot snapshot = client.createComplianceSnapshot(
                "proj-1",
                new RuleboundClient.ComplianceSnapshotRequest(95, 10, 0, 0)
        );
        RuleboundClient.SyncResponse sync = client.syncRules(
                new RuleboundClient.SyncOptions("rulebound", "typescript", "2026-03-01T00:00:00Z")
        );
        RuleboundClient.SyncAckResult ack = client.ackSync(new RuleboundClient.SyncAckRequest("proj-1", "abc123"));
        List<RuleboundClient.ApiToken> tokens = client.listTokens("org-1");
        List<RuleboundClient.TopViolation> top = client.getTopViolations(new RuleboundClient.AnalyticsReadOptions("proj-1", null, 5));
        List<RuleboundClient.WebhookEndpoint> endpoints = client.listWebhookEndpoints("org-1");
        RuleboundClient.DeliveryResult delivery = client.testWebhookEndpoint("wh-1");
        List<RuleboundClient.WebhookDelivery> deliveries = client.listWebhookDeliveries("wh-1", 10);

        assertEquals("/v1/compliance/proj-1?since=2026-03-01T00%3A00%3A00Z&limit=5", mockServer.requests().get(0).path());
        assertEquals("/v1/sync?project=rulebound&stack=typescript&since=2026-03-01T00%3A00%3A00Z", mockServer.requests().get(2).path());
        assertEquals("/v1/analytics/top-violations?project_id=proj-1&limit=5", mockServer.requests().get(5).path());
        assertEquals("/v1/webhooks/endpoints?org_id=org-1", mockServer.requests().get(6).path());
        assertEquals("/v1/webhooks/deliveries?endpoint_id=wh-1&limit=10", mockServer.requests().get(8).path());
        assertEquals("proj-1", compliance.projectId());
        assertEquals(95, snapshot.score());
        assertEquals("abc123", sync.meta().versionHash());
        assertTrue(ack.synced());
        assertEquals("rb_123456", tokens.get(0).tokenPrefix());
        assertEquals(4, top.get(0).count());
        assertNotNull(endpoints.get(0).secretPrefix());
        assertTrue(delivery.success());
        assertEquals("delivered", deliveries.get(0).status());
    }

    @Test
    void raisesTypedApiErrors() throws Exception {
        MockServer mockServer = startServer(List.of(new MockReply(403, "Forbidden", "text/plain")));
        RuleboundClient client = new RuleboundClient("test-api-key", mockServer.baseUrl());

        RuleboundClient.RuleboundException error = assertThrows(
                RuleboundClient.RuleboundException.class,
                () -> client.validate(new RuleboundClient.ValidationRequest(null, "test", null, null, null, null))
        );

        assertEquals(403, error.getStatusCode());
        assertEquals("Forbidden", error.getBody());
        assertFalse(error.getMessage().isBlank());
    }

    private MockServer startServer(List<MockReply> replies) throws IOException {
        Queue<MockReply> queue = new ArrayDeque<>(replies);
        List<RecordedRequest> requests = new ArrayList<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/", exchange -> handle(exchange, queue, requests));
        server.start();
        return new MockServer("http://localhost:" + server.getAddress().getPort(), requests);
    }

    private void handle(HttpExchange exchange, Queue<MockReply> replies, List<RecordedRequest> requests) throws IOException {
        String body = readBody(exchange.getRequestBody());
        Map<String, Object> json = body.isBlank()
                ? Map.of()
                : MAPPER.readValue(body, new TypeReference<>() {});

        requests.add(new RecordedRequest(exchange.getRequestURI().toString(), json));

        MockReply reply = replies.remove();
        exchange.getResponseHeaders().add("Content-Type", reply.contentType());
        byte[] bytes = reply.body().getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(reply.status(), bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    private String readBody(InputStream inputStream) throws IOException {
        return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    }

    private record MockReply(int status, String body, String contentType) {}

    private record RecordedRequest(String path, Map<String, Object> jsonBody) {}

    private record MockServer(String baseUrl, List<RecordedRequest> requests) {}
}
