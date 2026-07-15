# Model routing — which model executes each goal (and each sub-task)

This is the single source of truth for **which model runs a goal**. The planner assigns a model tier per goal at PLAN time; the dispatcher applies it (and the escalation ladder) at RUN time; a goal that fans out uses the same rubric for its sub-tasks. Model routing is a layer ON TOP of the existing gates — it never bypasses first-party evidence, the 3-strike cap, the production-readiness rubric, or a HUMAN_GATE.

Completeness is the first constraint; speed/cost is the second. Right-sizing the model is how you get speed **without** lowering the bar — a mechanical task does not need the flagship, and a flagship on a mechanical task is just slower and more expensive, not safer.

## The model roster

| Tag | Model (slug) | Platform | Use it for | Default effort | Relative cost |
|---|---|---|---|---|---|
| `claude:fable` | Claude Fable 5 | Claude (the orchestrator itself + a Claude subagent) | Planning, stage/goal design, architecture, adversarial review, creative taste & judgement | — | orchestrator |
| `claude:opus` | Claude Opus 4.8 | Claude subagent | Claude-side workhorse for creative/planning sub-goals that don't need the top tier (faster than Fable) | — | lower than Fable |
| `codex:sol` | `gpt-5.6-sol` | Codex MCP | **HARD + CRITICAL engineering ONLY** — security/auth/payments, credential-touching, **irreversible/data-dropping** migrations & other destructive-capable work, destructive DB-schema changes, concurrency/perf-critical, cross-cutting refactor over many files, external-API-contract correctness, architecture, final integration/security review. (An *additive/reversible* migration is MED → Terra — see the matrix.) The escalation ceiling. | `ultra` | highest (~$5/$30 per 1M) |
| `codex:terra` | `gpt-5.6-terra` | Codex MCP | **DEFAULT engineering workhorse** — feature implementation on an established architecture, API/DB/integration logic, ordinary bug fixes, medium-complexity PR review | `high` | mid (~$2.50/$15) |
| `codex:luna` | `gpt-5.6-luna` | Codex MCP | **EASY + LOW-VARIANCE** — boilerplate/CRUD scaffolding, fixtures/mocks, tests on an existing pattern, docs/comments/type stubs, mechanical rename/format/config edits | `high` (bump to `xhigh` for pure execution of a settled plan — rivals Terra at ~2.5x cheaper) | lowest (~$1/$6) |

Grounding: the operator's routing intent (Claude plans; Sol = important/hard only; Terra = main; Luna = light/easy) + a model-comparison brief (Terra as an escalation tier, not a blanket default; `luna/xhigh` ≈ Terra; the flagship reserved for expensive-if-wrong work). Codex model slugs verified present in the host's Codex model cache.

## The two-axis tag on every goal: `[<platform>:<model>]`

- **Platform** (unchanged): `codex` = engineering, `claude` = creative/planning, `mixed` = split into a codex sub-goal + a claude sub-goal.
- **Model**: append `:<tier>` — `sol` / `terra` / `luna` for codex; `fable` / `opus` for claude.
- **A bare `[codex]`/`[claude]` tag is UNCLASSIFIED, not "default terra".** Older ledgers keep working, but a bare tag forces the pre-dispatch classifier to run (below): it resolves to `terra`/`fable` ONLY after the classifier confirms the goal is benign + medium. A bare tag on a security/credential/payment/irreversible-migration goal must classify UP to `sol`, never silently sit at `terra`. "Default terra" is the answer for a *classified-benign* goal, not a way to skip classification.
- **Optional effort suffix**: `[codex:luna/xhigh]`, `[codex:sol/ultra]`, `[codex:terra/high]`. Omit to use the roster's default effort. Passed to Codex as `config: { model_reasoning_effort: "<effort>" }`. On an up-escalation the new tier uses its own default effort (a `luna/xhigh` that escalates becomes `terra/high`, then `sol/ultra`) — the suffix pins the *starting* effort, not the ladder.
- **Optional `fanout`**: a modifier on a normal tag — `[codex:terra fanout]` — meaning the goal decomposes into sub-tasks with their own tier map (below). `fanout` is never a platform by itself; a `[fanout]` with no sub-map falls back to running as a single goal at the tag's tier.
- **Optional `pin`**: `[codex:sol pin]` locks the tier against **every re-tiering actor**, not just the escalation ladder: the tie-break "settled plan → cheaper tier" rule, a `G x.10` meta-goal that regenerates the goal, and a reviewer's diff all must leave a pinned tier alone (only a HUMAN_GATE can change it). This is what actually protects a security goal from being quietly re-tagged `terra` during next-stage regeneration. A pin never blocks *up*-escalation on a strike.

