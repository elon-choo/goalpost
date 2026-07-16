#!/usr/bin/env node
'use strict';

const { parseHookLog } = require('../scripts/telemetry/parse-hooklog');
const fs = require('fs');

try {
  const parsed = parseHookLog(fs.readFileSync('test/fixtures/codex-guard.sample.log', 'utf8'));
  const records = parsed.decisions;
  const allowCount = records.filter((record) => record.decision === 'ALLOW').length;
  const blockCount = records.filter((record) => record.decision === 'BLOCK').length;
  const hasDeclaredLane = records.some((record) => record.token === 'declared:lane=destructive');
  // H-01: guard-override lines (guard disabled) must be parsed, and nothing may vanish silently.
  const overrides = records.filter((record) => record.override).map((record) => record.override).sort().join(',');
  // L-06: the fixture's `ALLOW inert` line must be distinguishable (inert:true), and only that one.
  const inertCount = records.filter((record) => record.inert === true).length;
  if (allowCount === 5 && blockCount === 12 && hasDeclaredLane && overrides === 'env,file' && parsed.dropped_lines === 0 && inertCount === 1) {
    process.stdout.write(`PASS allow_count=${allowCount} block_count=${blockCount} overrides=${overrides} dropped_lines=${parsed.dropped_lines} inert_count=${inertCount}\n`);
  } else {
    process.stderr.write(`FAIL allow_count=${allowCount} block_count=${blockCount} declared_lane=${hasDeclaredLane} overrides=${overrides} dropped_lines=${parsed.dropped_lines} inert_count=${inertCount}\n`);
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`FAIL ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
}
