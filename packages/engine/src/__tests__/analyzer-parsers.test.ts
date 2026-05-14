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

  it("treats malformed XML as a clean report (zero findings, PASS)", () => {
    const report = writeReport("target/pmd.xml", `<<<not xml>>>`)
    const result = runCheck({
      type: "analyzer",
      analyzer: "pmd",
      report,
      report_format: "pmd-xml",
    })
    // Parser is regex-based and tolerant; junk input means no findings extracted.
    expect(result.status).toBe("PASS")
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
