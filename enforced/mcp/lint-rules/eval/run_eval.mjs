// eval/run_eval.mjs — corpus precision/recall 리포트 (exit 0 고정)
import { readFileSync } from "node:fs";
import { scanKoreanProse } from "../src/cli.mjs";
const rows = readFileSync(new URL("./corpus.jsonl", import.meta.url), "utf8")
  .trim().split("\n").map((l) => JSON.parse(l));
let tp = 0, fp = 0, fn = 0, tn = 0;
const misses = [], falses = [], perRule = {};
for (const r of rows) {
  const hit = scanKoreanProse(r.text, r).length > 0;
  const exp = r.label === "violation";
  if (exp && hit) tp++;
  else if (!exp && hit) { fp++; falses.push(r); }
  else if (exp && !hit) { fn++; misses.push(r); }
  else tn++;
  if (!exp) continue;
  perRule[r.rule] ??= { hit: 0, total: 0 };
  perRule[r.rule].total++;
  if (hit) perRule[r.rule].hit++;
}
const prec = tp / (tp + fp || 1);
const rec = tp / (tp + fn || 1);
const f1 = (2 * prec * rec) / ((prec + rec) || 1);
console.log(`corpus=${rows.length} TP=${tp} FP=${fp} FN=${fn} TN=${tn}`);
console.log(`precision=${prec.toFixed(3)} recall=${rec.toFixed(3)} F1=${f1.toFixed(3)}`);
console.log("per-rule recall:");
for (const [k, v] of Object.entries(perRule)) {
  console.log(` - ${k}: ${(v.hit / v.total).toFixed(3)} (${v.hit}/${v.total})`);
}
console.log(`misses(${misses.length}):`);
for (const m of misses) console.log(` - ${m.id}[${m.rule}]: ${m.text}`);
console.log(`false-positives(${falses.length}):`);
for (const f of falses) {
  const v = scanKoreanProse(f.text);
  console.log(` - ${f.id}: ${f.text} => ${v.map((x) => x.rule).join(",")}`);
}
const pass = rec >= 0.85 && prec >= 0.90;
console.log(`goal: recall>=0.85 precision>=0.90 => ${pass ? "PASS" : "FAIL"}`);
// note: 리포트 전용, exit 코드는 항상 0 (CI 게이트는 test에서 assert)
// corpus: 위반 30(13종×2+) + 정상 30(경계 포함)
// end
