using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Rulebound;

public sealed class RuleboundClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly string _serverUrl;
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public RuleboundClient(string apiKey, string serverUrl = "http://localhost:3001")
    {
        _serverUrl = serverUrl.TrimEnd('/');
        _http = new HttpClient();
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        _http.DefaultRequestHeaders.Add("User-Agent", "rulebound-dotnet/0.1.0");
        _http.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<ValidationReport> ValidateAsync(
        string code,
        string? language = null,
        string? project = null,
        string? task = null,
        CancellationToken ct = default)
    {
        var payload = new { code, language, project, task };
        var resp = await PostAsync("/v1/validate", payload, ct);
        return JsonSerializer.Deserialize<ValidationReport>(resp, JsonOpts)
            ?? throw new RuleboundException("Failed to parse validation response");
    }

    public async Task<ValidationReport> ValidatePlanAsync(
        string plan,
        string? task = null,
        CancellationToken ct = default)
    {
        var payload = new { plan, task };
        var resp = await PostAsync("/v1/validate", payload, ct);
        return JsonSerializer.Deserialize<ValidationReport>(resp, JsonOpts)
            ?? throw new RuleboundException("Failed to parse validation response");
    }

    public async Task<List<Rule>> GetRulesAsync(
        string? stack = null,
        string? category = null,
        string? tag = null,
        CancellationToken ct = default)
    {
        var query = BuildQuery(("stack", stack), ("category", category), ("tag", tag));
        var resp = await GetAsync($"/v1/rules{query}", ct);
        var wrapper = JsonSerializer.Deserialize<DataWrapper<List<Rule>>>(resp, JsonOpts);
        return wrapper?.Data ?? [];
    }

    public async Task<SyncResponse> SyncRulesAsync(
        string? project = null,
        string? stack = null,
        string? since = null,
        CancellationToken ct = default)
    {
        var query = BuildQuery(("project", project), ("stack", stack), ("since", since));
        var resp = await GetAsync($"/v1/sync{query}", ct);
        return JsonSerializer.Deserialize<SyncResponse>(resp, JsonOpts)
            ?? throw new RuleboundException("Failed to parse sync response");
    }

    public async Task<ComplianceData> GetComplianceAsync(string projectId, CancellationToken ct = default)
    {
        var resp = await GetAsync($"/v1/compliance/{projectId}", ct);
        var wrapper = JsonSerializer.Deserialize<DataWrapper<ComplianceData>>(resp, JsonOpts);
        return wrapper?.Data ?? throw new RuleboundException("Failed to parse compliance response");
    }

    private async Task<string> PostAsync(string path, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, JsonOpts);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await _http.PostAsync($"{_serverUrl}{path}", content, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new RuleboundException($"API error {(int)resp.StatusCode}: {body}");
        return body;
    }

    private async Task<string> GetAsync(string path, CancellationToken ct)
    {
        var resp = await _http.GetAsync($"{_serverUrl}{path}", ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
            throw new RuleboundException($"API error {(int)resp.StatusCode}: {body}");
        return body;
    }

    private static string BuildQuery(params (string key, string? value)[] pairs)
    {
        var parts = pairs.Where(p => p.value != null).Select(p => $"{p.key}={Uri.EscapeDataString(p.value!)}");
        var q = string.Join("&", parts);
        return q.Length > 0 ? $"?{q}" : "";
    }

    public void Dispose() => _http.Dispose();
}

public class RuleboundException(string message) : Exception(message);

public record Rule(
    string Id, string Title, string Content, string Category,
    string Severity, string Modality, List<string> Tags, List<string> Stack, int Version);

public record ValidationResult(
    string RuleId, string RuleTitle, string Severity, string Modality,
    string Status, string Reason, string? SuggestedFix);

public record ValidationSummary(int Pass, int Violated, int NotCovered);

public record ValidationReport(
    string Task, int RulesMatched, int RulesTotal,
    List<ValidationResult> Results, ValidationSummary Summary, string Status)
{
    public bool Passed => Status == "PASSED";
    public bool Blocked => Status == "FAILED";
    public IEnumerable<ValidationResult> Violations => Results.Where(r => r.Status == "VIOLATED");
}

public record SyncResponse(List<Rule> Data, SyncMeta Meta);
public record SyncMeta(int Total, string VersionHash, string SyncedAt);
public record ComplianceData(string ProjectId, int? CurrentScore, List<ComplianceTrend> Trend);
public record ComplianceTrend(int Score, int PassCount, int ViolatedCount, int NotCoveredCount, DateTime Date);
internal record DataWrapper<T>(T Data);
