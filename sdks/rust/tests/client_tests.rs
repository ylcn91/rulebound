use httpmock::prelude::*;
use rulebound::{
    AnalyticsReadOptions, AuditListOptions, Error, ProjectCreateRequest, RuleListOptions,
    RuleboundClient, SyncAckRequest, SyncOptions, TokenCreateRequest, ValidationRequest,
    WebhookEndpointCreateRequest,
};

#[tokio::test]
async fn validate_and_rules_contract() {
    let server = MockServer::start_async().await;

    let validate = server
        .mock_async(|when, then| {
            when.method(POST)
                .path("/v1/validate")
                .json_body_obj(&serde_json::json!({
                    "plan": "Implement OAuth callback",
                    "project": "rulebound",
                    "useLlm": true
                }));
            then.status(200).json_body(serde_json::json!({
                "task": "Validate auth flow",
                "rulesMatched": 1,
                "rulesTotal": 1,
                "results": [],
                "summary": { "pass": 1, "violated": 0, "notCovered": 0 },
                "status": "PASSED"
            }));
        })
        .await;

    let list_rules = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/rules")
                .query_param("stack", "typescript")
                .query_param("q", "eval")
                .query_param("limit", "10");
            then.status(200).json_body(serde_json::json!({
                "data": [{
                    "id": "rule-1",
                    "ruleSetId": "set-1",
                    "title": "No eval",
                    "content": "Avoid eval",
                    "category": "security",
                    "severity": "error",
                    "modality": "must",
                    "tags": ["security"],
                    "stack": ["typescript"],
                    "isActive": true,
                    "version": 2,
                    "createdAt": "2026-03-08T10:00:00Z",
                    "updatedAt": "2026-03-08T10:00:00Z"
                }],
                "total": 1
            }));
        })
        .await;

    let delete_rule = server
        .mock_async(|when, then| {
            when.method(DELETE).path("/v1/rules/rule-1");
            then.status(200)
                .json_body(serde_json::json!({ "data": { "deleted": true } }));
        })
        .await;

    let client = RuleboundClient::new("test-api-key", &server.base_url()).unwrap();

    let report = client
        .validate(ValidationRequest {
            plan: Some("Implement OAuth callback".into()),
            project: Some("rulebound".into()),
            use_llm: Some(true),
            ..ValidationRequest::default()
        })
        .await
        .unwrap();
    let rules = client
        .list_rules(&RuleListOptions {
            stack: Some("typescript".into()),
            query: Some("eval".into()),
            limit: Some(10),
            ..RuleListOptions::default()
        })
        .await
        .unwrap();
    let deleted = client.delete_rule("rule-1").await.unwrap();

    assert_eq!(report.status, "PASSED");
    assert_eq!(rules.total, Some(1));
    assert!(deleted.deleted);
    validate.assert_async().await;
    list_rules.assert_async().await;
    delete_rule.assert_async().await;
}

