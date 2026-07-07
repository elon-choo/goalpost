# Changelog

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
