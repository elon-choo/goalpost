#!/usr/bin/env node
'use strict';
// Regression checks for adversarial-review round-1 CONFIRMED findings
// (H-01, H-02, H-03, H-04, H-05, H-06, M-01, M-02, M-03, M-04, L-01)
// + round-2 findings (H-02R, M-05, L-02, L-03, L-04, L-06)
// + 0.5.0 routing-tag checks (R5-*: claude:opus / codex:gpt-6-sol lanes, legacy normalization, xverify records).
// Each check reproduces the red-teamer's input and asserts the fixed behavior.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const { parseLedger } = require(path.join(ROOT, 'scripts/telemetry/parse-ledger'));
const { parseHookLog } = require(path.join(ROOT, 'scripts/telemetry/parse-hooklog'));
const { buildReport, markdown } = require(path.join(ROOT, 'scripts/telemetry/report'));

let failures = 0;
function check(id, condition, detail) {
  const suffix = detail ? ` -- ${detail}` : '';
  if (condition) process.stdout.write(`PASS ${id}${suffix}\n`);
  else { failures += 1; process.stderr.write(`FAIL ${id}${suffix}\n`); }
}

// ---- H-01: guard-override lines parsed; unrecognized lines counted, not dropped ----
const hook = parseHookLog([
  '2026-07-15T22:00:00+0900 ALLOW override=env',
  '2026-07-15T22:00:01+0900 ALLOW override=file',
  '2026-07-15T22:00:02+0900 ALLOW sandbox=read-only',
  'totally unrecognized line'
].join('\n'));
check('H-01 override lines parsed as ALLOW with override field, sandbox null',
  hook.decisions.length === 3
  && hook.decisions[0].decision === 'ALLOW' && hook.decisions[0].override === 'env' && hook.decisions[0].sandbox === null
  && hook.decisions[1].override === 'file' && hook.decisions[1].sandbox === null);
check('H-01 unrecognized line surfaces as dropped_lines count', hook.dropped_lines === 1);

// ---- H-02: attempt fields scoped to the q: segment, title prose cannot overwrite them ----
const h02 = parseLedger('- [ ] G2.1 [codex:terra] Enforce tier:sol policy | depends: — | q:0 i:0 tier:terra effort:low sandbox:read-only | evidence:');
check('H-02 title prose tier:sol does not overwrite attempt tier:terra',
  h02.goals[0].actual_model === 'terra' && h02.goals[0].escalations.length === 0);
const h02b = parseLedger('- [ ] G2.2 [codex:luna] Enforce tier:sol policy | evidence:');
check('H-02 no attempt segment -> no fabricated tier from prose',
  h02b.goals[0].actual_model === 'luna' && !('tier' in h02b.goals[0]) && h02b.goals[0].escalations.length === 0);

// ---- H-05: prose checklists must not fabricate goals ----
const h05 = parseLedger([
  '- [x] Gate [red-team] passed',
  '- [ ] Grep [codex] the code for secrets',
  '- [x] Generate [claude:opus] the doc'
].join('\n'));
check('H-05 prose checklist rows (Gate/Grep/Generate) fabricate no goals', h05.goals.length === 0);

// ---- H-06: untagged real goal rows are collected, not dropped ----
const h06 = parseLedger('- [ ] G1.9 integration verification + review GO (adversarial-review) | depends: G1.1..G1.8 | verdict:');
check('H-06 untagged goal row collected with assigned_tier untagged',
  h06.goals.length === 1 && h06.goals[0].id === 'G1.9'
  && h06.goals[0].assigned_tier === 'untagged' && h06.goals[0].outcome === 'pending');

// H-05/H-06 against a FROZEN S1-boundary snapshot (NOT the live ledger — the live one advances
// as the run drains, which would make this assertion a time-bomb; the snapshot keeps it stable+strong)
const realLedger = parseLedger(fs.readFileSync(path.join(ROOT, 'test/fixtures/ledger.s1-snapshot.md'), 'utf8'));
const ids = realLedger.goals.map((goal) => goal.id);
const expectedIds = ['G1.1', 'G1.2', 'G1.3', 'G1.4', 'G1.5', 'G1.6', 'G1.8', 'G1.9', 'G1.10', 'G1.9.5'];
check('H-06 real ledger goal ids are exactly the 10 real rows',
  JSON.stringify(ids) === JSON.stringify(expectedIds), `got [${ids.join(', ')}]`);
