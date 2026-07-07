# Goalpost

**Plan a project as a stage × goal roadmap with hard per-goal acceptance gates, then run it hands-off.** A persistent ledger drives an orchestrator that delegates engineering goals to the [Codex](https://github.com/openai/codex) MCP and creative/marketing goals to Claude Code, verifies every goal's Definition of Done on real evidence before advancing, runs an independent review at every stage boundary, and stops only at genuine human-decision gates.

It is the discipline of "break the work into atomic goals, and don't advance until each one is genuinely production-ready" turned into a Claude Code plugin that anyone can install.

## Why

Long builds fail in two opposite ways: the agent *runs away* (marks things done that aren't, drifts from the goal, compacts and loses the thread), or it *stalls* (asks the human at every step). Goalpost fixes both with one artifact — a **ledger** that is the single source of truth — and two rules:

- **No goal is closed without first-party evidence** that its Definition of Done passed (a test run, a build, a rendered artifact), plus a production-readiness rubric ("a human would not need to touch this again").
- **It only stops at real human-decision gates** — irreversible/outward-facing actions, a NO-GO review verdict, a three-strike failure, or a scope change. Everything else it drains autonomously.

## How it works

```
main session = orchestrator (dispatch only, re-reads the ledger every cycle)
      │
      ├── engineering goal ──▶ Codex MCP        (implementation, tests, infra, data)
      ├── creative goal   ──▶ Claude Code       (marketing, naming, positioning, planning)
      └── stage boundary  ──▶ transition-reviewer (independent GO / NO-GO gate)
```

Two modes:

- **PLAN** — decompose the project into 5–10 stages, each with 8–12 *atomic* goals. Every goal carries a routing tag and a Definition of Done: `[codex]` goals get an executable DoD (a command with an observable pass/fail); `[claude]` goals get a checklist DoD scored by a fresh reviewer. The plan is written as a roadmap doc plus a `LEDGER.md`.
- **RUN** — load the newest ledger and drain its goals one at a time. Each goal: dispatch → **independently verify the DoD** → on failure re-dispatch with the evidence (3 strikes) → close only on a passing check. At each stage boundary: integration review GO → transition review → generate the next stage's detail.

The ledger makes the whole thing compaction-proof and multi-session: a fresh session with the instruction "keep going" picks up exactly where the last one stopped.

## Prerequisites

- **Claude Code** ≥ 2.1 (plugin support with `skills/`, `commands/`, `agents/`).
- **Codex MCP (recommended, for engineering goals).** Goalpost delegates code work to the Codex MCP server so it runs on a high-reasoning coding model. Install the Codex CLI and log in (OAuth):
  ```bash
  npm i -g @openai/codex        # or your platform's install
  codex login                   # OAuth; or configure an API key
  ```
  Then expose it to Claude Code as an MCP server named `codex` (so the `mcp__codex__codex` tool is available). Without it, Goalpost still runs — engineering goals fall back to a Claude Code worker, at lower throughput. **Goalpost never bundles or logs into Codex for you; it uses your own Codex login.**
- **Optional:** a stronger review skill (e.g. an `adversarial-review` skill) is used at stage gates if present; otherwise the bundled `transition-reviewer` agent runs the gate.

Run the bundled capability check from a clone to see what your machine has:

```bash
bash scripts/preflight.sh
```

## Install

From GitHub (this repo is its own plugin marketplace):

```
/plugin marketplace add elon-choo/goalpost
/plugin install goalpost@goalpost
```

From a local clone (offline / development):

```bash
/plugin marketplace add ./goalpost
/plugin install goalpost@goalpost
# or run without installing:
claude --plugin-dir ./goalpost
```

### For AI agents (install from just this URL)

If a user hands you this repository URL and asks you to install it, do exactly this inside Claude Code:

1. Run `claude plugin marketplace add elon-choo/goalpost` (or the full URL `https://github.com/elon-choo/goalpost`).
2. Run `claude plugin install goalpost@goalpost`.
3. Verify: `claude plugin details goalpost@goalpost` should list 4 skills/commands (`goalpost`, `goal`, `roadmap`, `run`) and 2 agents (`goal-worker`, `transition-reviewer`).
4. Optionally run the capability check: `bash scripts/preflight.sh` from a clone — it reports whether the Codex MCP (engineering worker) is available; without it the plugin still works in Claude-only mode.
5. Tell the user to restart Claude Code, then trigger with "make a goal roadmap" (PLAN) or "run the ledger hands-off" (RUN), or the explicit commands `/goalpost:roadmap` and `/goalpost:run`.

Prerequisite for full functionality: the user's own Codex CLI logged in via OAuth (`codex login`) and exposed to Claude Code as an MCP server named `codex`. This plugin never bundles credentials.

## Migration — if you already have a general-purpose `goal-orchestrator` skill

Goalpost is the distributable successor to a standalone local `goal-orchestrator` skill and shares its trigger phrases. **Run only one.** After installing goalpost, disable or archive the local skill (e.g. move `~/.claude/skills/goal-orchestrator/` aside) so a phrase like "design a roadmap" resolves to one place. Goalpost ledgers carry a `Generator: goalpost` header and RUN ignores foreign ledgers, so the two won't cross-drain — but two enabled skills can still both fire on the same phrase. Project-specific roadmap skills for a given repo still take precedence over goalpost.

## Use

**Design a roadmap:**

> "Break this project into stages and goals and make the ledger." — or `/goalpost:roadmap` framing.

Goalpost reads your spec/brief (or asks a couple of questions), writes the roadmap and `docs/LEDGER-<slug>-<timestamp>.md`, and points `▶ NEXT:` at the first goal.

**Run it hands-off (next session, or right away):**

> "Keep going from the ledger." / "Run it autonomously while I'm away." / "다음 goal 이어서."

Goalpost loads the newest ledger, declares the start point and stop conditions in one line, and drains goals — engineering to Codex, creative to Claude — until it hits a human-decision gate, then reports.

**Run a single goal manually:**

```
/goalpost:goal <goal brief>            # auto-routes: code → Codex, creative → Claude
/goalpost:goal <goal brief> --codex    # force Codex
/goalpost:goal <goal brief> --claude   # force Claude
```

## What "production-ready" means here

A goal closes only when it clears `skills/goalpost/templates/production-readiness.md`:

- **Engineering:** DoD re-run with real output, tests green, build/typecheck clean, no stub on the shipped path, errors handled at boundaries, no secrets, working code protected, docs synced.
- **Creative:** audience + intent explicit, every claim sourced (nothing fabricated), one clear CTA, on-voice, no AI tells, acceptance gate passed.
- **Both:** evidence is first-party, and anything unverifiable is labelled *unverified* — never inferred to pass.

## Portability

The core flow is host-agnostic and keeps work in normal repo paths. Machine-specific needs (e.g. macOS folders that block direct file access under a launchd bridge) are handled by optional **host adapters** that the preflight detects — the plugin degrades gracefully and never assumes your machine looks like the author's.

## Components

| Path | What |
|---|---|
| `skills/goalpost/SKILL.md` | The orchestrator (PLAN + RUN). |
| `commands/goal.md` | `/goalpost:goal` — single-goal executor with routing + acceptance loop. |
| `agents/goal-worker.md` | Isolated creative/planning worker (returns summary + evidence only). |
| `agents/transition-reviewer.md` | Independent stage-gate reviewer (GO / NO-GO, no edits). |
| `skills/goalpost/templates/` | Ledger, roadmap, and production-readiness rubric. |
| `scripts/preflight.sh` | Read-only capability detector. |

## License

MIT — see [LICENSE](LICENSE).
