#!/usr/bin/env node
// sync-versions.mjs — check 4 version spots; exit 1 on mismatch. Run: node scripts/sync-versions.mjs [--base dir]
import { readFileSync } from "node:fs";
import { join } from "node:path";
const bi = process.argv.indexOf("--base");
const base = bi !== -1 ? process.argv[bi + 1] : ".";
const pj = JSON.parse(readFileSync(join(base, "plugin.json"), "utf8"));
const rules = readFileSync(join(base, "RULES.md"), "utf8");
const instinct = readFileSync(join(base, "rules/00-instinct.md"), "utf8");
const epj = JSON.parse(readFileSync(join(base, "enforced/plugin.json"), "utf8"));
const readme = readFileSync(join(base, "README.md"), "utf8");
const mR = rules.match(/\*\*Version\*\*:\s*(\d+\.\d+\.\d+)/);
const mI = instinct.match(/\*\*Version\*\*:\s*(\d+\.\d+\.\d+)/);
const mRd = readme.match(/RULES\.md`?\s*v(\d+\.\d+\.\d+)/);
// Spots: plugin.json version (plugin track), rulesVersion (rules track),
// RULES.md Version (must equal rulesVersion), 00-instinct Version (instinct track),
// enforced/plugin.json rulesVersion (must equal rulesVersion — split-pack drift guard),
// README.md RULES.md vX.Y.Z mention (must equal rulesVersion — doc drift guard).
const spots = { "plugin.json:version": pj.version, "plugin.json:rulesVersion": pj.rulesVersion, "RULES.md:Version": mR?.[1], "00-instinct:Version": mI?.[1], "enforced/plugin.json:rulesVersion": epj.rulesVersion, "README.md:rulesVersion-ref": mRd?.[1] };
for (const [k, v] of Object.entries(spots)) console.log(`${k}=${v ?? "MISSING"}`);
if (!pj.version || !pj.rulesVersion || !mR?.[1] || !mI?.[1] || !epj.rulesVersion || !mRd?.[1]) { console.error("missing version spot"); process.exit(1); }
if (pj.rulesVersion !== mR[1]) { console.error(`mismatch rulesVersion ${pj.rulesVersion} vs RULES.md ${mR[1]}`); process.exit(1); }
if (mRd[1] !== pj.rulesVersion) { console.error(`mismatch README.md ${mRd[1]} vs rulesVersion ${pj.rulesVersion}`); process.exit(1); }
if (epj.rulesVersion !== pj.rulesVersion) { console.error(`mismatch enforced rulesVersion ${epj.rulesVersion} vs plugin ${pj.rulesVersion}`); process.exit(1); }
// plugin/instinct tracks are independent semver lines; only presence + rules-track equality enforced.
// Usage without package.json: node scripts/sync-versions.mjs [--base <plugin-dir>]
console.log("versions OK (rules track aligned; plugin/instinct tracks present)");
