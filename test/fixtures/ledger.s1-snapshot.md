# Snapshot — S1-boundary ledger state (FROZEN fixture for the H-05/H-06 regression; DO NOT advance this file)
# Purpose: the H-06 regression must assert against a STABLE ledger, not the live one (which advances as the run drains). Freezing the S1 boundary keeps the assertion (untagged orchestrator rows collected, no prose-invented ids) strong and stable.

▶ NEXT: G1.9

## Stage 1 (frozen)
- [x] G1.1 [codex:terra] schema + validator | depends: — | q:0 i:1 tier:terra effort:high sandbox:danger-full-access | evidence: test/telemetry.out
- [x] G1.2 [codex:luna→terra] ledger parser | depends: G1.1 | q:0 i:0 tier:terra effort:high sandbox:danger-full-access | evidence: test/ledger.diff.out
- [x] G1.3 [codex:luna→terra] hooklog parser | depends: G1.1 | q:0 i:0 tier:terra effort:high sandbox:danger-full-access | evidence: test/hooklog.out
- [x] G1.4 [codex:terra] aggregator | depends: G1.2, G1.3 | q:0 i:0 tier:terra effort:high sandbox:danger-full-access | evidence: test/report.out
- [x] G1.5 [codex:luna→terra] cost proxy | depends: G1.4 | q:0 i:0 tier:terra effort:high sandbox:danger-full-access | evidence: test/cost.out
- [x] G1.6 [codex:luna→terra] fixtures | depends: G1.1 | q:0 i:0 tier:terra effort:high sandbox:danger-full-access | evidence: test/fixtures/
- [x] G1.8 [codex:terra] risk burn-down | depends: G1.2, G1.3 | q:0 i:0 tier:terra effort:high sandbox:danger-full-access | evidence: test/robustness.out
- [ ] G1.9 integration verification + review GO (adversarial-review) | depends: G1.1..G1.8 | verdict:
- [ ] G1.10 meta-goal: generate Stage 2 detail (goals + DoDs) from the ledger's actual state | depends: G1.9 | output:
- [ ] G1.9.5 transition review (independent) | depends: G1.10 | conclusion:

## Prose lines that must NOT be parsed as goals (H-05 no-fabrication)
- Generate [claude:opus] the Stage 2 detail from actual state
- Gate at each boundary before advancing to the next stage
- Grep the telemetry code for secret/env access before closing
