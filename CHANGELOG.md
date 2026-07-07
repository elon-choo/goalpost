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