#[tokio::test]
async fn projects_audit_compliance_and_sync_contract() {
    let server = MockServer::start_async().await;

    let list_projects = server
        .mock_async(|when, then| {
            when.method(GET).path("/v1/projects");
            then.status(200)
                .json_body(serde_json::json!({ "data": [], "total": 0 }));
        })
        .await;

    let create_project = server
        .mock_async(|when, then| {
            when.method(POST)
                .path("/v1/projects")
                .json_body_obj(&serde_json::json!({
                    "name": "Rulebound",
                    "slug": "rulebound",
                    "repoUrl": "https://github.com/rulebound/rulebound",
                    "stack": ["typescript"]
                }));
            then.status(201).json_body(serde_json::json!({
                "data": {
                    "id": "proj-1",
                    "orgId": "org-1",
                    "name": "Rulebound",
                    "slug": "rulebound",
                    "repoUrl": "https://github.com/rulebound/rulebound",
                    "stack": ["typescript"],
                    "createdAt": "2026-03-08T10:00:00Z",
                    "updatedAt": "2026-03-08T10:00:00Z"
                }
            }));
        })
        .await;

    let list_audit = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/audit")
                .query_param("org_id", "org-1")
                .query_param("project_id", "proj-1")
                .query_param("limit", "5");
            then.status(200).json_body(serde_json::json!({
                "data": [{
                    "id": "audit-1",
                    "orgId": "org-1",
                    "projectId": "proj-1",
                    "userId": "user-1",
                    "action": "rule.created",
                    "ruleId": "rule-1",
                    "status": "SUCCESS",
                    "metadata": { "actor": "sdk-test" },
                    "createdAt": "2026-03-08T10:00:00Z"
                }],
                "total": 1
            }));
        })
        .await;

    let export_audit = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/audit/export")
                .query_param("org_id", "org-1")
                .query_param("limit", "20");
            then.status(200).body("id,action\n1,rule.created\n");
        })
        .await;

    let get_compliance = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/compliance/proj-1")
                .query_param("since", "2026-03-01T00:00:00Z")
                .query_param("limit", "5");
            then.status(200).json_body(serde_json::json!({
                "data": {
                    "projectId": "proj-1",
                    "currentScore": 93,
                    "trend": [{
                        "score": 93,
                        "passCount": 9,
                        "violatedCount": 1,
                        "notCoveredCount": 0,
                        "date": "2026-03-08T00:00:00Z"
                    }]
                }
            }));
        })
        .await;

    let sync_rules = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/sync")
                .query_param("project", "rulebound")
                .query_param("stack", "typescript")
                .query_param("since", "2026-03-01T00:00:00Z");
            then.status(200).json_body(serde_json::json!({
                "data": [],
                "meta": { "total": 0, "versionHash": "abc123", "syncedAt": "2026-03-08T12:00:00Z" }
            }));
        })
        .await;

    let ack_sync = server
        .mock_async(|when, then| {
            when.method(POST).path("/v1/sync/ack").json_body_obj(
                &serde_json::json!({ "projectId": "proj-1", "ruleVersionHash": "abc123" }),
            );
            then.status(200)
                .json_body(serde_json::json!({ "data": { "synced": true } }));
        })
        .await;

    let client = RuleboundClient::new("test-api-key", &server.base_url()).unwrap();

    let projects = client.list_projects().await.unwrap();
    let project = client
        .create_project(&ProjectCreateRequest {
            name: "Rulebound".into(),
            slug: "rulebound".into(),
            repo_url: Some("https://github.com/rulebound/rulebound".into()),
            stack: Some(vec!["typescript".into()]),
        })
        .await
        .unwrap();
    let audit = client
        .list_audit(&AuditListOptions {
            org_id: Some("org-1".into()),
            project_id: Some("proj-1".into()),
            limit: Some(5),
            ..AuditListOptions::default()
        })
        .await
        .unwrap();
    let exported = client
        .export_audit(&AuditListOptions {
            org_id: Some("org-1".into()),
            limit: Some(20),
            ..AuditListOptions::default()
        })
        .await
        .unwrap();
    let compliance = client
        .get_compliance("proj-1", Some("2026-03-01T00:00:00Z"), Some(5))
        .await
        .unwrap();
    let sync = client
        .sync_rules(&SyncOptions {
            project: Some("rulebound".into()),
            stack: Some("typescript".into()),
            since: Some("2026-03-01T00:00:00Z".into()),
        })
        .await
        .unwrap();
    let ack = client
        .ack_sync(&SyncAckRequest {
            project_id: "proj-1".into(),
            rule_version_hash: "abc123".into(),
        })
        .await
        .unwrap();

    assert_eq!(projects.total, Some(0));
    assert_eq!(project.org_id, "org-1");
    assert_eq!(audit.total, Some(1));
    assert!(exported.contains("rule.created"));
    assert_eq!(compliance.project_id, "proj-1");
    assert_eq!(sync.meta.version_hash, "abc123");
    assert!(ack.synced);
    list_projects.assert_async().await;
    create_project.assert_async().await;
    list_audit.assert_async().await;
    export_audit.assert_async().await;
    get_compliance.assert_async().await;
    sync_rules.assert_async().await;
    ack_sync.assert_async().await;
}