const boundary = realLedger.goals.filter((goal) => ['G1.9', 'G1.10', 'G1.9.5'].includes(goal.id));
check('H-06 real ledger G1.9/G1.10/G1.9.5 present as pending untagged',
  boundary.length === 3 && boundary.every((goal) => goal.outcome === 'pending' && goal.assigned_tier === 'untagged'));
check('H-05 real ledger contains no prose-invented ids', ids.every((id) => /^G\d+(\.\d+)*$/.test(id)));

// ---- H-03: non-core tiers bucketed, distribution reconciles, no-rate tiers labelled ----
const h03Report = buildReport({ goals: [
  { id: 'G7.1', assigned_tier: 'fable', actual_model: 'fable', escalations: [], outcome: 'done' },
  { id: 'G7.2', assigned_tier: 'terra', actual_model: 'terra', escalations: [], outcome: 'done', input_tokens: 1000, output_tokens: 100 }
] }, { decisions: [], dropped_lines: 0 });
check('H-03 non-core tier (fable) gets its own bucket', h03Report.summary.tier_distribution.fable === 1);
check('H-03 tier distribution reconciles with goals.length',
  h03Report.summary.tier_distribution_total === 2 && h03Report.summary.tier_reconciles === true);
const h03Md = markdown(h03Report);
check('H-03 no-rate tier labelled best-effort, not silently $0-dropped',
  h03Report.summary.cost_no_rate_tiers.includes('fable')
  && h03Md.includes('- G7.1 (fable): best-effort (no rate)')
  && h03Md.includes('- fable: best-effort (no rate)')
  && h03Md.includes('- fable: 1'));

// ---- H-04: missing input path / bad arg are errors; garbage CONTENT stays fail-open ----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goalpost-regress-'));
const reportJs = path.join(ROOT, 'scripts/telemetry/report.js');
const validateJs = path.join(ROOT, 'scripts/telemetry/validate.js');
const guardFixture = path.join(ROOT, 'test/fixtures/codex-guard.sample.log');
const missing = spawnSync('node', [reportJs, '--ledger', path.join(tmp, 'no-such-ledger.md'), '--hooklog', guardFixture, '--out-json', path.join(tmp, 'r.json'), '--out-md', path.join(tmp, 'r.md')], { encoding: 'utf8' });
check('H-04 missing --ledger path exits 1 with stderr message',
  missing.status === 1 && /Could not read --ledger/.test(missing.stderr), `status=${missing.status}`);
const badArg = spawnSync('node', [reportJs, '--ledger'], { encoding: 'utf8' });
check('H-04 bad CLI arg exits non-zero with usage', badArg.status === 1 && /Usage:/.test(badArg.stderr));
const garbage = path.join(ROOT, 'test/fixtures/garbage.txt');
const failOpen = spawnSync('node', [reportJs, '--ledger', garbage, '--hooklog', garbage, '--out-json', path.join(tmp, 'g.json'), '--out-md', path.join(tmp, 'g.md')], { encoding: 'utf8' });
check('H-04 garbage CONTENT on an existing path stays fail-open (exit 0, typed-empty)',
  failOpen.status === 0 && JSON.parse(fs.readFileSync(path.join(tmp, 'g.json'), 'utf8')).goals.length === 0);

// ---- M-01: escalation only on a strict UP move; bare/unclassified and downgrades skip ----
const m01 = parseLedger([
  '- [x] G8.1 [codex] Bare tag first classification | q:0 i:0 tier:terra effort:low sandbox:read-only |',
  '- [x] G8.2 [codex:sol] Downgrade run | q:0 i:0 tier:terra effort:low sandbox:read-only |',
  '- [x] G8.3 [codex:luna→terra] Arrow-tag escalation | q:1 i:0 tier:terra effort:low sandbox:read-only |'
].join('\n'));
check('M-01 bare [codex] first classification is NOT an escalation', m01.goals[0].escalations.length === 0);
check('M-01 downgrade sol->terra is NOT an escalation', m01.goals[1].escalations.length === 0);
check('M-01 luna→terra arrow-tag UP move still counts as 1 escalation', m01.goals[2].escalations.length === 1);

