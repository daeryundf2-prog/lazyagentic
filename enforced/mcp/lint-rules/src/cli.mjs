#!/usr/bin/env node
import { appendFileSync, realpathSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
function llog(v){try{const p=process.env.LAZYAGENTIC_LINT_LOG;if(!p)return;appendFileSync(p,JSON.stringify({ts:new Date().toISOString(),count:v.length,rules:[...new Set(v.map(x=>x.rule))]})+"\n");}catch{}}

export const TOOL_NAME = "scan_korean_prose";

export const RULES = [
  { id: "park-da", pattern: /(?<![가-힣])박다(?![가-힣])/, description: "박다 원형 금지 (코드를 박다)" },
  { id: "park-compound", pattern: /박아\s*넣/, description: "박다 변형 금지 (박아넣다)" },
  { id: "park-inflected", pattern: /(?<![가-힣])(?:박아(서|넣)|박았|박어|박는|박고(?:서)?(?![가-힣])|박을|박음)/, description: "박다 굴절형 금지 (박아서/박았다/박는다/박고)" },
  { id: "double-passive-ji", pattern: /되어(지|진)/, description: "이중피동 금지 (판단되어진다/되어진다)" },
  { id: "double-passive-jyeo", pattern: /되어져/, description: "이중피동 금지 (작성되어져 있다)" },
  { id: "by-passive", pattern: /에\s*의(해|하여)/, description: "~에의해 수동태 금지 (AI에 의해/의하여 생성)" },
  { id: "pillar-suffix", pattern: /(운영|전략|추진|핵심|사업|기술)\s*축(?![소적하사])/, description: "~축 구조은유 금지 (운영 축/전략 축/사업 축), 축소·축적 제외" },
  { id: "experience-possession", pattern: /경험\s*(을\s*)?(보유|소유|가지고)/, description: "경험보유 번역투 금지 (경험[을] 보유/소유/가지고)" },
  { id: "day-one-filler", pattern: /(투입\s*)?첫\s*날\s*부터/, description: "투입첫날부터 사족 금지 (첫 날 띄어쓰기 포함)" },
  { id: "cliche-very-important", pattern: /매우\s*중요/, description: "AI클리셰 금지 (매우 중요)" },
  { id: "cliche-core", pattern: /핵심적인/, description: "AI클리셰 금지 (핵심적인)" },
  { id: "cliche-fast-changing", pattern: /빠르게\s*변화하는/, description: "AI클리셰 금지 (빠르게 변화하는)" },
  { id: "cliche-noticeably", pattern: /눈에\s*띄게/, description: "AI클리셰 금지 (눈에 띄게)" },
];

export function scanKoreanProse(text, options = {}) {
  const violations = [];
  const preserved = new Set(options.preservedLines ?? []);
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const lineNo = idx + 1;
    if (options.contentKind === "source" || preserved.has(lineNo)) return;
    const excerpt = raw.trim().slice(0, 120);
    for (const r of RULES) {
      if (r.pattern.test(raw)) {
        violations.push({ rule: r.id, line: lineNo, excerpt });
      }
    }
  });
  llog(violations);
  return violations;
}

export const TOOL_DEF = {
  name: TOOL_NAME,
  description: "Read-only advisory scan of authored Korean narrative; never rewrites text. Mark originals as source or identify quotation lines explicitly. Findings are stylistic heuristics, not evidence verification.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Korean text to scan" },
      contentKind: { type: "string", enum: ["narrative", "source"], default: "narrative" },
      preservedLines: { type: "array", items: { type: "integer", minimum: 1 }, description: "1-based lines containing quotations, names or extracted originals to exclude" },
    },
    required: ["text"],
    additionalProperties: false,
  },
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const errorResponse = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function validArguments(args) {
  return isObject(args) && typeof args.text === "string" &&
    Object.keys(args).every((key) => Object.hasOwn(TOOL_DEF.inputSchema.properties, key)) &&
    (args.contentKind === undefined || ["narrative", "source"].includes(args.contentKind)) &&
    (args.preservedLines === undefined || (Array.isArray(args.preservedLines) &&
      args.preservedLines.every((line) => Number.isInteger(line) && line > 0 && line <= args.text.split(/\r?\n/).length)));
}

function handleRequest(input) {
  const id = isObject(input) && (typeof input.id === "string" || Number.isInteger(input.id)) ? input.id : null;
  if (!isObject(input) || input.jsonrpc !== "2.0" || typeof input.method !== "string" ||
      (Object.hasOwn(input, "id") && id === null) ||
      (input.params !== undefined && !isObject(input.params))) {
    return errorResponse(id, -32600, "Invalid Request");
  }
  if (!Object.hasOwn(input, "id")) return null;
  const result = (value) => ({ jsonrpc: "2.0", id, result: value });
  switch (input.method) {
    case "initialize":
      if (typeof input.params?.protocolVersion !== "string" || !isObject(input.params.capabilities) ||
          !isObject(input.params.clientInfo) || typeof input.params.clientInfo.name !== "string" ||
          typeof input.params.clientInfo.version !== "string") {
        return errorResponse(id, -32602, "Invalid initialization parameters");
      }
      return result({ protocolVersion: "2024-11-05", serverInfo: { name: "lint-rules", version: "1.0.0" }, capabilities: { tools: {} } });
    case "ping":
      return result({});
    case "tools/list":
      return result({ tools: [TOOL_DEF] });
    case "tools/call": {
      if (input.params?.name !== TOOL_NAME || !validArguments(input.params.arguments)) {
        return errorResponse(id, -32602, "Unknown tool or invalid arguments");
      }
      try {
        const args = input.params.arguments;
        const violations = scanKoreanProse(args.text, args);
        const payload = { tool: TOOL_NAME, violations, contentKind: args.contentKind ?? "narrative", preservedLines: args.preservedLines ?? [] };
        return result({ content: [{ type: "text", text: JSON.stringify(payload) }], isError: false });
      } catch {
        return result({ content: [{ type: "text", text: "Scan failed" }], isError: true });
      }
    }
    default:
      return errorResponse(id, -32601, "Method not found");
  }
}

async function main() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let input;
    try { input = JSON.parse(line); }
    catch { process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "Parse error"))}\n`); continue; }
    const response = handleRequest(input);
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(() => { process.stderr.write("lint-rules transport failed\n"); process.exitCode = 1; });
}
