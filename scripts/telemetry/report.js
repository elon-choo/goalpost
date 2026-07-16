#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { parseLedger } = require('./parse-ledger');
const { parseHookLog } = require('./parse-hooklog');

// L-04: null-prototype so a tier literally named __proto__/constructor is a plain key,
// never an inherited Object.prototype member (which read as a truthy fake "rate").
const RATES = Object.assign(Object.create(null), {
  sol: { input: 5, output: 30 },
  terra: { input: 2.5, output: 15 },
  luna: { input: 1, output: 6 }
});

// H-04: I/O errors propagate to main — a missing/unreadable path the user passed must not
// masquerade as an empty run. (Empty/garbage CONTENT stays fail-open: parsers return typed-empty.)
function readFile(filename) {
  return fs.readFileSync(filename, 'utf8');
}

function dollars(value) { return `$${value.toFixed(2)}`; }

function buildReport(ledger, hooklog) {
  const decisions = hooklog.decisions;
  // L-04: null-prototype accumulators — a tier named __proto__/constructor cannot corrupt the map.
  const tierDistribution = Object.assign(Object.create(null), { luna: 0, terra: 0, sol: 0 });
  const costByTier = Object.assign(Object.create(null), { luna: 0, terra: 0, sol: 0 });
  const noRateTiers = [];
  let escalations = 0;
  let wallClock = 0;
  for (const goal of ledger.goals) {
    // H-03: every goal lands in a bucket — tiers outside luna/terra/sol get their own key.
    tierDistribution[goal.assigned_tier] = (tierDistribution[goal.assigned_tier] || 0) + 1;
    escalations += Array.isArray(goal.escalations) ? goal.escalations.length : 0;
    wallClock += typeof goal.wall_clock_s === 'number' ? goal.wall_clock_s : 0;
    const rate = RATES[goal.assigned_tier];
    if (rate && (typeof goal.input_tokens === 'number' || typeof goal.output_tokens === 'number')) {
      costByTier[goal.assigned_tier] += ((goal.input_tokens || 0) * rate.input + (goal.output_tokens || 0) * rate.output) / 1000000;
    } else if (!rate && !noRateTiers.includes(goal.assigned_tier)) {
      noRateTiers.push(goal.assigned_tier); // H-03: no published rate — labelled, not silently $0-dropped
    }
  }
  const hookDecisions = {
    allow: decisions.filter((record) => record.decision === 'ALLOW').length,
    block: decisions.filter((record) => record.decision === 'BLOCK').length,
    dropped_lines: hooklog.dropped_lines
  };
  // M-05: ledger parse warnings ride the report, mirroring hooklog dropped_lines — not only
  // visible when parse-ledger.js is called directly.
  const ledgerWarnings = ledger.warnings || { non_numeric_dropped: 0, duplicate_ids: 0, dropped_rows: 0 };
  const distributionTotal = Object.values(tierDistribution).reduce((sum, count) => sum + count, 0);
  return {
    goals: ledger.goals,
    hook_decisions: decisions,
    summary: {
      tier_distribution: tierDistribution,
      tier_distribution_total: distributionTotal,
      tier_reconciles: distributionTotal === ledger.goals.length, // H-03: reconcile assertion input
      escalation_count: escalations,
      ledger_warnings: ledgerWarnings,
      hook_decisions: hookDecisions,
      wall_clock_s: wallClock,
      cost_proxy_by_tier: costByTier,
      cost_no_rate_tiers: noRateTiers
    }
  };
}

function markdown(report) {
  const lines = ['# Goalpost run report', '', '## Tier distribution', ''];
  for (const tier of Object.keys(report.summary.tier_distribution)) lines.push(`- ${tier}: ${report.summary.tier_distribution[tier]}`);
  lines.push('', '## Escalations', '', `- Total: ${report.summary.escalation_count}`, '', '## Ledger warnings', '', `- non-numeric attempt values dropped: ${report.summary.ledger_warnings.non_numeric_dropped}`, `- duplicate goal ids: ${report.summary.ledger_warnings.duplicate_ids}`, `- malformed checkbox rows dropped: ${report.summary.ledger_warnings.dropped_rows}`, '', '## Hook decisions', '', `- ALLOW: ${report.summary.hook_decisions.allow}`, `- BLOCK: ${report.summary.hook_decisions.block}`, `- dropped (unrecognized) lines: ${report.summary.hook_decisions.dropped_lines}`, '', '## Wall-clock', '', `- Total: ${report.summary.wall_clock_s}s`, '', '## Cost proxy', '');
  for (const goal of report.goals) {
    const rate = RATES[goal.assigned_tier];
    if (!rate) {
      lines.push(`- ${goal.id} (${goal.assigned_tier}): best-effort (no rate)`); // H-03
      continue;
    }
    if (typeof goal.input_tokens === 'number' || typeof goal.output_tokens === 'number') {
      const cost = ((goal.input_tokens || 0) * rate.input + (goal.output_tokens || 0) * rate.output) / 1000000;
      lines.push(`- ${goal.id} (${goal.assigned_tier}): ${dollars(cost)}`);
    } else {
      lines.push(`- ${goal.id} (${goal.assigned_tier}): best-effort (no token counts); rates $${rate.input}/1M input, $${rate.output}/1M output`);
    }
  }
  lines.push('', 'Per-tier totals:');
  for (const tier of Object.keys(report.summary.cost_proxy_by_tier)) lines.push(`- ${tier}: ${dollars(report.summary.cost_proxy_by_tier[tier])}`);
  for (const tier of report.summary.cost_no_rate_tiers) lines.push(`- ${tier}: best-effort (no rate)`);
  return `${lines.join('\n')}\n`;
}

function argumentsMap(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 2) {
    if (!args[index] || !args[index].startsWith('--') || !args[index + 1]) return null;
    result[args[index].slice(2)] = args[index + 1];
  }
  return result;
}

function main() {
  const args = argumentsMap(process.argv.slice(2));
  if (!args || !args.ledger || !args.hooklog || !args['out-json'] || !args['out-md']) {
    process.stderr.write('Usage: node scripts/telemetry/report.js --ledger <f> --hooklog <f> --out-json <f> --out-md <f>\n');
    return 1; // H-04: a usage/arg error is a non-zero exit
  }
  let ledgerText;
  let hooklogText;
  try {
    ledgerText = readFile(args.ledger);
  } catch (error) {
    process.stderr.write(`Could not read --ledger ${args.ledger}: ${error instanceof Error ? error.message : 'read error'}\n`);
    return 1; // H-04: a missing/unreadable input path is an error, not an empty run
  }
  try {
    hooklogText = readFile(args.hooklog);
  } catch (error) {
    process.stderr.write(`Could not read --hooklog ${args.hooklog}: ${error instanceof Error ? error.message : 'read error'}\n`);
    return 1;
  }
  const report = buildReport(parseLedger(ledgerText), parseHookLog(hooklogText));
  if (!report.summary.tier_reconciles) {
    process.stderr.write(`Tier distribution total ${report.summary.tier_distribution_total} does not reconcile with ${report.goals.length} goals\n`);
    return 1; // H-03: reconcile assertion
  }
  try {
    fs.writeFileSync(args['out-json'], `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(args['out-md'], markdown(report));
  } catch (error) {
    process.stderr.write(`Could not write report: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    return 1;
  }
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { buildReport, markdown };
