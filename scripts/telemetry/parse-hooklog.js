#!/usr/bin/env node
'use strict';

const fs = require('fs');

function parseHookLog(text) {
  const decisions = [];
  let droppedLines = 0;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    // H-01: guard-override lines (`<ts> ALLOW override=<source>`, written when the guard is disabled)
    // are the most audit-critical records — parse them (decision=ALLOW, override field, sandbox null).
    const overrideMatch = /^(\S+)\s+ALLOW\s+override=(\S+)\s*$/.exec(line);
    if (overrideMatch) {
      decisions.push({ ts: overrideMatch[1], decision: 'ALLOW', token: null, sandbox: null, override: overrideMatch[2] });
      continue;
    }
    const match = /^(\S+)\s+(ALLOW|BLOCK)\s+(inert\s+)?sandbox=(\S+)(?:\s+approval=(\S+))?(?:\s+(declared:lane=destructive)|\s+token:(.*))?\s*$/.exec(line);
    if (!match) {
      droppedLines += 1; // H-01: unrecognized non-empty lines are counted, never silently vanished
      continue;
    }
    const [, ts, decision, inert, sandbox, approval, declaredLane, tokenText] = match;
    const record = { ts, decision, token: null, sandbox };
    if (inert !== undefined) record.inert = true; // L-06: `ALLOW inert` is distinguishable in telemetry
    // L-02: declared-lane comes from the regex CAPTURE position, so a token whose text merely
    // contains "declared:lane=destructive" keeps its full captured value (e.g. the git-push prefix).
    if (declaredLane !== undefined) record.token = declaredLane;
    else if (tokenText !== undefined) record.token = tokenText;
    if (approval !== undefined) record.approval = approval;
    decisions.push(record);
  }
  return { decisions, dropped_lines: droppedLines };
}

function readInput(filename) {
  try {
    return filename ? fs.readFileSync(filename, 'utf8') : fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function main() {
  if (!process.argv[2] && process.stdin.isTTY) process.stderr.write('Usage: node scripts/telemetry/parse-hooklog.js <codex-guard.log>\n');
  process.stdout.write(`${JSON.stringify(parseHookLog(readInput(process.argv[2])), null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { parseHookLog };