// ---- M-02: uppercase [X] checkbox rows are parsed as done ----
const m02 = parseLedger('- [X] G9.1 [codex:luna] Uppercase checkbox | evidence:');
check('M-02 uppercase [X] row parsed as done', m02.goals.length === 1 && m02.goals[0].outcome === 'done');

// ---- M-03: non-numeric wall_clock_s dropped + warned; emitted report validates ----
const m03Row = '- [~] G10.1 [codex:sol] Suffixed wall clock | q:0 i:1 tier:sol effort:medium sandbox:workspace-write wall_clock_s:90s |';
const m03 = parseLedger(m03Row);
check('M-03 non-numeric wall_clock_s not stored, counted as warning',
  !('wall_clock_s' in m03.goals[0]) && m03.warnings.non_numeric_dropped === 1);
const m03Ledger = path.join(tmp, 'm03-ledger.md');
fs.writeFileSync(m03Ledger, `${m03Row}\n`);
const m03Json = path.join(tmp, 'm03.json');
const m03Run = spawnSync('node', [reportJs, '--ledger', m03Ledger, '--hooklog', guardFixture, '--out-json', m03Json, '--out-md', path.join(tmp, 'm03.md')], { encoding: 'utf8' });
const m03Validate = spawnSync('node', [validateJs, m03Json], { encoding: 'utf8' });
check('M-03 emitted run-report.json passes validate.js',
  m03Run.status === 0 && m03Validate.status === 0, `validate stderr: ${(m03Validate.stderr || '').trim()}`);

// ---- M-04: schema-declared top-level scalar types enforced; forward-compat kept ----
const m04Bad = path.join(tmp, 'm04-bad.json');
fs.writeFileSync(m04Bad, JSON.stringify({ run_id: 123, goals: [] }));
const m04BadRun = spawnSync('node', [validateJs, m04Bad], { encoding: 'utf8' });
check('M-04 run_id with wrong type rejected (exit 1)',
  m04BadRun.status === 1 && /run_id/.test(m04BadRun.stderr), `status=${m04BadRun.status}`);
const m04Good = spawnSync('node', [validateJs, path.join(ROOT, 'test/fixtures/telemetry.valid.json')], { encoding: 'utf8' });
check('M-04 valid doc with unknown extra fields still accepted (exit 0)', m04Good.status === 0);

// ---- L-01: duplicate goal ids flagged, both still parsed ----
const l01 = parseLedger([
  '- [x] G11.1 [codex:luna] First | evidence:',
  '- [ ] G11.1 [codex:terra] Duplicate | evidence:'
].join('\n'));
check('L-01 duplicate id flagged (still parses both rows)',
  l01.goals.length === 2 && l01.warnings.duplicate_ids === 1);

// ---- ROUND 2 ----

// ---- H-02R: a TITLE mentioning "q:" / tier:sol / effort: prose cannot hijack the attempt record ----
const h02r = parseLedger('- [ ] G4.1 [codex:terra] Harden the q: scan against tier:sol effort: prose | depends: — | q:0 i:0 tier:terra effort:low sandbox:read-only | evidence:');
check('H-02R trailing real record wins over q:-mentioning title (no fabricated escalation)',
  h02r.goals[0].actual_model === 'terra' && h02r.goals[0].escalations.length === 0,
  `actual_model=${h02r.goals[0].actual_model} escalations=${h02r.goals[0].escalations.length}`);
check('H-02R q/i/tier/effort/sandbox captured from the real record, not lost',
  h02r.goals[0].q === 0 && h02r.goals[0].i === 0 && h02r.goals[0].tier === 'terra'
  && h02r.goals[0].effort === 'low' && h02r.goals[0].sandbox === 'read-only');
const h02rNone = parseLedger('- [ ] G4.2 [codex:terra] Harden the q: scan | depends: — | evidence:');
check('H-02R title-only q: mention with NO record -> no attempt fields fabricated',
  !('tier' in h02rNone.goals[0]) && !('q' in h02rNone.goals[0]) && h02rNone.goals[0].escalations.length === 0);

