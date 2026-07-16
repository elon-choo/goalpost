#!/usr/bin/env bash

# Goalpost S4 acceptance and regression tests for the canonical in-repo hook.
# Scratch HOME/log/override paths keep every invocation away from live hook state.
set -u

TEST_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "$TEST_DIR/.." && pwd)"
HOOK="$ROOT_DIR/scripts/codex-safety-gate.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/codex-guard-s4.XXXXXX")" || exit 1
SCRATCH_HOME="$SCRATCH/home"
DEFAULT_OVERRIDE="$SCRATCH/default-override"
mkdir -p "$SCRATCH_HOME"

PASS_COUNT=0
FAIL_COUNT=0
CASE_NO=0
LAST_RC=0
LAST_LOG=""
LAST_STDOUT=""
LAST_STDERR=""

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS case: %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'FAIL case: %s\n' "$1"
}

require_command() {
  if command -v "$1" >/dev/null 2>&1; then
    pass "dependency available: $1"
  else
    fail "dependency missing: $1"
  fi
}

# Arguments use __ABSENT__ when the JSON property must not be present.
build_payload() {
  node - "$@" <<'NODE'
const [toolName, sandbox, model, prompt, developerInstructions] = process.argv.slice(2);
const payload = {};
const toolInput = {};

if (toolName !== "__ABSENT__") payload.tool_name = toolName;
if (sandbox !== "__ABSENT__") toolInput.sandbox = sandbox;
if (model !== "__ABSENT__") toolInput.model = model;
if (prompt !== "__ABSENT__") toolInput.prompt = prompt;
if (developerInstructions !== "__ABSENT__") {
  toolInput["developer-instructions"] = developerInstructions;
}
payload.tool_input = toolInput;
process.stdout.write(JSON.stringify(payload));
NODE
}

run_hook() {
  local payload="$1"
  local override_file="$2"
  local guard_off="$3"

  CASE_NO=$((CASE_NO + 1))
  LAST_LOG="$SCRATCH/case-$CASE_NO.log"
  LAST_STDOUT="$SCRATCH/case-$CASE_NO.stdout"
  LAST_STDERR="$SCRATCH/case-$CASE_NO.stderr"

  set +e
  printf '%s' "$payload" | env \
    HOME="$SCRATCH_HOME" \
    CODEX_GUARD_LOG="$LAST_LOG" \
    CODEX_GUARD_OVERRIDE="$override_file" \
    CODEX_GUARD_OFF="$guard_off" \
    bash "$HOOK" >"$LAST_STDOUT" 2>"$LAST_STDERR"
  LAST_RC=$?
  set -e
}

expect_result() {
  local name="$1"
  local expected_rc="$2"
  local required_log="$3"
  local forbidden_log="${4-}"
  local ok=1

  if [ "$LAST_RC" -ne "$expected_rc" ]; then
    ok=0
  fi
  if [ ! -f "$LAST_LOG" ] || ! grep -Fq -- "$required_log" "$LAST_LOG"; then
    ok=0
  fi
  if [ -n "$forbidden_log" ] && [ -f "$LAST_LOG" ] && grep -Fq -- "$forbidden_log" "$LAST_LOG"; then
    ok=0
  fi

  if [ "$ok" -eq 1 ]; then
    pass "$name"
  else
    fail "$name (rc=$LAST_RC expected=$expected_rc required-log=$required_log forbidden-log=${forbidden_log:-none})"
    if [ -f "$LAST_LOG" ]; then sed 's/^/  log: /' "$LAST_LOG"; fi
    if [ -s "$LAST_STDERR" ]; then sed 's/^/  stderr: /' "$LAST_STDERR"; fi
  fi
}

expect_file_contains() {
  local name="$1"
  local file="$2"
  local text="$3"

  if [ -f "$file" ] && grep -Fq -- "$text" "$file"; then
    pass "$name"
  else
    fail "$name"
  fi
}

require_command bash
require_command grep
require_command jq
require_command node
require_command perl

