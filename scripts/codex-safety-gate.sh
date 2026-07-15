#!/bin/bash
# codex-safety-gate.sh — a PreToolUse hook for the Codex MCP tools (goalpost, optional).
#
# Purpose: machine-enforce the goalpost model-routing destructive-action guardrail.
#   If a Codex MCP dispatch is destructive-capable but goes out on the most
#   permissive lane (sandbox=danger-full-access), block it (exit 2) and tell the
#   caller to re-dispatch on the gated lane (workspace-write + on-request) or route
#   it to a HUMAN_GATE. This promotes the prompt-level guardrail from a "second wall"
#   to a "first wall" against GPT-5.6 Sol's documented tendency to take destructive
#   actions on broad instructions (OpenAI system card; TechCrunch 2026-07-14).
#
# Wire it (in ~/.claude/settings.json, appended to hooks.PreToolUse — do NOT overwrite):
#   { "matcher": "mcp__codex__.*",
#     "hooks": [ { "type": "command",
#                  "command": "$HOME/.claude/hooks/codex-safety-gate.sh", "timeout": 10 } ] }
#   (copy this script to that path, chmod +x. Not async — it must block.)
#
# Design (standard Claude Code PreToolUse contract):
#   - fail-open: any self-failure (no input, parse error) -> exit 0 (allow). Only exit 2 blocks.
#   - Polices the danger-full-access lane only; read-only / workspace-write pass through
#     (read-only can't destroy; workspace-write is already the gated lane the guardrail wants).
#   - Strips a <<<GOALPOST-GUARDRAIL>>>...<<<END-GOALPOST-GUARDRAIL>>> delimited region before
#     the token scan, so the injected guardrail's own forbidden-token list can't false-positive.
#   - Honors an explicit `GOALPOST-LANE: destructive` marker (catches paraphrased destructive ops).
#   - Override: env CODEX_GUARD_OFF=1, or a non-empty ~/.claude/hooks/codex-guard-override.txt
#     (one intentional full-access destructive op).
#   - Logs every decision to ~/.claude/ops/codex-guard.log (observability).
set -u

LOG="${CODEX_GUARD_LOG:-$HOME/.claude/ops/codex-guard.log}"
OVERRIDE_FILE="${CODEX_GUARD_OVERRIDE:-$HOME/.claude/hooks/codex-guard-override.txt}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true

log() { printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || echo now)" "$1" >>"$LOG" 2>/dev/null || true; }

# 수동 실행(TTY) 가드 — 훅 컨텍스트가 아니면 stdin 대기 행 방지
[ -t 0 ] && exit 0

PAYLOAD="$(cat 2>/dev/null || true)"
[ -n "$PAYLOAD" ] || exit 0                       # 입력 없음 → fail-open

# ── 오버라이드 ───────────────────────────────────────────────────────────
if [ "${CODEX_GUARD_OFF:-0}" = "1" ]; then log "ALLOW override=env"; exit 0; fi
if [ -s "$OVERRIDE_FILE" ]; then log "ALLOW override=file"; exit 0; fi

# ── 필드 추출 (jq 우선 → sed 폴백) ───────────────────────────────────────
getf() {  # $1 = jq path expr ; sed fallback key
  local val=""
  if command -v jq >/dev/null 2>&1; then
    val="$(printf '%s' "$PAYLOAD" | jq -r "$2 // empty" 2>/dev/null)" || val=""
  fi
  printf '%s' "$val"
}
SANDBOX="$(getf sandbox '.tool_input.sandbox')"
APPROVAL="$(getf approval '.tool_input["approval-policy"]')"
PROMPT="$(getf prompt '.tool_input.prompt')"
DEVINS="$(getf devins '.tool_input["developer-instructions"]')"
# jq 실패 시 최소 폴백(정확 파싱 불가면 fail-open 원칙에 따라 통과 쪽) — sandbox만 추출 시도
if [ -z "$SANDBOX" ] && ! command -v jq >/dev/null 2>&1; then
  SANDBOX="$(printf '%s' "$PAYLOAD" | sed -n 's/.*"sandbox"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
fi

