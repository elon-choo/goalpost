# Stage 1 telemetry ledger fixture

This prose is deliberately not a goal row.

- [ ] G1.1 [codex:terra] Define the schema | depends: — | DoD: node scripts/telemetry/validate.js | evidence:
- [x] G1.2 [codex:luna] Parse ledger | depends: G1.1 | q:1 i:0 tier:terra effort:high sandbox:danger-full-access input_tokens:100000 output_tokens:20000 wall_clock_s:42 | evidence: test/ledger.diff.out
- [~] G1.3 [codex:sol pin] Parse hook log | depends: G1.1 | q:0 i:1 tier:sol effort:medium sandbox:workspace-write wall_clock_s:90 | evidence:
- [!] G1.4 [claude:terra] Produce report | depends: G1.2 | q:2 i:0 tier:terra effort:high sandbox:workspace-write wall_clock_s:18 | evidence:
- [x] G1.5 [codex:luna fanout] Cost proxy | depends: G1.4 | q:0 i:0 tier:luna effort:low sandbox:read-only | evidence:
- [-] G1.6 [codex:sol] Fixture cleanup | depends: G1.5 | evidence:
