# Test script for lazyagentic (Windows PowerShell)
# Usage: .\test_integrity.ps1 [-BasePath <plugin-dir>] [-Junction <junction-dir>]
param(
    [string]$BasePath = (Join-Path $env:USERPROFILE ".gemini\config\plugins\lazyagentic"),
    [string]$Junction = (Join-Path $env:USERPROFILE "agentic"),
    [switch]$Strict
)
$base = $BasePath
$junction = $Junction
$maxLines = 800
$maxBytes = 46080
$maxChars = 12000

Write-Host "=== TEST 1: Junction Path Integrity ==="
Write-Host "base=$base junction=$junction"
if ((Test-Path $junction) -and (Test-Path "$junction\rules")) {
    Write-Host "[PASS] Junction $junction exists and is readable" -ForegroundColor Green
} elseif ((Test-Path "$base\rules")) {
    Write-Host "[WARN] Junction missing — falling back to plugin path $base (see README Dual-Mount)" -ForegroundColor Yellow
    if ($Strict) {
        Write-Host "[FAIL] Strict mode: junction fallback not allowed" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[FAIL] Neither junction nor plugin path readable" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== TEST 2: Rule File Integrity & Tool Capacity Audit (rules/) ==="
Write-Host "Single tool call limit ($maxLines lines, $maxBytes bytes, $maxChars chars):`n"
$ruleFiles = Get-ChildItem -Path "$base\rules" -Filter "*.md" | Sort-Object Name
$allPassed = $true

Write-Host ("{0,-30} | {1,8} | {2,10} | {3,22} | {4,15}" -f "Rule File", "Lines", "Bytes", "Tool Headroom", "Status")
Write-Host ("-" * 95)

foreach ($file in $ruleFiles) {
    $raw = Get-Content $file.FullName -Raw
    $lines = (Get-Content $file.FullName).Count
    $bytes = (Get-Item $file.FullName).Length
    $chars = $raw.Length

    $remainLines = $maxLines - $lines
    $remainKB = [math]::Round(($maxBytes - $bytes) / 1024, 1)

    if ($lines -le $maxLines -and $bytes -le $maxBytes -and $chars -le $maxChars) {
        $status = "[PASS] Complete"
        $lineRemainStr = "$remainLines lines, $remainKB KB"
        Write-Host ("{0,-30} | {1,6} L | {2,8} B | {3,18} free | {4,15}" -f $file.Name, $lines, $bytes, $lineRemainStr, $status) -ForegroundColor Green
    } else {
        $status = "[FAIL] Exceeded"
        $allPassed = $false
        Write-Host ("{0,-30} | {1,6} L | {2,8} B | {3,18} free | {4,15}" -f $file.Name, $lines, $bytes, "Over limit", $status) -ForegroundColor Red
    }
}

Write-Host "`n=== TEST 3: RULES.md Reference Link Target Validation ==="
$rulesContent = Get-Content "$base\RULES.md" -Raw
$matches = [regex]::Matches($rulesContent, '\[~/agentic/(rules/[^\]]+)\]')
foreach ($m in $matches) {
    $relPath = $m.Groups[1].Value
    $target1 = Join-Path $base $relPath
    $target2 = Join-Path $junction $relPath
    if ((Test-Path $target1) -or (Test-Path $target2)) {
        Write-Host "[PASS] Target exists: $relPath" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Missing target: $relPath" -ForegroundColor Red
        $allPassed = $false
    }
}

# 제목-파일명 정합성: 04 파일의 첫 제목이 # 04. 로 시작하는지 등
Write-Host "`n=== TEST 3b: Rule File Title Consistency ==="
foreach ($file in $ruleFiles) {
    if ($file.Name -match '^(\d+)-') {
        $num = $Matches[1]
        $first = (Get-Content $file.FullName -TotalCount 1)
        if ($first -match "^#\s*$num\.") {
            Write-Host "[PASS] Title matches: $($file.Name)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Title mismatch: $($file.Name) -> '$first'" -ForegroundColor Red
            $allPassed = $false
        }
    }
}

Write-Host "`n=== TEST 4: Entry Point Resolution (global preferred, plugin path fallback) ==="
$pluginGemini = Join-Path $base "GEMINI.md"
# $base=~/.gemini/config/plugins/lazyagentic -> global dir = ~/.gemini/config
# 얕은 경로(예: CI의 '.')에서는 부모가 비어 Split-Path가 예외를 내므로 먼저 확인한다.
$globalGemini = $null
$parent1 = Split-Path $base -Parent
if (-not [string]::IsNullOrWhiteSpace($parent1)) {
    $parent2 = Split-Path $parent1 -Parent
    if (-not [string]::IsNullOrWhiteSpace($parent2)) {
        $globalGemini = Join-Path $parent2 "GEMINI.md"
    }
}
if ($globalGemini) {
    if (Test-Path $globalGemini) {
        Write-Host "[PASS] Global GEMINI.md exists ($globalGemini)" -ForegroundColor Green
    } elseif (Test-Path $pluginGemini) {
        Write-Host "[PASS] Plugin-path GEMINI.md exists ($pluginGemini, global missing — single-plugin mode)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] No entry point: neither $globalGemini nor $pluginGemini exists" -ForegroundColor Red
        $allPassed = $false
    }
} else {
    Write-Host "[WARN] Base '$base' too shallow — skipping global GEMINI.md check (fallback WARN is pass)" -ForegroundColor Yellow
    if (Test-Path $pluginGemini) {
        Write-Host "[PASS] Plugin-path GEMINI.md exists ($pluginGemini)" -ForegroundColor Green
    }
}

Write-Host "`n=== TEST 5: Markdown Relative Links Integrity ==="
$linkErrors = 0
$mdFiles = Get-ChildItem -Path $base -Filter "*.md" -Recurse | Where-Object { $_.FullName -notmatch '\\\.git\\' }
foreach ($file in $mdFiles) {
    $content = Get-Content $file.FullName -Raw
    $links = [regex]::Matches($content, '\]\(([^)]+)\)')
    foreach ($m in $links) {
        $link = $m.Groups[1].Value
        if ($link -match '^(http|mailto:|~|#)') { continue }
        $target = ($link -split '[#?]')[0]
        if ([string]::IsNullOrWhiteSpace($target)) { continue }
        if ($target -match '[/\.]') {
            $p1 = Join-Path $file.DirectoryName $target
            $p2 = Join-Path $base $target
            if (-not (Test-Path $p1) -and -not (Test-Path $p2)) {
                Write-Host "[FAIL] Broken relative link in $($file.Name): $link" -ForegroundColor Red
                $linkErrors++
                $allPassed = $false
            }
        }
    }
}
if ($linkErrors -eq 0) {
    Write-Host "[PASS] All relative markdown links resolve to valid physical files" -ForegroundColor Green
}

Write-Host "`n=== TEST 6: Korean Natural Prose & Verb Policy Integrity ==="
$rulesText = Get-Content (Join-Path $base "RULES.md") -Raw
if ($rulesText -match "Korean Natural Prose" -and $rulesText -match "Korean Verb Precision") {
    Write-Host "[PASS] RULES.md contains Korean prose & verb precision trigger policies" -ForegroundColor Green
} else {
    Write-Host "[FAIL] RULES.md missing Korean policy triggers" -ForegroundColor Red
    $allPassed = $false
}

$p03 = Join-Path $base "rules\03-korean-natural-prose.md"
if (Test-Path $p03) {
    $t03 = Get-Content $p03 -Raw
    if ($t03 -match "zero-anaphora" -and $t03 -match "translation-ese") {
        Write-Host "[PASS] 03-korean-natural-prose.md contains zero-anaphora & translation-ese policies" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] 03-korean-natural-prose.md missing syntax policy keywords" -ForegroundColor Red
        $allPassed = $false
    }
}

$p04 = Join-Path $base "rules\04-korean-verb-usage.md"
if (Test-Path $p04) {
    $t04 = Get-Content $p04 -Raw
    if ($t04 -match "박다") {
        Write-Host "[PASS] 04-korean-verb-usage.md contains prohibited verb rules (박다 ban)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] 04-korean-verb-usage.md missing verb usage rules" -ForegroundColor Red
        $allPassed = $false
    }
}

if ($allPassed) {
    Write-Host "`n>>> ALL LAZYAGENTIC TESTS PASSED <<<" -ForegroundColor Cyan
} else {
    Write-Host "`n>>> SOME TESTS FAILED <<<" -ForegroundColor Red
    exit 1
}
