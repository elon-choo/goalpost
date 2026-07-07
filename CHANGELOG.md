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
