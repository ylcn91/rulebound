package rulebound

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	serverURL  string
	apiKey     string
	httpClient *http.Client
}

type ClientOption func(*Client)

func WithTimeout(d time.Duration) ClientOption {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

func WithHTTPClient(httpClient *http.Client) ClientOption {
	return func(c *Client) {
		c.httpClient = httpClient
	}
}

func NewClient(apiKey, serverURL string, opts ...ClientOption) *Client {
	c := &Client{
		serverURL: strings.TrimRight(serverURL, "/"),
		apiKey:    apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Body)
}

type DataResponse[T any] struct {
	Data T `json:"data"`
}

type ListResponse[T any] struct {
	Data  []T `json:"data"`
	Total int `json:"total,omitempty"`
}

type DeleteResult struct {
	Deleted bool `json:"deleted"`
}

type Rule struct {
	ID        string   `json:"id"`
	RuleSetID string   `json:"ruleSetId"`
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Category  string   `json:"category"`
	Severity  string   `json:"severity"`
	Modality  string   `json:"modality"`
	Tags      []string `json:"tags"`
	Stack     []string `json:"stack"`
	IsActive  bool     `json:"isActive"`
	Version   int      `json:"version"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

type RuleCreateRequest struct {
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Category  string   `json:"category"`
	Severity  string   `json:"severity,omitempty"`
	Modality  string   `json:"modality,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Stack     []string `json:"stack,omitempty"`
	RuleSetID string   `json:"ruleSetId,omitempty"`
}

type RuleUpdateRequest struct {
	Title      string   `json:"title,omitempty"`
	Content    string   `json:"content,omitempty"`
	Category   string   `json:"category,omitempty"`
	Severity   string   `json:"severity,omitempty"`
	Modality   string   `json:"modality,omitempty"`
	Tags       []string `json:"tags,omitempty"`
	Stack      []string `json:"stack,omitempty"`
	IsActive   *bool    `json:"isActive,omitempty"`
	ChangeNote string   `json:"changeNote,omitempty"`
}

type RuleListOptions struct {
	Stack    string
	Category string
	Tag      string
	Query    string
	Limit    int
	Offset   int
}

type Project struct {
	ID        string   `json:"id"`
	OrgID     string   `json:"orgId"`
	Name      string   `json:"name"`
	Slug      string   `json:"slug"`
	RepoURL   *string  `json:"repoUrl"`
	Stack     []string `json:"stack"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

type ProjectCreateRequest struct {
	Name    string   `json:"name"`
	Slug    string   `json:"slug"`
	RepoURL *string  `json:"repoUrl,omitempty"`
	Stack   []string `json:"stack,omitempty"`
}

type ProjectUpdateRequest struct {
	Name    string   `json:"name,omitempty"`
	Slug    string   `json:"slug,omitempty"`
	RepoURL *string  `json:"repoUrl,omitempty"`
	Stack   []string `json:"stack,omitempty"`
}

type ValidationRequest struct {
	Code     string `json:"code,omitempty"`
	Plan     string `json:"plan,omitempty"`
	Language string `json:"language,omitempty"`
	Project  string `json:"project,omitempty"`
	Task     string `json:"task,omitempty"`
	UseLLM   *bool  `json:"useLlm,omitempty"`
}

type ValidationResult struct {
	RuleID       string `json:"ruleId"`
	RuleTitle    string `json:"ruleTitle"`
	Severity     string `json:"severity"`
	Modality     string `json:"modality"`
	Status       string `json:"status"`
	Reason       string `json:"reason"`
	SuggestedFix string `json:"suggestedFix,omitempty"`
}

type ValidationSummary struct {
	Pass       int `json:"pass"`
	Violated   int `json:"violated"`
	NotCovered int `json:"notCovered"`
}

type ValidationReport struct {
	Task         string             `json:"task"`
	RulesMatched int                `json:"rulesMatched"`
	RulesTotal   int                `json:"rulesTotal"`
	Results      []ValidationResult `json:"results"`
	Summary      ValidationSummary  `json:"summary"`
	Status       string             `json:"status"`
}

func (r *ValidationReport) Passed() bool {
	return r.Status == "PASSED"
}

func (r *ValidationReport) Blocked() bool {
	return r.Status == "FAILED"
}

func (r *ValidationReport) Violations() []ValidationResult {
	violations := make([]ValidationResult, 0)
	for _, result := range r.Results {
		if result.Status == "VIOLATED" {
			violations = append(violations, result)
		}
	}
	return violations
}

type AuditEntry struct {
	ID        string                 `json:"id"`
	OrgID     string                 `json:"orgId"`
	ProjectID *string                `json:"projectId"`
	UserID    *string                `json:"userId"`
	Action    string                 `json:"action"`
	RuleID    *string                `json:"ruleId"`
	Status    string                 `json:"status"`
	Metadata  map[string]interface{} `json:"metadata"`
	CreatedAt string                 `json:"createdAt"`
}

type AuditCreateRequest struct {
	OrgID     string                 `json:"orgId"`
	ProjectID string                 `json:"projectId,omitempty"`
	UserID    string                 `json:"userId,omitempty"`
	Action    string                 `json:"action"`
	RuleID    string                 `json:"ruleId,omitempty"`
	Status    string                 `json:"status"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type AuditListOptions struct {
	OrgID     string
	ProjectID string
	Action    string
	Since     string
	Until     string
	Limit     int
	Offset    int
}

type ComplianceTrend struct {
	Score           int    `json:"score"`
	PassCount       int    `json:"passCount"`
	ViolatedCount   int    `json:"violatedCount"`
	NotCoveredCount int    `json:"notCoveredCount"`
	Date            string `json:"date"`
}

type ComplianceData struct {
	ProjectID    string            `json:"projectId"`
	CurrentScore *int              `json:"currentScore"`
	Trend        []ComplianceTrend `json:"trend"`
}

type ComplianceSnapshot struct {
	ID              string `json:"id"`
	ProjectID       string `json:"projectId"`
	Score           int    `json:"score"`
	PassCount       int    `json:"passCount"`
	ViolatedCount   int    `json:"violatedCount"`
	NotCoveredCount int    `json:"notCoveredCount"`
	SnapshotAt      string `json:"snapshotAt"`
}

type ComplianceSnapshotRequest struct {
	Score           int `json:"score"`
	PassCount       int `json:"passCount,omitempty"`
	ViolatedCount   int `json:"violatedCount,omitempty"`
	NotCoveredCount int `json:"notCoveredCount,omitempty"`
}

type SyncMeta struct {
	Total       int    `json:"total"`
	VersionHash string `json:"versionHash"`
	SyncedAt    string `json:"syncedAt"`
}

type SyncResponse struct {
	Data []Rule   `json:"data"`
	Meta SyncMeta `json:"meta"`
}

type SyncOptions struct {
	Project string
	Stack   string
	Since   string
}

type SyncAckRequest struct {
	ProjectID       string `json:"projectId"`
	RuleVersionHash string `json:"ruleVersionHash"`
}

type SyncAckResult struct {
	Synced bool `json:"synced"`
}

type APIToken struct {
	ID          string   `json:"id"`
	OrgID       string   `json:"orgId"`
	UserID      string   `json:"userId"`
	Name        string   `json:"name"`
	TokenPrefix string   `json:"tokenPrefix"`
	Scopes      []string `json:"scopes"`
	ExpiresAt   *string  `json:"expiresAt"`
	LastUsedAt  *string  `json:"lastUsedAt"`
	CreatedAt   string   `json:"createdAt"`
}

type TokenCreateRequest struct {
	OrgID     string   `json:"orgId"`
	UserID    string   `json:"userId"`
	Name      string   `json:"name"`
	Scopes    []string `json:"scopes,omitempty"`
	ExpiresAt string   `json:"expiresAt,omitempty"`
}

type CreatedAPIToken struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Token     string   `json:"token"`
	Prefix    string   `json:"prefix"`
	Scopes    []string `json:"scopes"`
	ExpiresAt *string  `json:"expiresAt"`
	CreatedAt string   `json:"createdAt"`
}

type AnalyticsReadOptions struct {
	ProjectID string
	Since     string
	Limit     int
}

type TopViolation struct {
	RuleID *string `json:"ruleId"`
	Count  int     `json:"count"`
}

type AnalyticsTrend struct {
	ProjectID string            `json:"projectId"`
	Interval  string            `json:"interval"`
	Trend     []ComplianceTrend `json:"trend"`
}

type AnalyticsCategoryBreakdown struct {
	Action string `json:"action"`
	Count  int    `json:"count"`
}

type AnalyticsSourceStat struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type WebhookEndpoint struct {
	ID           string   `json:"id"`
	OrgID        string   `json:"orgId"`
	URL          string   `json:"url"`
	Events       []string `json:"events"`
	IsActive     bool     `json:"isActive"`
	Description  *string  `json:"description"`
	CreatedAt    string   `json:"createdAt"`
	UpdatedAt    string   `json:"updatedAt"`
	Secret       *string  `json:"secret"`
	SecretPrefix *string  `json:"secretPrefix"`
}

type WebhookEndpointCreateRequest struct {
	OrgID       string   `json:"orgId"`
	URL         string   `json:"url"`
	Secret      string   `json:"secret"`
	Events      []string `json:"events"`
	Description string   `json:"description,omitempty"`
}

type WebhookEndpointUpdateRequest struct {
	URL         string   `json:"url,omitempty"`
	Secret      string   `json:"secret,omitempty"`
	Events      []string `json:"events,omitempty"`
	Description string   `json:"description,omitempty"`
	IsActive    *bool    `json:"isActive,omitempty"`
}

type WebhookDelivery struct {
	ID           string                 `json:"id"`
	EndpointID   string                 `json:"endpointId"`
	Event        string                 `json:"event"`
	Payload      map[string]interface{} `json:"payload"`
	Status       string                 `json:"status"`
	ResponseCode *int                   `json:"responseCode"`
	ResponseBody *string                `json:"responseBody"`
	Attempts     int                    `json:"attempts"`
	NextRetryAt  *string                `json:"nextRetryAt"`
	CreatedAt    string                 `json:"createdAt"`
}

type DeliveryResult struct {
	Success    bool   `json:"success"`
	StatusCode *int   `json:"statusCode"`
	Error      string `json:"error,omitempty"`
}

type WebhookEndpointListOptions struct {
	OrgID string
}

type WebhookDeliveryListOptions struct {
	EndpointID string
	Limit      int
}

func (c *Client) Validate(req ValidationRequest) (*ValidationReport, error) {
	var report ValidationReport
	if err := c.doJSON(http.MethodPost, "/v1/validate", nil, req, &report); err != nil {
		return nil, err
	}
	return &report, nil
}

func (c *Client) ListRules(options RuleListOptions) (*ListResponse[Rule], error) {
	query := make(url.Values)
	setString(query, "stack", options.Stack)
	setString(query, "category", options.Category)
	setString(query, "tag", options.Tag)
	setString(query, "q", options.Query)
	setInt(query, "limit", options.Limit)
	setInt(query, "offset", options.Offset)

	var response ListResponse[Rule]
	if err := c.doJSON(http.MethodGet, "/v1/rules", query, nil, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetRules(options RuleListOptions) ([]Rule, error) {
	response, err := c.ListRules(options)
	if err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) GetRule(ruleID string) (*Rule, error) {
	var response DataResponse[Rule]
	if err := c.doJSON(http.MethodGet, "/v1/rules/"+url.PathEscape(ruleID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) CreateRule(req RuleCreateRequest) (*Rule, error) {
	var response DataResponse[Rule]
	if err := c.doJSON(http.MethodPost, "/v1/rules", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) UpdateRule(ruleID string, req RuleUpdateRequest) (*Rule, error) {
	var response DataResponse[Rule]
	if err := c.doJSON(http.MethodPut, "/v1/rules/"+url.PathEscape(ruleID), nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) DeleteRule(ruleID string) (*DeleteResult, error) {
	var response DataResponse[DeleteResult]
	if err := c.doJSON(http.MethodDelete, "/v1/rules/"+url.PathEscape(ruleID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) ListProjects() (*ListResponse[Project], error) {
	var response ListResponse[Project]
	if err := c.doJSON(http.MethodGet, "/v1/projects", nil, nil, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetProject(projectID string) (*Project, error) {
	var response DataResponse[Project]
	if err := c.doJSON(http.MethodGet, "/v1/projects/"+url.PathEscape(projectID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) CreateProject(req ProjectCreateRequest) (*Project, error) {
	var response DataResponse[Project]
	if err := c.doJSON(http.MethodPost, "/v1/projects", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) UpdateProject(projectID string, req ProjectUpdateRequest) (*Project, error) {
	var response DataResponse[Project]
	if err := c.doJSON(http.MethodPut, "/v1/projects/"+url.PathEscape(projectID), nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) DeleteProject(projectID string) (*DeleteResult, error) {
	var response DataResponse[DeleteResult]
	if err := c.doJSON(http.MethodDelete, "/v1/projects/"+url.PathEscape(projectID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) ListAudit(options AuditListOptions) (*ListResponse[AuditEntry], error) {
	query := make(url.Values)
	setString(query, "org_id", options.OrgID)
	setString(query, "project_id", options.ProjectID)
	setString(query, "action", options.Action)
	setString(query, "since", options.Since)
	setString(query, "until", options.Until)
	setInt(query, "limit", options.Limit)
	setInt(query, "offset", options.Offset)

	var response ListResponse[AuditEntry]
	if err := c.doJSON(http.MethodGet, "/v1/audit", query, nil, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetAudit(options AuditListOptions) ([]AuditEntry, error) {
	response, err := c.ListAudit(options)
	if err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) CreateAudit(req AuditCreateRequest) (*AuditEntry, error) {
	var response DataResponse[AuditEntry]
	if err := c.doJSON(http.MethodPost, "/v1/audit", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) ExportAudit(options AuditListOptions) (string, error) {
	query := make(url.Values)
	setString(query, "org_id", options.OrgID)
	setString(query, "project_id", options.ProjectID)
	setString(query, "action", options.Action)
	setString(query, "since", options.Since)
	setString(query, "until", options.Until)
	setInt(query, "limit", options.Limit)
	setInt(query, "offset", options.Offset)

	return c.doText(http.MethodGet, "/v1/audit/export", query, nil)
}

func (c *Client) GetCompliance(projectID string, since string, limit int) (*ComplianceData, error) {
	query := make(url.Values)
	setString(query, "since", since)
	setInt(query, "limit", limit)

	var response DataResponse[ComplianceData]
	if err := c.doJSON(http.MethodGet, "/v1/compliance/"+url.PathEscape(projectID), query, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) CreateComplianceSnapshot(projectID string, req ComplianceSnapshotRequest) (*ComplianceSnapshot, error) {
	var response DataResponse[ComplianceSnapshot]
	if err := c.doJSON(http.MethodPost, "/v1/compliance/"+url.PathEscape(projectID)+"/snapshot", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) SyncRules(options SyncOptions) (*SyncResponse, error) {
	query := make(url.Values)
	setString(query, "project", options.Project)
	setString(query, "stack", options.Stack)
	setString(query, "since", options.Since)

	var response SyncResponse
	if err := c.doJSON(http.MethodGet, "/v1/sync", query, nil, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) AckSync(req SyncAckRequest) (*SyncAckResult, error) {
	var response DataResponse[SyncAckResult]
	if err := c.doJSON(http.MethodPost, "/v1/sync/ack", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) ListTokens(orgID string) ([]APIToken, error) {
	query := make(url.Values)
	setString(query, "org_id", orgID)

	var response DataResponse[[]APIToken]
	if err := c.doJSON(http.MethodGet, "/v1/tokens", query, nil, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) CreateToken(req TokenCreateRequest) (*CreatedAPIToken, error) {
	var response DataResponse[CreatedAPIToken]
	if err := c.doJSON(http.MethodPost, "/v1/tokens", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) DeleteToken(tokenID string) (*DeleteResult, error) {
	var response DataResponse[DeleteResult]
	if err := c.doJSON(http.MethodDelete, "/v1/tokens/"+url.PathEscape(tokenID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) GetTopViolations(options AnalyticsReadOptions) ([]TopViolation, error) {
	query := make(url.Values)
	setString(query, "project_id", options.ProjectID)
	setString(query, "since", options.Since)
	setInt(query, "limit", options.Limit)

	var response DataResponse[[]TopViolation]
	if err := c.doJSON(http.MethodGet, "/v1/analytics/top-violations", query, nil, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) GetAnalyticsTrend(projectID, interval string, limit int) (*AnalyticsTrend, error) {
	query := make(url.Values)
	setString(query, "project_id", projectID)
	setString(query, "interval", interval)
	setInt(query, "limit", limit)

	var response DataResponse[AnalyticsTrend]
	if err := c.doJSON(http.MethodGet, "/v1/analytics/trend", query, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) GetCategoryBreakdown(projectID, since string) ([]AnalyticsCategoryBreakdown, error) {
	query := make(url.Values)
	setString(query, "project_id", projectID)
	setString(query, "since", since)

	var response DataResponse[[]AnalyticsCategoryBreakdown]
	if err := c.doJSON(http.MethodGet, "/v1/analytics/category-breakdown", query, nil, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) GetSourceStats(projectID, since string) ([]AnalyticsSourceStat, error) {
	query := make(url.Values)
	setString(query, "project_id", projectID)
	setString(query, "since", since)

	var response DataResponse[[]AnalyticsSourceStat]
	if err := c.doJSON(http.MethodGet, "/v1/analytics/source-stats", query, nil, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) ListWebhookEndpoints(options WebhookEndpointListOptions) ([]WebhookEndpoint, error) {
	query := make(url.Values)
	setString(query, "org_id", options.OrgID)

	var response DataResponse[[]WebhookEndpoint]
	if err := c.doJSON(http.MethodGet, "/v1/webhooks/endpoints", query, nil, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) GetWebhookEndpoint(endpointID string) (*WebhookEndpoint, error) {
	var response DataResponse[WebhookEndpoint]
	if err := c.doJSON(http.MethodGet, "/v1/webhooks/endpoints/"+url.PathEscape(endpointID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) CreateWebhookEndpoint(req WebhookEndpointCreateRequest) (*WebhookEndpoint, error) {
	var response DataResponse[WebhookEndpoint]
	if err := c.doJSON(http.MethodPost, "/v1/webhooks/endpoints", nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) UpdateWebhookEndpoint(endpointID string, req WebhookEndpointUpdateRequest) (*WebhookEndpoint, error) {
	var response DataResponse[WebhookEndpoint]
	if err := c.doJSON(http.MethodPut, "/v1/webhooks/endpoints/"+url.PathEscape(endpointID), nil, req, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) DeleteWebhookEndpoint(endpointID string) (*DeleteResult, error) {
	var response DataResponse[DeleteResult]
	if err := c.doJSON(http.MethodDelete, "/v1/webhooks/endpoints/"+url.PathEscape(endpointID), nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) TestWebhookEndpoint(endpointID string) (*DeliveryResult, error) {
	var response DataResponse[DeliveryResult]
	if err := c.doJSON(http.MethodPost, "/v1/webhooks/endpoints/"+url.PathEscape(endpointID)+"/test", nil, nil, &response); err != nil {
		return nil, err
	}
	return &response.Data, nil
}

func (c *Client) ListWebhookDeliveries(options WebhookDeliveryListOptions) ([]WebhookDelivery, error) {
	query := make(url.Values)
	setString(query, "endpoint_id", options.EndpointID)
	setInt(query, "limit", options.Limit)

	var response DataResponse[[]WebhookDelivery]
	if err := c.doJSON(http.MethodGet, "/v1/webhooks/deliveries", query, nil, &response); err != nil {
		return nil, err
	}
	return response.Data, nil
}

func (c *Client) doJSON(method, path string, query url.Values, body any, out any) error {
	fullURL := c.buildURL(path, query)
	var payload io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		payload = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, fullURL, payload)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "rulebound-go/0.1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}

	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func (c *Client) doText(method, path string, query url.Values, body any) (string, error) {
	fullURL := c.buildURL(path, query)
	var payload io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return "", fmt.Errorf("marshal request: %w", err)
		}
		payload = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, fullURL, payload)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "rulebound-go/0.1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}
	if resp.StatusCode >= 400 {
		return "", &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}
	return string(respBody), nil
}

func (c *Client) buildURL(path string, query url.Values) string {
	fullURL := c.serverURL + path
	if len(query) == 0 {
		return fullURL
	}
	return fullURL + "?" + query.Encode()
}

func setString(values url.Values, key, value string) {
	if value != "" {
		values.Set(key, value)
	}
}

func setInt(values url.Values, key string, value int) {
	if value != 0 {
		values.Set(key, strconv.Itoa(value))
	}
}
