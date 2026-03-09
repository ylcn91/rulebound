from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Generic, Optional, TypeVar

T = TypeVar("T")


@dataclass
class DataResponse(Generic[T]):
    data: T


@dataclass
class ListResponse(Generic[T]):
    data: list[T]
    total: Optional[int] = None


@dataclass
class DeleteResult:
    deleted: bool


@dataclass
class Rule:
    id: str
    rule_set_id: str
    title: str
    content: str
    category: str
    severity: str = "warning"
    modality: str = "should"
    tags: list[str] = field(default_factory=list)
    stack: list[str] = field(default_factory=list)
    is_active: bool = True
    version: int = 1
    created_at: str = ""
    updated_at: str = ""


@dataclass
class Project:
    id: str
    org_id: str
    name: str
    slug: str
    repo_url: Optional[str] = None
    stack: list[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


@dataclass
class ValidationResult:
    rule_id: str
    rule_title: str
    severity: str
    modality: str
    status: str
    reason: str
    suggested_fix: Optional[str] = None


@dataclass
class ValidationSummary:
    passed: int = 0
    violated: int = 0
    not_covered: int = 0


@dataclass
class ValidationReport:
    task: str
    rules_matched: int
    rules_total: int
    results: list[ValidationResult]
    summary: ValidationSummary
    status: str

    @property
    def passed(self) -> bool:
        return self.status == "PASSED"

    @property
    def blocked(self) -> bool:
        return self.status == "FAILED"

    @property
    def violations(self) -> list[ValidationResult]:
        return [result for result in self.results if result.status == "VIOLATED"]


@dataclass
class AuditEntry:
    id: str
    org_id: str
    project_id: Optional[str]
    user_id: Optional[str]
    action: str
    rule_id: Optional[str]
    status: str
    metadata: Optional[dict[str, Any]]
    created_at: str


@dataclass
class ComplianceTrend:
    score: int
    pass_count: int
    violated_count: int
    not_covered_count: int
    date: str


@dataclass
class ComplianceData:
    project_id: str
    current_score: Optional[int]
    trend: list[ComplianceTrend] = field(default_factory=list)


@dataclass
class ComplianceSnapshot:
    id: str
    project_id: str
    score: int
    pass_count: int
    violated_count: int
    not_covered_count: int
    snapshot_at: str


@dataclass
class SyncMeta:
    total: int
    version_hash: str
    synced_at: str


@dataclass
class SyncResponse:
    data: list[Rule]
    meta: SyncMeta


@dataclass
class SyncAckResult:
    synced: bool


@dataclass
class ApiToken:
    id: str
    org_id: str
    user_id: str
    name: str
    token_prefix: str
    scopes: list[str] = field(default_factory=list)
    expires_at: Optional[str] = None
    last_used_at: Optional[str] = None
    created_at: str = ""


@dataclass
class CreatedApiToken:
    id: str
    name: str
    token: str
    prefix: str
    scopes: list[str] = field(default_factory=list)
    expires_at: Optional[str] = None
    created_at: str = ""


@dataclass
class TopViolation:
    rule_id: Optional[str]
    count: int


@dataclass
class AnalyticsTrend:
    project_id: str
    interval: str
    trend: list[ComplianceTrend] = field(default_factory=list)


@dataclass
class AnalyticsCategoryBreakdown:
    action: str
    count: int


@dataclass
class AnalyticsSourceStat:
    status: str
    count: int


@dataclass
class WebhookEndpoint:
    id: str
    org_id: str
    url: str
    events: list[str] = field(default_factory=list)
    is_active: bool = True
    description: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    secret: Optional[str] = None
    secret_prefix: Optional[str] = None


@dataclass
class WebhookDelivery:
    id: str
    endpoint_id: str
    event: str
    status: str
    response_code: Optional[int]
    attempts: int
    created_at: str
    payload: Optional[dict[str, Any]] = None
    response_body: Optional[str] = None
    next_retry_at: Optional[str] = None


@dataclass
class DeliveryResult:
    success: bool
    status_code: Optional[int] = None
    error: Optional[str] = None