// ---- M-05: ledger.warnings surfaced in run-report.json summary + run-report.md ----
const m05Ledger = parseLedger([
  '- [x] G12.1 [codex:sol] Real goal | q:0 i:0 tier:sol effort:low sandbox:read-only wall_clock_s:90s |',
  '- [x] G12.1 [codex:sol] Duplicate | q:0 i:0 tier:sol effort:low sandbox:read-only |',
  '- [x] Ship the [codex:terra] malformed row | evidence:'
].join('\n'));
const m05Report = buildReport(m05Ledger, { decisions: [], dropped_lines: 0 });
check('M-05 ledger warnings ride run-report.json summary.ledger_warnings',
  m05Report.summary.ledger_warnings.non_numeric_dropped === 1
  && m05Report.summary.ledger_warnings.duplicate_ids === 1
  && m05Report.summary.ledger_warnings.dropped_rows === 1,
  JSON.stringify(m05Report.summary.ledger_warnings));
const m05Md = markdown(m05Report);
check('M-05 ledger warnings surfaced as lines in run-report.md',
  m05Md.includes('## Ledger warnings')
  && m05Md.includes('- non-numeric attempt values dropped: 1')
  && m05Md.includes('- duplicate goal ids: 1')
  && m05Md.includes('- malformed checkbox rows dropped: 1'));

// ---- L-06: `ALLOW inert` distinguishable from plain ALLOW ----
const l06 = parseHookLog([
  '2026-07-15T22:10:00+0900 ALLOW inert sandbox=default',
  '2026-07-15T22:10:01+0900 ALLOW sandbox=read-only'
].join('\n'));
check('L-06 inert modifier emitted as inert:true; plain ALLOW has no inert field',
  l06.decisions[0].inert === true && !('inert' in l06.decisions[1])
  && l06.decisions[0].sandbox === 'default' && l06.dropped_lines === 0);

// ---- L-03: checkbox rows failing the id anchor counted as dropped_rows (not goals) ----
const l03 = parseLedger([
  '- [x] Ship the thing [codex:terra] no id anchor | q:0 i:0 tier:terra |',
  '- [ ] G13.1 [codex:luna] Real goal | evidence:',
  'plain prose line, not a checkbox'
].join('\n'));
check('L-03 anchor-failing checkbox row counted as dropped_rows, real goal still parsed',
  l03.goals.length === 1 && l03.goals[0].id === 'G13.1' && l03.warnings.dropped_rows === 1);

// ---- L-04: a tier named __proto__/constructor cannot corrupt the accumulators ----
const l04 = buildReport({ goals: [
  { id: 'G14.1', assigned_tier: '__proto__', actual_model: '__proto__', escalations: [], outcome: 'done', input_tokens: 1000, output_tokens: 100 },
  { id: 'G14.2', assigned_tier: 'constructor', actual_model: 'constructor', escalations: [], outcome: 'done' }
] }, { decisions: [], dropped_lines: 0 });
check('L-04 __proto__/constructor tiers land as plain keys and reconcile',
  l04.summary.tier_distribution['__proto__'] === 1
  && l04.summary.tier_distribution['constructor'] === 1
  && l04.summary.tier_distribution_total === 2 && l04.summary.tier_reconciles === true,
  JSON.stringify(l04.summary.tier_distribution));
check('L-04 __proto__/constructor are no-rate tiers (no fake inherited rate, no NaN cost)',
  l04.summary.cost_no_rate_tiers.includes('__proto__')
  && l04.summary.cost_no_rate_tiers.includes('constructor')
  && Object.values(l04.summary.cost_proxy_by_tier).every((value) => Number.isFinite(value)));

// ---- L-02: a real token containing "declared:lane=destructive" keeps its full text ----
const l02 = parseHookLog([
  '2026-07-15T22:20:00+0900 BLOCK sandbox=danger-full-access approval=on-request token:git push origin main declared:lane=destructive',
  '2026-07-15T22:20:01+0900 BLOCK sandbox=default approval=default declared:lane=destructive'
].join('\n'));
check('L-02 token with declared-lane text keeps git-push prefix; bare declared-lane still tagged',
  l02.decisions[0].token === 'git push origin main declared:lane=destructive'
  && l02.decisions[1].token === 'declared:lane=destructive' && l02.dropped_lines === 0,
  `token0=${JSON.stringify(l02.decisions[0].token)}`);