## The classifier — pick the tier by BLAST RADIUS × VARIANCE

Score two independent things, then take the higher-tier signal:

- **Blast radius** — what is the damage if this goal is done wrong?
  - HIGH: data loss, security/auth, payments, credentials, production, a destructive/irreversible schema or data migration, anything hard to reverse. (A reversible/additive migration is MED, not HIGH — see the carve-out below.)
  - MED: a normal feature or integration on an established codebase — a bug is annoying but contained and caught by tests.
  - LOW: docs, comments, fixtures, boilerplate, a test that mirrors an existing one — a mistake is cheap and obvious.
- **Variance** ("변수") — how wide is the space of acceptable answers?
  - HIGH: open design space, cross-file coupling, an approach that must be chosen, ambiguous requirements.
  - MED: a known pattern with some judgement — one reasonable shape among a few.
  - LOW: one obvious correct shape, an established pattern to copy, no cross-file coupling. This is the literal meaning of "변수가 적은 쉬운 업무" — a low-variance task.

Route on the full matrix (blast radius drives the floor; variance is resolved by Fable, not bought with Sol):

| radius ↓ / variance → | LOW variance | MED variance | HIGH variance |
|---|---|---|---|
| **LOW radius** | `luna` | `terra` | **design goal (Fable) → then `terra`** |
| **MED radius** | `terra` | `terra` | **design goal (Fable) → then `terra`** |
| **HIGH radius** | `sol` (`pin`) | `sol` (`pin`) | `sol` (`pin`) — design the risky decision first (Fable/`sol`), then implement |

Two corrections that keep this from over-spending Sol and under-protecting the critical goals:

- **Variance is a planning signal, not a Sol trigger.** HIGH variance means the requirement/design is not yet settled. Do NOT dispatch an unresolved requirement to an executor at any tier — that burns the flagship on work the plan should have pinned down. Fable (the orchestrator) resolves the ambiguity first (a design/decision goal), and only the now-settled implementation is routed by blast radius. A LOW-blast-radius but ambiguous task is a re-plan, not a Sol goal — "Sol for hard + critical" means high blast radius, not "anything unclear."
- **Blast radius sets a non-negotiable floor.** HIGH radius → Sol regardless of variance, `pin`ned so the ladder can't downgrade it. This is the safety floor; the matrix above never lets cost pull a HIGH-radius goal below Sol.

Reversible vs destructive is part of blast radius: an **additive/reversible** schema change (add a nullable column, a new table, a new index) is MED radius → `terra`; only a migration that **drops or rewrites existing data** (or is not cleanly reversible) is HIGH radius → `sol` + the destructive-op gate. Don't send every migration to Sol; send the *irreversible* ones.

Tie-breaks: for the *pure execution of an already-settled plan*, drop to the cheaper tier (Luna/Terra) — most of the reasoning was already spent at design time. **Never downgrade a security, credential, payment, data-loss, or irreversible-migration goal to save cost or time** — completeness is the first constraint, and blast radius is a floor, not a preference.

Worked examples:
- "Add a `created_at` column read to an existing list endpoint + a test" → LOW/LOW → `codex:luna`.
- "Implement the funnel-analytics aggregation endpoint per the spec" → MED/MED → `codex:terra`.
- "Design and apply the auth-session refresh + RLS policy change" → HIGH radius → `codex:sol pin`.
- "Write the landing-page hero copy" → creative → `claude:fable` (or `claude:opus` for a routine variant).

