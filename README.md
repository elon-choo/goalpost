# 🥅 Goalpost

*A disciplined project manager for an AI coding agent: it breaks a project into small, verified goals, builds them hands-off, and keeps a powerful-but-reckless model on a short leash.*

![version](https://img.shields.io/badge/version-0.5.0-2563eb) ![license](https://img.shields.io/badge/license-MIT-16a34a) ![platform](https://img.shields.io/badge/Claude%20Code-plugin-7c3aed) &nbsp; **Install:** `/plugin install goalpost@goalpost`

---

## What it is (30-second version)

You hand Goalpost a project. It breaks the work into small, numbered **goals**, decides which AI model each goal deserves (Claude Opus 5.5 for anything that needs judgement, a fast worker for settled mechanical edits, and a second vendor to double-check the risky parts), then **builds them one at a time** — proving each goal actually works before it moves on, and pausing only when it genuinely needs a human decision. A single **ledger file** is the source of truth, so the work survives restarts and a fresh session picks up exactly where the last one stopped.

Think of it as the discipline *"break the work into steps, and don't move on until each step is truly done"* turned into a Claude Code plugin — with a safety layer that stops a broadly-instructed model from deleting your files or data.

**What you get**

- 🎯 **No fake "done".** Every goal is verified against real evidence — a test that ran, a build that passed — before it advances. No "looks good, moving on."
- ⚡ **The right model for each job.** Hard work runs on Claude Opus 5.5, settled mechanical packets on GPT-6 Sol, and GPT-6 Astra — a different vendor — cross-checks every stage boundary and every risky goal.
- 🛡️ **Safe by default.** Destructive work is sandboxed and gated. In 0.3.0 the safety layer was itself *measured and hardened* against real destructive-AI incidents — and it's honest about what it can't catch (see the [release notes](docs/RELEASE-NOTES-v0.3.0.md)).

## Get started in ~1 minute

**🤖 Using an AI coding agent (Claude Code, Cursor, etc.)?** Just paste this repo's link into the agent and say **"install this plugin and show me how to use it."** The agent will follow the [For AI agents](#for-ai-agents-install-from-just-this-url) steps below — it installs itself and guides you. Nothing else to do.

**✋ Prefer to do it by hand?** Inside Claude Code:

```
/plugin marketplace add elon-choo/goalpost
/plugin install goalpost@goalpost
```

Then just say what you want:

> **"Break this project into a goal roadmap."** → it plans (PLAN mode).
> **"Run the ledger hands-off."** → it builds, one verified goal at a time (RUN mode).

Full walkthrough in [Use](#use). One prerequisite for the Sol lane and the cross-vendor check — your own [Codex login](#prerequisites) — is explained below.

---

## The details

**Plan a project as a stage × goal roadmap with hard per-goal acceptance gates, then run it hands-off.** A persistent ledger drives an orchestrator that runs **medium-or-harder engineering and all creative/planning goals on Claude Opus 5.5**, hands **settled mechanical packets to GPT-6 Sol** through the [Codex](https://github.com/openai/codex) MCP, and has **GPT-6 Astra cross-verify every stage boundary and every consequential goal** — verifying every goal's Definition of Done on real evidence before advancing and stopping only at genuine human-decision gates.

It is the discipline of "break the work into atomic goals, and don't advance until each one is genuinely production-ready" turned into a Claude Code plugin that anyone can install.

## Why

Long builds fail in two opposite ways: the agent *runs away* (marks things done that aren't, drifts from the goal, compacts and loses the thread), or it *stalls* (asks the human at every step). Goalpost fixes both with one artifact — a **ledger** that is the single source of truth — and two rules:

- **No goal is closed without first-party evidence** that its Definition of Done passed (a test run, a build, a rendered artifact), plus a production-readiness rubric ("a human would not need to touch this again").
- **It only stops at real human-decision gates** — irreversible/outward-facing actions, a NO-GO review verdict, a three-strike failure, or a scope change. Everything else it drains autonomously.

## How it works

```
main session = orchestrator, Claude Opus 5.5 (dispatch only, re-reads the ledger every cycle)
      │
      ├── medium-or-harder goal ──▶ Claude Opus 5.5 subagent   (engineering: goal-worker-scoped · creative/planning: goal-worker)
      ├── settled mechanical    ──▶ Codex MCP · GPT-6 Sol      (exact files + steps + acceptance command)
      ├── consequential goal    ──▶ + GPT-6 Astra, read-only   (cross-vendor verification before [x])
      └── stage boundary        ──▶ transition-reviewer + GPT-6 Astra (independent GO / NO-GO gate)
```

Two modes:

- **PLAN** — first **align**: drive ambiguity to zero before any goal is written (every vague adjective becomes an observable target — "make it faster" → "p95 < 300ms on a named probe"; an outcome with no way to measure it yet gets a precursor **measurement goal** that builds the harness). Then decompose the project into 5–10 stages, each with 8–12 *atomic* goals. Every goal carries a two-axis routing tag `[<platform>:<model>]` (executor + model lane, chosen by blast radius × variance — see [Model routing](#model-routing)), a declared write set (`writes:`) + goal-level constraints, and a Definition of Done: engineering goals get an executable DoD (a command with an observable pass/fail); creative/planning goals get a checklist DoD scored by a fresh reviewer; a subjective-but-real outcome may use a verifier panel (2–3 fresh judges, unanimous). The plan is written as a roadmap doc plus a `LEDGER.md`.
- **RUN** — load the newest ledger **in the target repo** (never another project's; a repo with no ledger stops and asks) and drain its goals one at a time. Each goal: dispatch → **independently verify the DoD** (including that the check itself wasn't weakened — a pass produced by gaming the harness is a failure) → on failure re-dispatch with the evidence (3 strikes) → close only on a passing check. At each stage boundary: integration review GO → generate the next stage's detail → transition review (which also vets the freshly generated DoDs) — each review run by the transition-reviewer and GPT-6 Astra in parallel → a short human-readable stage report in `docs/`.

The ledger makes the whole thing compaction-proof and multi-session: a fresh session with the instruction "keep going" picks up exactly where the last one stopped.

## Model routing

Every goal gets the model it needs — since 0.5.0 (owner instruction 2026-09-24) the priority is results over cost or time. The planner assigns a lane at plan time and the dispatcher applies it at run time; the full rubric is `skills/goalpost/templates/model-routing.md`.

| Lane | Model | Use it for | Default effort |
|---|---|---|---|
| `claude:opus` | Claude Opus 5.5 | **The default** — every goal of medium-or-harder difficulty (implementation, debugging, research, design, refactors, migrations, security, code review) and every creative/planning goal. Runs as `goalpost:goal-worker-scoped` (engineering) or `goalpost:goal-worker` (creative/planning) at `high`, and as `goalpost:goal-worker-xhigh` for HIGH-blast-radius (`pin`) goals and the top escalation rung. | `high`; `xhigh` for pinned goals and top-rung retries |
| `codex:gpt-6-sol` | GPT-6 Sol | **Low-difficulty, fully specified packets only** — mechanical edits with exact files, exact steps and acceptance commands; repeated transformations; running known checks. Must pass the Sol-eligibility gate. | `high` |
| *(cross-verifier)* | GPT-6 Astra | Not an executor. A fresh read-only Codex thread cross-verifies every stage gate (alongside `goalpost:transition-reviewer`, which runs Opus 5.5 at `xhigh`) and every `pin`/`xverify` goal before it closes; also consulted on consequential design choices. | `high`; `xhigh`/`max` when consequential |

Pick the lane by **blast radius × variance**: HIGH radius (security/data/payments/irreversible migrations) → `claude:opus/xhigh pin` with a mandatory Astra cross-check, never Sol; anything that still needs a decision → Opus; only LOW-radius, LOW-variance, fully specified work → Sol. A DoD strike **moves up the goal's ladder** (Sol → Opus high → Opus xhigh; Opus high → Opus high + an Astra diagnosis → Opus xhigh) rather than repeating; the 3-strike cap is unchanged. Astra's findings are evidence the orchestrator confirms and applies; a disagreement on a consequential point gets a second Astra pass or a test. Independent, disjoint-file goals — and `fanout` goals with a per-sub-task lane map — run concurrently as parallel Opus subagents and Sol packets. Legacy tags from earlier versions (`codex:sol/terra/luna`, `claude:fable`, `claude:opus/medium`) normalize automatically; the old flagship tag `codex:sol` becomes `claude:opus/xhigh pin`, never the GPT-6 Sol lane. Fable 5.1 runs only when you explicitly ask for it.

**Destructive-action safety.** GPT-5.6 Sol was documented to interpret instructions broadly and take destructive actions (deleting files/data, using credentials) unless explicitly forbidden — and any broadly-instructed agent with a shell can do the same. Goalpost injects an allow/deny guardrail into every worker dispatch, Claude or Codex (no deletes/destructive-git/real-sends/credential-use without explicit + human authorization; operate only on *named* targets, never a similar-looking substitute; a binding STOP-WHEN condition), and **isolates any destructive-capable goal into its own gated goal** (Codex `workspace-write` + `on-request`; on the Claude lane a worktree, disposable state and no ambient production secrets; or a human gate) instead of bundling it. The fast host default is kept only for ordinary edits — the sandbox wall stays under the prompt guardrail on destructive lanes.

**Optional hard enforcement (`scripts/codex-safety-gate.sh`).** The guardrail above is a prompt-level contract. For a *machine-enforced* wall, wire the bundled `PreToolUse` hook — it refuses a destructive-capable Codex call on the `danger-full-access` lane before it runs:

```bash
cp scripts/codex-safety-gate.sh ~/.claude/hooks/ && chmod +x ~/.claude/hooks/codex-safety-gate.sh
```

Then append to `hooks.PreToolUse` in `~/.claude/settings.json` (do not overwrite existing entries):

```json
{ "matcher": "mcp__codex__.*",
  "hooks": [ { "type": "command", "command": "$HOME/.claude/hooks/codex-safety-gate.sh", "timeout": 10 } ] }
```

It lets `read-only`/`workspace-write` calls through and blocks (exit 2) a `danger-full-access` call carrying a hard destructive token or a `GOALPOST-LANE: destructive` marker, with a re-scope instruction. Fail-open by design; override an intentional one-off with `CODEX_GUARD_OFF=1` (or a single-use override file).

**What the hook catches — and what it does NOT (0.3.0, read this).** The hook catches, on the full-access lane: literal destructive tokens (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `git push --force`, …); an explicit legacy `gpt-5.6-sol` dispatch (the old flagship on the fast lane — GPT-6 Sol, `gpt-6-sol`, is a different model and is not matched); no-arg mass-mutation calls (`cancelAllSubscriptions()`, `deleteMany()`, `clearAll()`/`wipeAll()`/…); a real SQL `UPDATE … SET … =` with no genuine `WHERE`; and a line-anchored `GOALPOST-LANE: destructive` directive. It deliberately does **not** block ordinary work — `removeAll(x)`, `UPDATE … WHERE id=?`, or English prose like "update character set". It **cannot** catch natural-language paraphrase ("wipe all rows in the users table") or a self-true `WHERE 1=1`, and it is **pre-dispatch only** — it never sees the shell commands Codex runs at runtime. So the hook is a *second wall*. The **durable** control against destructive over-reach (documented for GPT-5.6 Sol) is **least privilege** (destructive-capable goals run `workspace-write` on Codex, or behind the Claude-lane isolation walls — never `danger-full-access`) plus a **HUMAN_GATE** on real data destruction. Least privilege is the wall; the token/marker hook rides on top of it.

## Observe your own run

`scripts/telemetry/` turns a finished (or in-flight) run into a report, so you can see how the routing + safety hook actually behaved:

```bash
# per-goal tiers/escalations from a ledger, hook decisions from the guard log, joined into one report
node scripts/telemetry/parse-ledger.js  docs/LEDGER-*.md            > /tmp/ledger.json
node scripts/telemetry/parse-hooklog.js ~/.claude/ops/codex-guard.log > /tmp/hooks.json
node scripts/telemetry/report.js --ledger docs/LEDGER-*.md \
     --hooklog ~/.claude/ops/codex-guard.log \
     --out-json run-report.json --out-md run-report.md
```

`run-report.md` shows the lane distribution (`opus` / `gpt-6-sol`, plus `luna`/`terra`/`sol` for pre-0.5.0 ledgers), escalation count, hook allow/block counts, total wall-clock, a best-effort per-tier cost proxy (published rates exist only for the legacy GPT-5.6 tiers; `opus` and `gpt-6-sol` rows are labelled best-effort), and any parser warnings. All parsers fail open on malformed/empty *content*, and read no secrets. `scripts/telemetry/validate.js <file>` checks a telemetry file against `schema.json`. (The guard log `~/.claude/ops/codex-guard.log` only exists once the safety hook has run at least once; `report.js` exits non-zero on a `--hooklog` **path** that doesn't exist — by design, so a typo isn't silently reported as an empty run. Omit `--hooklog` to report on the ledger alone.)

## Prerequisites

- **Claude Code** ≥ 2.1 (plugin support with `skills/`, `commands/`, `agents/`).
- **Codex MCP (recommended, for the GPT-6 Sol lane and GPT-6 Astra cross-verification).** Goalpost sends settled mechanical packets to GPT-6 Sol and cross-verification to GPT-6 Astra through the Codex MCP server. Install the Codex CLI and log in (OAuth):
  ```bash
  npm i -g @openai/codex        # or your platform's install
  codex login                   # OAuth; or configure an API key
  ```
  Then expose it to Claude Code as an MCP server named `codex` (so the `mcp__codex__codex` tool is available). Without it, Goalpost still runs Claude-only — Sol packets run on Claude Opus 5.5 and there is no cross-vendor check (a pinned goal then gates instead of self-certifying). **Goalpost never bundles or logs into Codex for you; it uses your own Codex login.**
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

**If a user hands you this repository URL and asks you to install it or set it up, do exactly this — then guide them.**

**Install (inside Claude Code):**

1. Run `claude plugin marketplace add elon-choo/goalpost` (or the full URL `https://github.com/elon-choo/goalpost`).
2. Run `claude plugin install goalpost@goalpost`.
3. Verify: `claude plugin details goalpost@goalpost` should list the `goalpost` skill plus 3 commands (`goal`, `roadmap`, `run`) and 4 agents (`goal-worker`, `goal-worker-scoped`, `goal-worker-xhigh`, `transition-reviewer`).
4. Check capabilities: `bash scripts/preflight.sh` from a clone — it reports whether the **Codex MCP** (the GPT-6 Sol lane and the GPT-6 Astra cross-verifier) is available. Without it the plugin still works in **Claude-only mode** (no cross-vendor check); tell the user this if Codex is missing.
5. Tell the user to **restart Claude Code** so the plugin loads.

**Then guide the user (don't just stop at "installed"):**

6. Explain in one line what they now have: *"Goalpost plans a project into small verified goals and builds them hands-off — say what you want built."*
7. Offer the two entry points in plain language:
   - To **plan**: they say *"break this project into a stage × goal roadmap"* (or `/goalpost:roadmap`). You'll produce a roadmap + a `docs/LEDGER-*.md`.
   - To **build hands-off**: they say *"run the ledger hands-off"* (or `/goalpost:run`). You'll drain goals one at a time, verifying each, stopping only at real human-decision gates.
   - For a **single goal**: `/goalpost:goal <what to do>`.
8. Flag the one prerequisite for full power (below) if it's not set up, and offer to help set it up.

**Prerequisite for full functionality:** the user's own Codex CLI logged in via OAuth (`codex login`) and exposed to Claude Code as an MCP server named `codex` (so the `mcp__codex__codex` tool exists). **This plugin never bundles or asks for credentials — it uses the user's own Codex login.** If the user wants the Sol lane and cross-vendor verification, walk them through `npm i -g @openai/codex && codex login` and adding it as an MCP server; otherwise confirm they're fine with Claude-only mode.

## Migration — if you already have a general-purpose `goal-orchestrator` skill

Goalpost is the distributable successor to a standalone local `goal-orchestrator` skill and shares its trigger phrases. **Run only one.** After installing goalpost, disable or archive the local skill (e.g. move `~/.claude/skills/goal-orchestrator/` aside) so a phrase like "design a roadmap" resolves to one place. Goalpost ledgers carry a `Generator: goalpost` header and RUN ignores foreign ledgers, so the two won't cross-drain — but two enabled skills can still both fire on the same phrase. Project-specific roadmap skills for a given repo still take precedence over goalpost.

## Use

**Design a roadmap:**

> "Break this project into stages and goals and make the ledger." — or `/goalpost:roadmap` framing.

Goalpost reads your spec/brief (or asks a couple of questions), writes the roadmap and `docs/LEDGER-<slug>-<timestamp>.md`, and points `▶ NEXT:` at the first goal.

**Run it hands-off (next session, or right away):**

> "Keep going from the ledger." / "Run it autonomously while I'm away." / "다음 goal 이어서."

Goalpost loads the newest ledger **inside the current project's repo only** (a repo with no ledger stops and asks — it never adopts another project's ledger), declares the start point and stop conditions in one line, and drains goals — medium-or-harder and creative work on Claude Opus 5.5, settled mechanical packets on GPT-6 Sol, GPT-6 Astra cross-checking the consequential ones — until it hits a human-decision gate, then reports.

**Run a single goal manually:**

```
/goalpost:goal <goal brief>            # auto-routes: judgement work → Claude Opus 5.5, settled mechanical → GPT-6 Sol
/goalpost:goal <goal brief> --codex    # force the GPT-6 Sol lane (only if the goal passes the Sol-eligibility gate)
/goalpost:goal <goal brief> --claude   # force Claude Opus 5.5
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
| `commands/roadmap.md` | `/goalpost:roadmap` — explicit PLAN entry point. |
| `commands/run.md` | `/goalpost:run` — explicit RUN entry point. |
| `agents/goal-worker.md` | Isolated creative/planning worker — Claude Opus 5.5, `effort: high` (returns summary + evidence only). |
| `agents/goal-worker-scoped.md` | Isolated engineering worker — Claude Opus 5.5, `effort: high`, scoped to the goal's named files. |
| `agents/goal-worker-xhigh.md` | Top-rung worker — Claude Opus 5.5, `effort: xhigh`, for pinned (HIGH-radius) goals and escalated retries, engineering or creative. |
| `agents/transition-reviewer.md` | Independent stage-gate reviewer — Claude Opus 5.5, `effort: xhigh` (GO / NO-GO, no edits); runs alongside a GPT-6 Astra cross-check. |
| `skills/goalpost/templates/model-routing.md` | Model-lane rubric (blast radius × variance → Opus 5.5 / GPT-6 Sol, GPT-6 Astra cross-verification), legacy-tag normalization, escalation ladder, and the destructive-action guardrail. |
| `skills/goalpost/templates/` | Ledger, roadmap, and production-readiness rubric. |
| `scripts/preflight.sh` | Read-only capability detector. |
| `scripts/codex-safety-gate.sh` | Optional `PreToolUse` hook — hard-blocks a destructive-capable Codex call on the full-access lane. |

## License

MIT — see [LICENSE](LICENSE).
