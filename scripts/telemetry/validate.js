#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(field, message) {
  process.stderr.write(`Invalid ${field}: ${message}\n`);
  return 1;
}

// M-04: validate.js enforces the schema's DECLARED fields (e.g. run_id: string), not arbitrary JSON-schema.
function validate(value, schema) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('$', 'must be an object');
  const declaredProperties = (schema && schema.properties) || {};
  for (const key of Object.keys(declaredProperties)) {
    const declaredType = declaredProperties[key].type;
    if (['string', 'number', 'boolean'].includes(declaredType) && key in value && typeof value[key] !== declaredType) {
      return fail(key, `must be a ${declaredType}`); // unknown extra fields remain ignored (forward-compat)
    }
  }
  if (!Array.isArray(value.goals)) return fail('goals', 'is required and must be an array');
  for (let index = 0; index < value.goals.length; index += 1) {
    const goal = value.goals[index];
    const prefix = `goals[${index}]`;
    if (!goal || typeof goal !== 'object' || Array.isArray(goal)) return fail(prefix, 'must be an object');
    for (const key of ['id', 'assigned_tier', 'outcome']) {
      if (typeof goal[key] !== 'string' || goal[key] === '') return fail(`${prefix}.${key}`, 'is required and must be a non-empty string');
    }
    for (const key of ['actual_model', 'effort', 'sandbox']) {
      if (key in goal && typeof goal[key] !== 'string') return fail(`${prefix}.${key}`, 'must be a string');
    }
    for (const key of ['escalations', 'hook_decisions']) {
      if (key in goal && !Array.isArray(goal[key])) return fail(`${prefix}.${key}`, 'must be an array');
    }
    for (const key of ['wall_clock_s', 'input_tokens', 'output_tokens']) {
      if (key in goal && (typeof goal[key] !== 'number' || !Number.isFinite(goal[key]) || goal[key] < 0)) return fail(`${prefix}.${key}`, 'must be a non-negative number');
    }
  }
  return 0;
}

function main() {
  const filename = process.argv[2];
  if (!filename) {
    process.stderr.write('Usage: node scripts/telemetry/validate.js <telemetry.json>\n');
    return 1;
  }
  try {
    // Load the adjacent schema; its declared top-level scalar types are enforced (M-04).
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
    return validate(JSON.parse(fs.readFileSync(filename, 'utf8')), schema);
  } catch (error) {
    return fail('$', error instanceof Error ? error.message : 'could not read JSON');
  }
}

if (require.main === module) process.exitCode = main();
module.exports = { validate };
