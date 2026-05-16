import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runAnalyzerCheck } from "../checks/runners/analyzer.js"
import type { AnalyzerCheck } from "../checks/types.js"

/**
 * These tests exercise the XML parsers in
 * packages/engine/src/checks/runners/analyzer.ts using inline fixtures.
 * They MUST NOT spawn mvn. Each test writes a known-good or known-bad
 * report file into a tmpdir and calls runAnalyzerCheck without `run`.
 */

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "rulebound-analyzer-"))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function writeReport(rel: string, content: string): string {
  const full = join(tmpDir, rel)
  mkdirSync(join(tmpDir, rel.split("/").slice(0, -1).join("/") || "."), {
    recursive: true,
  })
  writeFileSync(full, content)
  return rel
}

function runCheck(check: AnalyzerCheck) {
  return runAnalyzerCheck({
    cwd: tmpDir,
    ruleId: "java.analyzer",
    check,
    allowCommandExecution: false,
  })
}

describe("PMD XML parser", () => {
  it("returns PASS on an empty (clean) report", () => {
    const report = writeReport(
      "target/pmd.xml",
      `<?xml version="1.0"?><pmd version="7.0.0"></pmd>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report,
      report_format: "pmd-xml",
    })
    expect(result.status).toBe("PASS")
    expect(result.blocking).toBe(false)
  })

  it("flags a SystemPrintln violation as a blocking warning", () => {
    const report = writeReport(
      "target/pmd.xml",
      `<?xml version="1.0"?>
<pmd version="7.0.0">
  <file name="src/main/java/com/example/demo/UserService.java">
    <violation beginline="14" endline="14" rule="SystemPrintln"
               ruleset="Best Practices" priority="3">
      Avoid using System.out.println
    </violation>
  </file>
</pmd>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report,
      report_format: "pmd-xml",
      fail_on_severity: "warning",
      severity: "error",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.blocking).toBe(true)
    expect(result.evidence?.filePath).toContain("UserService.java")
    expect(result.evidence?.line).toBe(14)
    expect(result.evidence?.matches?.[0]).toMatch(/Avoid using System\.out\.println/)
  })

  it("treats priority<=2 PMD violations as error severity", () => {
    const report = writeReport(
      "target/pmd.xml",
      `<?xml version="1.0"?>
<pmd version="7.0.0">
  <file name="A.java">
    <violation beginline="1" rule="AvoidThrowingNullPointerException" priority="2">
      boom
    </violation>
  </file>
</pmd>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report,
      report_format: "pmd-xml",
      fail_on_severity: "error",
    })
    expect(result.status).toBe("VIOLATED")
  })

  it("PMD priority>2 finding is filtered out when fail_on_severity=error", () => {
    const report = writeReport(
      "target/pmd.xml",
      `<?xml version="1.0"?>
<pmd version="7.0.0">
  <file name="A.java">
    <violation beginline="1" rule="UnusedImports" priority="4">unused</violation>
  </file>
</pmd>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report,
      report_format: "pmd-xml",
      fail_on_severity: "error",
    })
    expect(result.status).toBe("PASS")
  })
})

