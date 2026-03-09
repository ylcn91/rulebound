using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Rulebound;

public sealed class RuleboundClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _serverUrl;
    private readonly bool _ownsHttpClient;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public RuleboundClient(string apiKey, string serverUrl = "http://localhost:3001", HttpClient? httpClient = null)
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _ownsHttpClient = httpClient is null;
        _http = httpClient ?? new HttpClient();
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        _http.DefaultRequestHeaders.Add("User-Agent", "rulebound-dotnet/0.1.0");
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public Task<ValidationReport> ValidateAsync(ValidationRequest request, CancellationToken ct = default)
        => RequestJsonAsync<ValidationReport>(HttpMethod.Post, "/v1/validate", body: request, ct: ct);

    public Task<ValidationReport> ValidateAsync(
        string code,
        string? language = null,
        string? project = null,
        string? task = null,
        CancellationToken ct = default)
        => ValidateAsync(new ValidationRequest(code, null, language, project, task, null), ct);

    public Task<ValidationReport> ValidatePlanAsync(
        string plan,
        string? task = null,
        string? project = null,
        bool? useLlm = null,
        CancellationToken ct = default)
        => ValidateAsync(new ValidationRequest(null, plan, null, project, task, useLlm), ct);

    public Task<ListResponse<Rule>> ListRulesAsync(RuleListOptions? options = null, CancellationToken ct = default)
        => RequestJsonAsync<ListResponse<Rule>>(HttpMethod.Get, "/v1/rules", query: options?.ToQuery(), ct: ct);

    public async Task<List<Rule>> GetRulesAsync(RuleListOptions? options = null, CancellationToken ct = default)
        => (await ListRulesAsync(options, ct)).Data;

    public async Task<Rule> GetRuleAsync(string ruleId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<Rule>>(HttpMethod.Get, $"/v1/rules/{Uri.EscapeDataString(ruleId)}", ct: ct)).Data;

    public async Task<Rule> CreateRuleAsync(RuleCreateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<Rule>>(HttpMethod.Post, "/v1/rules", body: request, ct: ct)).Data;

    public async Task<Rule> UpdateRuleAsync(string ruleId, RuleUpdateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<Rule>>(HttpMethod.Put, $"/v1/rules/{Uri.EscapeDataString(ruleId)}", body: request, ct: ct)).Data;

    public async Task<DeleteResult> DeleteRuleAsync(string ruleId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<DeleteResult>>(HttpMethod.Delete, $"/v1/rules/{Uri.EscapeDataString(ruleId)}", ct: ct)).Data;

    public Task<ListResponse<Project>> ListProjectsAsync(CancellationToken ct = default)
        => RequestJsonAsync<ListResponse<Project>>(HttpMethod.Get, "/v1/projects", ct: ct);

    public async Task<Project> GetProjectAsync(string projectId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<Project>>(HttpMethod.Get, $"/v1/projects/{Uri.EscapeDataString(projectId)}", ct: ct)).Data;

    public async Task<Project> CreateProjectAsync(ProjectCreateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<Project>>(HttpMethod.Post, "/v1/projects", body: request, ct: ct)).Data;

    public async Task<Project> UpdateProjectAsync(string projectId, ProjectUpdateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<Project>>(HttpMethod.Put, $"/v1/projects/{Uri.EscapeDataString(projectId)}", body: request, ct: ct)).Data;

    public async Task<DeleteResult> DeleteProjectAsync(string projectId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<DeleteResult>>(HttpMethod.Delete, $"/v1/projects/{Uri.EscapeDataString(projectId)}", ct: ct)).Data;

    public Task<ListResponse<AuditEntry>> ListAuditAsync(AuditListOptions? options = null, CancellationToken ct = default)
        => RequestJsonAsync<ListResponse<AuditEntry>>(HttpMethod.Get, "/v1/audit", query: options?.ToQuery(), ct: ct);

    public async Task<List<AuditEntry>> GetAuditAsync(AuditListOptions? options = null, CancellationToken ct = default)
        => (await ListAuditAsync(options, ct)).Data;

    public async Task<AuditEntry> CreateAuditAsync(AuditCreateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<AuditEntry>>(HttpMethod.Post, "/v1/audit", body: request, ct: ct)).Data;

    public Task<string> ExportAuditAsync(AuditListOptions? options = null, CancellationToken ct = default)
        => RequestTextAsync(HttpMethod.Get, "/v1/audit/export", query: options?.ToQuery(), ct: ct);

    public async Task<ComplianceData> GetComplianceAsync(
        string projectId,
        string? since = null,
        int? limit = null,
        CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<ComplianceData>>(
            HttpMethod.Get,
            $"/v1/compliance/{Uri.EscapeDataString(projectId)}",
            query: BuildQuery(("since", since), ("limit", limit?.ToString())),
            ct: ct)).Data;

    public async Task<ComplianceSnapshot> CreateComplianceSnapshotAsync(
        string projectId,
        ComplianceSnapshotRequest request,
        CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<ComplianceSnapshot>>(
            HttpMethod.Post,
            $"/v1/compliance/{Uri.EscapeDataString(projectId)}/snapshot",
            body: request,
            ct: ct)).Data;

    public Task<SyncResponse> SyncRulesAsync(SyncOptions? options = null, CancellationToken ct = default)
        => RequestJsonAsync<SyncResponse>(HttpMethod.Get, "/v1/sync", query: options?.ToQuery(), ct: ct);

    public async Task<SyncAckResult> AckSyncAsync(SyncAckRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<SyncAckResult>>(HttpMethod.Post, "/v1/sync/ack", body: request, ct: ct)).Data;

    public async Task<List<ApiToken>> ListTokensAsync(string? orgId = null, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<List<ApiToken>>>(HttpMethod.Get, "/v1/tokens", query: BuildQuery(("org_id", orgId)), ct: ct)).Data;

    public async Task<CreatedApiToken> CreateTokenAsync(TokenCreateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<CreatedApiToken>>(HttpMethod.Post, "/v1/tokens", body: request, ct: ct)).Data;

    public async Task<DeleteResult> DeleteTokenAsync(string tokenId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<DeleteResult>>(HttpMethod.Delete, $"/v1/tokens/{Uri.EscapeDataString(tokenId)}", ct: ct)).Data;

    public async Task<List<TopViolation>> GetTopViolationsAsync(AnalyticsReadOptions? options = null, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<List<TopViolation>>>(
            HttpMethod.Get,
            "/v1/analytics/top-violations",
            query: options?.ToQuery(),
            ct: ct)).Data;

    public async Task<AnalyticsTrend> GetAnalyticsTrendAsync(
        string projectId,
        string? interval = null,
        int? limit = null,
        CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<AnalyticsTrend>>(
            HttpMethod.Get,
            "/v1/analytics/trend",
            query: BuildQuery(("project_id", projectId), ("interval", interval), ("limit", limit?.ToString())),
            ct: ct)).Data;

    public async Task<List<AnalyticsCategoryBreakdown>> GetCategoryBreakdownAsync(
        string? projectId = null,
        string? since = null,
        CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<List<AnalyticsCategoryBreakdown>>>(
            HttpMethod.Get,
            "/v1/analytics/category-breakdown",
            query: BuildQuery(("project_id", projectId), ("since", since)),
            ct: ct)).Data;

    public async Task<List<AnalyticsSourceStat>> GetSourceStatsAsync(
        string? projectId = null,
        string? since = null,
        CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<List<AnalyticsSourceStat>>>(
            HttpMethod.Get,
            "/v1/analytics/source-stats",
            query: BuildQuery(("project_id", projectId), ("since", since)),
            ct: ct)).Data;

    public async Task<List<WebhookEndpoint>> ListWebhookEndpointsAsync(string? orgId = null, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<List<WebhookEndpoint>>>(
            HttpMethod.Get,
            "/v1/webhooks/endpoints",
            query: BuildQuery(("org_id", orgId)),
            ct: ct)).Data;

    public async Task<WebhookEndpoint> GetWebhookEndpointAsync(string endpointId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<WebhookEndpoint>>(HttpMethod.Get, $"/v1/webhooks/endpoints/{Uri.EscapeDataString(endpointId)}", ct: ct)).Data;

    public async Task<WebhookEndpoint> CreateWebhookEndpointAsync(WebhookEndpointCreateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<WebhookEndpoint>>(HttpMethod.Post, "/v1/webhooks/endpoints", body: request, ct: ct)).Data;

    public async Task<WebhookEndpoint> UpdateWebhookEndpointAsync(string endpointId, WebhookEndpointUpdateRequest request, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<WebhookEndpoint>>(HttpMethod.Put, $"/v1/webhooks/endpoints/{Uri.EscapeDataString(endpointId)}", body: request, ct: ct)).Data;

    public async Task<DeleteResult> DeleteWebhookEndpointAsync(string endpointId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<DeleteResult>>(HttpMethod.Delete, $"/v1/webhooks/endpoints/{Uri.EscapeDataString(endpointId)}", ct: ct)).Data;

    public async Task<DeliveryResult> TestWebhookEndpointAsync(string endpointId, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<DeliveryResult>>(HttpMethod.Post, $"/v1/webhooks/endpoints/{Uri.EscapeDataString(endpointId)}/test", ct: ct)).Data;

    public async Task<List<WebhookDelivery>> ListWebhookDeliveriesAsync(string? endpointId = null, int? limit = null, CancellationToken ct = default)
        => (await RequestJsonAsync<DataEnvelope<List<WebhookDelivery>>>(
            HttpMethod.Get,
            "/v1/webhooks/deliveries",
            query: BuildQuery(("endpoint_id", endpointId), ("limit", limit?.ToString())),
            ct: ct)).Data;

    private async Task<T> RequestJsonAsync<T>(
        HttpMethod method,
        string path,
        object? body = null,
        Dictionary<string, string?>? query = null,
        CancellationToken ct = default)
    {
        var payload = await SendAsync(method, path, body, query, ct);
        return JsonSerializer.Deserialize<T>(payload, JsonOpts)
            ?? throw new RuleboundException("Failed to parse JSON response");
    }

    private async Task<string> RequestTextAsync(
        HttpMethod method,
        string path,
        object? body = null,
        Dictionary<string, string?>? query = null,
        CancellationToken ct = default)
    {
        return await SendAsync(method, path, body, query, ct);
    }

    private async Task<string> SendAsync(
        HttpMethod method,
        string path,
        object? body,
        Dictionary<string, string?>? query,
        CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, $"{_serverUrl}{path}{ToQueryString(query)}");
        if (body is not null)
        {
            request.Content = new StringContent(JsonSerializer.Serialize(body, JsonOpts), Encoding.UTF8, "application/json");
        }

        using var response = await _http.SendAsync(request, ct);
        var payload = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            throw new RuleboundException($"API error {(int)response.StatusCode}", (int)response.StatusCode, payload);
        }

        return payload;
    }

    private static Dictionary<string, string?> BuildQuery(params (string key, string? value)[] pairs)
    {
        var query = new Dictionary<string, string?>();
        foreach (var (key, value) in pairs)
        {
            if (value is not null)
            {
                query[key] = value;
            }
        }

        return query;
    }

    private static string ToQueryString(Dictionary<string, string?>? query)
    {
        if (query is null || query.Count == 0)
        {
            return string.Empty;
        }

        var parts = query
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
            .Select(pair => $"{pair.Key}={Uri.EscapeDataString(pair.Value!)}")
            .ToArray();

        return parts.Length == 0 ? string.Empty : $"?{string.Join("&", parts)}";
    }

    public void Dispose()
    {
        if (_ownsHttpClient)
        {
            _http.Dispose();
        }
    }
}

