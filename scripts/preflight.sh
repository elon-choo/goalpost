#!/usr/bin/env bash
# goalpost preflight — report the capabilities that shape a run.
# Read-only and safe: no writes to protected folders, no network, no state changes.
# The orchestrator reads this to decide worker routing and adapters. MCP tool
# availability is confirmed by Claude at runtime; this reports the host-side proxies.
set -u

say() { printf '%s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "== goalpost preflight =="
say "os: $(uname -s) $(uname -m)"

# --- codex (GPT-6 Sol worker lane + GPT-6 Astra cross-verification) ---
codex_cli="no"; codex_auth="no"
have codex && codex_cli="yes"
if [ -f "$HOME/.codex/auth.json" ]; then
  # present + non-empty is enough as a host-side proxy; do not print token contents
  if [ -s "$HOME/.codex/auth.json" ]; then codex_auth="yes"; fi
fi
if [ "$codex_cli" = "yes" ] && [ "$codex_auth" = "yes" ]; then
  say "codex: likely (cli=yes, auth=yes) — confirm mcp__codex__codex tool at runtime; Sol packets + Astra cross-verification -> Codex"
elif [ "$codex_cli" = "yes" ]; then
  say "codex: cli=yes but auth=no — run 'codex login' (OAuth) or set an API key; else Sol packets run on Claude Opus and Astra cross-verification is unavailable"
else
  say "codex: no cli found — Sol packets run on Claude Opus; Astra cross-verification unavailable (Claude-only mode)"
fi

# --- codex models (0.5.0 roster: gpt-6-sol worker, gpt-6-astra cross-verifier) ---
# Matches the catalog "slug" key exactly, so an upgrade pointer that merely mentions a slug
# does not count. A stale cache is a hint only: the Codex bridge validates model/effort at call time.
models_cache="$HOME/.codex/models_cache.json"
if [ -f "$models_cache" ]; then
  sol6="no"; astra="no"; legacy="no"
  grep -Eq '"slug": *"gpt-6-sol"'   "$models_cache" 2>/dev/null && sol6="yes"
  grep -Eq '"slug": *"gpt-6-astra"' "$models_cache" 2>/dev/null && astra="yes"
  grep -Eq '"slug": *"gpt-5\.6-(sol|terra|luna)"' "$models_cache" 2>/dev/null && legacy="yes"
  say "codex-models: gpt-6-sol=$sol6 gpt-6-astra=$astra (legacy gpt-5.6 tiers in cache: $legacy — not routed to since 0.5.0)"
else
  say "codex-models: unknown (cache not found) — the bridge validates gpt-6-sol / gpt-6-astra at call time"
fi

# --- review skill (stage gate) ---
review="bundled (goalpost:transition-reviewer)"
for d in "$HOME/.claude/skills/adversarial-review" "$HOME/.claude/plugins"/*/skills/adversarial-review; do
  [ -d "$d" ] && review="adversarial-review (host skill) — stronger, preferred" && break
done
say "review: $review"

# --- protected filesystem adapter ---
protected="no"
adapter="none"
if [ "$(uname -s)" = "Darwin" ]; then
  # macOS may block ~/Documents|~/Desktop|~/Downloads under a launchd/daemon bridge (TCC EPERM).
  # We do NOT probe-write those folders (could prompt / fail); we only report a known adapter.
  if have docbroker || [ -x "$HOME/.claude/bin/docbroker/docbroker" ]; then
    protected="possible"; adapter="docbroker"
  else
    protected="possible"; adapter="none (if EPERM on Documents/Desktop/Downloads, keep work in a normal repo path)"
  fi
fi
say "protected-fs: $protected · adapter: $adapter"

say "== end preflight =="
