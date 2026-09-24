#!/usr/bin/env node
'use strict';

const fs = require('fs');

const OUTCOMES = { ' ': 'pending', '~': 'in_progress', x: 'done', X: 'done', '!': 'failed', '-': 'removed' };
const ATTEMPT_FIELDS = ['q', 'i', 'tier', 'effort', 'sandbox', 'wall_clock_s', 'input_tokens', 'output_tokens'];
const NUMERIC_FIELDS = ['q', 'i', 'wall_clock_s', 'input_tokens', 'output_tokens'];
// M-01: escalation ladders — an escalation is a strictly UP move WITHIN one ladder, and only
// after a quality strike (q >= 1): a first classification, a normalization, or an uncertainty
// re-route (q:0) is never one. Null-prototype maps so __proto__/constructor never rank.
// - Legacy GPT-5.6 Codex ladder (pre-0.5.0): luna < terra < sol, measured from the FIRST tag in
//   the row (legacy arrow tags like [codex:luna→terra] recorded an escalation).
// - 0.5.0 ladder: gpt-6-sol < opus, measured from the LIVE tag (the part after the last →;
//   0.5.0 arrows record a normalization or re-route, and the attempt `tier:` records escalation).
// A move across ladders (a legacy terra row normalized to opus) is a re-classification.
const LEGACY_LADDER = Object.assign(Object.create(null), { luna: 1, terra: 2, sol: 3 });
const LADDER_050 = Object.assign(Object.create(null), { 'gpt-6-sol': 1, opus: 2 });

function upMove(ladder, from, to) {
  return ladder[from] !== undefined && ladder[to] !== undefined && ladder[to] > ladder[from];
}

// Tiers named in a tag, in order: "codex:luna→codex:gpt-6-sol/high" -> ['luna', 'gpt-6-sol'].
function tagChain(tag) {
  return tag.split('→').map((part, index) => {
    if (index === 0) return assignedTier(part);
    const match = /^\s*(?:[a-z0-9_-]+:)?([a-z0-9_-]+)/i.exec(part);
    return match ? match[1] : null;
  }).filter(Boolean);
}

function escalationBaseline(tag, actual, q) {
  if (typeof q !== 'number' || q < 1 || tag === undefined) return null;
  const chain = tagChain(tag);
  if (chain.length === 0) return null;
  const first = chain[0];
  const live = chain[chain.length - 1];
  if (upMove(LEGACY_LADDER, first, actual)) return first;
  if (upMove(LADDER_050, live, actual)) return live;
  return null;
}

function assignedTier(tag) {
  const match = /^([a-z0-9_-]+):([a-z0-9_-]+)/i.exec(tag.trim());
  if (match) return match[2];
  return /^[a-z0-9_-]+$/i.test(tag.trim()) ? 'unclassified' : null;
}

function parseAttempt(segment) {
  const values = {};
  let nonNumericDropped = 0;
  for (const name of ATTEMPT_FIELDS) {
    const match = new RegExp(`(?:^|\\s)${name}:([^\\s|]+)`).exec(segment);
    if (!match) continue;
    if (NUMERIC_FIELDS.includes(name)) {
      // M-03: numeric attempt fields are coerced; a non-numeric value (e.g. "90s") is dropped
      // from the goal and counted as a warning so goals[] and any total stay consistent.
      if (/^\d+(?:\.\d+)?$/.test(match[1])) values[name] = Number(match[1]);
      else nonNumericDropped += 1;
    } else {
      values[name] = match[1];
    }
  }
  return { values, nonNumericDropped };
}

function parseLedger(text) {
  const goals = [];
  const seenIds = new Set();
  const warnings = { non_numeric_dropped: 0, duplicate_ids: 0, dropped_rows: 0 };
  for (const row of String(text || '').split(/\r?\n/)) {
    // H-05/H-06: id anchored to G<digit>(.<digit>)* so prose words (Gate/Grep/Generate) can never
    // become goals, and the [tag] is OPTIONAL so a real untagged goal row is collected, not dropped.
    const match = /^\s*-\s*\[([ ~xX!-])\]\s+(G\d+(?:\.\d+)*)(?:\s+\[([^\]]+)\])?(?:\s|$)/.exec(row);
    if (!match) {
      // L-03: a checkbox row that fails the goal-id anchor is counted, never silently invisible.
      if (/^\s*-\s*\[[ ~xX!-]\]/.test(row)) warnings.dropped_rows += 1;
      continue;
    }
    const tier = match[3] === undefined ? 'untagged' : assignedTier(match[3]);
    if (!tier) continue;
    // H-02/H-02R: the attempt record is identified by the record GRAMMAR — the segment must
    // START with q:<digit> — and the LAST such segment wins. A title merely mentioning "q:"
    // (e.g. "Harden the q: scan") can never hijack the record.
    const attemptSegment = row.split('|').reverse().find((segment) => /^\s*q:\d/.test(segment));
    const { values: attempt, nonNumericDropped } = attemptSegment
      ? parseAttempt(attemptSegment)
      : { values: {}, nonNumericDropped: 0 };
    warnings.non_numeric_dropped += nonNumericDropped;
    const actualTier = typeof attempt.tier === 'string' ? attempt.tier : tier;
    // M-01: count an escalation only on a strict UP move within a ladder after a quality strike;
    // unclassified/untagged and tiers outside the ladders are skipped (see escalationBaseline).
    const baseline = escalationBaseline(match[3], actualTier, attempt.q);
    const goal = {
      id: match[2],
      assigned_tier: tier,
      actual_model: actualTier,
      escalations: baseline ? [{ assigned_tier: baseline, actual_tier: actualTier }] : [],
      outcome: OUTCOMES[match[1]]
    };
    for (const field of ATTEMPT_FIELDS) {
      if (field in attempt) goal[field] = attempt[field];
    }
    if (seenIds.has(goal.id)) warnings.duplicate_ids += 1; // L-01: flagged, still parsed
    seenIds.add(goal.id);
    goals.push(goal);
  }
  return { goals, warnings };
}

function readInput(filename) {
  try {
    return filename ? fs.readFileSync(filename, 'utf8') : fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function main() {
  if (!process.argv[2] && process.stdin.isTTY) process.stderr.write('Usage: node scripts/telemetry/parse-ledger.js <ledger.md>\n');
  process.stdout.write(`${JSON.stringify(parseLedger(readInput(process.argv[2])), null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { parseLedger };