public sealed class RuleboundException : Exception
{
    public RuleboundException(string message, int? statusCode = null, string? body = null) : base(body is null ? message : $"{message}: {body}")
    {
        StatusCode = statusCode;
        Body = body;
    }

    public int? StatusCode { get; }
    public string? Body { get; }
}

public record DataEnvelope<T>(T Data);
public record ListResponse<T>(List<T> Data, int? Total);
public record DeleteResult(bool Deleted);

public record Rule(
    string Id,
    string RuleSetId,
    string Title,
    string Content,
    string Category,
    string Severity,
    string Modality,
    List<string> Tags,
    List<string> Stack,
    bool IsActive,
    int Version,
    string CreatedAt,
    string UpdatedAt);

public record RuleCreateRequest(
    string Title,
    string Content,
    string Category,
    string? Severity = null,
    string? Modality = null,
    List<string>? Tags = null,
    List<string>? Stack = null,
    string? RuleSetId = null);

public record RuleUpdateRequest(
    string? Title = null,
    string? Content = null,
    string? Category = null,
    string? Severity = null,
    string? Modality = null,
    List<string>? Tags = null,
    List<string>? Stack = null,
    bool? IsActive = null,
    string? ChangeNote = null);

public record RuleListOptions(
    string? Stack = null,
    string? Category = null,
    string? Tag = null,
    string? Query = null,
    int? Limit = null,
    int? Offset = null)
{
    public Dictionary<string, string?> ToQuery() => new()
    {
        ["stack"] = Stack,
        ["category"] = Category,
        ["tag"] = Tag,
        ["q"] = Query,
        ["limit"] = Limit?.ToString(),
        ["offset"] = Offset?.ToString(),
    };
}