## Escalation ladder + the normative attempt/outcome table

Two independent counters — do not conflate them:
- **`quality_strikes`** — DoD failures where the work is wrong. Cap **3**, then `⏸ HUMAN_GATE(3-strike)`. This is the unchanged safety gate.
- **`infra_retries`** — Codex auth/MCP/timeout/sandbox-denial errors. Separate cap (default 3), then `⏸ HUMAN_GATE(infra)`. Never counts toward `quality_strikes`.

Each **quality** strike re-dispatches at the next rung of the tier's ladder (below) — generally one tier *up* (a task a tier failed needs a stronger one), with the single exception that the **workhorse Terra gets a second same-tier try before Sol**. Every re-dispatch carries the prior attempt's **failure evidence**. (So "escalate on a strike" is precise; "always +1 tier every strike" is not — read the per-assignment ladder, not the one-liner.)

| Outcome of an attempt | quality_strike? | next tier/effort | routes to |
|---|---|---|---|
| DoD pass + rubric clear | — | — | `[x]` + evidence path |
| **DoD failure** (work wrong) | +1 (cap 3) | escalate one tier up (see ladder) | re-dispatch with evidence; at 3 → `HUMAN_GATE(3-strike)` |
| **Infra/worker error** (auth, MCP, timeout, sandbox denial) | no | same tier | re-run after preflight; own cap → `HUMAN_GATE(infra)` |
| **Flake** (re-run passes, no code change) | no | same tier | require a root-cause change or 2 consecutive greens |
| **SAFETY_STOP** (the goal cannot be done without a forbidden/destructive action, and the worker correctly stopped) | **no** | **no escalation** | `HUMAN_GATE(safety-stop)` + re-classify the goal's capability — NEVER re-dispatch the same goal to a stronger tier under the same permissions (that just hands a more capable model the same forbidden action) |

Tier ladder per assignment (model/effort at attempt 1 / 2 / 3):
- Assigned `luna`: luna·high → **terra**·high → **sol**·ultra.
- Assigned `terra`: terra·high → terra·high → **sol**·ultra (the workhorse gets a second try before the flagship).
- Assigned `sol`: sol·ultra → sol·ultra → sol·ultra (no higher tier exists; the re-attempts add the accumulated failure evidence, not more effort — Sol already runs at `ultra`). Then `HUMAN_GATE(3-strike)`.
- A `pin`ned tier disables only the *downgrade* direction; up-escalation on a quality strike still applies.
- **If the next ladder tier is unavailable on this host** (e.g. escalating to Sol on a host without `gpt-5.6-sol`): do NOT loop-retry the missing model (that read as a non-striking infra error and would spin forever) — record `degraded-ceiling` and `⏸ HUMAN_GATE(model-unavailable)` if the goal's blast radius needed that tier, else re-attempt the highest available tier at max effort and note the degraded ceiling.
- **Claude-side ladder** (creative goals): `opus` → `fable`. The `fable` attempt runs as a **fresh reviewer/author subagent**, never inline in the orchestrator (writer/judge separation, principle 4). A creative strike escalates the author tier the same way, and the fresh-context C-row scoring is unchanged.
- **Fan-out strike accounting:** a `[fanout]` goal counts strikes at the **goal** level, not per sub-task. A wave with failed leaves triggers a **repair round** that re-dispatches only the failed leaves (siblings are not re-run) = **one** goal-level strike. Three repair rounds → `HUMAN_GATE(3-strike)`. This prevents "5 leaves × 3 tries = 15 dispatches" from silently blowing past the 3-strike cap.
- **Record BOTH counters in the ledger row** (so ladder state survives compaction/session-swap): each dispatch stamps `q:<quality_strikes> i:<infra_retries> tier:<t> effort:<e> sandbox:<s>` on the goal row. A single `attempt:<n>` is NOT enough — after a mix of a DoD failure and an infra error, only the separate `q`/`i` counts tell a fresh session whether it is one quality strike from the 3-strike gate or just retrying infra. The counters live in the ledger (the source of truth), never in lost context.

