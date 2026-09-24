#!/usr/bin/env bash
# test_integrity.sh — lazyagentic POSIX counterpart of test_integrity.ps1
# Usage: ./test_integrity.sh [--base <plugin-dir>] [--junction <junction-dir>] [--strict]
set -euo pipefail
BASE="${HOME}/.gemini/config/plugins/lazyagentic"
JUNCTION="${HOME}/agentic"
STRICT=0
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="$2"; shift 2;;
    --junction) JUNCTION="$2"; shift 2;;
    --strict) STRICT=1; shift 1;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done
MAX_LINES=800; MAX_BYTES=46080; MAX_CHARS=12000
fail=0

echo "=== TEST 1: Junction Path Integrity ==="
echo "base=$BASE junction=$JUNCTION"
if [ -d "$JUNCTION/rules" ]; then
  echo "[PASS] Junction $JUNCTION exists"
elif [ -d "$BASE/rules" ]; then
  echo "[WARN] Junction missing — falling back to plugin path $BASE"
  if [ "$STRICT" -eq 1 ]; then
    echo "[FAIL] Strict mode: junction fallback not allowed"
    fail=1
  fi
else
  echo "[FAIL] Neither junction nor plugin path readable"; exit 1
fi
echo ""

echo "=== TEST 2: Rule File Capacity Audit (rules/) ==="
for f in "$BASE"/rules/*.md; do
  [ -e "$f" ] || continue
  lines=$(wc -l < "$f" | tr -d ' ')
  bytes=$(wc -c < "$f" | tr -d ' ')
  chars=$(wc -m < "$f" | tr -d ' ')
  name=$(basename "$f")
  if [ "$lines" -le "$MAX_LINES" ] && [ "$bytes" -le "$MAX_BYTES" ] && [ "$chars" -le "$MAX_CHARS" ]; then
    echo "[PASS] $name ${lines}L ${bytes}B ${chars}ch"
  else
    echo "[FAIL] $name exceeds limit (${lines}L ${bytes}B ${chars}ch)"; fail=1
  fi
done
echo ""

echo "=== TEST 3: RULES.md Reference Targets (via scripts/check-links.sh) ==="
if bash "$BASE/scripts/check-links.sh" --base "$BASE" --junction "$JUNCTION"; then
  :
else
  fail=1
fi
echo ""

echo "=== TEST 3b: Title Consistency (NN- prefix vs '# NN.') ==="
for f in "$BASE"/rules/*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  num=$(echo "$base" | grep -o '^[0-9]*' || true)
  first=$(head -n 1 "$f")
  case "$first" in
    "# $num."*) echo "[PASS] $base";;
    *) echo "[FAIL] Title mismatch: $base -> '$first'"; fail=1;;
  esac
done
echo ""

echo "=== TEST 4: Entry Point Resolution (global preferred, plugin path fallback) ==="
GLOBAL_GEMINI="$(dirname "$(dirname "$BASE")")/GEMINI.md"
PLUGIN_GEMINI="$BASE/GEMINI.md"
echo "global=$GLOBAL_GEMINI plugin=$PLUGIN_GEMINI"
if [ -f "$GLOBAL_GEMINI" ]; then
  echo "[PASS] Global GEMINI.md exists ($GLOBAL_GEMINI)"
elif [ -f "$PLUGIN_GEMINI" ]; then
  echo "[PASS] Plugin-path GEMINI.md exists ($PLUGIN_GEMINI, global missing — single-plugin mode)"
else
  echo "[FAIL] No entry point: neither $GLOBAL_GEMINI nor $PLUGIN_GEMINI exists"
  fail=1
fi
echo ""

echo "=== TEST 5: Markdown Relative Links Integrity ==="
link_errors=0
for md in "$BASE"/*.md "$BASE"/rules/*.md; do
  [ -e "$md" ] || continue
  dir=$(dirname "$md")
  links=$(grep -oE '\]\([^)]+\)' "$md" | sed 's/^\](//;s/)$//' || true)
  for link in $links; do
    case "$link" in
      http*|mailto:*|"~"*|"#"*) continue ;;
      *)
        target=$(echo "$link" | cut -d'#' -f1 | cut -d'?' -f1)
        [ -z "$target" ] && continue
        if [[ "$target" == *"/"* || "$target" == *.* ]]; then
          if [ ! -e "$dir/$target" ] && [ ! -e "$BASE/$target" ]; then
            echo "[FAIL] Broken relative link in $(basename "$md"): $link"
            link_errors=$((link_errors + 1))
            fail=1
          fi
        fi
        ;;
    esac
  done
done
if [ "$link_errors" -eq 0 ]; then
  echo "[PASS] All relative markdown links resolve to valid physical files"
fi
echo ""

echo "=== TEST 6: Korean Natural Prose & Verb Policy Integrity ==="
if grep -q "Korean Natural Prose" "$BASE/RULES.md" && grep -q "Korean Verb Precision" "$BASE/RULES.md"; then
  echo "[PASS] RULES.md contains Korean prose & verb precision trigger policies"
else
  echo "[FAIL] RULES.md missing Korean policy triggers"; fail=1
fi

if [ -f "$BASE/rules/03-korean-natural-prose.md" ]; then
  if grep -qi "zero-anaphora" "$BASE/rules/03-korean-natural-prose.md" && grep -qi "translation-ese" "$BASE/rules/03-korean-natural-prose.md"; then
    echo "[PASS] 03-korean-natural-prose.md contains zero-anaphora & translation-ese policies"
  else
    echo "[FAIL] 03-korean-natural-prose.md missing syntax policy keywords"; fail=1
  fi
else
  echo "[FAIL] Missing 03-korean-natural-prose.md"; fail=1
fi

if [ -f "$BASE/rules/04-korean-verb-usage.md" ]; then
  if grep -q "박다" "$BASE/rules/04-korean-verb-usage.md"; then
    echo "[PASS] 04-korean-verb-usage.md contains prohibited verb rules (박다 ban)"
  else
    echo "[FAIL] 04-korean-verb-usage.md missing verb usage rules"; fail=1
  fi
else
  echo "[FAIL] Missing 04-korean-verb-usage.md"; fail=1
fi
echo ""

if [ -f "$BASE/contracts/PIN.json" ] && [ -f "$BASE/scripts/check_contract_drift.mjs" ]; then
  if node "$BASE/scripts/check_contract_drift.mjs"; then
    echo "[PASS] contracts vendored files match PIN"
  else
    echo "[FAIL] contracts drift detected"; fail=1
  fi
else
  echo "[SKIP] contracts not vendored in $BASE — 설치본 갱신 후 활성화"
fi
echo ""

if [ "$fail" -ne 0 ]; then echo ">>> SOME TESTS FAILED <<<"; exit 1; fi
echo ">>> ALL LAZYAGENTIC TESTS PASSED <<<"