public record Project(
    string Id,
    string OrgId,
    string Name,
    string Slug,
    string? RepoUrl,
    List<string> Stack,
    string CreatedAt,
    string UpdatedAt);

public record ProjectCreateRequest(string Name, string Slug, string? RepoUrl = null, List<string>? Stack = null);
public record ProjectUpdateRequest(string? Name = null, string? Slug = null, string? RepoUrl = null, List<string>? Stack = null);

public record ValidationRequest(
    string? Code = null,
    string? Plan = null,
    string? Language = null,
    string? Project = null,
    string? Task = null,
    bool? UseLlm = null);

public record ValidationResult(
    string RuleId,
    string RuleTitle,
    string Severity,
    string Modality,
    string Status,
    string Reason,
    string? SuggestedFix);

public record ValidationSummary([property: JsonPropertyName("pass")] int Pass, int Violated, int NotCovered);

public record ValidationReport(
    string Task,
    int RulesMatched,
    int RulesTotal,
    List<ValidationResult> Results,
    ValidationSummary Summary,
    string Status)
{
    public bool Passed => Status == "PASSED";
    public bool Blocked => Status == "FAILED";
    public IEnumerable<ValidationResult> Violations => Results.Where(result => result.Status == "VIOLATED");
}

public record AuditEntry(
    string Id,
    string OrgId,
    string? ProjectId,
    string? UserId,
    string Action,
    string? RuleId,
    string Status,
    Dictionary<string, object?>? Metadata,
    string CreatedAt);

