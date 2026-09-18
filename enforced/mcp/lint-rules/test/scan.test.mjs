import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanKoreanProse, RULES, TOOL_NAME } from "../src/cli.mjs";

const VIOLATIONS = [
  "코드를 박다 방식으로 처리했다.",
  "데이터를 박아넣고 배포했다.",
  "값을 박아서 저장했다.",
  "이 결정은 판단되어진다.",
  "문서가 작성되어져 있다.",
  "AI에 의해 생성된 코드이다.",
  "외부 요인에 의해 발생한 오류이다.",
  "4대 핵심 운영 축을 추진한다.",
  "3대 전략 축을 수립했다.",
  "실전 경험을 보유하고 있습니다.",
  "최적화 경험을 가지고 있다.",
  "투입 첫날부터 가용성을 유지했다.",
  "첫날부터 체계를 갖췄다.",
  "이 기능은 매우 중요합니다.",
  "핵심적인 역할을 수행합니다.",
  "빠르게 변화하는 시장에 대응합니다.",
  "눈에 띄게 성과가 향상되었습니다.",
  "로그를 박다 기록했다.",
  "결과가 판단되어지는 과정이다.",
  "AI에 의해 작성되었다.",
];

const CLEAN = [
  "새로운 API를 설계한 뒤 통합 테스트를 실행하여 안정성을 확인했습니다.",
  "설정 파일을 열어 수정한 뒤 저장합니다.",
  "AI가 생성한 코드를 검토하고 필요한 부분을 다듬었습니다.",
  "외부 문제로 발생한 오류를 로그에서 확인했습니다.",
  "4대 핵심 운영 방향을 정하고 과제를 나누었습니다.",
  "비동기 백엔드 환경에서 논블로킹 I/O 성능을 최적화한 경험이 있습니다.",
  "투입 초기 체계적인 인벤토리 파악을 통해 안정성을 높였습니다.",
  "이 기능은 서비스 안정에 도움이 됩니다.",
  "시장 흐름에 맞춰 대응 방안을 마련합니다.",
  "성과가 조금씩 나아지고 있습니다.",
];

describe("scan_korean_prose", () => {
  it("exposes single tool with 13 rules", () => {
    assert.equal(TOOL_NAME, "scan_korean_prose");
    assert.equal(RULES.length, 13);
  });

  it("detects at least 18 of 20 violation sentences", () => {
    let detected = 0;
    const missed = [];
    for (const s of VIOLATIONS) {
      const v = scanKoreanProse(s);
      if (v.length > 0) detected++;
      else missed.push(s);
    }
    assert.ok(detected >= 18, `only ${detected}/20 detected, missed: ${missed.join(" | ")}`);
  });

  it("returns {rule, line, excerpt} shape", () => {
    const v = scanKoreanProse("코드를 박다 처리했다.");
    assert.ok(v.length > 0);
    for (const item of v) {
      assert.ok(typeof item.rule === "string");
      assert.ok(typeof item.line === "number");
      assert.ok(typeof item.excerpt === "string");
    }
  });

  it("zero false positives on 10 clean sentences", () => {
    for (const s of CLEAN) {
      const v = scanKoreanProse(s);
      assert.equal(v.length, 0, `false positive: "${s}" -> ${JSON.stringify(v)}`);
    }
  });

  it("retains verb-form detection without matching report names", () => {
    for (const form of ["박다", "박아넣다", "박아 넣다", "박아서", "박았다", "박어", "박는다", "박고", "박을", "박음", "박고서"]) {
      assert.ok(scanKoreanProse(`값을 ${form} 처리했다.`).length > 0, form);
    }
  });

  it("preserves source text and explicitly marked quotation lines without rewriting", () => {
    const text = '박다은 조사관의 기록\n인용: "매우 중요한 자료에 의해 판단되어진다."\n이 기능은 매우 중요합니다.';
    const original = text;
    assert.deepEqual(scanKoreanProse(text, { contentKind: "source" }), []);
    const hits = scanKoreanProse(text, { preservedLines: [1, 2] });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 3);
    assert.equal(text, original);
    assert.deepEqual(scanKoreanProse("박다은·박고은 조사관이 2026-09-17 09:30에 원본 2개를 확인했다."), []);
  });

  it("writes lint log line when LAZYAGENTIC_LINT_LOG set", () => {
    const dir = mkdtempSync(join(tmpdir(), "lintlog-"));
    const log = join(dir, "lint.log");
    process.env.LAZYAGENTIC_LINT_LOG = log;
    try {
      scanKoreanProse("코드를 박다 처리했다.");
      assert.ok(existsSync(log));
      const j = JSON.parse(readFileSync(log, "utf8").trim().split("\n").at(-1));
      assert.ok(j.ts && typeof j.count === "number" && Array.isArray(j.rules));
    } finally { delete process.env.LAZYAGENTIC_LINT_LOG; rmSync(dir, { recursive: true, force: true }); }
  });

  it("writes no file when LAZYAGENTIC_LINT_LOG unset", () => {
    delete process.env.LAZYAGENTIC_LINT_LOG;
    const dir = mkdtempSync(join(tmpdir(), "lintlog-"));
    const log = join(dir, "nolog.log");
    try {
      scanKoreanProse("코드를 박다 처리했다.");
      assert.equal(existsSync(log), false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it("eval corpus recall>=0.85", () => {
    const rows = readFileSync(new URL("../eval/corpus.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const viols = rows.filter((r) => r.label === "violation");
    let hit = 0; const missed = [];
    for (const r of viols) { if (scanKoreanProse(r.text, r).length > 0) hit++; else missed.push(`${r.id}[${r.rule}]`); }
    const rec = hit / viols.length;
    assert.ok(rec >= 0.85, `recall ${rec.toFixed(3)}=${hit}/${viols.length} missed: ${missed.join(", ")}`);
  });

  it("eval corpus precision>=0.90", () => {
    const rows = readFileSync(new URL("../eval/corpus.jsonl", import.meta.url), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    let tp = 0, fp = 0; const falses = [];
    for (const r of rows) {
      const h = scanKoreanProse(r.text, r).length > 0;
      if (r.label === "violation" && h) tp++;
      if (r.label === "clean" && h) { fp++; falses.push(`${r.id}=>${scanKoreanProse(r.text, r).map((x) => x.rule).join(",")}`); }
    }
    const prec = tp / (tp + fp || 1);
    assert.ok(prec >= 0.90, `precision ${prec.toFixed(3)}=${tp}/${tp + fp} falses: ${falses.join(", ")}`);
  });
});