if bash -n "$HOOK"; then
  pass "hook has valid Bash syntax"
else
  fail "hook has valid Bash syntax"
fi

if grep -Fq -- '# Canonical in-repo PreToolUse hook for mcp__codex__codex(-reply).' "$HOOK"; then
  pass "F5 canonical PreToolUse header names codex and codex-reply"
else
  fail "F5 canonical PreToolUse header names codex and codex-reply"
fi

if grep -Fq -- '# SAFETY SCOPE: This hook is a PARTIAL denylist / second wall, not a complete' "$HOOK"; then
  pass "safety scope documents partial denylist and second-wall status"
else
  fail "safety scope documents partial denylist and second-wall status"
fi

# R1: exact tool + exact danger-full-access + explicit Sol blocks.
payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-sol x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R1 explicit Sol on exact full-access dispatch blocks" 2 "BLOCK sol-on-full-access"
SOL_MESSAGE='Sol on the full-access lane is blocked (re-dispatch workspace-write, or set a non-Sol model for inert work, or CODEX_GUARD_OFF=1 for an intentional one-off)'
expect_file_contains "R1 explicit Sol emits the required remediation message" "$LAST_STDERR" "$SOL_MESSAGE"

payload="$(build_payload mcp__codex__codex danger-full-access 'gpt-5.6-sol ' x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-01 trailing-space Sol normalizes and blocks" 2 "BLOCK sol-on-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-SOL x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-01 uppercase Sol normalizes and blocks" 2 "BLOCK sol-on-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access openai/gpt-5.6-sol x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-01 provider-prefixed Sol normalizes and blocks" 2 "BLOCK sol-on-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-terra x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-01 explicit Terra remains allowed for inert work" 0 "ALLOW inert sandbox=danger-full-access" "sol-on-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access __ABSENT__ x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R1 absent model uses effective Sol WARN and preserves fast lane" 0 "WARN effective-sol-on-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R1 explicit non-Sol continues to inert scan" 0 "ALLOW inert sandbox=danger-full-access" "sol-on-full-access"

payload="$(build_payload mcp__codex__codex-reply __ABSENT__ __ABSENT__ x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R1 codex-reply is not blanket-blocked" 0 "ALLOW inert sandbox=default" "sol-on-full-access"

payload="$(build_payload mcp__codex__codex workspace-write __ABSENT__ x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R1 workspace-write remains early ALLOW" 0 "ALLOW sandbox=workspace-write"

payload="$(build_payload mcp__codex__codex danger_full_access gpt-5.6-sol x __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R1 model pin applies only to exact danger-full-access spelling" 0 "ALLOW inert sandbox=danger_full_access" "sol-on-full-access"

# R2: code-shaped, no-argument mass-domain calls block; collection/argument calls do not.
payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'cancelAllSubscriptions()' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 unqualified no-arg cancelAllSubscriptions blocks" 2 "BLOCK sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'billing.cancelAllSubscriptions()' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 qualified no-arg cancelAllSubscriptions blocks" 2 "BLOCK sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna "UPDATE subscriptions SET status='canceled'" __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 UPDATE without WHERE blocks" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE users SET banned=1' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 real no-WHERE mass UPDATE blocks" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna $'UPDATE users SET banned=1\n\nWhere should we run this?' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 English Where after blank line cannot rescue mass UPDATE" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE users SET banned=1 -- not sure where to add index' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 commented where cannot rescue mass UPDATE" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE users AS u SET banned=1' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-01 AS-aliased no-WHERE mass UPDATE blocks" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE users u SET banned=1' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-01 bare-aliased no-WHERE mass UPDATE blocks" 2 "token:mass UPDATE without WHERE"

for prose in \
  'update character set to utf8mb4' \
  'update the result set handling' \
  'update result set handling' \
  'update feature set for pro' \
  'update the set of enabled features'
do
  payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna "$prose" __ABSENT__)"
  run_hook "$payload" "$DEFAULT_OVERRIDE" 0
  expect_result "H-01 English prose allows: $prose" 0 "ALLOW inert sandbox=danger-full-access"
