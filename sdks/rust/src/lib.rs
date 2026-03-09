use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct RuleboundClient {
    server_url: String,
    http: reqwest::Client,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("api error {status}: {body}")]
    Api { status: u16, body: String },
}

#[derive(Debug, Clone, Deserialize)]
pub struct DataEnvelope<T> {
    pub data: T,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListResponse<T> {
    pub data: Vec<T>,
    pub total: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteResult {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub rule_set_id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub severity: String,
    pub modality: String,
    pub tags: Vec<String>,
    pub stack: Vec<String>,
    pub is_active: bool,
    pub version: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuleCreateRequest {
    pub title: String,
    pub content: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_set_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuleUpdateRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub change_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct RuleListOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    #[serde(rename = "q", skip_serializing_if = "Option::is_none")]
    pub query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub org_id: String,
    pub name: String,
    pub slug: String,
    pub repo_url: Option<String>,
    pub stack: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreateRequest {
    pub name: String,
    pub slug: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUpdateRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ValidationRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "useLlm")]
    pub use_llm: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub rule_id: String,
    pub rule_title: String,
    pub severity: String,
    pub modality: String,
    pub status: String,
    pub reason: String,
    pub suggested_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationSummary {
    pub pass: i32,
    pub violated: i32,
    pub not_covered: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub task: String,
    pub rules_matched: i32,
    pub rules_total: i32,
    pub results: Vec<ValidationResult>,
    pub summary: ValidationSummary,
    pub status: String,
}

impl ValidationReport {
    pub fn passed(&self) -> bool {
        self.status == "PASSED"
    }

    pub fn blocked(&self) -> bool {
        self.status == "FAILED"
    }

    pub fn violations(&self) -> Vec<&ValidationResult> {
        self.results
            .iter()
            .filter(|result| result.status == "VIOLATED")
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub id: String,
    pub org_id: String,
    pub project_id: Option<String>,
    pub user_id: Option<String>,
    pub action: String,
    pub rule_id: Option<String>,
    pub status: String,
    pub metadata: Option<Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuditCreateRequest {
    pub org_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct AuditListOptions {
    #[serde(rename = "org_id", skip_serializing_if = "Option::is_none")]
    pub org_id: Option<String>,
    #[serde(rename = "project_id", skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub until: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceTrend {
    pub score: i32,
    pub pass_count: i32,
    pub violated_count: i32,
    pub not_covered_count: i32,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceData {
    pub project_id: String,
    pub current_score: Option<i32>,
    pub trend: Vec<ComplianceTrend>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceSnapshot {
    pub id: String,
    pub project_id: String,
    pub score: i32,
    pub pass_count: i32,
    pub violated_count: i32,
    pub not_covered_count: i32,
    pub snapshot_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceSnapshotRequest {
    pub score: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pass_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub violated_count: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub not_covered_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMeta {
    pub total: i32,
    pub version_hash: String,
    pub synced_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResponse {
    pub data: Vec<Rule>,
    pub meta: SyncMeta,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct SyncOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAckRequest {
    pub project_id: String,
    pub rule_version_hash: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAckResult {
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiToken {
    pub id: String,
    pub org_id: String,
    pub user_id: String,
    pub name: String,
    pub token_prefix: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<String>,
    pub last_used_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenCreateRequest {
    pub org_id: String,
    pub user_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scopes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedApiToken {
    pub id: String,
    pub name: String,
    pub token: String,
    pub prefix: String,
    pub scopes: Vec<String>,
    pub expires_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct AnalyticsReadOptions {
    #[serde(rename = "project_id", skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopViolation {
    pub rule_id: Option<String>,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsTrend {
    pub project_id: String,
    pub interval: String,
    pub trend: Vec<ComplianceTrend>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsCategoryBreakdown {
    pub action: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsSourceStat {
    pub status: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookEndpoint {
    pub id: String,
    pub org_id: String,
    pub url: String,
    pub events: Vec<String>,
    pub is_active: bool,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub secret: Option<String>,
    pub secret_prefix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebhookEndpointCreateRequest {
    pub org_id: String,
    pub url: String,
    pub secret: String,
    pub events: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WebhookEndpointUpdateRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub events: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebhookDelivery {
    pub id: String,
    pub endpoint_id: String,
    pub event: String,
    pub payload: Option<Value>,
    pub status: String,
    pub response_code: Option<i32>,
    pub response_body: Option<String>,
    pub attempts: i32,
    pub next_retry_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryResult {
    pub success: bool,
    pub status_code: Option<i32>,
    pub error: Option<String>,
}

impl RuleboundClient {
    pub fn new(api_key: &str, server_url: &str) -> Result<Self, Error> {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", api_key)).unwrap(),
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(USER_AGENT, HeaderValue::from_static("rulebound-rust/0.1.0"));

        let http = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .build()?;

        Ok(Self {
            server_url: server_url.trim_end_matches('/').to_string(),
            http,
        })
    }

    pub async fn validate(&self, request: ValidationRequest) -> Result<ValidationReport, Error> {
        self.request_json(Method::POST, "/v1/validate", None::<&()>, Some(&request))
            .await
    }

    pub async fn list_rules(&self, options: &RuleListOptions) -> Result<ListResponse<Rule>, Error> {
        self.request_json(Method::GET, "/v1/rules", Some(options), None::<&()>)
            .await
    }

    pub async fn get_rules(&self, options: &RuleListOptions) -> Result<Vec<Rule>, Error> {
        Ok(self.list_rules(options).await?.data)
    }

    pub async fn get_rule(&self, rule_id: &str) -> Result<Rule, Error> {
        Ok(self
            .request_json::<DataEnvelope<Rule>, _, ()>(
                Method::GET,
                &format!("/v1/rules/{}", encode_path(rule_id)),
                None::<&()>,
                None::<&()>,
            )
            .await?
            .data)
    }

    pub async fn create_rule(&self, request: &RuleCreateRequest) -> Result<Rule, Error> {
        Ok(self
            .request_json::<DataEnvelope<Rule>, (), _>(
                Method::POST,
                "/v1/rules",
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn update_rule(
        &self,
        rule_id: &str,
        request: &RuleUpdateRequest,
    ) -> Result<Rule, Error> {
        Ok(self
            .request_json::<DataEnvelope<Rule>, (), _>(
                Method::PUT,
                &format!("/v1/rules/{}", encode_path(rule_id)),
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn delete_rule(&self, rule_id: &str) -> Result<DeleteResult, Error> {
        Ok(self
            .request_json::<DataEnvelope<DeleteResult>, (), ()>(
                Method::DELETE,
                &format!("/v1/rules/{}", encode_path(rule_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn list_projects(&self) -> Result<ListResponse<Project>, Error> {
        self.request_json(Method::GET, "/v1/projects", None::<&()>, None::<&()>)
            .await
    }

    pub async fn get_project(&self, project_id: &str) -> Result<Project, Error> {
        Ok(self
            .request_json::<DataEnvelope<Project>, (), ()>(
                Method::GET,
                &format!("/v1/projects/{}", encode_path(project_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn create_project(&self, request: &ProjectCreateRequest) -> Result<Project, Error> {
        Ok(self
            .request_json::<DataEnvelope<Project>, (), _>(
                Method::POST,
                "/v1/projects",
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn update_project(
        &self,
        project_id: &str,
        request: &ProjectUpdateRequest,
    ) -> Result<Project, Error> {
        Ok(self
            .request_json::<DataEnvelope<Project>, (), _>(
                Method::PUT,
                &format!("/v1/projects/{}", encode_path(project_id)),
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn delete_project(&self, project_id: &str) -> Result<DeleteResult, Error> {
        Ok(self
            .request_json::<DataEnvelope<DeleteResult>, (), ()>(
                Method::DELETE,
                &format!("/v1/projects/{}", encode_path(project_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn list_audit(
        &self,
        options: &AuditListOptions,
    ) -> Result<ListResponse<AuditEntry>, Error> {
        self.request_json(Method::GET, "/v1/audit", Some(options), None::<&()>)
            .await
    }

    pub async fn get_audit(&self, options: &AuditListOptions) -> Result<Vec<AuditEntry>, Error> {
        Ok(self.list_audit(options).await?.data)
    }

    pub async fn create_audit(&self, request: &AuditCreateRequest) -> Result<AuditEntry, Error> {
        Ok(self
            .request_json::<DataEnvelope<AuditEntry>, (), _>(
                Method::POST,
                "/v1/audit",
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn export_audit(&self, options: &AuditListOptions) -> Result<String, Error> {
        self.request_text(Method::GET, "/v1/audit/export", Some(options), None::<&()>)
            .await
    }

    pub async fn get_compliance(
        &self,
        project_id: &str,
        since: Option<&str>,
        limit: Option<i32>,
    ) -> Result<ComplianceData, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(skip_serializing_if = "Option::is_none")]
            since: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            limit: Option<i32>,
        }

        Ok(self
            .request_json::<DataEnvelope<ComplianceData>, _, ()>(
                Method::GET,
                &format!("/v1/compliance/{}", encode_path(project_id)),
                Some(&Query { since, limit }),
                None,
            )
            .await?
            .data)
    }

    pub async fn create_compliance_snapshot(
        &self,
        project_id: &str,
        request: &ComplianceSnapshotRequest,
    ) -> Result<ComplianceSnapshot, Error> {
        Ok(self
            .request_json::<DataEnvelope<ComplianceSnapshot>, (), _>(
                Method::POST,
                &format!("/v1/compliance/{}/snapshot", encode_path(project_id)),
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn sync_rules(&self, options: &SyncOptions) -> Result<SyncResponse, Error> {
        self.request_json(Method::GET, "/v1/sync", Some(options), None::<&()>)
            .await
    }

    pub async fn ack_sync(&self, request: &SyncAckRequest) -> Result<SyncAckResult, Error> {
        Ok(self
            .request_json::<DataEnvelope<SyncAckResult>, (), _>(
                Method::POST,
                "/v1/sync/ack",
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn list_tokens(&self, org_id: Option<&str>) -> Result<Vec<ApiToken>, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(rename = "org_id", skip_serializing_if = "Option::is_none")]
            org_id: Option<&'a str>,
        }

        Ok(self
            .request_json::<DataEnvelope<Vec<ApiToken>>, _, ()>(
                Method::GET,
                "/v1/tokens",
                Some(&Query { org_id }),
                None,
            )
            .await?
            .data)
    }

    pub async fn create_token(
        &self,
        request: &TokenCreateRequest,
    ) -> Result<CreatedApiToken, Error> {
        Ok(self
            .request_json::<DataEnvelope<CreatedApiToken>, (), _>(
                Method::POST,
                "/v1/tokens",
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn delete_token(&self, token_id: &str) -> Result<DeleteResult, Error> {
        Ok(self
            .request_json::<DataEnvelope<DeleteResult>, (), ()>(
                Method::DELETE,
                &format!("/v1/tokens/{}", encode_path(token_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn get_top_violations(
        &self,
        options: &AnalyticsReadOptions,
    ) -> Result<Vec<TopViolation>, Error> {
        Ok(self
            .request_json::<DataEnvelope<Vec<TopViolation>>, _, ()>(
                Method::GET,
                "/v1/analytics/top-violations",
                Some(options),
                None,
            )
            .await?
            .data)
    }

    pub async fn get_analytics_trend(
        &self,
        project_id: &str,
        interval: Option<&str>,
        limit: Option<i32>,
    ) -> Result<AnalyticsTrend, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(rename = "project_id")]
            project_id: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            interval: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            limit: Option<i32>,
        }

        Ok(self
            .request_json::<DataEnvelope<AnalyticsTrend>, _, ()>(
                Method::GET,
                "/v1/analytics/trend",
                Some(&Query {
                    project_id,
                    interval,
                    limit,
                }),
                None,
            )
            .await?
            .data)
    }

    pub async fn get_category_breakdown(
        &self,
        project_id: Option<&str>,
        since: Option<&str>,
    ) -> Result<Vec<AnalyticsCategoryBreakdown>, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(rename = "project_id", skip_serializing_if = "Option::is_none")]
            project_id: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            since: Option<&'a str>,
        }

        Ok(self
            .request_json::<DataEnvelope<Vec<AnalyticsCategoryBreakdown>>, _, ()>(
                Method::GET,
                "/v1/analytics/category-breakdown",
                Some(&Query { project_id, since }),
                None,
            )
            .await?
            .data)
    }

    pub async fn get_source_stats(
        &self,
        project_id: Option<&str>,
        since: Option<&str>,
    ) -> Result<Vec<AnalyticsSourceStat>, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(rename = "project_id", skip_serializing_if = "Option::is_none")]
            project_id: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            since: Option<&'a str>,
        }

        Ok(self
            .request_json::<DataEnvelope<Vec<AnalyticsSourceStat>>, _, ()>(
                Method::GET,
                "/v1/analytics/source-stats",
                Some(&Query { project_id, since }),
                None,
            )
            .await?
            .data)
    }

    pub async fn list_webhook_endpoints(
        &self,
        org_id: Option<&str>,
    ) -> Result<Vec<WebhookEndpoint>, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(rename = "org_id", skip_serializing_if = "Option::is_none")]
            org_id: Option<&'a str>,
        }

        Ok(self
            .request_json::<DataEnvelope<Vec<WebhookEndpoint>>, _, ()>(
                Method::GET,
                "/v1/webhooks/endpoints",
                Some(&Query { org_id }),
                None,
            )
            .await?
            .data)
    }

    pub async fn get_webhook_endpoint(&self, endpoint_id: &str) -> Result<WebhookEndpoint, Error> {
        Ok(self
            .request_json::<DataEnvelope<WebhookEndpoint>, (), ()>(
                Method::GET,
                &format!("/v1/webhooks/endpoints/{}", encode_path(endpoint_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn create_webhook_endpoint(
        &self,
        request: &WebhookEndpointCreateRequest,
    ) -> Result<WebhookEndpoint, Error> {
        Ok(self
            .request_json::<DataEnvelope<WebhookEndpoint>, (), _>(
                Method::POST,
                "/v1/webhooks/endpoints",
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn update_webhook_endpoint(
        &self,
        endpoint_id: &str,
        request: &WebhookEndpointUpdateRequest,
    ) -> Result<WebhookEndpoint, Error> {
        Ok(self
            .request_json::<DataEnvelope<WebhookEndpoint>, (), _>(
                Method::PUT,
                &format!("/v1/webhooks/endpoints/{}", encode_path(endpoint_id)),
                None,
                Some(request),
            )
            .await?
            .data)
    }

    pub async fn delete_webhook_endpoint(&self, endpoint_id: &str) -> Result<DeleteResult, Error> {
        Ok(self
            .request_json::<DataEnvelope<DeleteResult>, (), ()>(
                Method::DELETE,
                &format!("/v1/webhooks/endpoints/{}", encode_path(endpoint_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn test_webhook_endpoint(&self, endpoint_id: &str) -> Result<DeliveryResult, Error> {
        Ok(self
            .request_json::<DataEnvelope<DeliveryResult>, (), ()>(
                Method::POST,
                &format!("/v1/webhooks/endpoints/{}/test", encode_path(endpoint_id)),
                None,
                None,
            )
            .await?
            .data)
    }

    pub async fn list_webhook_deliveries(
        &self,
        endpoint_id: Option<&str>,
        limit: Option<i32>,
    ) -> Result<Vec<WebhookDelivery>, Error> {
        #[derive(Serialize)]
        struct Query<'a> {
            #[serde(rename = "endpoint_id", skip_serializing_if = "Option::is_none")]
            endpoint_id: Option<&'a str>,
            #[serde(skip_serializing_if = "Option::is_none")]
            limit: Option<i32>,
        }

        Ok(self
            .request_json::<DataEnvelope<Vec<WebhookDelivery>>, _, ()>(
                Method::GET,
                "/v1/webhooks/deliveries",
                Some(&Query { endpoint_id, limit }),
                None,
            )
            .await?
            .data)
    }

    async fn request_json<T, Q, B>(
        &self,
        method: Method,
        path: &str,
        query: Option<&Q>,
        body: Option<&B>,
    ) -> Result<T, Error>
    where
        T: DeserializeOwned,
        Q: Serialize + ?Sized,
        B: Serialize + ?Sized,
    {
        let text = self.request_text(method, path, query, body).await?;
        Ok(serde_json::from_str::<T>(&text)?)
    }

    async fn request_text<Q, B>(
        &self,
        method: Method,
        path: &str,
        query: Option<&Q>,
        body: Option<&B>,
    ) -> Result<String, Error>
    where
        Q: Serialize + ?Sized,
        B: Serialize + ?Sized,
    {
        let url = self.build_url(path, query)?;
        let mut request = self.http.request(method, &url);
        if let Some(body) = body {
            request = request.json(body);
        }

        let response = request.send().await?;
        let status = response.status();
        let text = response.text().await?;
        if !status.is_success() {
            return Err(Error::Api {
                status: status.as_u16(),
                body: text,
            });
        }

        Ok(text)
    }

    fn build_url<Q>(&self, path: &str, query: Option<&Q>) -> Result<String, Error>
    where
        Q: Serialize + ?Sized,
    {
        let mut url = format!("{}{}", self.server_url, path);
        if let Some(query) = query {
            let encoded = serde_urlencoded::to_string(query).map_err(|err| Error::Api {
                status: 0,
                body: err.to_string(),
            })?;
            if !encoded.is_empty() {
                url.push('?');
                url.push_str(&encoded);
            }
        }
        Ok(url)
    }
}

fn encode_path(value: &str) -> String {
    urlencoding::encode(value).into_owned()
}
