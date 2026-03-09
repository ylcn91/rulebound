package rulebound

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type mockedResponse struct {
	status int
	body   string
}

type recordedRequest struct {
	Method string
	Path   string
	Body   map[string]any
}

func newMockServer(t *testing.T, responses []mockedResponse) (*httptest.Server, *[]recordedRequest) {
	t.Helper()

	requests := make([]recordedRequest, 0, len(responses))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if r.Body != nil {
			_ = json.NewDecoder(r.Body).Decode(&body)
		}

		requests = append(requests, recordedRequest{
			Method: r.Method,
			Path:   r.URL.RequestURI(),
			Body:   body,
		})

		reply := responses[0]
		responses = responses[1:]
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(reply.status)
		_, _ = w.Write([]byte(reply.body))
	}))

	return server, &requests
}

func TestValidateAndRules(t *testing.T) {
	server, requests := newMockServer(t, []mockedResponse{
		{status: 200, body: `{"task":"Validate auth flow","rulesMatched":1,"rulesTotal":1,"results":[],"summary":{"pass":1,"violated":0,"notCovered":0},"status":"PASSED"}`},
		{status: 200, body: `{"data":[{"id":"rule-1","ruleSetId":"set-1","title":"No eval","content":"Avoid eval","category":"security","severity":"error","modality":"must","tags":["security"],"stack":["typescript"],"isActive":true,"version":2,"createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}],"total":1}`},
		{status: 200, body: `{"data":{"deleted":true}}`},
	})
	defer server.Close()

	client := NewClient("test-api-key", server.URL)
	useLLM := true
	report, err := client.Validate(ValidationRequest{Plan: "Implement OAuth callback", Project: "rulebound", UseLLM: &useLLM})
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	rules, err := client.ListRules(RuleListOptions{Stack: "typescript", Query: "eval", Limit: 10})
	if err != nil {
		t.Fatalf("list rules failed: %v", err)
	}
	deleted, err := client.DeleteRule("rule-1")
	if err != nil {
		t.Fatalf("delete rule failed: %v", err)
	}

	if (*requests)[0].Path != "/v1/validate" {
		t.Fatalf("unexpected validate path: %s", (*requests)[0].Path)
	}
	if (*requests)[0].Body["plan"] != "Implement OAuth callback" {
		t.Fatalf("unexpected validate body: %+v", (*requests)[0].Body)
	}
	if (*requests)[1].Path != "/v1/rules?limit=10&q=eval&stack=typescript" {
		t.Fatalf("unexpected rules path: %s", (*requests)[1].Path)
	}
	if report.Status != "PASSED" || rules.Total != 1 || !deleted.Deleted {
		t.Fatalf("unexpected parsed response: %+v %+v %+v", report, rules, deleted)
	}
}

func TestProjectsAuditAndExport(t *testing.T) {
	server, requests := newMockServer(t, []mockedResponse{
		{status: 200, body: `{"data":[],"total":0}`},
		{status: 201, body: `{"data":{"id":"proj-1","orgId":"org-1","name":"Rulebound","slug":"rulebound","repoUrl":"https://github.com/rulebound/rulebound","stack":["typescript"],"createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}}`},
		{status: 200, body: `{"data":[{"id":"audit-1","orgId":"org-1","projectId":"proj-1","userId":"user-1","action":"rule.created","ruleId":"rule-1","status":"SUCCESS","metadata":{"actor":"sdk-test"},"createdAt":"2026-03-08T10:00:00Z"}],"total":1}`},
		{status: 200, body: "id,action\n1,rule.created\n"},
	})
	defer server.Close()

	client := NewClient("test-api-key", server.URL)
	projects, err := client.ListProjects()
	if err != nil {
		t.Fatalf("list projects failed: %v", err)
	}
	repoURL := "https://github.com/rulebound/rulebound"
	project, err := client.CreateProject(ProjectCreateRequest{Name: "Rulebound", Slug: "rulebound", RepoURL: &repoURL, Stack: []string{"typescript"}})
	if err != nil {
		t.Fatalf("create project failed: %v", err)
	}
	audit, err := client.ListAudit(AuditListOptions{OrgID: "org-1", ProjectID: "proj-1", Limit: 5})
	if err != nil {
		t.Fatalf("list audit failed: %v", err)
	}
	csv, err := client.ExportAudit(AuditListOptions{OrgID: "org-1", Limit: 20})
	if err != nil {
		t.Fatalf("export audit failed: %v", err)
	}

	if (*requests)[0].Path != "/v1/projects" {
		t.Fatalf("unexpected projects path: %s", (*requests)[0].Path)
	}
	if (*requests)[1].Body["slug"] != "rulebound" {
		t.Fatalf("unexpected project body: %+v", (*requests)[1].Body)
	}
	if (*requests)[2].Path != "/v1/audit?limit=5&org_id=org-1&project_id=proj-1" {
		t.Fatalf("unexpected audit path: %s", (*requests)[2].Path)
	}
	if (*requests)[3].Path != "/v1/audit/export?limit=20&org_id=org-1" {
		t.Fatalf("unexpected export path: %s", (*requests)[3].Path)
	}
	if projects.Total != 0 || project.OrgID != "org-1" || audit.Total != 1 || csv == "" {
		t.Fatalf("unexpected parsed response")
	}
}

