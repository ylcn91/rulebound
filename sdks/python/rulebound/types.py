from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Rule:
    id: str
    title: str
    content: str
    category: str
    severity: str = "warning"
    modality: str = "should"
    tags: list[str] = field(default_factory=list)
    stack: list[str] = field(default_factory=list)
    version: int = 1


@dataclass
class ValidationResult:
    rule_id: str
    rule_title: str
    severity: str
    modality: str
    status: str  # PASS | VIOLATED | NOT_COVERED
    reason: str
    suggested_fix: Optional[str] = None


@dataclass
class ValidationReport:
    task: str
    rules_matched: int
    rules_total: int
    results: list[ValidationResult]
    summary: dict  # pass, violated, not_covered
    status: str  # PASSED | PASSED_WITH_WARNINGS | FAILED

    @property
    def passed(self) -> bool:
        return self.status == "PASSED"

    @property
    def blocked(self) -> bool:
        return self.status == "FAILED"

    @property
    def violations(self) -> list[ValidationResult]:
        return [r for r in self.results if r.status == "VIOLATED"]