**The SAFETY_STOP row is the important one:** without it, a worker that correctly refuses a destructive action looks like a DoD failure, takes a strike, and escalates — handing Sol the same goal under the same fast permissions. A safety stop must instead freeze the goal at a HUMAN_GATE and force re-classification.

## Sub-task distribution — when a goal fans out (`[fanout]`)

A goal that decomposes into independent sub-tasks (e.g. "implement 5 similar endpoints + write the API doc") is tagged `[fanout]` and carries a **sub-routing map** where each leaf declares: its tier (by the same classifier), its `depends`, and its **write set** (the files/resources it will write). RUN executes the fan-out as **one Workflow stage-runner** (flat topology — one Workflow level, no recursive nesting), and the stage-runner is a **wave scheduler**, not a fire-everything: it dispatches only leaves whose `depends` are satisfied **and** whose write sets are disjoint from every other leaf in the same wave; leaves with overlapping *filesystem* write sets are serialized or run in isolated worktrees, but leaves sharing a **DB table / external resource / network endpoint** must be serialized (a worktree isolates files, not a live datastore); unknown write set → treat as overlapping. A failed leaf is retried alone (it does not re-run its siblings). Example map:

```
[codex:terra fanout] G3.4 — implement 5 report endpoints + OpenAPI doc
  wave 1 (parallel, disjoint write sets):
    - endpoint A → codex:terra   writes: routes/reportA.ts
    - … endpoints B–E → codex:terra   writes: routes/reportB..E.ts   (NOT the shared router index — see below)
    - OpenAPI doc → codex:luna   writes: docs/openapi.yaml
  serialized (shared write set): register all 5 in routes/index.ts  → codex:terra   writes: routes/index.ts
  wave 2: integration smoke test → codex:terra   depends: endpoints A–E + index
```

This is the primary productivity lever: right-sized models on disjoint work, concurrently — not one flagship doing everything in series, and not blind parallelism that races on a shared file. If two "independent" leaves would both write `routes/index.ts`, they are NOT independent — serialize them or the write is lost.

**A single Codex call does not re-route tiers mid-run** — one Codex invocation runs one OpenAI model. Cross-tier sub-routing is realized by the *orchestrator* issuing multiple Codex calls at different tiers, not by a worker swapping models inside one run. When a Codex worker *does* parallelize internally (its own subagents/worktrees), you can only nudge its effort, not its tier — pass a developer-instruction like "spend minimal effort on mechanical sub-parts (fixtures, docs, boilerplate); reserve deep reasoning for the risky parts."

## Sol destructive-action guardrail (REQUIRED on every Codex dispatch; strictest for Sol)

**Why:** the GPT-5.6 system card and independent reports (TechCrunch, 2026-07-14) document that Sol interprets instructions broadly and will take **destructive actions — deleting files, data, and databases, and using credentials — without asking**, unless explicitly forbidden. It shows more out-of-intent action than the prior generation. The mitigation is layered and **non-optional**; it costs nothing on normal work and prevents the expensive failure.

**1. Inject this allow/deny block into every Codex dispatch's `developer-instructions`** (verbatim; Sol especially):