func TestComplianceSyncTokensAnalyticsAndWebhooks(t *testing.T) {
	server, requests := newMockServer(t, []mockedResponse{
		{status: 200, body: `{"data":{"projectId":"proj-1","currentScore":93,"trend":[{"score":93,"passCount":9,"violatedCount":1,"notCoveredCount":0,"date":"2026-03-08T00:00:00Z"}]}}`},
		{status: 201, body: `{"data":{"id":"snap-1","projectId":"proj-1","score":95,"passCount":10,"violatedCount":0,"notCoveredCount":0,"snapshotAt":"2026-03-08T12:00:00Z"}}`},
		{status: 200, body: `{"data":[{"id":"rule-1","ruleSetId":"set-1","title":"No eval","content":"Avoid eval","category":"security","severity":"error","modality":"must","tags":["security"],"stack":["typescript"],"isActive":true,"version":2,"createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}],"meta":{"total":1,"versionHash":"abc123","syncedAt":"2026-03-08T12:00:00Z"}}`},
		{status: 200, body: `{"data":{"synced":true}}`},
		{status: 200, body: `{"data":[{"id":"token-1","orgId":"org-1","userId":"user-1","name":"CI token","tokenPrefix":"rb_123456","scopes":["read"],"expiresAt":null,"lastUsedAt":null,"createdAt":"2026-03-08T10:00:00Z"}]}`},
		{status: 200, body: `{"data":[{"ruleId":"rule-1","count":4}]}`},
		{status: 200, body: `{"data":[{"id":"wh-1","orgId":"org-1","url":"https://hooks.example.com/rulebound","events":["violation.detected"],"isActive":true,"description":"Production","secretPrefix":"whsec_ab...","createdAt":"2026-03-08T10:00:00Z","updatedAt":"2026-03-08T10:00:00Z"}]}`},
		{status: 200, body: `{"data":{"success":true,"statusCode":200}}`},
		{status: 200, body: `{"data":[{"id":"delivery-1","endpointId":"wh-1","event":"test","status":"delivered","responseCode":200,"attempts":1,"createdAt":"2026-03-08T10:00:00Z"}]}`},
	})
	defer server.Close()

	client := NewClient("test-api-key", server.URL)
	compliance, err := client.GetCompliance("proj-1", "2026-03-01T00:00:00Z", 5)
	if err != nil {
		t.Fatalf("get compliance failed: %v", err)
	}
	snapshot, err := client.CreateComplianceSnapshot("proj-1", ComplianceSnapshotRequest{Score: 95, PassCount: 10})
	if err != nil {
		t.Fatalf("create snapshot failed: %v", err)
	}
	syncResponse, err := client.SyncRules(SyncOptions{Project: "rulebound", Stack: "typescript", Since: "2026-03-01T00:00:00Z"})
	if err != nil {
		t.Fatalf("sync rules failed: %v", err)
	}
	ack, err := client.AckSync(SyncAckRequest{ProjectID: "proj-1", RuleVersionHash: "abc123"})
	if err != nil {
		t.Fatalf("ack sync failed: %v", err)
	}
	tokens, err := client.ListTokens("org-1")
	if err != nil {
		t.Fatalf("list tokens failed: %v", err)
	}
	top, err := client.GetTopViolations(AnalyticsReadOptions{ProjectID: "proj-1", Limit: 5})
	if err != nil {
		t.Fatalf("get top violations failed: %v", err)
	}
	endpoints, err := client.ListWebhookEndpoints(WebhookEndpointListOptions{OrgID: "org-1"})
	if err != nil {
		t.Fatalf("list endpoints failed: %v", err)
	}
	testResult, err := client.TestWebhookEndpoint("wh-1")
	if err != nil {
		t.Fatalf("test endpoint failed: %v", err)
	}
	deliveries, err := client.ListWebhookDeliveries(WebhookDeliveryListOptions{EndpointID: "wh-1", Limit: 10})
	if err != nil {
		t.Fatalf("list deliveries failed: %v", err)
	}

	if (*requests)[0].Path != "/v1/compliance/proj-1?limit=5&since=2026-03-01T00%3A00%3A00Z" {
		t.Fatalf("unexpected compliance path: %s", (*requests)[0].Path)
	}
	if (*requests)[2].Path != "/v1/sync?project=rulebound&since=2026-03-01T00%3A00%3A00Z&stack=typescript" {
		t.Fatalf("unexpected sync path: %s", (*requests)[2].Path)
	}
	if (*requests)[5].Path != "/v1/analytics/top-violations?limit=5&project_id=proj-1" {
		t.Fatalf("unexpected analytics path: %s", (*requests)[5].Path)
	}
	if (*requests)[6].Path != "/v1/webhooks/endpoints?org_id=org-1" {
		t.Fatalf("unexpected endpoints path: %s", (*requests)[6].Path)
	}
	if (*requests)[8].Path != "/v1/webhooks/deliveries?endpoint_id=wh-1&limit=10" {
		t.Fatalf("unexpected deliveries path: %s", (*requests)[8].Path)
	}
	if compliance.ProjectID != "proj-1" || snapshot.Score != 95 || syncResponse.Meta.VersionHash != "abc123" || !ack.Synced || tokens[0].TokenPrefix != "rb_123456" || top[0].Count != 4 || endpoints[0].SecretPrefix == nil || !testResult.Success || deliveries[0].Status != "delivered" {
		t.Fatalf("unexpected parsed response")
	}
}

func TestAPIError(t *testing.T) {
	server, _ := newMockServer(t, []mockedResponse{
		{status: 403, body: "Forbidden"},
	})
	defer server.Close()

	client := NewClient("test-api-key", server.URL)
	_, err := client.Validate(ValidationRequest{Plan: "test"})
	if err == nil {
		t.Fatal("expected error")
	}

	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("unexpected error type: %T", err)
	}
	if apiErr.StatusCode != 403 || apiErr.Body != "Forbidden" {
		t.Fatalf("unexpected api error: %+v", apiErr)
	}
}