// ---- 0.5.0 ROUTING TAGS (owner instruction 2026-09-24) ----

// R5-01: the new lane tags parse to their model keys (effort suffix + modifiers ignored).
const r501 = parseLedger([
  '- [ ] G15.1 [codex:gpt-6-sol/high] Rename in 4 named files | writes: a.ts b.ts | evidence:',
  '- [ ] G15.2 [claude:opus/high] Implement the endpoint | evidence:',
  '- [ ] G15.3 [claude:opus/xhigh pin xverify] Auth refresh + RLS | evidence:',
  '- [ ] G15.4 [claude:opus/high fanout] Five endpoints | evidence:'
].join('\n'));
check('R5-01 new lane tags parse to gpt-6-sol / opus',
  JSON.stringify(r501.goals.map((goal) => goal.assigned_tier)) === JSON.stringify(['gpt-6-sol', 'opus', 'opus', 'opus']),
  r501.goals.map((goal) => goal.assigned_tier).join(','));

// R5-02: a Sol strike that comes back to Opus is ONE escalation; Opus -> Sol is a downgrade, never one.
const r502 = parseLedger([
  '- [x] G16.1 [codex:gpt-6-sol/high] Mechanical packet | q:1 i:0 tier:opus effort:high sandbox:claude-session |',
  '- [x] G16.2 [claude:opus/high] Downgrade run | q:0 i:0 tier:gpt-6-sol effort:high sandbox:danger-full-access |',
  '- [x] G16.3 [claude:opus/high] Same lane, higher effort | q:2 i:0 tier:opus effort:xhigh sandbox:worktree |'
].join('\n'));
check('R5-02 gpt-6-sol -> opus counts as 1 escalation', r502.goals[0].escalations.length === 1
  && r502.goals[0].escalations[0].assigned_tier === 'gpt-6-sol' && r502.goals[0].escalations[0].actual_tier === 'opus');
check('R5-02 opus -> gpt-6-sol downgrade is NOT an escalation', r502.goals[1].escalations.length === 0);
check('R5-02 opus high -> opus xhigh (effort only) is NOT a lane escalation', r502.goals[2].escalations.length === 0
  && r502.goals[2].effort === 'xhigh' && r502.goals[2].sandbox === 'worktree');

// R5-03: legacy tags normalized in arrow form keep their legacy assigned tier; the cross-ladder
// re-classification (terra/sol -> opus, luna -> gpt-6-sol) is NOT counted as a strike escalation.
const r503 = parseLedger([
  '- [x] G17.1 [codex:terra→claude:opus/high] Legacy workhorse row | q:0 i:0 tier:opus effort:high sandbox:claude-session |',
  '- [x] G17.2 [codex:sol pin→claude:opus/xhigh pin] Legacy flagship row | q:0 i:0 tier:opus effort:xhigh sandbox:worktree |',
  '- [x] G17.3 [codex:luna→codex:gpt-6-sol/high] Legacy easy row | q:0 i:0 tier:gpt-6-sol effort:high sandbox:danger-full-access |'
].join('\n'));
check('R5-03 legacy arrow rows keep legacy assigned tier',
  JSON.stringify(r503.goals.map((goal) => goal.assigned_tier)) === JSON.stringify(['terra', 'sol', 'luna']));
check('R5-03 legacy -> 0.5.0 re-classification is not an escalation',
  r503.goals.every((goal) => goal.escalations.length === 0),
  r503.goals.map((goal) => goal.escalations.length).join(','));
check('R5-03 legacy luna->terra (same legacy ladder) still counts', parseLedger('- [x] G17.4 [codex:luna] Old run | q:1 i:0 tier:terra effort:high sandbox:read-only |').goals[0].escalations.length === 1);

