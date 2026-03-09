from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import httpx
import pytest

from rulebound import RuleboundClient, RuleboundError


@dataclass
class MockReply:
    kind: str
    payload: Any
    status: int = 200


class RecorderTransport:
    def __init__(self, replies: list[MockReply]):
        self._replies = replies
        self.requests: list[dict[str, Any]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        raw_body = request.content.decode() if request.content else ""
        self.requests.append(
            {
                "method": request.method,
                "url": str(request.url),
                "body": json.loads(raw_body) if raw_body else None,
            }
        )
        reply = self._replies.pop(0)
        if reply.kind == "text":
            return httpx.Response(reply.status, text=reply.payload)
        return httpx.Response(reply.status, json=reply.payload)


def make_client(replies: list[MockReply]) -> tuple[RuleboundClient, RecorderTransport]:
    transport = RecorderTransport(replies)
    client = RuleboundClient(
        api_key="test-api-key",
        server="http://localhost:3001",
        transport=httpx.MockTransport(transport),
    )
    return client, transport


def test_validate_and_rules_crud():
    client, transport = make_client(
        [
            MockReply(
                "json",
                {
                    "task": "Validate auth flow",
                    "rulesMatched": 1,
                    "rulesTotal": 1,
                    "results": [],
                    "summary": {"pass": 1, "violated": 0, "notCovered": 0},
                    "status": "PASSED",
                },
            ),
            MockReply(
                "json",
                {
                    "data": [
                        {
                            "id": "rule-1",
                            "ruleSetId": "set-1",
                            "title": "No eval",
                            "content": "Avoid eval",
                            "category": "security",
                            "severity": "error",
                            "modality": "must",
                            "tags": ["security"],
                            "stack": ["typescript"],
                            "isActive": True,
                            "version": 2,
                            "createdAt": "2026-03-08T10:00:00Z",
                            "updatedAt": "2026-03-08T10:00:00Z",
                        }
                    ],
                    "total": 1,
                },
            ),
            MockReply("json", {"data": {"deleted": True}}),
        ]
    )

    report = client.validate(plan="Implement OAuth callback", project="rulebound", use_llm=True)
    rules = client.list_rules(stack="typescript", q="eval", limit=10)
    deleted = client.delete_rule("rule-1")

    assert transport.requests[0]["url"] == "http://localhost:3001/v1/validate"
    assert transport.requests[0]["body"] == {
        "plan": "Implement OAuth callback",
        "project": "rulebound",
        "useLlm": True,
    }
    assert transport.requests[1]["url"] == "http://localhost:3001/v1/rules?stack=typescript&q=eval&limit=10"
    assert report.status == "PASSED"
    assert rules.total == 1
    assert deleted.deleted is True


def test_project_and_audit_contract():
    client, transport = make_client(
        [
            MockReply("json", {"data": [], "total": 0}),
            MockReply(
                "json",
                {
                    "data": {
                        "id": "proj-1",
                        "orgId": "org-1",
                        "name": "Rulebound",
                        "slug": "rulebound",
                        "repoUrl": "https://github.com/rulebound/rulebound",
                        "stack": ["typescript"],
                        "createdAt": "2026-03-08T10:00:00Z",
                        "updatedAt": "2026-03-08T10:00:00Z",
                    }
                },
                201,
            ),
            MockReply(
                "json",
                {
                    "data": [
                        {
                            "id": "audit-1",
                            "orgId": "org-1",
                            "projectId": "proj-1",
                            "userId": "user-1",
                            "action": "rule.created",
                            "ruleId": "rule-1",
                            "status": "SUCCESS",
                            "metadata": {"actor": "sdk-test"},
                            "createdAt": "2026-03-08T10:00:00Z",
                        }
                    ],
                    "total": 1,
                },
            ),
            MockReply("text", "id,action\n1,rule.created\n"),
        ]
    )

    projects = client.list_projects()
    created = client.create_project(
        {
            "name": "Rulebound",
            "slug": "rulebound",
            "repoUrl": "https://github.com/rulebound/rulebound",
            "stack": ["typescript"],
        }
    )
    audit = client.list_audit(org_id="org-1", project_id="proj-1", limit=5)
    exported = client.export_audit(org_id="org-1", limit=20)

    assert transport.requests[0]["url"] == "http://localhost:3001/v1/projects"
    assert transport.requests[1]["body"]["slug"] == "rulebound"
    assert transport.requests[2]["url"] == "http://localhost:3001/v1/audit?org_id=org-1&project_id=proj-1&limit=5"
    assert transport.requests[3]["url"] == "http://localhost:3001/v1/audit/export?org_id=org-1&limit=20"
    assert projects.total == 0
    assert created.org_id == "org-1"
    assert audit.data[0].action == "rule.created"
    assert "rule.created" in exported


def test_compliance_sync_tokens_analytics_and_webhooks():
    client, transport = make_client(
        [
            MockReply(
                "json",
                {
                    "data": {
                        "projectId": "proj-1",
                        "currentScore": 93,
                        "trend": [
                            {
                                "score": 93,
                                "passCount": 9,
                                "violatedCount": 1,
                                "notCoveredCount": 0,
                                "date": "2026-03-08T00:00:00Z",
                            }
                        ],
                    }
                },
            ),
            MockReply(
                "json",
                {
                    "data": {
                        "id": "snap-1",
                        "projectId": "proj-1",
                        "score": 95,
                        "passCount": 10,
                        "violatedCount": 0,
                        "notCoveredCount": 0,
                        "snapshotAt": "2026-03-08T12:00:00Z",
                    }
                },
                201,
            ),
            MockReply(
                "json",
                {
                    "data": [
                        {
                            "id": "rule-1",
                            "ruleSetId": "set-1",
                            "title": "No eval",
                            "content": "Avoid eval",
                            "category": "security",
                            "severity": "error",
                            "modality": "must",
                            "tags": ["security"],
                            "stack": ["typescript"],
                            "isActive": True,
                            "version": 2,
                            "createdAt": "2026-03-08T10:00:00Z",
                            "updatedAt": "2026-03-08T10:00:00Z",
                        }
                    ],
                    "meta": {"total": 1, "versionHash": "abc123", "syncedAt": "2026-03-08T12:00:00Z"},
                },
            ),
            MockReply("json", {"data": {"synced": True}}),
            MockReply(
                "json",
                {
                    "data": [
                        {
                            "id": "token-1",
                            "orgId": "org-1",
                            "userId": "user-1",
                            "name": "CI token",
                            "tokenPrefix": "rb_123456",
                            "scopes": ["read"],
                            "expiresAt": None,
                            "lastUsedAt": None,
                            "createdAt": "2026-03-08T10:00:00Z",
                        }
                    ]
                },
            ),
            MockReply("json", {"data": [{"ruleId": "rule-1", "count": 4}]}),
            MockReply(
                "json",
                {
                    "data": [
                        {
                            "id": "wh-1",
                            "orgId": "org-1",
                            "url": "https://hooks.example.com/rulebound",
                            "events": ["violation.detected"],
                            "isActive": True,
                            "description": "Production",
                            "secretPrefix": "whsec_ab...",
                            "createdAt": "2026-03-08T10:00:00Z",
                            "updatedAt": "2026-03-08T10:00:00Z",
                        }
                    ]
                },
            ),
            MockReply("json", {"data": {"success": True, "statusCode": 200}}),
            MockReply(
                "json",
                {
                    "data": [
                        {
                            "id": "delivery-1",
                            "endpointId": "wh-1",
                            "event": "test",
                            "status": "delivered",
                            "responseCode": 200,
                            "attempts": 1,
                            "createdAt": "2026-03-08T10:00:00Z",
                        }
                    ]
                },
            ),
        ]
    )

    compliance = client.get_compliance("proj-1", since="2026-03-01T00:00:00Z", limit=5)
    snapshot = client.create_compliance_snapshot("proj-1", {"score": 95, "passCount": 10})
    sync = client.sync_rules(project="rulebound", stack="typescript", since="2026-03-01T00:00:00Z")
    ack = client.ack_sync("proj-1", "abc123")
    tokens = client.list_tokens(org_id="org-1")
    top = client.get_top_violations(project_id="proj-1", limit=5)
    endpoints = client.list_webhook_endpoints(org_id="org-1")
    tested = client.test_webhook_endpoint("wh-1")
    deliveries = client.list_webhook_deliveries(endpoint_id="wh-1", limit=10)

    assert transport.requests[0]["url"] == "http://localhost:3001/v1/compliance/proj-1?since=2026-03-01T00%3A00%3A00Z&limit=5"
    assert transport.requests[2]["url"] == "http://localhost:3001/v1/sync?project=rulebound&stack=typescript&since=2026-03-01T00%3A00%3A00Z"
    assert transport.requests[5]["url"] == "http://localhost:3001/v1/analytics/top-violations?project_id=proj-1&limit=5"
    assert transport.requests[6]["url"] == "http://localhost:3001/v1/webhooks/endpoints?org_id=org-1"
    assert transport.requests[8]["url"] == "http://localhost:3001/v1/webhooks/deliveries?endpoint_id=wh-1&limit=10"
    assert compliance.current_score == 93
    assert snapshot.score == 95
    assert sync.meta.version_hash == "abc123"
    assert ack.synced is True
    assert tokens[0].token_prefix == "rb_123456"
    assert top[0].count == 4
    assert endpoints[0].secret_prefix == "whsec_ab..."
    assert tested.success is True
    assert deliveries[0].status == "delivered"


def test_raises_rulebound_error_on_failure():
    client, _ = make_client([MockReply("text", "Forbidden", 403)])

    with pytest.raises(RuleboundError) as exc_info:
        client.validate(plan="test")

    assert exc_info.value.status_code == 403
    assert exc_info.value.body == "Forbidden"