public record AuditCreateRequest(
    string OrgId,
    string? ProjectId,
    string? UserId,
    string Action,
    string? RuleId,
    string Status,
    Dictionary<string, object?>? Metadata = null);

public record AuditListOptions(
    string? OrgId = null,
    string? ProjectId = null,
    string? Action = null,
    string? Since = null,
    string? Until = null,
    int? Limit = null,
    int? Offset = null)
{
    public Dictionary<string, string?> ToQuery() => new()
    {
        ["org_id"] = OrgId,
        ["project_id"] = ProjectId,
        ["action"] = Action,
        ["since"] = Since,
        ["until"] = Until,
        ["limit"] = Limit?.ToString(),
        ["offset"] = Offset?.ToString(),
    };
}

public record ComplianceTrend(int Score, int PassCount, int ViolatedCount, int NotCoveredCount, string Date);
public record ComplianceData(string ProjectId, int? CurrentScore, List<ComplianceTrend> Trend);
public record ComplianceSnapshot(string Id, string ProjectId, int Score, int PassCount, int ViolatedCount, int NotCoveredCount, string SnapshotAt);
public record ComplianceSnapshotRequest(int Score, int? PassCount = null, int? ViolatedCount = null, int? NotCoveredCount = null);

public record SyncMeta(int Total, string VersionHash, string SyncedAt);
public record SyncResponse(List<Rule> Data, SyncMeta Meta);
public record SyncOptions(string? Project = null, string? Stack = null, string? Since = null)
{
    public Dictionary<string, string?> ToQuery() => new()
    {
        ["project"] = Project,
        ["stack"] = Stack,
        ["since"] = Since,
    };
}

public record SyncAckRequest(string ProjectId, string RuleVersionHash);
public record SyncAckResult(bool Synced);

public record ApiToken(
    string Id,
    string OrgId,
    string UserId,
    string Name,
    string TokenPrefix,
    List<string> Scopes,
    string? ExpiresAt,
    string? LastUsedAt,
    string CreatedAt);

public record TokenCreateRequest(string OrgId, string UserId, string Name, List<string>? Scopes = null, string? ExpiresAt = null);
public record CreatedApiToken(string Id, string Name, string Token, string Prefix, List<string> Scopes, string? ExpiresAt, string CreatedAt);

public record AnalyticsReadOptions(string? ProjectId = null, string? Since = null, int? Limit = null)
{
    public Dictionary<string, string?> ToQuery() => new()
    {
        ["project_id"] = ProjectId,
        ["since"] = Since,
        ["limit"] = Limit?.ToString(),
    };
}

public record TopViolation(string? RuleId, int Count);
public record AnalyticsTrend(string ProjectId, string Interval, List<ComplianceTrend> Trend);
public record AnalyticsCategoryBreakdown(string Action, int Count);
public record AnalyticsSourceStat(string Status, int Count);

public record WebhookEndpoint(
    string Id,
    string OrgId,
    string Url,
    List<string> Events,
    bool IsActive,
    string? Description,
    string CreatedAt,
    string UpdatedAt,
    string? Secret,
    string? SecretPrefix);

public record WebhookEndpointCreateRequest(string OrgId, string Url, string Secret, List<string> Events, string? Description = null);
public record WebhookEndpointUpdateRequest(string? Url = null, string? Secret = null, List<string>? Events = null, string? Description = null, bool? IsActive = null);

public record WebhookDelivery(
    string Id,
    string EndpointId,
    string Event,
    Dictionary<string, object?>? Payload,
    string Status,
    int? ResponseCode,
    string? ResponseBody,
    int Attempts,
    string? NextRetryAt,
    string CreatedAt);

public record DeliveryResult(bool Success, int? StatusCode, string? Error);