// R5-03b (Astra xverify finding): escalation after a normalization is measured from the LIVE tag,
// and an uncertainty re-route (q:0) is never an escalation.
const r503b = parseLedger([
  '- [x] G17.5 [codex:luna→codex:gpt-6-sol/high] Normalized, then Sol struck | q:1 i:0 tier:opus effort:high sandbox:claude-session |',
  '- [x] G17.6 [codex:gpt-6-sol→claude:opus/high] Sol said "needs a decision" | q:0 i:0 tier:opus effort:high sandbox:claude-session |',
  '- [x] G17.7 [codex:gpt-6-sol→claude:opus/high] Re-routed, then an Opus-high retry | q:1 i:0 tier:opus effort:high sandbox:claude-session |'
].join('\n'));
check('R5-03b luna→gpt-6-sol normalized row that escalated to opus counts 1 (from the live tag)',
  r503b.goals[0].escalations.length === 1 && r503b.goals[0].escalations[0].assigned_tier === 'gpt-6-sol'
  && r503b.goals[0].assigned_tier === 'luna');
check('R5-03b uncertainty re-route gpt-6-sol→opus (q:0) is NOT an escalation', r503b.goals[1].escalations.length === 0);
check('R5-03b re-routed row retried on the same lane (opus→opus, q:1) is NOT an escalation', r503b.goals[2].escalations.length === 0);
// Ledger contract (model-routing.md): in 0.5.0 an arrow is a normalization / re-route / quota
// substitution, never a strike escalation, so a chain ending in the lane that ran is not one.
const r503c = parseLedger('- [x] G17.8 [codex:luna→codex:gpt-6-sol→claude:opus/high] Normalized, then re-routed | q:1 i:0 tier:opus effort:high sandbox:claude-session |');
check('R5-03b arrow chain ending at the lane that ran (re-routes, per contract) is NOT an escalation',
  r503c.goals[0].escalations.length === 0 && r503c.goals[0].assigned_tier === 'luna');

// R5-04: an xverify record segment on the row never hijacks or breaks the attempt record.
const r504 = parseLedger('- [x] G18.1 [claude:opus/xhigh pin] Payments webhook | q:0 i:1 tier:opus effort:xhigh sandbox:worktree | xverify: gpt-6-astra/max GO → docs/xverify/G18.1.md | evidence: /tmp/goalpost-evidence/G18.1.log');
check('R5-04 xverify segment leaves the attempt record intact',
  r504.goals.length === 1 && r504.goals[0].q === 0 && r504.goals[0].i === 1 && r504.goals[0].tier === 'opus'
  && r504.goals[0].effort === 'xhigh' && r504.warnings.dropped_rows === 0 && r504.goals[0].outcome === 'done');

// R5-05: the shipped LEDGER template's example rows use tags the parser accepts.
const templateLedger = parseLedger(fs.readFileSync(path.join(ROOT, 'skills/goalpost/templates/LEDGER-template.md'), 'utf8'));
const templateTiers = Object.fromEntries(templateLedger.goals.map((goal) => [goal.id, goal.assigned_tier]));
check('R5-05 LEDGER template rows parse with 0.5.0 lanes',
  templateTiers['G1.1'] === 'opus' && templateTiers['G1.2'] === 'opus' && templateTiers['G1.3'] === 'gpt-6-sol'
  && templateTiers['G1.4'] === 'opus' && templateTiers['G1.9'] === 'untagged' && templateLedger.warnings.dropped_rows === 0,
  JSON.stringify(templateTiers));

// R5-06: report buckets the new lanes, reconciles, and labels them best-effort (no published rate here).
const r506 = buildReport(parseLedger([
  '- [x] G19.1 [claude:opus/high] A | q:0 i:0 tier:opus effort:high sandbox:claude-session input_tokens:1000 output_tokens:100 |',
  '- [x] G19.2 [codex:gpt-6-sol/high] B | q:0 i:0 tier:gpt-6-sol effort:high sandbox:danger-full-access |'
].join('\n')), { decisions: [], dropped_lines: 0 });
check('R5-06 opus / gpt-6-sol get their own buckets and reconcile',
  r506.summary.tier_distribution.opus === 1 && r506.summary.tier_distribution['gpt-6-sol'] === 1 && r506.summary.tier_reconciles === true);
check('R5-06 new lanes are no-rate (best-effort), never priced at the legacy gpt-5.6-sol rate',
  r506.summary.cost_no_rate_tiers.includes('opus') && r506.summary.cost_no_rate_tiers.includes('gpt-6-sol')
  && r506.summary.cost_proxy_by_tier.sol === 0);

if (failures) {
  process.stderr.write(`${failures} regression check(s) FAILED\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('ALL REGRESSION CHECKS PASS\n');
}
