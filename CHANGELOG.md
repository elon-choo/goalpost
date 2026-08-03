# Changelog

## 0.4.1

Eleven operating-policy decisions, made by the owner off a full audit of real goalpost runs (94 ledgers, 11 days of goal-loop logs, 100 past decisions), wired into the spec. Each rule carries its decision provenance inline (`owner decision 2026-08-0X`).

- **Pre-dispatch auto-classification is mandatory.** A goal whose routing tag is missing, bare, or off-roster is classified by blast radius × variance at dispatch and the resolved tier is written back onto its ledger row — the last safety net for goals plan-time tagging missed (audit: 11/18 real ledgers carried zero tags; one PII+credential prod deploy ran on an off-roster tag). SKILL RUN step 3 + routing checklist item 1.
- **Escalation to Sol is pre-authorized.** A quality-strike ladder that reaches `sol` no longer waits for per-goal owner approval; the counterpart is that an escalated Sol attempt always runs the gated lane, never `danger-full-access`. SKILL escalation + routing ladder.
- **Review rounds are improvement-keyed, not count-keyed.** A NO-GO keeps iterating fix → re-verify while each round measurably improves; two consecutive flat rounds = a direction problem → `HUMAN_GATE(review-stalled)`. Replaces the fixed NO-GO-equals-gate rule (audit: a 62→78→91 auto-recovery was the success pattern worth standardizing). SKILL stage gate + HUMAN_GATE list.
- **Fixed gate goals are mandatory in every stage.** `G x.8/.9/.10/.9.5` are part of the stage skeleton; omitting one takes a written `Gates-waived:` line (audit: half of real ledgers shipped without gates). SKILL PLAN step 3 + step 6 audit.
- **Weak DoDs are auto-rejected.** A goal with no DoD, or a self-certifying one ("file exists"-class), is rejected and rewritten at ledger creation AND at dispatch (new checklist item 4b). SKILL PLAN step 6 + routing checklist.
- **Parallel-by-default wave scheduling.** Depends-clear goals with provably disjoint write sets fire concurrently by default; serial is the fallback for overlap/unknown, never the default for convenience. SKILL RUN parallelism.
- **A HUMAN_GATE no longer freezes the whole ledger.** Goals dependency- AND resource-independent of the gated item may start and continue; an unanswered gate is never resolved by defaulting to the recommendation — the owner explicitly chose reminders over timed auto-proceed. SKILL HUMAN_GATE handling.
- **Quota exhaustion is a standardized infra event.** A 429/usage cap substitutes a worker from the other platform at the SAME DoD, recorded as `[<orig>→<sub>]` on the row; a `sol`-required goal is never substituted down (`HUMAN_GATE(model-unavailable)`). SKILL acceptance loop + routing outcome table.
- **Full-completion wrap-up is automatic; the next direction is not.** On completion: final report, ledger completion row, pre-authorized deploys — then 2–3 evidence-backed next-ledger candidates posted to the host's async decision channel instead of self-picking a direction. SKILL reporting.

Carried over from unreleased:

- **Claude-side hybrid routing wired (owner decision, 2026-07-26).** `[claude:opus...]` tags now reach a real agent: new `agents/goal-worker-scoped.md` (frontmatter `model: opus`, `effort: medium`) executes scoped implementation & edit goals — grounded in FrontierCode 1.1, where Claude Opus 5 peaks at medium effort on mergeability (53.4% medium vs 48.0% high on Main; above medium it loses points to out-of-scope refactors). `transition-reviewer` pins `effort: high` (verification lane). `templates/model-routing.md` gains a Claude-side routing section (fable = judgement/0→1 — never effort-downshifted; opus/medium = scoped edits; hybrid boundary keeps Codex for parallel capacity + cross-vendor review) and the roster row updates Opus 4.8 → Opus 5; dispatch rules added to `commands/goal.md` and SKILL routing/RUN step 3; PLAN (`commands/roadmap.md` + SKILL step 3) now writes the effort suffix by default (`[codex:terra/high]`, `[claude:opus/medium]`); the Claude-side escalation ladder covers the scoped lane (opus/medium strike → fable).
- **Preflight reports codex model tiers.** `scripts/preflight.sh` reads `~/.codex/models_cache.json` and prints `codex-models: sol=… terra=… luna=…` (fallback: `unknown (cache not found)`) — implementing the capability line the SKILL/ledger header already referenced.
- README: version badge synced to plugin.json (0.4.0), routing table gains the Claude rows, agent count 2 → 3.

