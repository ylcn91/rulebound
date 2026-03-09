using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace Rulebound.Tests;

public sealed class RuleboundClientTests
{
    [Fact]
    public async Task ValidateAndRulesAsync()
    {
        var handler = new RecordingHandler(
        [
            new StubResponse(HttpStatusCode.OK, """{"task":"Validate auth flow","rulesMatched":1,"rulesTotal":1,"results":[],"summary":{"pass":1,"violated":0,"notCovered":0},"status":"PASSED"}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"id":"rule-1","ruleSetId":"set-1","title":"No eval","content":"Avoid eval","category":"security","severity":"error","modality":"must","tags":["security"],"stack":["typescript"],"isActive":true,"version":2,"createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}],"total":1}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":{"deleted":true}}"""),
        ]);
        using var http = new HttpClient(handler);
        using var client = new RuleboundClient("test-api-key", "http://localhost:3001", http);

        var report = await client.ValidateAsync(new ValidationRequest(Plan: "Implement OAuth callback", Project: "rulebound", UseLlm: true));
        var rules = await client.ListRulesAsync(new RuleListOptions(Stack: "typescript", Query: "eval", Limit: 10));
        var deleted = await client.DeleteRuleAsync("rule-1");

        Assert.Equal("http://localhost:3001/v1/validate", handler.Requests[0].Url);
        Assert.Equal("Implement OAuth callback", handler.Requests[0].Body!["plan"]!.ToString());
        Assert.Equal("http://localhost:3001/v1/rules?stack=typescript&q=eval&limit=10", handler.Requests[1].Url);
        Assert.Equal("PASSED", report.Status);
        Assert.Equal(1, rules.Total);
        Assert.True(deleted.Deleted);
    }

    [Fact]
    public async Task ProjectsAuditAndExportAsync()
    {
        var handler = new RecordingHandler(
        [
            new StubResponse(HttpStatusCode.OK, """{"data":[],"total":0}"""),
            new StubResponse(HttpStatusCode.Created, """{"data":{"id":"proj-1","orgId":"org-1","name":"Rulebound","slug":"rulebound","repoUrl":"https://github.com/rulebound/rulebound","stack":["typescript"],"createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"id":"audit-1","orgId":"org-1","projectId":"proj-1","userId":"user-1","action":"rule.created","ruleId":"rule-1","status":"SUCCESS","metadata":{"actor":"sdk-test"},"createdAt":"2026-03-08T10:00:00Z"}],"total":1}"""),
            new StubResponse(HttpStatusCode.OK, "id,action\n1,rule.created\n", "text/csv"),
        ]);
        using var http = new HttpClient(handler);
        using var client = new RuleboundClient("test-api-key", "http://localhost:3001", http);

        var projects = await client.ListProjectsAsync();
        var created = await client.CreateProjectAsync(new ProjectCreateRequest("Rulebound", "rulebound", "https://github.com/rulebound/rulebound", ["typescript"]));
        var audit = await client.ListAuditAsync(new AuditListOptions(OrgId: "org-1", ProjectId: "proj-1", Limit: 5));
        var csv = await client.ExportAuditAsync(new AuditListOptions(OrgId: "org-1", Limit: 20));

        Assert.Equal("http://localhost:3001/v1/projects", handler.Requests[0].Url);
        Assert.Equal("rulebound", handler.Requests[1].Body!["slug"]!.ToString());
        Assert.Equal("http://localhost:3001/v1/audit?org_id=org-1&project_id=proj-1&limit=5", handler.Requests[2].Url);
        Assert.Equal("http://localhost:3001/v1/audit/export?org_id=org-1&limit=20", handler.Requests[3].Url);
        Assert.Equal(0, projects.Total);
        Assert.Equal("org-1", created.OrgId);
        Assert.Equal(1, audit.Total);
        Assert.Contains("rule.created", csv);
    }

