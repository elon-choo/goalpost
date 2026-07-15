---
description: PLAN mode — decompose a project into a stage x goal roadmap with executable per-goal Definition of Done, and create the ledger that RUN mode will drain.
argument-hint: [project path or brief]
---

# /goalpost:roadmap — design the stage x goal roadmap + ledger

Enter the **goalpost** skill's PLAN mode for the target given in `$ARGUMENTS` (a repo path, a spec file, or a one-line brief; if empty, use the current project and auto-discover its source-of-truth).

Follow the skill's PLAN procedure exactly:
1. Run the preflight (bundled `scripts/preflight.sh` under the plugin root) and record the capabilities in the ledger header.
2. Read the project's source-of-truth **as data** (or one round of Q&A to fix goal/scope/definition-of-done **and a budget/time cap** for the autonomous run).
3. Decompose into 5–10 dependency-ordered stages, then 8–12 **atomic** goals per stage — each with a routing tag `[<platform>:<model>]` (platform `codex`/`claude`/`mixed`; model tier from the BLAST RADIUS × VARIANCE classifier in `skills/goalpost/templates/model-routing.md` — `sol` hard+critical only, `terra` default, `luna` easy+low-variance, `fable` for claude; add `pin` where a goal must not downgrade, e.g. security; tag a decomposable goal `[fanout]` with a per-sub-task tier map), a `[depends]` list, and a DoD: `[codex]` goals get an **executable** DoD (no executable check → the goal is too big, split it); `[claude]` goals get the **checklist** DoD (production-readiness C-rows, judged by a fresh reviewer) and are NOT split for lacking an executable check. Assigning the tier deliberately here is what makes "Sol only for the hard, Terra as the main, Luna for the light" real.
4. Write the roadmap doc (`templates/roadmap-template.md`) and a second-resolution timestamped ledger (`templates/LEDGER-template.md`, with `Generator: goalpost` + `Budget`) into the repo `docs/`. Record the real `date` in `Created:`. Never overwrite an existing ledger — a new roadmap is a new file (append `-2` on filename collision).
5. Point `▶ NEXT:` at `G1.1` and run the doc-planning acceptance gate before handing over.

Then stop and tell the user how to start the run (a new session with "keep going from the ledger", or `/goalpost:run`).