```
ALLOWED without asking: read/edit files inside the target repo scope; run tests, builds, typecheck, lint; create new files in scope.
FORBIDDEN unless the goal explicitly and in writing authorizes it AND a human has approved it — if the goal seems to need one of these, STOP and report instead of proceeding:
- Deleting or truncating files, directories, databases, tables, or volumes (rm -rf, DROP, TRUNCATE, a migration "down" that drops data).
- Row-level or bulk data destruction/rewrite even without DROP: `DELETE FROM`, a mass `UPDATE ... SET` without a tight WHERE, a data-backfill/rewrite migration, overwriting a file's contents wholesale.
- Destructive git: reset --hard, checkout -- / restore that discards work, clean -fdx, force push, branch -D on a shared branch, history rewrite.
- Any real outbound effect: sends (email/SMS/push/webhook to a real endpoint), deploys, payments, contract/legal actions.
- Reading or using credentials/secrets/tokens beyond what the goal explicitly hands you; copying or printing env/secret files.
- Acting outside the target repo scope: other repos, the home dir, system files, remote machines.
Operate ONLY on the exact targets the goal names. If a named target (file, table, branch, host, resource id) does not exist or is ambiguous, STOP and report — NEVER substitute a similar-looking target (this is how "delete VM 1/2/3" becomes "delete VM 5/6/7").
Never widen "implement X" into "and also clean up / reset / delete Y". If you are unsure whether an action is destructive, treat it as forbidden and ask.
```

**1b. Bind a stop condition to every dispatch (GOAL / STOP WHEN / EVIDENCE).** Sol's other documented failure mode is *not stopping* — over-continuing past the task into unrequested "cleanup", refactors, or extra passes (a real Codex run that went eight hours). Counter it exactly as v4.18.0 does: every worker prompt states an **observable stop condition** and is judged by returned evidence, never by self-report.
```
GOAL: <the one thing this goal must achieve>
STOP WHEN: <the exact observable condition that ends the turn — e.g. "the named test passes and its output is written to <path>"> — stop there; do not add a verification loop, polish pass, review cycle, or bonus refactor past this line.
EVIDENCE: <the artifact that proves STOP WHEN was met — a log file, an exit code, a diff>. Return the evidence path; do not claim done without it.
```
The orchestrator's acceptance loop already enforces the EVIDENCE half (first-party verification, no `[x]` without an observed artifact). Adding the explicit STOP WHEN to the prompt is the cheap other half — it keeps a broad instruction from turning into open-ended, destructive-capable roaming.