describe("Checkstyle XML parser", () => {
  it("returns PASS on an empty report", () => {
    const report = writeReport(
      "target/checkstyle-result.xml",
      `<?xml version="1.0" encoding="UTF-8"?><checkstyle version="10.0"></checkstyle>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
    })
    expect(result.status).toBe("PASS")
  })

  it("flags an error-level Checkstyle violation", () => {
    const report = writeReport(
      "target/checkstyle-result.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="10.0">
  <file name="src/main/java/com/example/demo/UserService.java">
    <error line="14" column="9" severity="error"
           message="Use a logger instead of System.out.println"
           source="com.puppycrawl.tools.checkstyle.checks.regexp.RegexpSinglelineJavaCheck"/>
    <error line="22" severity="warning"
           message="empty catch block"
           source="com.puppycrawl.tools.checkstyle.checks.blocks.EmptyBlockCheck"/>
  </file>
</checkstyle>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
      fail_on_severity: "warning",
      severity: "error",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.blocking).toBe(true)
    expect(result.evidence?.matches).toHaveLength(2)
    expect(result.evidence?.matches?.[0]).toMatch(/\[error\]/)
    expect(result.evidence?.matches?.[1]).toMatch(/\[warning\]/)
  })

  it("filters out info-severity Checkstyle entries when fail_on_severity=warning", () => {
    const report = writeReport(
      "target/checkstyle-result.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="10.0">
  <file name="A.java">
    <error line="1" severity="info" message="just FYI"
           source="com.puppycrawl.tools.checkstyle.checks.coding.MagicNumberCheck"/>
  </file>
</checkstyle>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
      fail_on_severity: "warning",
    })
    expect(result.status).toBe("PASS")
  })
})

describe("SpotBugs XML parser", () => {
  it("returns PASS on a report with no BugInstance entries", () => {
    const report = writeReport(
      "target/spotbugsXml.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<BugCollection version="4.8.0"></BugCollection>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "spotbugs",
      report,
      report_format: "spotbugs-xml",
    })
    expect(result.status).toBe("PASS")
  })

  it("captures BugInstance with priority=1 as error", () => {
    const report = writeReport(
      "target/spotbugsXml.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<BugCollection version="4.8.0">
  <BugInstance type="DE_MIGHT_IGNORE" priority="1" category="BAD_PRACTICE">
    <ShortMessage>Exception ignored</ShortMessage>
    <LongMessage>Method com.example.demo.UserService.parseOrZero(String) ignores exception</LongMessage>
    <SourceLine classname="com.example.demo.UserService"
                sourcepath="com/example/demo/UserService.java"
                start="22" end="22"/>
  </BugInstance>
</BugCollection>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "spotbugs",
      report,
      report_format: "spotbugs-xml",
      fail_on_severity: "error",
      severity: "error",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.blocking).toBe(true)
    expect(result.evidence?.filePath).toBe("com/example/demo/UserService.java")
    expect(result.evidence?.line).toBe(22)
    expect(result.evidence?.matches?.[0]).toMatch(/ignores exception/)
  })

  it("priority=2 BugInstance is reported as warning, not blocking when fail_on_severity=error", () => {
    const report = writeReport(
      "target/spotbugsXml.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<BugCollection version="4.8.0">
  <BugInstance type="DM_DEFAULT_ENCODING" priority="2">
    <LongMessage>Reliance on default encoding</LongMessage>
    <SourceLine sourcepath="A.java" start="3"/>
  </BugInstance>
</BugCollection>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "spotbugs",
      report,
      report_format: "spotbugs-xml",
      fail_on_severity: "error",
    })
    expect(result.status).toBe("PASS")
  })
})

describe("JUnit XML parser (Surefire + ArchUnit)", () => {
  it("returns PASS when every testcase succeeded", () => {
    const report = writeReport(
      "target/surefire-reports/TEST-com.example.demo.ArchitectureTest.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.demo.ArchitectureTest" tests="2" failures="0" errors="0">
  <testcase name="controllers_should_not_use_repositories" classname="com.example.demo.ArchitectureTest" time="0.12"/>
  <testcase name="no_field_injection" classname="com.example.demo.ArchitectureTest" time="0.08"/>
</testsuite>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "junit",
      report,
      report_format: "junit-xml",
    })
    expect(result.status).toBe("PASS")
  })

  it("captures an ArchUnit failure as an error finding", () => {
    const report = writeReport(
      "target/surefire-reports/TEST-com.example.demo.ArchitectureTest.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.demo.ArchitectureTest" tests="2" failures="1" errors="0">
  <testcase name="controllers_should_not_use_repositories"
            classname="com.example.demo.ArchitectureTest" time="0.15">
    <failure message="Architecture Violation [Priority: MEDIUM] - Rule 'no classes that reside in a package &quot;..controller..&quot; should depend on classes that reside in a package &quot;..repository..&quot;' was violated (1 times)" type="java.lang.AssertionError">
      com.tngtech.archunit.lang.ArchAssertionError: Architecture Violation
    </failure>
  </testcase>
  <testcase name="no_field_injection" classname="com.example.demo.ArchitectureTest" time="0.08"/>
</testsuite>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "junit",
      report,
      report_format: "junit-xml",
      fail_on_severity: "error",
      severity: "error",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.blocking).toBe(true)
    expect(result.evidence?.filePath).toBe("com.example.demo.ArchitectureTest")
    expect(result.evidence?.matches?.[0]).toMatch(/Architecture Violation/)
  })

  it("captures <error> (test errored) entries as error findings", () => {
    const report = writeReport(
      "target/surefire-reports/TEST-com.example.demo.UserServiceTest.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.demo.UserServiceTest" tests="1" failures="0" errors="1">
  <testcase name="greet_returns_greeting" classname="com.example.demo.UserServiceTest">
    <error message="NullPointerException" type="java.lang.NullPointerException">stack trace here</error>
  </testcase>
</testsuite>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "junit",
      report,
      report_format: "junit-xml",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.evidence?.matches?.[0]).toMatch(/NullPointerException/)
  })
})

describe("Missing or malformed reports", () => {
  it("returns ERROR when the report file does not exist", () => {
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report: "target/does-not-exist.xml",
      report_format: "pmd-xml",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
    expect(result.reason).toMatch(/not found/i)
  })

  it("returns ERROR for malformed XML instead of a clean PASS", () => {
    const report = writeReport("target/pmd.xml", `<<<not xml>>>`)
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report,
      report_format: "pmd-xml",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
    expect(result.reason).toMatch(/malformed analyzer report/i)
  })

  it("parses ESLint native JSON output (array shape)", () => {
    const report = writeReport(
      "target/eslint.json",
      JSON.stringify([
        {
          filePath: "/abs/path/src/a.ts",
          messages: [
            { ruleId: "no-unused-vars", severity: 2, message: "Unused", line: 3, column: 5 },
            { ruleId: "no-debugger", severity: 1, message: "Debugger present", line: 7 },
          ],
        },
        { filePath: "/abs/path/src/b.ts", messages: [] },
      ]),
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "eslint",
      report,
      report_format: "json",
      fail_on_severity: "warning",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.reason).toContain("2 finding(s)")
    expect(result.evidence?.matches?.length).toBe(2)
  })

  it("ESLint native JSON with all clean files returns PASS", () => {
    const report = writeReport(
      "target/eslint-clean.json",
      JSON.stringify([{ filePath: "/abs/clean.ts", messages: [] }]),
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "eslint",
      report,
      report_format: "json",
    })
    expect(result.status).toBe("PASS")
  })
})

/**
 * ENG-002 — extended coverage:
 *  1. Malformed reports must NOT throw and must surface non-blocking ERROR.
 *  2. Missing-report contract: today the runner returns `ERROR` for *all*
 *     missing report cases (PASS path = report present + no findings).
 *     A future `report_optional: true` mode could return NOT_APPLICABLE, but
 *     it does not exist yet — this matrix pins that we treat absence as
 *     ERROR until an explicit opt-in surface is added.
 *  3. Severity-threshold transitions across info / warning / error.
 *  4. Large reports must not blow the heap or evidence matcher.
 */
describe("ENG-002: malformed analyzer report behaviour", () => {
  it("PMD parser returns ERROR on truncated/dangling tags without throwing", () => {
    const report = writeReport(
      "target/pmd.xml",
      `<?xml version="1.0"?><pmd version="7.0.0"><file name="A.java"><violation beginline="1" rule="X"`,
    )
    let result: ReturnType<typeof runCheck> | undefined
    expect(() => {
      result = runCheck({
        type: "analyzer",
        analyzer: "pmd",
        report,
        report_format: "pmd-xml",
      })
    }).not.toThrow()
    expect(result?.status).toBe("ERROR")
    expect(result?.blocking).toBe(false)
  })

  it("JUnit parser returns ERROR on malformed XML", () => {
    const report = writeReport(
      "target/surefire-reports/TEST-bad.xml",
      `<?xml version="1.0"?><testsuite><testcase name="x"><failure message="bad"></testsuite>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "junit",
      report,
      report_format: "junit-xml",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
  })

  it("Checkstyle parser returns ERROR on mis-nested elements", () => {
    const report = writeReport(
      "target/checkstyle-result.xml",
      `<?xml version="1.0"?><checkstyle><file name="X.java"><error line="1" severity="error" message=""</file></checkstyle>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
  })

  it("SpotBugs parser returns ERROR on unclosed BugInstance entries", () => {
    const report = writeReport(
      "target/spotbugsXml.xml",
      `<?xml version="1.0"?><BugCollection><BugInstance type="X" priority="1"><SourceLine sourcepath="A.java" start="1"/>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "spotbugs",
      report,
      report_format: "spotbugs-xml",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
  })

  it("SARIF parser returns ERROR on broken JSON without throwing", () => {
    const report = writeReport("target/scan.sarif", `{ "runs": [ { not valid json`)
    const result = runCheck({
      type: "analyzer",
      analyzer: "semgrep",
      report,
      report_format: "sarif",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
  })

  it("ESLint JSON object-shape (not array) returns ERROR without throwing", () => {
    const report = writeReport(
      "target/eslint-bad.json",
      JSON.stringify({ filePath: "a.ts", messages: [] }),
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "eslint",
      report,
      report_format: "json",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
  })

  it("Non-JSON in ESLint report returns ERROR", () => {
    const report = writeReport("target/eslint-junk.json", `not json at all`)
    const result = runCheck({
      type: "analyzer",
      analyzer: "eslint",
      report,
      report_format: "json",
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
  })
})

describe("ENG-002: missing-report NOT_APPLICABLE vs ERROR matrix", () => {
  // Documents the actual runner contract today: missing report is always ERROR
  // (non-blocking) with an actionable hint. There is no `report_optional` mode
  // yet — when one is added, this matrix should grow to include NOT_APPLICABLE.

  it.each([
    ["pmd", "pmd-xml"],
    ["checkstyle", "checkstyle-xml"],
    ["spotbugs", "spotbugs-xml"],
    ["junit", "junit-xml"],
    ["eslint", "json"],
    ["semgrep", "sarif"],
    ["gitleaks", "sarif"],
  ] as const)("%s missing report → ERROR (non-blocking) with actionable hint", (analyzer, fmt) => {
    const result = runCheck({
      type: "analyzer",
      analyzer,
      report: `target/never-emitted-${analyzer}.xml`,
      report_format: fmt,
    })
    expect(result.status).toBe("ERROR")
    expect(result.blocking).toBe(false)
    expect(result.reason).toMatch(/not found/i)
    // Hint must tell the user how to get the report.
    expect(result.reason).toMatch(/analyzer|build|run/i)
    expect(result.evidence?.analyzerReport).toContain(analyzer)
  })

  it("missing report with run= and allowCommandExecution=false stays NOT_APPLICABLE", () => {
    // When a `run` is declared but commands are not allowed, the runner
    // short-circuits with NOT_APPLICABLE — *before* checking the report.
    const result = runAnalyzerCheck({
      cwd: tmpDir,
      ruleId: "java.analyzer",
      allowCommandExecution: false,
      check: {
        type: "analyzer",
        analyzer: "pmd",
        run: "mvn pmd:check",
        report: "target/never-emitted.xml",
        report_format: "pmd-xml",
      },
    })
    expect(result.status).toBe("NOT_APPLICABLE")
    expect(result.blocking).toBe(false)
    expect(result.reason).toMatch(/--allow-commands/)
  })
})

describe("ENG-002: severity threshold transitions", () => {
  function pmdWith(priority: number): string {
    return writeReport(
      `target/pmd-p${priority}.xml`,
      `<?xml version="1.0"?>
<pmd version="7.0.0"><file name="A.java">
  <violation beginline="1" rule="R" priority="${priority}">m</violation>
</file></pmd>`,
    )
  }

  it("priority=3 (warning) is filtered when fail_on_severity=error", () => {
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report: pmdWith(3),
      report_format: "pmd-xml",
      fail_on_severity: "error",
    })
    expect(result.status).toBe("PASS")
  })

  it("priority=3 (warning) is reported when fail_on_severity=warning (default)", () => {
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report: pmdWith(3),
      report_format: "pmd-xml",
      // Omit fail_on_severity → default is "warning"
    })
    expect(result.status).toBe("VIOLATED")
  })

  it("info-level Checkstyle is included only when fail_on_severity=info", () => {
    const report = writeReport(
      "target/info.xml",
      `<?xml version="1.0"?>
<checkstyle><file name="X.java">
  <error line="1" severity="info" message="fyi"/>
</file></checkstyle>`,
    )
    const pass = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
      fail_on_severity: "warning",
    })
    expect(pass.status).toBe("PASS")

    const violated = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
      fail_on_severity: "info",
    })
    expect(violated.status).toBe("VIOLATED")
  })

  it("severity=warning at the check level keeps blocking=false even when finding is error-level", () => {
    const report = writeReport(
      "target/err.xml",
      `<?xml version="1.0"?>
<checkstyle><file name="X.java">
  <error line="1" severity="error" message="bad"/>
</file></checkstyle>`,
    )
    const result = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
      severity: "warning",
      fail_on_severity: "warning",
    })
    expect(result.status).toBe("VIOLATED")
    expect(result.blocking).toBe(false)
  })
})

