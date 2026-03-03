from __future__ import annotations

import httpx
from typing import Optional
from rulebound.types import Rule, ValidationReport, ValidationResult


class RuleboundClient:
    """Python client for the Rulebound API server."""

    def __init__(
        self,
        api_key: str,
        server: str = "http://localhost:3001",
        timeout: float = 30.0,
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
        )

    def validate(
        self,
        code: str,
        language: Optional[str] = None,
        project: Optional[str] = None,
        task: Optional[str] = None,
    ) -> ValidationReport:
        """Validate code against organization rules."""
        payload: dict = {"code": code}
        if language:
            payload["language"] = language
        if project:
            payload["project"] = project
        if task:
            payload["task"] = task

        resp = self._client.post("/v1/validate", json=payload)
        resp.raise_for_status()
        data = resp.json()
        return self._parse_report(data)

    def validate_plan(
        self,
        plan: str,
        task: Optional[str] = None,
    ) -> ValidationReport:
        """Validate an implementation plan against rules."""
        payload: dict = {"plan": plan}
        if task:
            payload["task"] = task

        resp = self._client.post("/v1/validate", json=payload)
        resp.raise_for_status()
        return self._parse_report(resp.json())

    def get_rules(
        self,
        stack: Optional[str] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> list[Rule]:
        """Fetch rules from the server."""
        params: dict = {}
        if stack:
            params["stack"] = stack
        if category:
            params["category"] = category
        if tag:
            params["tag"] = tag

        resp = self._client.get("/v1/rules", params=params)
        resp.raise_for_status()
        data = resp.json()
        return [self._parse_rule(r) for r in data.get("data", [])]

    def sync_rules(
        self,
        project: Optional[str] = None,
        stack: Optional[str] = None,
        since: Optional[str] = None,
    ) -> dict:
        """Sync rules from the central server."""
        params: dict = {}
        if project:
            params["project"] = project
        if stack:
            params["stack"] = stack
        if since:
            params["since"] = since

        resp = self._client.get("/v1/sync", params=params)
        resp.raise_for_status()
        return resp.json()

    def get_compliance(self, project_id: str) -> dict:
        """Get compliance data for a project."""
        resp = self._client.get(f"/v1/compliance/{project_id}")
        resp.raise_for_status()
        return resp.json().get("data", {})

    def log_audit(
        self,
        org_id: str,
        action: str,
        status: str,
        project_id: Optional[str] = None,
        rule_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        """Log an audit event."""
        payload: dict = {"orgId": org_id, "action": action, "status": status}
        if project_id:
            payload["projectId"] = project_id
        if rule_id:
            payload["ruleId"] = rule_id
        if metadata:
            payload["metadata"] = metadata

        resp = self._client.post("/v1/audit", json=payload)
        resp.raise_for_status()
        return resp.json().get("data", {})

    def close(self):
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    @staticmethod
    def _parse_report(data: dict) -> ValidationReport:
        results = [
            ValidationResult(
                rule_id=r.get("ruleId", ""),
                rule_title=r.get("ruleTitle", ""),
                severity=r.get("severity", "warning"),
                modality=r.get("modality", "should"),
                status=r.get("status", "NOT_COVERED"),
                reason=r.get("reason", ""),
                suggested_fix=r.get("suggestedFix"),
            )
            for r in data.get("results", [])
        ]
        return ValidationReport(
            task=data.get("task", ""),
            rules_matched=data.get("rulesMatched", 0),
            rules_total=data.get("rulesTotal", 0),
            results=results,
            summary=data.get("summary", {}),
            status=data.get("status", "PASSED"),
        )

    @staticmethod
    def _parse_rule(data: dict) -> Rule:
        return Rule(
            id=data.get("id", ""),
            title=data.get("title", ""),
            content=data.get("content", ""),
            category=data.get("category", "general"),
            severity=data.get("severity", "warning"),
            modality=data.get("modality", "should"),
            tags=data.get("tags", []),
            stack=data.get("stack", []),
            version=data.get("version", 1),
        )
