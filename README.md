# 🥅 Goalpost

*A disciplined project manager for an AI coding agent: it breaks a project into small, verified goals, builds them hands-off, and keeps a powerful-but-reckless model on a short leash.*

![version](https://img.shields.io/badge/version-0.3.0-2563eb) ![license](https://img.shields.io/badge/license-MIT-16a34a) ![platform](https://img.shields.io/badge/Claude%20Code-plugin-7c3aed) &nbsp; **Install:** `/plugin install goalpost@goalpost`

---

## What it is (30-second version)

You hand Goalpost a project. It breaks the work into small, numbered **goals**, decides which AI model each goal deserves (a cheap fast one for boilerplate; the expensive flagship only for the risky stuff), then **builds them one at a time** — proving each goal actually works before it moves on, and pausing only when it genuinely needs a human decision. A single **ledger file** is the source of truth, so the work survives restarts and a fresh session picks up exactly where the last one stopped.

Think of it as the discipline *"break the work into steps, and don't move on until each step is truly done"* turned into a Claude Code plugin — with a safety layer that stops a broadly-instructed model (GPT-5.6 Sol) from deleting your files or data.

**What you get**

- 🎯 **No fake "done".** Every goal is verified against real evidence — a test that ran, a build that passed — before it advances. No "looks good, moving on."
- ⚡ **Right-sized cost.** Each goal runs on the cheapest capable model; the flagship is reserved for hard/critical work, so you don't pay top rates for boilerplate.
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

Full walkthrough in [Use](#use). One prerequisite for the engineering goals — your own [Codex login](#prerequisites) — is explained below.

---

## The details

**Plan a project as a stage × goal roadmap with hard per-goal acceptance gates, then run it hands-off.** A persistent ledger drives an orchestrator that delegates engineering goals to the [Codex](https://github.com/openai/codex) MCP — **right-sizing each goal across GPT-5.6 Sol / Terra / Luna by its blast radius** — and creative/marketing goals to Claude Code, verifies every goal's Definition of Done on real evidence before advancing, runs an independent review at every stage boundary, and stops only at genuine human-decision gates.

It is the discipline of "break the work into atomic goals, and don't advance until each one is genuinely production-ready" turned into a Claude Code plugin that anyone can install.

## Why

Long builds fail in two opposite ways: the agent *runs away* (marks things done that aren't, drifts from the goal, compacts and loses the thread), or it *stalls* (asks the human at every step). Goalpost fixes both with one artifact — a **ledger** that is the single source of truth — and two rules:

- **No goal is closed without first-party evidence** that its Definition of Done passed (a test run, a build, a rendered artifact), plus a production-readiness rubric ("a human would not need to touch this again").
- **It only stops at real human-decision gates** — irreversible/outward-facing actions, a NO-GO review verdict, a three-strike failure, or a scope change. Everything else it drains autonomously.

## How it works

```
main session = orchestrator (dispatch only, re-reads the ledger every cycle)
      │
      ├── engineering goal ──▶ Codex MCP    ── sol   (hard + critical: security, migrations, refactors, final review)
      │                                      ── terra (default workhorse: features, integrations, bug fixes)
      │                                      ── luna  (easy + low-variance: boilerplate, fixtures, docs, tests)
      ├── creative goal   ──▶ Claude Code       (marketing, naming, positioning, planning)
      └── stage boundary  ──▶ transition-reviewer (independent GO / NO-GO gate)
```

Two modes:

- **PLAN** — decompose the project into 5–10 stages, each with 8–12 *atomic* goals. Every goal carries a two-axis routing tag `[<platform>:<model>]` (platform + model tier, chosen by blast radius × variance — see [Model routing](#model-routing)) and a Definition of Done: `[codex]` goals get an executable DoD (a command with an observable pass/fail); `[claude]` goals get a checklist DoD scored by a fresh reviewer. The plan is written as a roadmap doc plus a `LEDGER.md`.
- **RUN** — load the newest ledger **in the target repo** (never another project's; a repo with no ledger stops and asks) and drain its goals one at a time. Each goal: dispatch → **independently verify the DoD** → on failure re-dispatch with the evidence (3 strikes) → close only on a passing check. At each stage boundary: integration review GO → generate the next stage's detail → transition review (which also vets the freshly generated DoDs).

The ledger makes the whole thing compaction-proof and multi-session: a fresh session with the instruction "keep going" picks up exactly where the last one stopped.

## Model routing

Not every goal needs the flagship. Running the top model for boilerplate is slower and costlier with no quality gain; running a weak model on a security change is a liability. Goalpost assigns each goal a model tier at plan time and applies it at run time — the full rubric is `skills/goalpost/templates/model-routing.md`.

| Tier | Codex model | Use it for | Default effort |
|---|---|---|---|
| `sol` | `gpt-5.6-sol` | **Hard + critical only** — security/auth/payments, migrations & destructive-capable work, schema, concurrency/perf, cross-cutting refactors, external-API contracts, architecture, final integration/security review. The escalation ceiling. | `ultra` |
| `terra` | `gpt-5.6-terra` | **Default workhorse** — feature implementation, API/DB/integration logic, ordinary bug fixes, medium PR review. | `high` |
| `luna` | `gpt-5.6-luna` | **Easy + low-variance** — boilerplate/CRUD, fixtures/mocks, tests on a pattern, docs, mechanical edits. | `high` / `xhigh` |

Pick the tier by **blast radius × variance**, route on the stronger signal (LOW+LOW → Luna; MED → Terra; HIGH → Sol), and **never downgrade a security/data/payment/migration goal to save cost**. A DoD strike **escalates one tier up** (Luna→Terra→Sol) rather than repeating the same tier; the 3-strike cap is unchanged. Independent, disjoint-file goals — and `[fanout]` goals with a per-sub-task tier map — run concurrently at right-sized tiers via a single Workflow level.

**Destructive-action safety.** GPT-5.6 Sol is documented to interpret instructions broadly and take destructive actions (deleting files/data, using credentials) unless explicitly forbidden. Goalpost injects an allow/deny guardrail into every Codex dispatch (no deletes/destructive-git/real-sends/credential-use without explicit + human authorization; operate only on *named* targets, never a similar-looking substitute; a binding STOP-WHEN condition), and **isolates any destructive-capable goal into its own gated goal** (`workspace-write` + `on-request`, or a human gate) instead of bundling it. The fast host default is kept only for ordinary edits — the sandbox wall stays under the prompt guardrail on destructive lanes.

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

**What the hook catches — and what it does NOT (0.3.0, read this).** The hook catches, on the full-access lane: literal destructive tokens (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `git push --force`, …); an explicit `gpt-5.6-sol` dispatch (Sol on the fast lane); no-arg mass-mutation calls (`cancelAllSubscriptions()`, `deleteMany()`, `clearAll()`/`wipeAll()`/…); a real SQL `UPDATE … SET … =` with no genuine `WHERE`; and a line-anchored `GOALPOST-LANE: destructive` directive. It deliberately does **not** block ordinary work — `removeAll(x)`, `UPDATE … WHERE id=?`, or English prose like "update character set". It **cannot** catch natural-language paraphrase ("wipe all rows in the users table") or a self-true `WHERE 1=1`, and it is **pre-dispatch only** — it never sees the shell commands Codex runs at runtime. So the hook is a *second wall*. The **durable** control against GPT-5.6 Sol's documented destructive-action tendency is **least-privilege sandboxing** (Sol / destructive-capable goals run `workspace-write`, never `danger-full-access`) plus a **HUMAN_GATE** on real data destruction. Least privilege is the wall; the token/marker hook rides on top of it.

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

`run-report.md` shows the tier distribution (luna/terra/sol), escalation count, hook allow/block counts, total wall-clock, a best-effort per-tier cost proxy, and any parser warnings. All parsers fail open on malformed/empty *content*, and read no secrets. `scripts/telemetry/validate.js <file>` checks a telemetry file against `schema.json`. (The guard log `~/.claude/ops/codex-guard.log` only exists once the safety hook has run at least once; `report.js` exits non-zero on a `--hooklog` **path** that doesn't exist — by design, so a typo isn't silently reported as an empty run. Omit `--hooklog` to report on the ledger alone.)

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

**If a user hands you this repository URL and asks you to install it or set it up, do exactly this — then guide them.**

**Install (inside Claude Code):**

1. Run `claude plugin marketplace add elon-choo/goalpost` (or the full URL `https://github.com/elon-choo/goalpost`).
2. Run `claude plugin install goalpost@goalpost`.
3. Verify: `claude plugin details goalpost@goalpost` should list the `goalpost` skill plus 3 commands (`goal`, `roadmap`, `run`) and 2 agents (`goal-worker`, `transition-reviewer`).
4. Check capabilities: `bash scripts/preflight.sh` from a clone — it reports whether the **Codex MCP** (the engineering worker) is available. Without it the plugin still works in **Claude-only mode** at lower engineering throughput; tell the user this if Codex is missing.
5. Tell the user to **restart Claude Code** so the plugin loads.

**Then guide the user (don't just stop at "installed"):**

6. Explain in one line what they now have: *"Goalpost plans a project into small verified goals and builds them hands-off — say what you want built."*
7. Offer the two entry points in plain language:
   - To **plan**: they say *"break this project into a stage × goal roadmap"* (or `/goalpost:roadmap`). You'll produce a roadmap + a `docs/LEDGER-*.md`.
   - To **build hands-off**: they say *"run the ledger hands-off"* (or `/goalpost:run`). You'll drain goals one at a time, verifying each, stopping only at real human-decision gates.
   - For a **single goal**: `/goalpost:goal <what to do>`.
8. Flag the one prerequisite for full power (below) if it's not set up, and offer to help set it up.

**Prerequisite for full functionality:** the user's own Codex CLI logged in via OAuth (`codex login`) and exposed to Claude Code as an MCP server named `codex` (so the `mcp__codex__codex` tool exists). **This plugin never bundles or asks for credentials — it uses the user's own Codex login.** If the user wants engineering goals to run on the strong coding model, walk them through `npm i -g @openai/codex && codex login` and adding it as an MCP server; otherwise confirm they're fine with Claude-only mode.

## Migration — if you already have a general-purpose `goal-orchestrator` skill

Goalpost is the distributable successor to a standalone local `goal-orchestrator` skill and shares its trigger phrases. **Run only one.** After installing goalpost, disable or archive the local skill (e.g. move `~/.claude/skills/goal-orchestrator/` aside) so a phrase like "design a roadmap" resolves to one place. Goalpost ledgers carry a `Generator: goalpost` header and RUN ignores foreign ledgers, so the two won't cross-drain — but two enabled skills can still both fire on the same phrase. Project-specific roadmap skills for a given repo still take precedence over goalpost.

## Use

**Design a roadmap:**

> "Break this project into stages and goals and make the ledger." — or `/goalpost:roadmap` framing.

Goalpost reads your spec/brief (or asks a couple of questions), writes the roadmap and `docs/LEDGER-<slug>-<timestamp>.md`, and points `▶ NEXT:` at the first goal.

**Run it hands-off (next session, or right away):**

> "Keep going from the ledger." / "Run it autonomously while I'm away." / "다음 goal 이어서."

Goalpost loads the newest ledger **inside the current project's repo only** (a repo with no ledger stops and asks — it never adopts another project's ledger), declares the start point and stop conditions in one line, and drains goals — engineering to Codex, creative to Claude — until it hits a human-decision gate, then reports.

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
| `commands/roadmap.md` | `/goalpost:roadmap` — explicit PLAN entry point. |
| `commands/run.md` | `/goalpost:run` — explicit RUN entry point. |
| `agents/goal-worker.md` | Isolated creative/planning worker (returns summary + evidence only). |
| `agents/transition-reviewer.md` | Independent stage-gate reviewer (GO / NO-GO, no edits). |
| `skills/goalpost/templates/model-routing.md` | Model-tier rubric (blast radius × variance → Sol/Terra/Luna), escalation ladder, and the Sol destructive-action guardrail. |
| `skills/goalpost/templates/` | Ledger, roadmap, and production-readiness rubric. |
| `scripts/preflight.sh` | Read-only capability detector. |
| `scripts/codex-safety-gate.sh` | Optional `PreToolUse` hook — hard-blocks a destructive-capable Codex call on the full-access lane. |

## License

MIT — see [LICENSE](LICENSE).