# ── 레인 판정: danger-full-access(또는 미지정=이 머신 기본값)만 감시 ────────
# read-only / workspace-write → 통과(이미 안전/게이트 레인)
case "$SANDBOX" in
  read-only|readonly|read_only)           log "ALLOW sandbox=read-only"; exit 0 ;;
  workspace-write|workspace_write)         log "ALLOW sandbox=workspace-write"; exit 0 ;;
  danger-full-access|danger_full_access|"") : ;;   # 감시 대상 (미지정=기본 full-access)
  *)                                       log "ALLOW sandbox=$SANDBOX(unknown)"; exit 0 ;;
esac

# ── 스캔 텍스트 구성: prompt + developer-instructions, 단 주입 가드레일은 스트립 ──
TEXT="$PROMPT
$DEVINS"
# 델리미터로 감싼 가드레일 블록 제거(그 안의 금지-토큰 목록이 오탐 내지 않게)
STRIPPED="$(printf '%s' "$TEXT" | perl -0777 -pe 's/<<<GOALPOST-GUARDRAIL>>>.*?<<<END-GOALPOST-GUARDRAIL>>>//gs' 2>/dev/null)"
[ -n "$STRIPPED" ] || STRIPPED="$TEXT"       # perl 부재/실패 → 원문(fail-open 쪽)

DESTRUCTIVE=""
TOKEN=""

# 1) 오케스트레이터의 명시 선언(패러프레이즈된 파괴 작업 대비)
if printf '%s' "$TEXT" | grep -qiE 'GOALPOST-LANE:[[:space:]]*destructive|lane=destructive'; then
  DESTRUCTIVE=1; TOKEN="declared:lane=destructive"
fi

# 2) 하드 파괴 명령 토큰(스트립된 텍스트에서만 — 낮은 오탐 위해 실제 명령 형태만)
if [ -z "$DESTRUCTIVE" ]; then
  PATTERNS='rm[[:space:]]+-[a-zA-Z]*[rf][a-zA-Z]*[rf]|DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|ROLE|USER)\b|TRUNCATE[[:space:]]+(TABLE[[:space:]]|[A-Za-z_"`])|DELETE[[:space:]]+FROM[[:space:]]|git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+push[[:space:]].*(--force|[[:space:]]-f\b)|git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f|(prisma[[:space:]]+)?migrate[[:space:]]+reset|\bdropdb\b|\brmdir[[:space:]]+-|DROP[[:space:]].*CASCADE'
  MATCH="$(printf '%s' "$STRIPPED" | grep -ioE "$PATTERNS" | head -n1 || true)"
  if [ -n "$MATCH" ]; then DESTRUCTIVE=1; TOKEN="token:$MATCH"; fi
fi

if [ -z "$DESTRUCTIVE" ]; then
  log "ALLOW inert sandbox=${SANDBOX:-default}"
  exit 0
fi

# ── 차단 (exit 2 + stderr 안내) ─────────────────────────────────────────
log "BLOCK sandbox=${SANDBOX:-default} approval=${APPROVAL:-default} $TOKEN"
NOTIFY_BIN="$HOME/.claude/bin/notify"
if [ -x "$NOTIFY_BIN" ]; then
  "$NOTIFY_BIN" codex-guard-block "Codex 파괴 디스패치 차단" \
    "full-access 레인의 파괴가능 작업 차단 ($TOKEN)" --level block >/dev/null 2>&1 || true
fi
{
  echo "[codex-safety-gate] BLOCKED: destructive-capable Codex dispatch on the danger-full-access lane ($TOKEN)."
  echo "Fix (goalpost model-routing guardrail):"
  echo "  1. Re-dispatch this goal with sandbox: workspace-write + approval-policy: on-request, no ambient prod secrets."
  echo "  2. If it performs REAL data destruction / a real send / a deploy NOT covered by a standing pre-authorization,"
  echo "     route it to a HUMAN_GATE and relay the approval to the human — do NOT auto-approve on the full-access lane."
  echo "  3. Destructive capability belongs in its OWN isolated, gated goal — never bundled into a broad implementation goal."
  echo "Intentional one-off full-access destructive op: set env CODEX_GUARD_OFF=1 for that call, or"
  echo "  echo reason > $OVERRIDE_FILE  (then clear it afterward)."
} >&2
exit 2