**2. Classify destructive capability by REACH, not just stated intent (fail safe):**
A goal is **destructive-capable** if the actions it will take *can reach* a real, hard-to-reverse effect — even if its one-line intent sounds harmless. Classify by what its commands touch, not by its title:
- Its intent is destructive (migration, delete, schema drop, infra/prod change, credential use, real send) — the obvious case.
- **Transitive reach (the non-obvious case):** it runs tests / scripts / build / install whose hooks or code can perform a destructive act against **real/production state** — a `pretest`/`postinstall` that runs `migrate reset --force` or deletes data, a command that inherits a **production** `DATABASE_URL` / cloud creds / a real send-deploy endpoint. A "Luna: add a test" goal whose `npm test` fires a `pretest` that resets the dev DB is destructive-capable *by transitivity*.
- **What does NOT make a goal destructive-capable:** merely using the network (`npm install`, pulling a package, hitting a *local/test* service, fetching a fixture) is normal dev work, not a destructive edge. The trigger is *reaching real production data / credentials / real external side-effects*, not network access per se — otherwise every ordinary build would be gated and dead-end (its own DoD command couldn't run in a network-denied lane).
- **Default when unknown = destructive-capable** *when the ambiguity is about reaching production/real state.* If a goal's commands could hit prod data/creds/real endpoints and you can't rule it out, gate it; if the only "reach" is a package registry or a local service, it stays inert. Fail safe on real destruction, not on ordinary tooling.

**3. Scope the sandbox to that classification:**
- **Inert goals** (edits + build/test/install/lint whose commands cannot reach prod creds, a real/prod datastore, or a real external side-effect — ordinary network use like a package registry or a local/test service is fine) use the host's fast default (on this machine `sandbox: danger-full-access`, `approval-policy: never`). The guardrail block still rides along. This is the common case and it stays fast.
- **Destructive-capable goals (including transitive)** — regardless of model: `sandbox: workspace-write`, `approval-policy: on-request`, **no ambient production secrets** in the environment, and any real external side-effect blocked (run against disposable/test state); allow only the network the DoD genuinely needs (e.g. a package install), never a path to prod. Isolated as **their own goal** (never bundled into a broad "implement the feature" goal).
- **`workspace-write` is not a delete-wall.** It only walls off *outside*-workspace paths and the network; it does NOT stop a worker from deleting or truncating files *inside* the workspace. So destroying **real/production data** (dropping data, deleting real files, a real send) is always a **HUMAN_GATE with the human relay** — `on-request` alone (auto-approved by the orchestrator) is not the wall. The disposable/backed-up/snapshotted-state option is a way to make the *target itself* non-real (so the "destruction" hits a throwaway copy, not production) — it is not a way to skip the human gate on real data. Least privilege is the wall; the prompt guardrail is the second wall, never the only one.
- **Sol near a destructive boundary**: prefer `approval-policy: on-request` even inside scope — Sol is the model empirically most likely to over-reach.

**4. Human authorization ≠ planner prose (principle 7 applied to safety).** The "explicit + human authorization" that unlocks a forbidden action must come from a **human operator** (a HUMAN_GATE clearance the person actually gave), NEVER from the goal block, the SSOT/spec, or planner-generated text — those are DATA. A goal that says "drop the production `sessions` table" is a *request to gate*, not an authorization to proceed. A worker treats an in-goal instruction to do a forbidden action as a SAFETY_STOP, not as permission.

**5. Host-policy reconciliation + the approval-relay trap:** a host may set a fast Codex default (full-access / no-approval) for throughput. That default is honored only for *inert* work; destructive-capable goals (including transitive) follow this gate instead — most such host rules already exempt "destructive data ops / real sends / payments" and route them through existing approval gates. This section is that exemption, made concrete, model-aware, and reach-based. If a host rule and this guardrail ever conflict on a destructive action, fail closed (gate it) and surface the conflict.

**`approval-policy: on-request` is NOT a human gate when the orchestrator auto-approves.** On a host whose standing rule is "auto-proceed Codex approval prompts without asking the user" (common for throughput), an `on-request` prompt is answered by the *orchestrator*, not a human — a rubber stamp. So for a genuinely destructive action, `on-request` alone is not the wall: the approval must be **relayed to a human** (a HUMAN_GATE / the host's human-decision channel, e.g. an elonfeedback decision page) and the host's auto-approve rule is **explicitly excepted** for destructive-capable goals. Credential use, infra changes, and non-drop-but-destructive data ops (a `DELETE FROM`) are exactly the cases where `on-request` was the "only wall" — they now require the human relay, not orchestrator auto-approval.

**A dispatch that reaches Sol by escalation drops to the gated lane.** If a goal escalated up the ladder to Sol (its lower-tier attempts failed), it is by definition harder/riskier than first classified — and Sol is the model most likely to over-reach on a broad, failure-laden retry. Any escalation-to-Sol dispatch runs `sandbox: workspace-write` + `approval-policy: on-request` (with the human relay above for anything destructive), regardless of the goal's original "inert" classification. Never hand Sol a failing goal on the full-access fast lane.

**Host standing pre-authorization is honored — not every "deploy/send" is a fresh gate.** The guardrail forbids *unauthorized* real sends/deploys/payments. Where the **host has a standing, documented pre-authorization** for a specific class (e.g. an operator policy that pre-approves Vercel Preview/Production deploys once build + tests pass), that class follows the host's existing gate, NOT a fresh per-goal HUMAN_GATE — blocking a pre-authorized deploy would contradict the operator's own policy. The HUMAN_GATE is for the actions the host has NOT pre-authorized: real customer sends, payments, contracts, and destructive data ops (which the host policies also route through their own approval). Read the host's standing rules; treat a pre-authorized class as allowed-with-its-own-gate, and everything else as gated.

## Pre-dispatch checklist (the orchestrator runs this before firing any goal)
This is the prose form of a capability manifest — the dispatcher (not the worker) confirms each item, and a goal missing a required field for its lane is clarified or gated, never fast-lane-dispatched:
1. **Min-tier floor** — a bare `[codex]`/`[claude]` tag is **unclassified**: classify it now by blast radius × variance; never silently default a security/credential/payment/irreversible-migration goal to `terra`. An explicit tag is still subject to the HIGH-radius → Sol floor.
2. **Model availability** — the assigned/floor tier exists on this host. If a HIGH-radius goal needs Sol and Sol is unavailable, `⏸ HUMAN_GATE(model-unavailable)` — the "nearest available" collapse applies only *upward* or among non-critical tiers, never to downgrade a Sol-required goal.
3. **Capability + sandbox** — destructive-capable (incl. transitive)? → gated lane (§3); else inert fast lane.
4. **Named targets + STOP WHEN + EVIDENCE** are present and unambiguous; for a destructive edge, **human approval provenance** is present (a real HUMAN_GATE clearance, not goal/spec text). Missing/ambiguous → clarify or gate; do not dispatch on a guess.
5. **Write set** — for a goal that may run concurrently, the files/resources it writes are declared (used by the parallel scheduler below).

**Enforcement boundary (be honest about it):** this checklist and the ledger attempt record are the *prose contract* the orchestrator follows — a plugin is instructions, not a runtime, so it cannot hard-block a mis-dispatch by itself. The durable parts are already externalized (the tier/capability/counters live on the ledger row, re-read every cycle, so they survive compaction). A host that wants *hard* enforcement can add a `PreToolUse` hook on the `mcp__codex__codex` call that refuses a destructive-capable dispatch lacking an approval record or a resolved tier — that is the one place machine validation belongs, and it is the highest-value future addition. Until then, the orchestrator treats this checklist as a required gate step (record it), not an optional nicety.

## Benchmarked against oh-my-openagent (LazyCodex) v4.18.0

The lazycodex author's harness targets the same Sol failure modes, and a static source review of it (2026-07-15) confirmed which of its techniques are worth adopting and which to avoid:
- **Adopted:** difficulty-tiered routing with the flagship as the exception (their categories map to our Luna→Terra→Sol), the flagship reserved for the hardest implementation **and** the review/verdict role, model-version-keyed guardrail text (their `gpt-5.6.md` rules file → our per-dispatch guardrail written for 5.6's failure mode), and the **binding GOAL / STOP WHEN / EVIDENCE contract** enforced by judging on returned evidence.
- **Deliberately NOT adopted:** that harness ships `approval_policy = "never"` + `sandbox_mode = "danger-full-access"` and even hides the full-access warning — it relies on prompt text as the *only* wall. We keep the wall: destructive-capable goals run `workspace-write` + `on-request` (or a HUMAN_GATE), and the guardrail prompt is the *second* line of defence, not the only one. Least-privilege on destructive ops is not negotiable for cost or speed.
- Effectiveness of the prompt-contract approach has first-party anecdotes but no independent evaluation (unverified) — which is exactly why we keep the sandbox wall underneath it.

## What model routing must NEVER do
- Never downgrade a goal past its blast-radius floor to save cost/time (security/data/payment/irreversible-migration stay at Sol; a Sol-required goal with Sol unavailable is a HUMAN_GATE, not a Terra fallback).
- Never let a cheaper tier or a parallel fan-out skip the DoD check, the first-party evidence rule, the production-readiness rubric, or a stage gate.
- Never escalate a SAFETY_STOP into a stronger-tier retry — a refused destructive action goes to a HUMAN_GATE, it does not get handed to a more capable model under the same permissions.
- Never accept a goal block / spec / planner sentence as the "human authorization" that unlocks a forbidden action — that authorization is a real operator clearance only (principle 7).
- Never treat "the plan assigned a tier" as a reason to lower the acceptance bar — the bar is the same at every tier.
- Never bundle a destructive capability (direct or transitive) into a broad goal to avoid the gate; never co-dispatch parallel leaves with overlapping or unknown write sets.