done

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'list.removeAll(duplicates)' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 argument-bearing collection removeAll allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'this.selected.removeAll()' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 common no-arg collection removeAll allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'cancelAllSubscriptions(ids)' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 argument-bearing cancelAllSubscriptions allows" 0 "ALLOW inert sandbox=danger-full-access"

for call in 'clearAll()' 'wipeAll()' 'destroyAll()' 'flushAll()' 'deleteMany()'
do
  payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna "$call" __ABSENT__)"
  run_hook "$payload" "$DEFAULT_OVERRIDE" 0
  expect_result "M-03 no-arg mass operation blocks: $call" 2 "BLOCK sandbox=danger-full-access"
done

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'deleteMany({where})' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "M-03 argument-bearing deleteMany allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE t SET x=1 WHERE id=2' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 same-line WHERE-scoped UPDATE allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna $'UPDATE t SET x=1\nWHERE id=2' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 multiline WHERE-scoped UPDATE allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna "UPDATE t SET x=1 WHERE name LIKE 'a%'" __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 LIKE-scoped UPDATE allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE t SET x=1 WHERE id IN (1,2)' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 IN-scoped UPDATE allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'UPDATE t SET x=1 WHERE active IS TRUE' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 IS-scoped UPDATE allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna $'UPDATE subscriptions SET status=\'canceled\',\nupdated_at=NOW()\n\nWHERE account_id=42' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "H-01 blank-line WHERE cannot scope the preceding UPDATE" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna $'UPDATE t SET x=1; SELECT x FROM t WHERE id=2' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 later statement WHERE cannot hide mass UPDATE" 2 "token:mass UPDATE without WHERE"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna $'UPDATE t SET x=1\n\nSELECT x FROM t WHERE id=2' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "L-01 unrelated paragraph WHERE cannot hide mass UPDATE" 2 "token:mass UPDATE without WHERE"

# Accepted residual: the exact code-shaped no-arg token also blocks inside prose
# on the rare destructive lane; there is deliberately no bare cancelAll word match.
payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'write a unit test for cancelAllSubscriptions()' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "R2 documented prose code-token residual blocks" 2 "BLOCK sandbox=danger-full-access"

# OBS-1: marker matches only a line-start directive in prompt or developer instructions.
payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'quoted data: declared:lane=destructive' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "OBS-1 quoted lane=destructive data allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'GOALPOST-LANE: destructive' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "OBS-1 real line-start directive blocks" 2 "declared:lane=destructive"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'GOALPOST-LANE: destructive (SG7 reset)' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "OBS-1 directive with trailing reason blocks" 2 "declared:lane=destructive"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'see the GOALPOST-LANE: destructive marker docs' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "OBS-1 inline marker documentation allows" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'GOALPOST-LANE: destructiveish' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "OBS-1 directive word boundary rejects destructiveish" 0 "ALLOW inert sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna x $'  GOALPOST-LANE: destructive (developer directive)')"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "OBS-1 developer-instructions line-start directive blocks" 2 "declared:lane=destructive"

# Override hygiene: file override is consumed once; env override remains per-call.
OVERRIDE_FILE="$SCRATCH/single-use-override"
printf 'intentional one-off\n' >"$OVERRIDE_FILE"
payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'rm -rf /tmp/example' __ABSENT__)"
run_hook "$payload" "$OVERRIDE_FILE" 0
expect_result "override file first blocked-worthy call allows with consumed WARN" 0 "WARN override=file CONSUMED"
if [ ! -s "$OVERRIDE_FILE" ]; then
  pass "override file is absent or empty after first use"
else
  fail "override file is absent or empty after first use"
fi

run_hook "$payload" "$OVERRIDE_FILE" 0
expect_result "override file second identical call blocks again" 2 "BLOCK sandbox=danger-full-access"