#[tokio::test]
async fn tokens_analytics_and_webhooks_contract() {
    let server = MockServer::start_async().await;

    let list_tokens = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/tokens")
                .query_param("org_id", "org-1");
            then.status(200).json_body(serde_json::json!({
                "data": [{
                    "id": "token-1",
                    "orgId": "org-1",
                    "userId": "user-1",
                    "name": "CI token",
                    "tokenPrefix": "rb_123456",
                    "scopes": ["read"],
                    "expiresAt": null,
                    "lastUsedAt": null,
                    "createdAt": "2026-03-08T10:00:00Z"
                }]
            }));
        })
        .await;

    let create_token = server
        .mock_async(|when, then| {
            when.method(POST)
                .path("/v1/tokens")
                .json_body_obj(&serde_json::json!({
                    "orgId": "org-1",
                    "userId": "user-1",
                    "name": "CI token",
                    "scopes": ["read", "validate"]
                }));
            then.status(201).json_body(serde_json::json!({
                "data": {
                    "id": "token-1",
                    "name": "CI token",
                    "token": "rb_secret",
                    "prefix": "rb_123456",
                    "scopes": ["read", "validate"],
                    "expiresAt": null,
                    "createdAt": "2026-03-08T10:00:00Z"
                }
            }));
        })
        .await;

    let top_violations = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/analytics/top-violations")
                .query_param("project_id", "proj-1")
                .query_param("limit", "5");
            then.status(200)
                .json_body(serde_json::json!({ "data": [{ "ruleId": "rule-1", "count": 4 }] }));
        })
        .await;

    let list_webhooks = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/webhooks/endpoints")
                .query_param("org_id", "org-1");
            then.status(200).json_body(serde_json::json!({
                "data": [{
                    "id": "wh-1",
                    "orgId": "org-1",
                    "url": "https://hooks.example.com/rulebound",
                    "events": ["violation.detected"],
                    "isActive": true,
                    "description": "Production",
                    "secretPrefix": "whsec_ab...",
                    "createdAt": "2026-03-08T10:00:00Z",
                    "updatedAt": "2026-03-08T10:00:00Z"
                }]
            }));
        })
        .await;

    let create_webhook = server
        .mock_async(|when, then| {
            when.method(POST)
                .path("/v1/webhooks/endpoints")
                .json_body_obj(&serde_json::json!({
                    "orgId": "org-1",
                    "url": "https://hooks.example.com/rulebound",
                    "secret": "whsec_secret_secret",
                    "events": ["violation.detected"],
                    "description": "Production"
                }));
            then.status(201).json_body(serde_json::json!({
                "data": {
                    "id": "wh-1",
                    "orgId": "org-1",
                    "url": "https://hooks.example.com/rulebound",
                    "events": ["violation.detected"],
                    "isActive": true,
                    "description": "Production",
                    "secret": "whsec_secret_secret",
                    "createdAt": "2026-03-08T10:00:00Z",
                    "updatedAt": "2026-03-08T10:00:00Z"
                }
            }));
        })
        .await;

    let test_webhook = server
        .mock_async(|when, then| {
            when.method(POST).path("/v1/webhooks/endpoints/wh-1/test");
            then.status(200)
                .json_body(serde_json::json!({ "data": { "success": true, "statusCode": 200 } }));
        })
        .await;

    let deliveries = server
        .mock_async(|when, then| {
            when.method(GET)
                .path("/v1/webhooks/deliveries")
                .query_param("endpoint_id", "wh-1")
                .query_param("limit", "10");
            then.status(200).json_body(serde_json::json!({
                "data": [{
                    "id": "delivery-1",
                    "endpointId": "wh-1",
                    "event": "test",
                    "status": "delivered",
                    "responseCode": 200,
                    "attempts": 1,
                    "createdAt": "2026-03-08T10:00:00Z"
                }]
            }));
        })
        .await;

    let client = RuleboundClient::new("test-api-key", &server.base_url()).unwrap();

    let tokens = client.list_tokens(Some("org-1")).await.unwrap();
    let created = client
        .create_token(&TokenCreateRequest {
            org_id: "org-1".into(),
            user_id: "user-1".into(),
            name: "CI token".into(),
            scopes: Some(vec!["read".into(), "validate".into()]),
            expires_at: None,
        })
        .await
        .unwrap();
    let top = client
        .get_top_violations(&AnalyticsReadOptions {
            project_id: Some("proj-1".into()),
            limit: Some(5),
            ..AnalyticsReadOptions::default()
        })
        .await
        .unwrap();
    let endpoints = client.list_webhook_endpoints(Some("org-1")).await.unwrap();
    let webhook = client
        .create_webhook_endpoint(&WebhookEndpointCreateRequest {
            org_id: "org-1".into(),
            url: "https://hooks.example.com/rulebound".into(),
            secret: "whsec_secret_secret".into(),
            events: vec!["violation.detected".into()],
            description: Some("Production".into()),
        })
        .await
        .unwrap();
    let tested = client.test_webhook_endpoint("wh-1").await.unwrap();
    let listed_deliveries = client
        .list_webhook_deliveries(Some("wh-1"), Some(10))
        .await
        .unwrap();

    assert_eq!(tokens[0].token_prefix, "rb_123456");
    assert_eq!(created.token, "rb_secret");
    assert_eq!(top[0].count, 4);
    assert_eq!(endpoints[0].secret_prefix.as_deref(), Some("whsec_ab..."));
    assert_eq!(webhook.secret.as_deref(), Some("whsec_secret_secret"));
    assert!(tested.success);
    assert_eq!(listed_deliveries[0].status, "delivered");
    list_tokens.assert_async().await;
    create_token.assert_async().await;
    top_violations.assert_async().await;
    list_webhooks.assert_async().await;
    create_webhook.assert_async().await;
    test_webhook.assert_async().await;
    deliveries.assert_async().await;
}

#[tokio::test]
async fn raises_typed_api_errors() {
    let server = MockServer::start_async().await;

    let error_mock = server
        .mock_async(|when, then| {
            when.method(POST).path("/v1/validate");
            then.status(403).body("Forbidden");
        })
        .await;

    let client = RuleboundClient::new("test-api-key", &server.base_url()).unwrap();
    let error = client
        .validate(ValidationRequest {
            plan: Some("test".into()),
            ..ValidationRequest::default()
        })
        .await
        .unwrap_err();

    match error {
        Error::Api { status, body } => {
            assert_eq!(status, 403);
            assert_eq!(body, "Forbidden");
        }
        other => panic!("unexpected error: {other:?}"),
    }

    error_mock.assert_async().await;
}
