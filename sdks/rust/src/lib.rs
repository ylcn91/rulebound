use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone)]
pub struct RuleboundClient {
    server_url: String,
    http: reqwest::Client,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("API error {status}: {body}")]
    Api { status: u16, body: String },
}

// If thiserror isn't available, manual impl:
// We'll keep it simple and just use reqwest::Error

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub severity: String,
    pub modality: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub stack: Vec<String>,
    #[serde(default)]
    pub version: i32,
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
        self.results.iter().filter(|r| r.status == "VIOLATED").collect()
    }
}

#[derive(Debug, Serialize)]
pub struct ValidateRequest {
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
}

#[derive(Debug, Deserialize)]
struct DataWrapper<T> {
    data: T,
}

#[derive(Debug, Deserialize)]
pub struct SyncMeta {
    pub total: i32,
    #[serde(rename = "versionHash")]
    pub version_hash: String,
    #[serde(rename = "syncedAt")]
    pub synced_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SyncResponse {
    pub data: Vec<Rule>,
    pub meta: SyncMeta,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComplianceData {
    pub project_id: String,
    pub current_score: Option<i32>,
}

impl RuleboundClient {
    pub fn new(api_key: &str, server_url: &str) -> Result<Self, reqwest::Error> {
        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&format!("Bearer {}", api_key)).unwrap());
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

    pub async fn validate(&self, req: ValidateRequest) -> Result<ValidationReport, reqwest::Error> {
        let resp = self.http
            .post(format!("{}/v1/validate", self.server_url))
            .json(&req)
            .send()
            .await?
            .json::<ValidationReport>()
            .await?;
        Ok(resp)
    }

    pub async fn get_rules(
        &self,
        stack: Option<&str>,
        category: Option<&str>,
        tag: Option<&str>,
    ) -> Result<Vec<Rule>, reqwest::Error> {
        let mut url = format!("{}/v1/rules", self.server_url);
        let mut params = vec![];
        if let Some(s) = stack { params.push(format!("stack={}", s)); }
        if let Some(c) = category { params.push(format!("category={}", c)); }
        if let Some(t) = tag { params.push(format!("tag={}", t)); }
        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        let resp: DataWrapper<Vec<Rule>> = self.http.get(&url).send().await?.json().await?;
        Ok(resp.data)
    }

    pub async fn sync_rules(
        &self,
        project: Option<&str>,
        stack: Option<&str>,
    ) -> Result<SyncResponse, reqwest::Error> {
        let mut url = format!("{}/v1/sync", self.server_url);
        let mut params = vec![];
        if let Some(p) = project { params.push(format!("project={}", p)); }
        if let Some(s) = stack { params.push(format!("stack={}", s)); }
        if !params.is_empty() {
            url.push('?');
            url.push_str(&params.join("&"));
        }

        self.http.get(&url).send().await?.json().await
    }

    pub async fn get_compliance(&self, project_id: &str) -> Result<ComplianceData, reqwest::Error> {
        let resp: DataWrapper<ComplianceData> = self.http
            .get(format!("{}/v1/compliance/{}", self.server_url, project_id))
            .send()
            .await?
            .json()
            .await?;
        Ok(resp.data)
    }
}