    [Fact]
    public async Task ComplianceSyncTokensAnalyticsAndWebhooksAsync()
    {
        var handler = new RecordingHandler(
        [
            new StubResponse(HttpStatusCode.OK, """{"data":{"projectId":"proj-1","currentScore":93,"trend":[{"score":93,"passCount":9,"violatedCount":1,"notCoveredCount":0,"date":"2026-03-08T00:00:00Z"}]}}"""),
            new StubResponse(HttpStatusCode.Created, """{"data":{"id":"snap-1","projectId":"proj-1","score":95,"passCount":10,"violatedCount":0,"notCoveredCount":0,"snapshotAt":"2026-03-08T12:00:00Z"}}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"id":"rule-1","ruleSetId":"set-1","title":"No eval","content":"Avoid eval","category":"security","severity":"error","modality":"must","tags":["security"],"stack":["typescript"],"isActive":true,"version":2,"createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}],"meta":{"total":1,"versionHash":"abc123","syncedAt":"2026-03-08T12:00:00Z"}}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":{"synced":true}}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"id":"token-1","orgId":"org-1","userId":"user-1","name":"CI token","tokenPrefix":"rb_123456","scopes":["read"],"expiresAt":null,"lastUsedAt":null,"createdAt":"2026-03-08T10:00:00Z"}]}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"ruleId":"rule-1","count":4}]}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"id":"wh-1","orgId":"org-1","url":"https://hooks.example.com/rulebound","events":["violation.detected"],"isActive":true,"description":"Production","secretPrefix":"whsec_ab...","createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}]}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":{"success":true,"statusCode":200}}"""),
            new StubResponse(HttpStatusCode.OK, """{"data":[{"id":"delivery-1","endpointId":"wh-1","event":"test","status":"delivered","responseCode":200,"attempts":1,"createdAt":"2026-03-08T10:00:00Z"}]}"""),
        ]);
        using var http = new HttpClient(handler);
        using var client = new RuleboundClient("test-api-key", "http://localhost:3001", http);

        var compliance = await client.GetComplianceAsync("proj-1", since: "2026-03-01T00:00:00Z", limit: 5);
        var snapshot = await client.CreateComplianceSnapshotAsync("proj-1", new ComplianceSnapshotRequest(95, 10, 0, 0));
        var sync = await client.SyncRulesAsync(new SyncOptions(Project: "rulebound", Stack: "typescript", Since: "2026-03-01T00:00:00Z"));
        var ack = await client.AckSyncAsync(new SyncAckRequest("proj-1", "abc123"));
        var tokens = await client.ListTokensAsync("org-1");
        var top = await client.GetTopViolationsAsync(new AnalyticsReadOptions(ProjectId: "proj-1", Limit: 5));
        var endpoints = await client.ListWebhookEndpointsAsync("org-1");
        var tested = await client.TestWebhookEndpointAsync("wh-1");
        var deliveries = await client.ListWebhookDeliveriesAsync("wh-1", 10);

        Assert.Equal("http://localhost:3001/v1/compliance/proj-1?since=2026-03-01T00%3A00%3A00Z&limit=5", handler.Requests[0].Url);
        Assert.Equal("http://localhost:3001/v1/sync?project=rulebound&stack=typescript&since=2026-03-01T00%3A00%3A00Z", handler.Requests[2].Url);
        Assert.Equal("http://localhost:3001/v1/analytics/top-violations?project_id=proj-1&limit=5", handler.Requests[5].Url);
        Assert.Equal("http://localhost:3001/v1/webhooks/endpoints?org_id=org-1", handler.Requests[6].Url);
        Assert.Equal("http://localhost:3001/v1/webhooks/deliveries?endpoint_id=wh-1&limit=10", handler.Requests[8].Url);
        Assert.Equal("proj-1", compliance.ProjectId);
        Assert.Equal(95, snapshot.Score);
        Assert.Equal("abc123", sync.Meta.VersionHash);
        Assert.True(ack.Synced);
        Assert.Equal("rb_123456", tokens[0].TokenPrefix);
        Assert.Equal(4, top[0].Count);
        Assert.Equal("whsec_ab...", endpoints[0].SecretPrefix);
        Assert.True(tested.Success);
        Assert.Equal("delivered", deliveries[0].Status);
    }

    [Fact]
    public async Task RaisesTypedErrorsAsync()
    {
        var handler = new RecordingHandler([new StubResponse(HttpStatusCode.Forbidden, "Forbidden", "text/plain")]);
        using var http = new HttpClient(handler);
        using var client = new RuleboundClient("test-api-key", "http://localhost:3001", http);

        var error = await Assert.ThrowsAsync<RuleboundException>(() => client.ValidateAsync(new ValidationRequest(Plan: "test")));

        Assert.Equal(403, error.StatusCode);
        Assert.Equal("Forbidden", error.Body);
    }
}

file sealed class RecordingHandler(IEnumerable<StubResponse> responses) : HttpMessageHandler
{
    private readonly Queue<StubResponse> _responses = new(responses);

    public List<RecordedRequest> Requests { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Dictionary<string, object?>? body = null;
        if (request.Content is not null)
        {
            var payload = await request.Content.ReadAsStringAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(payload))
            {
                body = JsonSerializer.Deserialize<Dictionary<string, object?>>(payload, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
        }

        Requests.Add(new RecordedRequest(request.RequestUri!.ToString(), body));

        var reply = _responses.Dequeue();
        return new HttpResponseMessage(reply.StatusCode)
        {
            Content = new StringContent(reply.Body, Encoding.UTF8, reply.ContentType)
        };
    }
}

file record StubResponse(HttpStatusCode StatusCode, string Body, string ContentType = "application/json");
file record RecordedRequest(string Url, Dictionary<string, object?>? Body);