describe("ENG-002: large report memory behaviour", () => {
  it("processes a ~10MB Checkstyle report with thousands of entries without OOM", () => {
    // Generate ~50_000 error rows (~200 bytes each → ~10MB).
    const ROWS = 50_000
    const head =
      `<?xml version="1.0" encoding="UTF-8"?>\n<checkstyle version="10.0">\n  <file name="src/Big.java">\n`
    const tail = `  </file>\n</checkstyle>\n`
    const row = (i: number) =>
      `    <error line="${i}" severity="error" message="repeated finding ${i} with some padding text to inflate the report" source="example.Check"/>\n`
    const body: string[] = []
    body.push(head)
    for (let i = 1; i <= ROWS; i++) body.push(row(i))
    body.push(tail)
    const report = writeReport("target/big-checkstyle.xml", body.join(""))

    const start = Date.now()
    const result = runCheck({
      type: "analyzer",
      analyzer: "checkstyle",
      report,
      report_format: "checkstyle-xml",
      fail_on_severity: "error",
    })
    const elapsedMs = Date.now() - start

    expect(result.status).toBe("VIOLATED")
    // The reason quotes only the first finding; matches[] caps at 20 entries.
    expect(result.evidence?.matches?.length).toBeLessThanOrEqual(20)
    expect(result.reason).toMatch(/finding\(s\) >= error/)
    // Soft timing guardrail — a regression past 30s on a 10MB report would
    // indicate quadratic behaviour. Loose bound to avoid CI flake.
    expect(elapsedMs).toBeLessThan(30_000)
  }, 60_000)
})
