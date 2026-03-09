from __future__ import annotations

from typing import Any, Optional

import httpx

from rulebound.types import (
    AnalyticsCategoryBreakdown,
    AnalyticsSourceStat,
    AnalyticsTrend,
    ApiToken,
    AuditEntry,
    ComplianceData,
    ComplianceSnapshot,
    ComplianceTrend,
    CreatedApiToken,
    DataResponse,
    DeleteResult,
    DeliveryResult,
    ListResponse,
    Project,
    Rule,
    SyncAckResult,
    SyncMeta,
    SyncResponse,
    TopViolation,
    ValidationReport,
    ValidationResult,
    ValidationSummary,
    WebhookDelivery,
    WebhookEndpoint,
)


class RuleboundError(Exception):
    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        body: Optional[str] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class RuleboundClient:
    """Python client for the Rulebound API server."""

    def __init__(
        self,
        api_key: str,
        server: str = "http://localhost:3001",
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ):
        self._server = server.rstrip("/")
        self._client = httpx.Client(
            base_url=self._server,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "rulebound-python/0.1.0",
            },
            timeout=timeout,
            transport=transport,
        )

    def validate(
        self,
        code: Optional[str] = None,
        plan: Optional[str] = None,
        language: Optional[str] = None,
        project: Optional[str] = None,
        task: Optional[str] = None,
        use_llm: Optional[bool] = None,
    ) -> ValidationReport:
        payload = self._compact(
            {
                "code": code,
                "plan": plan,
                "language": language,
                "project": project,
                "task": task,
                "useLlm": use_llm,
            }
        )
        data = self._request_json("POST", "/v1/validate", json=payload)
        return self._parse_validation_report(data)

    def validate_plan(
        self,
        plan: str,
        task: Optional[str] = None,
        project: Optional[str] = None,
        use_llm: Optional[bool] = None,
    ) -> ValidationReport:
        return self.validate(plan=plan, task=task, project=project, use_llm=use_llm)

    def list_rules(
        self,
        stack: Optional[str] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        q: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> ListResponse[Rule]:
        data = self._request_json(
            "GET",
            "/v1/rules",
            params=self._compact(
                {
                    "stack": stack,
                    "category": category,
                    "tag": tag,
                    "q": q,
                    "limit": limit,
                    "offset": offset,
                }
            ),
        )
        return ListResponse(
            data=[self._parse_rule(item) for item in data.get("data", [])],
            total=data.get("total"),
        )

    def get_rules(
        self,
        stack: Optional[str] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        q: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> list[Rule]:
        return self.list_rules(stack=stack, category=category, tag=tag, q=q, limit=limit, offset=offset).data

    def get_rule(self, rule_id: str) -> Rule:
        data = self._request_json("GET", f"/v1/rules/{rule_id}")
        return self._parse_rule(data["data"])

    def create_rule(self, payload: dict[str, Any]) -> Rule:
        data = self._request_json("POST", "/v1/rules", json=payload)
        return self._parse_rule(data["data"])

    def update_rule(self, rule_id: str, payload: dict[str, Any]) -> Rule:
        data = self._request_json("PUT", f"/v1/rules/{rule_id}", json=payload)
        return self._parse_rule(data["data"])

    def delete_rule(self, rule_id: str) -> DeleteResult:
        data = self._request_json("DELETE", f"/v1/rules/{rule_id}")
        return DeleteResult(deleted=bool(data.get("data", {}).get("deleted", False)))

    def list_projects(self) -> ListResponse[Project]:
        data = self._request_json("GET", "/v1/projects")
        return ListResponse(
            data=[self._parse_project(item) for item in data.get("data", [])],
            total=data.get("total"),
        )

    def get_project(self, project_id: str) -> Project:
        data = self._request_json("GET", f"/v1/projects/{project_id}")
        return self._parse_project(data["data"])

    def create_project(self, payload: dict[str, Any]) -> Project:
        data = self._request_json("POST", "/v1/projects", json=payload)
        return self._parse_project(data["data"])

    def update_project(self, project_id: str, payload: dict[str, Any]) -> Project:
        data = self._request_json("PUT", f"/v1/projects/{project_id}", json=payload)
        return self._parse_project(data["data"])

    def delete_project(self, project_id: str) -> DeleteResult:
        data = self._request_json("DELETE", f"/v1/projects/{project_id}")
        return DeleteResult(deleted=bool(data.get("data", {}).get("deleted", False)))

    def list_audit(
        self,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        action: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> ListResponse[AuditEntry]:
        data = self._request_json(
            "GET",
            "/v1/audit",
            params=self._compact(
                {
                    "org_id": org_id,
                    "project_id": project_id,
                    "action": action,
                    "since": since,
                    "until": until,
                    "limit": limit,
                    "offset": offset,
                }
            ),
        )
        return ListResponse(
            data=[self._parse_audit_entry(item) for item in data.get("data", [])],
            total=data.get("total"),
        )

    def get_audit(
        self,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        action: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> list[AuditEntry]:
        return self.list_audit(
            org_id=org_id,
            project_id=project_id,
            action=action,
            since=since,
            until=until,
            limit=limit,
            offset=offset,
        ).data

    def create_audit(self, payload: dict[str, Any]) -> AuditEntry:
        data = self._request_json("POST", "/v1/audit", json=payload)
        return self._parse_audit_entry(data["data"])

    def export_audit(
        self,
        org_id: Optional[str] = None,
        project_id: Optional[str] = None,
        action: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> str:
        return self._request_text(
            "GET",
            "/v1/audit/export",
            params=self._compact(
                {
                    "org_id": org_id,
                    "project_id": project_id,
                    "action": action,
                    "since": since,
                    "until": until,
                    "limit": limit,
                    "offset": offset,
                }
            ),
        )

    def log_audit(
        self,
        org_id: str,
        action: str,
        status: str,
        project_id: Optional[str] = None,
        rule_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> AuditEntry:
        return self.create_audit(
            self._compact(
                {
                    "orgId": org_id,
                    "projectId": project_id,
                    "userId": user_id,
                    "action": action,
                    "ruleId": rule_id,
                    "status": status,
                    "metadata": metadata,
                }
            )
        )

    def get_compliance(
        self,
        project_id: str,
        since: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> ComplianceData:
        data = self._request_json(
            "GET",
            f"/v1/compliance/{project_id}",
            params=self._compact({"since": since, "limit": limit}),
        )
        return self._parse_compliance_data(data["data"])

    def create_compliance_snapshot(self, project_id: str, payload: dict[str, Any]) -> ComplianceSnapshot:
        data = self._request_json("POST", f"/v1/compliance/{project_id}/snapshot", json=payload)
        return self._parse_compliance_snapshot(data["data"])

    def sync_rules(
        self,
        project: Optional[str] = None,
        stack: Optional[str] = None,
        since: Optional[str] = None,
    ) -> SyncResponse:
        data = self._request_json(
            "GET",
            "/v1/sync",
            params=self._compact({"project": project, "stack": stack, "since": since}),
        )
        return SyncResponse(
            data=[self._parse_rule(item) for item in data.get("data", [])],
            meta=self._parse_sync_meta(data.get("meta", {})),
        )

    def ack_sync(self, project_id: str, rule_version_hash: str) -> SyncAckResult:
        data = self._request_json(
            "POST",
            "/v1/sync/ack",
            json={"projectId": project_id, "ruleVersionHash": rule_version_hash},
        )
        return SyncAckResult(synced=bool(data.get("data", {}).get("synced", False)))

    def list_tokens(self, org_id: Optional[str] = None) -> list[ApiToken]:
        data = self._request_json("GET", "/v1/tokens", params=self._compact({"org_id": org_id}))
        return [self._parse_api_token(item) for item in data.get("data", [])]

    def create_token(self, payload: dict[str, Any]) -> CreatedApiToken:
        data = self._request_json("POST", "/v1/tokens", json=payload)
        return self._parse_created_api_token(data["data"])

    def delete_token(self, token_id: str) -> DeleteResult:
        data = self._request_json("DELETE", f"/v1/tokens/{token_id}")
        return DeleteResult(deleted=bool(data.get("data", {}).get("deleted", False)))

    def get_top_violations(
        self,
        project_id: Optional[str] = None,
        since: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[TopViolation]:
        data = self._request_json(
            "GET",
            "/v1/analytics/top-violations",
            params=self._compact({"project_id": project_id, "since": since, "limit": limit}),
        )
        return [
            TopViolation(
                rule_id=item.get("ruleId"),
                count=int(item.get("count", 0)),
            )
            for item in data.get("data", [])
        ]

    def get_analytics_trend(
        self,
        project_id: str,
        interval: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> AnalyticsTrend:
        data = self._request_json(
            "GET",
            "/v1/analytics/trend",
            params=self._compact({"project_id": project_id, "interval": interval, "limit": limit}),
        )
        payload = data["data"]
        return AnalyticsTrend(
            project_id=payload.get("projectId", ""),
            interval=payload.get("interval", ""),
            trend=[self._parse_compliance_trend(item) for item in payload.get("trend", [])],
        )

    def get_category_breakdown(
        self,
        project_id: Optional[str] = None,
        since: Optional[str] = None,
    ) -> list[AnalyticsCategoryBreakdown]:
        data = self._request_json(
            "GET",
            "/v1/analytics/category-breakdown",
            params=self._compact({"project_id": project_id, "since": since}),
        )
        return [
            AnalyticsCategoryBreakdown(
                action=item.get("action", ""),
                count=int(item.get("count", 0)),
            )
            for item in data.get("data", [])
        ]

    def get_source_stats(
        self,
        project_id: Optional[str] = None,
        since: Optional[str] = None,
    ) -> list[AnalyticsSourceStat]:
        data = self._request_json(
            "GET",
            "/v1/analytics/source-stats",
            params=self._compact({"project_id": project_id, "since": since}),
        )
        return [
            AnalyticsSourceStat(
                status=item.get("status", ""),
                count=int(item.get("count", 0)),
            )
            for item in data.get("data", [])
        ]

    def list_webhook_endpoints(self, org_id: Optional[str] = None) -> list[WebhookEndpoint]:
        data = self._request_json("GET", "/v1/webhooks/endpoints", params=self._compact({"org_id": org_id}))
        return [self._parse_webhook_endpoint(item) for item in data.get("data", [])]

    def get_webhook_endpoint(self, endpoint_id: str) -> WebhookEndpoint:
        data = self._request_json("GET", f"/v1/webhooks/endpoints/{endpoint_id}")
        return self._parse_webhook_endpoint(data["data"])

    def create_webhook_endpoint(self, payload: dict[str, Any]) -> WebhookEndpoint:
        data = self._request_json("POST", "/v1/webhooks/endpoints", json=payload)
        return self._parse_webhook_endpoint(data["data"])

    def update_webhook_endpoint(self, endpoint_id: str, payload: dict[str, Any]) -> WebhookEndpoint:
        data = self._request_json("PUT", f"/v1/webhooks/endpoints/{endpoint_id}", json=payload)
        return self._parse_webhook_endpoint(data["data"])

    def delete_webhook_endpoint(self, endpoint_id: str) -> DeleteResult:
        data = self._request_json("DELETE", f"/v1/webhooks/endpoints/{endpoint_id}")
        return DeleteResult(deleted=bool(data.get("data", {}).get("deleted", False)))

    def test_webhook_endpoint(self, endpoint_id: str) -> DeliveryResult:
        data = self._request_json("POST", f"/v1/webhooks/endpoints/{endpoint_id}/test")
        payload = data.get("data", {})
        return DeliveryResult(
            success=bool(payload.get("success", False)),
            status_code=payload.get("statusCode"),
            error=payload.get("error"),
        )

    def list_webhook_deliveries(
        self,
        endpoint_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[WebhookDelivery]:
        data = self._request_json(
            "GET",
            "/v1/webhooks/deliveries",
            params=self._compact({"endpoint_id": endpoint_id, "limit": limit}),
        )
        return [self._parse_webhook_delivery(item) for item in data.get("data", [])]

    def close(self):
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> Any:
        response = self._client.request(method, path, params=params, json=json)
        if response.status_code >= 400:
            raise RuleboundError(
                f"API error {response.status_code}",
                status_code=response.status_code,
                body=response.text,
            )
        return response.json()

    def _request_text(
        self,
        method: str,
        path: str,
        *,
        params: Optional[dict[str, Any]] = None,
        json: Optional[dict[str, Any]] = None,
    ) -> str:
        response = self._client.request(method, path, params=params, json=json)
        if response.status_code >= 400:
            raise RuleboundError(
                f"API error {response.status_code}",
                status_code=response.status_code,
                body=response.text,
            )
        return response.text

    @staticmethod
    def _compact(payload: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in payload.items() if value is not None}

    @staticmethod
    def _parse_rule(data: dict[str, Any]) -> Rule:
        return Rule(
            id=data.get("id", ""),
            rule_set_id=data.get("ruleSetId", ""),
            title=data.get("title", ""),
            content=data.get("content", ""),
            category=data.get("category", ""),
            severity=data.get("severity", "warning"),
            modality=data.get("modality", "should"),
            tags=list(data.get("tags", []) or []),
            stack=list(data.get("stack", []) or []),
            is_active=bool(data.get("isActive", True)),
            version=int(data.get("version", 1)),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
        )

    @staticmethod
    def _parse_project(data: dict[str, Any]) -> Project:
        return Project(
            id=data.get("id", ""),
            org_id=data.get("orgId", ""),
            name=data.get("name", ""),
            slug=data.get("slug", ""),
            repo_url=data.get("repoUrl"),
            stack=list(data.get("stack", []) or []),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
        )

    @staticmethod
    def _parse_validation_report(data: dict[str, Any]) -> ValidationReport:
        results = [
            ValidationResult(
                rule_id=item.get("ruleId", ""),
                rule_title=item.get("ruleTitle", ""),
                severity=item.get("severity", ""),
                modality=item.get("modality", ""),
                status=item.get("status", "NOT_COVERED"),
                reason=item.get("reason", ""),
                suggested_fix=item.get("suggestedFix"),
            )
            for item in data.get("results", [])
        ]
        summary_payload = data.get("summary", {})
        summary = ValidationSummary(
            passed=int(summary_payload.get("pass", 0)),
            violated=int(summary_payload.get("violated", 0)),
            not_covered=int(summary_payload.get("notCovered", 0)),
        )
        return ValidationReport(
            task=data.get("task", ""),
            rules_matched=int(data.get("rulesMatched", 0)),
            rules_total=int(data.get("rulesTotal", 0)),
            results=results,
            summary=summary,
            status=data.get("status", "PASSED"),
        )

    @staticmethod
    def _parse_audit_entry(data: dict[str, Any]) -> AuditEntry:
        return AuditEntry(
            id=data.get("id", ""),
            org_id=data.get("orgId", ""),
            project_id=data.get("projectId"),
            user_id=data.get("userId"),
            action=data.get("action", ""),
            rule_id=data.get("ruleId"),
            status=data.get("status", ""),
            metadata=data.get("metadata"),
            created_at=data.get("createdAt", ""),
        )

    @staticmethod
    def _parse_compliance_trend(data: dict[str, Any]) -> ComplianceTrend:
        return ComplianceTrend(
            score=int(data.get("score", 0)),
            pass_count=int(data.get("passCount", 0)),
            violated_count=int(data.get("violatedCount", 0)),
            not_covered_count=int(data.get("notCoveredCount", 0)),
            date=data.get("date", ""),
        )

    def _parse_compliance_data(self, data: dict[str, Any]) -> ComplianceData:
        return ComplianceData(
            project_id=data.get("projectId", ""),
            current_score=data.get("currentScore"),
            trend=[self._parse_compliance_trend(item) for item in data.get("trend", [])],
        )

    @staticmethod
    def _parse_compliance_snapshot(data: dict[str, Any]) -> ComplianceSnapshot:
        return ComplianceSnapshot(
            id=data.get("id", ""),
            project_id=data.get("projectId", ""),
            score=int(data.get("score", 0)),
            pass_count=int(data.get("passCount", 0)),
            violated_count=int(data.get("violatedCount", 0)),
            not_covered_count=int(data.get("notCoveredCount", 0)),
            snapshot_at=data.get("snapshotAt", ""),
        )

    @staticmethod
    def _parse_sync_meta(data: dict[str, Any]) -> SyncMeta:
        return SyncMeta(
            total=int(data.get("total", 0)),
            version_hash=data.get("versionHash", ""),
            synced_at=data.get("syncedAt", ""),
        )

    @staticmethod
    def _parse_api_token(data: dict[str, Any]) -> ApiToken:
        return ApiToken(
            id=data.get("id", ""),
            org_id=data.get("orgId", ""),
            user_id=data.get("userId", ""),
            name=data.get("name", ""),
            token_prefix=data.get("tokenPrefix", ""),
            scopes=list(data.get("scopes", []) or []),
            expires_at=data.get("expiresAt"),
            last_used_at=data.get("lastUsedAt"),
            created_at=data.get("createdAt", ""),
        )

    @staticmethod
    def _parse_created_api_token(data: dict[str, Any]) -> CreatedApiToken:
        return CreatedApiToken(
            id=data.get("id", ""),
            name=data.get("name", ""),
            token=data.get("token", ""),
            prefix=data.get("prefix", ""),
            scopes=list(data.get("scopes", []) or []),
            expires_at=data.get("expiresAt"),
            created_at=data.get("createdAt", ""),
        )

    @staticmethod
    def _parse_webhook_endpoint(data: dict[str, Any]) -> WebhookEndpoint:
        return WebhookEndpoint(
            id=data.get("id", ""),
            org_id=data.get("orgId", ""),
            url=data.get("url", ""),
            events=list(data.get("events", []) or []),
            is_active=bool(data.get("isActive", True)),
            description=data.get("description"),
            created_at=data.get("createdAt", ""),
            updated_at=data.get("updatedAt", ""),
            secret=data.get("secret"),
            secret_prefix=data.get("secretPrefix"),
        )

    @staticmethod
    def _parse_webhook_delivery(data: dict[str, Any]) -> WebhookDelivery:
        return WebhookDelivery(
            id=data.get("id", ""),
            endpoint_id=data.get("endpointId", ""),
            event=data.get("event", ""),
            status=data.get("status", ""),
            response_code=data.get("responseCode"),
            attempts=int(data.get("attempts", 0)),
            created_at=data.get("createdAt", ""),
            payload=data.get("payload"),
            response_body=data.get("responseBody"),
            next_retry_at=data.get("nextRetryAt"),
        )
