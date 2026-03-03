package rulebound

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
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

func NewClient(apiKey, serverURL string, opts ...ClientOption) *Client {
	c := &Client{
		serverURL: serverURL,
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

type Rule struct {
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Content  string   `json:"content"`
	Category string   `json:"category"`
	Severity string   `json:"severity"`
	Modality string   `json:"modality"`
	Tags     []string `json:"tags"`
	Stack    []string `json:"stack"`
	Version  int      `json:"version"`
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
	var violations []ValidationResult
	for _, result := range r.Results {
		if result.Status == "VIOLATED" {
			violations = append(violations, result)
		}
	}
	return violations
}

type ValidateRequest struct {
	Code     string `json:"code,omitempty"`
	Plan     string `json:"plan,omitempty"`
	Language string `json:"language,omitempty"`
	Project  string `json:"project,omitempty"`
	Task     string `json:"task,omitempty"`
}

func (c *Client) Validate(req ValidateRequest) (*ValidationReport, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	resp, err := c.doRequest("POST", "/v1/validate", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var report ValidationReport
	if err := json.NewDecoder(resp.Body).Decode(&report); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &report, nil
}

type GetRulesParams struct {
	Stack    string
	Category string
	Tag      string
}

func (c *Client) GetRules(params GetRulesParams) ([]Rule, error) {
	u, _ := url.Parse(c.serverURL + "/v1/rules")
	q := u.Query()
	if params.Stack != "" {
		q.Set("stack", params.Stack)
	}
	if params.Category != "" {
		q.Set("category", params.Category)
	}
	if params.Tag != "" {
		q.Set("tag", params.Tag)
	}
	u.RawQuery = q.Encode()

	resp, err := c.doRequestURL("GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []Rule `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return result.Data, nil
}

type SyncParams struct {
	Project string
	Stack   string
	Since   string
}

func (c *Client) SyncRules(params SyncParams) ([]Rule, error) {
	u, _ := url.Parse(c.serverURL + "/v1/sync")
	q := u.Query()
	if params.Project != "" {
		q.Set("project", params.Project)
	}
	if params.Stack != "" {
		q.Set("stack", params.Stack)
	}
	if params.Since != "" {
		q.Set("since", params.Since)
	}
	u.RawQuery = q.Encode()

	resp, err := c.doRequestURL("GET", u.String(), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []Rule `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return result.Data, nil
}

func (c *Client) doRequest(method, path string, body []byte) (*http.Response, error) {
	return c.doRequestURL(method, c.serverURL+path, body)
}

func (c *Client) doRequestURL(method, fullURL string, body []byte) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		bodyReader = bytes.NewReader(body)
	}

	req, err := http.NewRequest(method, fullURL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "rulebound-go/0.1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}

	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	return resp, nil
}