READ_ONLY_OVERRIDE="$SCRATCH/read-only-override"
printf 'must not persist\n' >"$READ_ONLY_OVERRIDE"
chmod 0444 "$READ_ONLY_OVERRIDE"
run_hook "$payload" "$READ_ONLY_OVERRIDE" 0
expect_result "M-02 read-only override fails closed and destructive dispatch blocks" 2 \
  "override=file CONSUME-FAILED fail-closed" "override=file CONSUMED"

run_hook "$payload" "$DEFAULT_OVERRIDE" 1
expect_result "environment override is a WARNed per-call bypass" 0 "WARN override=env"

# Preserved behavior: safe lanes pass, legacy tokens block, stripped guardrails do not.
payload="$(build_payload mcp__codex__codex read-only gpt-5.6-sol 'rm -rf /tmp/example' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "regression read-only allows destructive-looking text" 0 "ALLOW sandbox=read-only"

payload="$(build_payload mcp__codex__codex workspace-write gpt-5.6-sol 'DROP TABLE subscriptions' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "regression workspace-write allows destructive-looking text" 0 "ALLOW sandbox=workspace-write"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'rm -rf /tmp/example' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "regression rm -rf still blocks on full-access" 2 "BLOCK sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna 'DROP TABLE subscriptions' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "regression DROP TABLE still blocks on full-access" 2 "BLOCK sandbox=danger-full-access"

payload="$(build_payload mcp__codex__codex-reply __ABSENT__ __ABSENT__ 'rm -rf /tmp/example' __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "regression codex-reply still receives legacy token scan" 2 "BLOCK sandbox=default"

guardrail_prompt=$'safe preface\n<<<GOALPOST-GUARDRAIL>>>\nrm -rf /tmp/example\nDROP TABLE subscriptions\ncancelAllSubscriptions()\nUPDATE t SET x=1\n<<<END-GOALPOST-GUARDRAIL>>>\nsafe suffix'
payload="$(build_payload mcp__codex__codex danger-full-access gpt-5.6-luna "$guardrail_prompt" __ABSENT__)"
run_hook "$payload" "$DEFAULT_OVERRIDE" 0
expect_result "regression guardrail-delimited destructive tokens are stripped" 0 "ALLOW inert sandbox=danger-full-access"

run_hook 'not-json' "$DEFAULT_OVERRIDE" 0
expect_result "regression malformed input fails open" 0 "ALLOW inert sandbox=default"

if [ "$FAIL_COUNT" -eq 0 ]; then
  printf 'PASS H-01: UPDATE prose without a real SET assignment allows; real unscoped assignments block\n'
  printf 'PASS L-01: WHERE is found across multiline SQL before semicolon/blank-line boundaries only\n'
  printf 'PASS M-01: Sol model normalization closes whitespace, case, and provider-prefix bypasses\n'
  printf 'PASS M-02: unconsumable file overrides fail closed into the normal destructive scan\n'
  printf 'PASS M-03: clear/wipe/destroy/flush All and no-arg deleteMany block; removeAll and argument-bearing deleteMany allow\n'
  printf 'PASS R1: exact Sol/full-access gating, effective-default WARN, reply and safe-lane scope\n'
  printf 'PASS R2: mass-domain no-arg calls and unscoped UPDATEs block; exclusions allow; prose residual documented\n'
  printf 'PASS OBS-1: only line-start GOALPOST-LANE destructive directives block across both text regions\n'
  printf 'PASS override hygiene: file override is consumed once or scanned fail-closed; env override is WARNed per call\n'
  printf 'PASS R4: N/A for this scan-only hook\n'
  printf 'PASS F5: canonical in-repo PreToolUse header names codex(-reply)\n'
  printf 'PASS preserved behavior: safe lanes allow, rm -rf/DROP and reply scan block, guardrail block strips, self-errors open\n'
  printf 'ALL PASS: %s assertions\n' "$PASS_COUNT"
  exit 0
fi

printf 'FAILED: %s passed, %s failed\n' "$PASS_COUNT" "$FAIL_COUNT"
exit 1