## 0.4.0

Stronger goal prompts — grounded in loop-engineering practice for goal/loop modes (the "strong goal" discipline: outcome + verification + constraints + scope + stop conditions, popularized for Codex `/goal` — Dev Roach lecture, 2026-07; cross-checked against OpenAI's published goal-mode guidance). PLAN now front-loads the understanding, and every goal states not just *what done means* but *what it may touch* and *what it must never touch*.

- **Align step in PLAN (ambiguity → zero).** Before decomposition, the planner scans for what is still vague (unstated target figures, undefined "done", unbounded scope, unnamed must-not-touch areas), resolves everything the repo/SSOT evidence can answer, batches only residual owner-level decisions into the single Q&A round, and converts every vague adjective into an observable target ("make it faster" → "p95 < 300ms on <probe>"). Rationale: ambiguity is the main cause of long, drifting runs — the understanding step can't be outsourced to the executor.
- **Per-goal `[scope — writes]` + `[constraints]` fields** (roadmap goal-prompt form, SKILL, ledger row `writes:`). Constraints are the goal-local "never touch login" lines that keep a long loop from wandering — on top of, not instead of, the global destructive-action guardrail. The declared write set finally gives the wave scheduler's "disjoint write sets" rule a home on ordinary (non-fanout) goal rows; missing/`unknown` still serializes (fail-safe).
- **Measurement-first rule.** "No executable check → split it" was incomplete: splitting creates no measurement. If an outcome is measurable in principle but no harness exists (no perf probe, no e2e, no visual differ), PLAN inserts a precursor **measurement goal** that builds the harness, and the implementation goal's DoD runs it. A measurement goal's own DoD must prove the harness can FAIL (it flags a known-bad case / injected regression — "the probe runs" is not a DoD), and the worker judged by a probe never writes that probe in the same session. `/goalpost:goal` gains a Step 0 (align-lite): derive outcome/check/scope/constraints before dispatch; refuse to dispatch a goal whose DoD can't be stated as an observable condition.
- **Verifier-panel DoD for subjective-but-real outcomes** (a visual effect landed): 2–3 fresh-context judges, unanimous pass, a rejection re-fires the loop — never the author scoring itself. Wired end-to-end: the transition-reviewer accepts a properly-specified panel DoD on a `[codex]` goal (no false "no executable command" blocker; a panel used where an executable check was feasible is still weak), and production-readiness E1 defines the panel's evidence form.
- **Harness-integrity gate (anti-gaming).** The DoD check is the measuring device, not part of the worker's write set. The acceptance loop now diffs the check's test/probe/threshold/fixture files **against a snapshot recorded at dispatch** (content hash / commit id stamped on the goal row — a worker commit can't blank the diff) before accepting any pass; a pass produced by editing, skipping, special-casing, or hardcoding the check is a DoD failure (strike + restore the check); a concurrent sibling whose declared write set legitimately covers those files is attributed to its own gate, not this goal's gaming; a check that genuinely must change routes to the existing weakening HUMAN_GATE. Worker-facing: a `HARNESS:` line joins the binding GOAL / STOP WHEN / EVIDENCE contract, and common-conventions gains clause 11. Production-readiness E1 verifies it.
- **Visual-fidelity decomposition.** "Match this reference" is never one goal: extract design tokens/components → build against them → a measured compare loop. Vision work in one blob burns tokens and drifts.
- **Env-parity note.** Each DoD states where it runs; an env-sensitive goal verifies in an environment equivalent to where the result matters, else the pass is recorded `local-only` with parity as a follow-up DoD or risk row.
- **Human-readable stage report.** At each stage completion RUN writes a short plain-language report to `docs/REPORT-stage-<n>-<ledger-slug>.md` (`Generator: goalpost` first line; goals done, measured figures, what changed where, residual risks) — the ledger stays the machine record; the report is what the operator actually reads. Goalpost-generated artifacts (`LEDGER*`, `REPORT-stage-*`, `Generator: goalpost` headers) are now explicitly excluded from PLAN's SSOT auto-discovery, so a run's own outputs can never be mistaken for the project's spec on a later re-plan.

## 0.3.0

Observe → improve → release. This version dogfooded the v0.2.1 routing + guardrail by running goalpost on itself: it built a run-telemetry harness, ran a controlled observation with deliberately-tiered synthetic goals + destructive tripwires, measured where the safety hook actually catches vs misses, and hardened the hook against the gaps that surfaced — then shipped the result.

- **Run-telemetry harness (`scripts/telemetry/`).** Parse a ledger's per-goal attempt records + the `~/.claude/ops/codex-guard.log` hook decisions and aggregate them into a `run-report.{json,md}` — tier distribution, escalations, hook allow/block counts, wall-clock, and a per-tier cost proxy. Fail-open on malformed/empty input; reads no secrets. See "Observe your own run" in the README.
- **Safety-hook hardening (`scripts/codex-safety-gate.sh`), driven by measured gaps.** A controlled observation run confirmed the previous hook caught literal destructive tokens but let paraphrased destruction and mass-mutation calls through. Added, layered under the sandbox wall:
  - **Sol on the full-access lane** — an explicit `gpt-5.6-sol` dispatch on `danger-full-access` is now blocked (model spelling normalized for case/whitespace/provider-prefix); the everyday default lane is warned, not blocked, to keep ordinary work fast. `codex-reply` is excluded (it inherits the thread's already-gated sandbox).
  - **Mass-mutation coverage** — no-arg mass-op calls (`cancelAllSubscriptions()`, `deleteMany()`, `clearAll()`/`wipeAll()`/`destroyAll()`/`flushAll()`, …) and a real SQL `UPDATE … SET … =` with no genuine `WHERE` (comparison-operator-aware, comment-stripped, alias-aware) now block on the full-access lane. Ordinary code (`removeAll(x)`, `UPDATE … WHERE id=?`, scoped `deleteMany({where})`) and English prose ("update character set", "clear all caches") do NOT — verified against a false-positive battery.
  - **Marker precision** — the `GOALPOST-LANE: destructive` marker now matches only as a line-anchored directive, so a prompt that merely *documents* the marker no longer false-positives.
  - **Override hygiene** — the file override is single-use (consumed after one bypass) and fails closed if it can't be consumed; every use logs a loud WARN.
- **Honest scope (read this).** The hook is a **partial denylist and a second wall, not a complete destructive-op preventer.** Natural-language paraphrase ("wipe all rows in the users table") and self-true predicates (`WHERE 1=1`) are NOT caught by string matching, and the hook is **pre-dispatch only** — it cannot see the shell commands Codex runs at runtime. The durable control against GPT-5.6 Sol's documented destructive-action tendency is **least-privilege sandboxing** (Sol/destructive-capable work on `workspace-write`, never `danger-full-access`) plus the **HUMAN_GATE** on real data destruction — the prompt/token hook rides on top of that, it does not replace it.
- Verified: telemetry DoDs re-run first-party; hook change carried through a 3-round adversarial review (68-assertion unit suite, zero ordinary-work false-positive) to an independent GO.

## 0.2.1

Ship the destructive-action guardrail as a real, optional enforcement hook (it was prose-only in 0.2.0).

- **`scripts/codex-safety-gate.sh`** — an optional `PreToolUse` hook for the `mcp__codex__*` tools. It lets `read-only`/`workspace-write` calls through and, on a `danger-full-access` call, blocks (exit 2, with a re-scope instruction) if the task carries a hard destructive token (`rm -rf`, `DROP TABLE`, `DELETE FROM`, `git push --force`, `migrate reset`, …) or an explicit `GOALPOST-LANE: destructive` marker. This turns the guardrail from a prompt-level "second wall" into a "first wall" that refuses the tool call. Fail-open by design; override with `CODEX_GUARD_OFF=1`.
- The guardrail block is now injected wrapped in `<<<GOALPOST-GUARDRAIL>>> … <<<END-GOALPOST-GUARDRAIL>>>` delimiters so the hook strips it before scanning (the guardrail's own forbidden-token list never false-positives), and destructive-capable dispatches carry a `GOALPOST-LANE: destructive` marker. `templates/model-routing.md` documents the wire-up; README has an install snippet.

## 0.2.0

Model-aware orchestration — right-size the model per goal for productivity without lowering the completeness bar, and harden against the flagship's destructive-action tendency.

- **Two-axis routing (`[<platform>:<model>]`).** Every goal now carries a model tier on top of its platform tag. Codex tiers: `sol` (`gpt-5.6-sol`, hard + critical only — the escalation ceiling), `terra` (`gpt-5.6-terra`, the default workhorse), `luna` (`gpt-5.6-luna`, easy + low-variance). Claude: `fable` / `opus`. A bare `[codex]`/`[claude]` still works and defaults to `terra`/`fable`.
- **New rubric `templates/model-routing.md`.** Picks the tier by BLAST RADIUS × VARIANCE, with worked examples, an optional effort suffix (`:luna/xhigh`) and a `pin` that locks against downgrade. This is the single source of truth for model selection, used by the planner, the dispatcher, and any goal that fans out.
- **Escalation ladder.** A DoD strike now re-dispatches one tier UP (Luna→Terra→Sol; Terra→Terra→Sol) with the failure evidence attached, instead of repeating the same tier. The 3-strike cap is unchanged.
- **Fan-out + parallelism.** `[fanout]` goals carry a per-sub-task tier map and run as one Workflow stage-runner; independent goals (disjoint files, satisfied `depends:`) may run concurrently at right-sized tiers. Gates are never skipped.
- **Sol destructive-action guardrail (principle 9).** Every Codex dispatch injects an allow/deny block into `developer-instructions` (no deleting files/data/DBs, no destructive git, no real sends/deploys/payments, no out-of-scope or unauthorized-credential actions; operate only on named targets — never substitute a similar-looking one; binding STOP-WHEN condition). Destructive-capable goals are isolated into their own gated goals (`workspace-write` + `on-request`, or a HUMAN_GATE), not bundled — the fast host default stays for ordinary edits only.
- **Benchmarked against oh-my-openagent (LazyCodex) v4.18.0.** Adopted its GOAL/STOP-WHEN/EVIDENCE stop-contract, difficulty-tiered routing, and named-target invariant; deliberately did NOT adopt its `approval_policy=never` + `danger-full-access` default — the sandbox wall stays under the prompt guardrail on destructive lanes.
- Preflight reports which Codex tiers exist (`codex-models`); a missing tier collapses to the nearest available. Templates, `production-readiness.md` (new E9 model-fit row + hardened E6/E7), and the transition-reviewer (now audits tier assignments) updated to match.

Hardening after two independent adversarial reviews (Claude red-team + GPT-5.6 Sol cross-model):
- **SAFETY_STOP is a distinct outcome.** A worker that correctly refuses a forbidden/destructive action no longer looks like a DoD failure — it does not strike, does not escalate (which would hand a stronger model the same forbidden action), and routes to `HUMAN_GATE(safety-stop)` for capability re-classification.
- **Destructive capability is classified by REACH, not title.** A goal whose commands can *reach* real external state — a `pretest` hook that resets a DB, a command inheriting a prod `DATABASE_URL` — is destructive-capable by transitivity; unknown defaults to destructive-capable. Only truly inert goals use the fast lane. Row-level destruction (`DELETE FROM`, mass `UPDATE`) is now in the deny-list.
- **Human authorization ≠ planner prose.** An in-goal/spec sentence like "drop table X" is DATA (principle 7/9), a request to gate — never the human authorization that unlocks a forbidden action. And `approval-policy: on-request` is treated as a rubber stamp on hosts whose orchestrator auto-approves — destructive approvals are relayed to a human, and escalation-to-Sol always drops to the gated lane.
- **No silent downgrade.** A bare/legacy tag is UNCLASSIFIED (re-classified every dispatch, never defaulted to `terra` for a security goal); a HIGH-blast-radius goal whose required tier is unavailable is `HUMAN_GATE(model-unavailable)`, not a Terra fallback; `pin` now binds every re-tiering actor (ladder, tie-break, `G x.10` regen, reviewer diffs).
- **Two explicit counters + a normative outcome table** (`quality_strikes` cap 3 = the gate; `infra_retries` separate) resolve the "is it 3 or 5 dispatches?" ambiguity; the tier/effort per attempt is spelled out; `[fanout]` counts one goal-level strike per repair round (not per leaf).
- **Concurrency is a wave scheduler.** Parallel goals require declared, disjoint write sets (dependency-clear ≠ resource-clear); first-party re-verification runs on a quiesced/isolated tree so a sibling's mid-edit can't manufacture a spurious strike; after a HUMAN_GATE no new work starts and running goals finish only if resource-isolated.
- **Ledger attempt record** (`attempt:<n> tier:<t> effort:<e> sandbox:<s>`) makes ladder state survive compaction. `production-readiness.md` E9 is under-tiering-blocks / over-tiering-audit-only; E6 requires a before/after state audit (not just a green test) for destructive-capable goals.

## 0.1.0

Initial release. Portable, distributable extraction and upgrade of the author's local `goal-orchestrator` skill.

- **PLAN + RUN orchestrator skill** (`skills/goalpost`) — stage × goal roadmap design and hands-off autonomous execution driven by a single-source-of-truth ledger.
- **`/goalpost:goal`** — single-goal executor primitive with worker routing (engineering → Codex MCP, creative → Claude Code) and a 3-strike acceptance loop that independently verifies each goal's Definition of Done.
- **`/goalpost:roadmap`, `/goalpost:run`** — explicit PLAN / RUN entry points.
- **Agents** — `goal-worker` (isolated creative/planning executor) and `transition-reviewer` (independent stage GO/NO-GO gate).
- **Templates** — ledger, roadmap, and a production-readiness rubric that operationalizes "no human needs to touch this again".
- **Portability** — host-agnostic core, Codex-availability auto-detection with graceful Claude-only fallback, optional host adapters (e.g. macOS protected-folder access) detected by `scripts/preflight.sh`.
- Packaged as a Claude Code plugin with its own marketplace manifest.

## 0.1.1

Project-boundary hardening after a real cross-project incident (an orchestrator run in a ledger-less folder silently adopted another project's newest ledger and killed that project's legitimate session):

- **Principle 8 — the project boundary is absolute.** Ledgers are discovered, selected, and created only inside the target repo (user-named path → `git rev-parse --show-toplevel` → cwd). No ledger in the repo → stop and ask; never widen the search to other projects, shared doc folders, recall, or memory.
- RUN integrity check now requires the ledger's `Target repo:` header to match the current project (a mirrored/foreign ledger is refused).
- PLAN's widened SSOT auto-discovery explicitly never selects a ledger.
- Mirrored ledger copies get a first-line `READ-ONLY COPY — never RUN from this file` marker.
- Session conflicts are reported, never resolved by killing another session/process.

## 0.1.2

Round-3 review closures (boundary residuals):

- Unresolved target repo (non-git parent cwd containing multiple projects) → ask, never sweep the subtree.
- `Target repo:` match compares tilde-expanded/realpath-normalized paths; a missing/unreadable header fails closed.
- A `READ-ONLY COPY` first-line marker disqualifies a ledger; even a user-named ledger path must sit inside the target repo.
- PLAN's SSOT auto-discovery adds an ownership check — a foreign project's roadmap/spec is confirmed with the user before adoption.

## 0.1.3

Second incident post-mortem closures + public release:

- **Ban the "most active ledger" heuristic.** When no ledger exists in the target repo, candidates seen elsewhere may be listed for reference, but the user chooses — recall/memory "activity" never selects a ledger (it picks the machine's busiest project, not the one the user meant).
- **Ownership-signal rule.** A fresh Session-claim / minutes-old updates / `[~]` rows / a live process mean the ledger already has an owner and is not yours to run — never inverted into "a duplicate to clean up".
- Repository published publicly; manifest/README URLs point to the real remote; README gains a "For AI agents" install section (install from just the repo URL).

## 0.1.4

Public-release triple-audit closures (docs accuracy H/M + parity):

- README stage-boundary order corrected to G x.9 → G x.10 → G x.9.5 (the transition review vets the freshly generated DoDs) — the doc no longer contradicts the skill.
- README/run.md "newest ledger" phrasing qualified with the project-boundary rule (in-repo only; no ledger → stop and ask).
- run.md gains the unresolved-parent-cwd guard (parity with SKILL.md).
- Components table lists all three commands; host-adapter wording made machine-neutral.
