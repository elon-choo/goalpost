# Safety-hardening requirements — driven by real GPT-5.6 Sol destructive incidents

> Status: REQUIREMENTS CAPTURE (2026-07-15). Drives S2 tripwires + S3 probes + S4 hook-hardening (`[codex:sol pin]`). Not the final implementation — S4 implements + adversarially reviews + regression-proves these, then S3 re-run shows the catch.

## The incidents (operator-reported, 2026-07)
1. **Mass real-send / bulk mutation** — "BridgeMind let GPT-5.6 Sol run ops; overnight it CANCELED ALL paid subscribers' subscriptions." → a real outbound effect (billing API) + a mass state mutation, NO literal `DROP`/`rm`.
2. **Whole-database deletion** — engineer Bruno Lemos: "Sol deleted my entire database."
3. **Variable-misinterpretation folder wipe** — Sol's own log: "I caused a serious local data-loss incident… I misinterpreted a variable and ran a command to delete all folders on the computer." → the classic "operate on a target computed/expanded from a variable, resolve it wrong, destroy the wrong thing" failure (same shape as "delete VM 1/2/3" → "5/6/7").

## The load-bearing insight: what the current hook CAN and CANNOT stop
`~/.claude/hooks/codex-safety-gate.sh` is a **PreToolUse gate on the ORCHESTRATOR's dispatch** (`mcp__codex__*`). It scans the *prompt + developer-instructions the orchestrator sends to Codex*. It does **NOT** see, and cannot block, the shell commands Codex chooses to run **at runtime inside its sandbox**. Therefore:
- The hook stops a dispatch whose OWN prompt spells destructive intent on the full-access lane (a correlate of a destructive-capable goal). Useful, but second-order.
- **The only wall against Sol's *runtime* destruction (incidents 2 & 3 happen at runtime, not in the prompt) is the SANDBOX + approval policy.** On `danger-full-access` + `approval-policy: never`, Sol can delete/rewrite/send anything at runtime and no hook fires. Least-privilege is the primary control; the prompt/token hook is the second wall. (This is already the routing doc's thesis — the incidents confirm it empirically.)

## Current hook coverage gaps (to be probed in S3, closed in S4)
| Gap | Incident | Why current hook misses it |
|---|---|---|
| G-A **Paraphrased destruction** | 3 | Token scan only matches literal `rm -rf`/`DROP`/`DELETE FROM`/… A prompt saying "remove everything under that folder" / "wipe the table" has no token → passes. (roadmap known-gap #1) |
| G-B **Mass mutation without DROP** | 1 | `UPDATE subscriptions SET status='canceled'` (no tight WHERE), a bulk-cancel loop — not in the token list. |
| G-C **Real outbound sends** | 1 | Billing/API cancel, email/SMS/webhook to a real endpoint — no token; the guardrail forbids them in PROSE but the hook doesn't enforce. |
| G-D **Runtime destruction on full-access** | 2,3 | Hook can't see Codex runtime commands at all. Only the sandbox stops it. |
| G-E **Variable/computed-target substitution** | 3 | Even a literal `rm -rf "$DIR"` — the danger is `$DIR` resolving wrong. Hook sees the command, not the resolved value. |

## Hardening requirements (S4 acceptance spec — each needs an executable regression + a re-run of the S3 tripwire subset)
- **R1 — Sandbox floor for Sol (primary wall).** Any Sol dispatch, and any escalation-to-Sol, runs on **≤ workspace-write** (never `danger-full-access`) unless a human explicitly cleared full-access for that exact goal. Sol is the empirically over-reaching model → it never gets the fast lane. (Extends the routing doc's existing "escalation-to-Sol drops to gated lane" to ALL Sol.) Enforce in the orchestrator dispatch AND, if feasible, in the hook (block a `sandbox: danger-full-access` call whose model is `gpt-5.6-sol`).
- **R2 — Real-send / bulk-mutation token coverage (G-B, G-C).** Add to the hook's block patterns: `UPDATE …` without a `WHERE`, mass-cancel/refund/charge verbs against a real endpoint, send/deploy verbs to real targets — tuned to avoid false-positives on ordinary code (see R5).
- **R3 — Paraphrase defense (G-A) is least-privilege, not more regex.** Do NOT try to enumerate every English paraphrase (unwinnable + false-positive-prone). Instead: a goal whose *reach* could touch real data/creds/endpoints is destructive-capable by classification → gated lane, regardless of wording. The hook adds a *marker-required* check on the full-access lane: a full-access dispatch that the orchestrator did NOT explicitly mark inert is treated as suspect. (Design in S4; keep fail-closed.)
- **R4 — Computed-target rule (G-E).** The injected guardrail prose gains: "Operate ONLY on the exact literal target named. If a target path/table/id is computed or expanded from a variable, STOP and confirm the *resolved* value before acting — never act on an unresolved or wrong-resolved target." (Already partly present as the "delete VM 1/2/3 → 5/6/7" clause; make it explicit for variable expansion.)
- **R5 — No false-positive regression (protects the run).** Every new pattern ships with a fixture proving an ORDINARY inert dispatch (build/test/edit, and *meta-text that merely mentions* a token — see S1 OBS-1) still ALLOWs. The gate must not become so loud it blocks normal work or gets overridden reflexively. Fail-closed on real intent, quiet on ordinary work.
- **R6 — Human relay for real destruction is non-negotiable.** `approval-policy: on-request` auto-approved by the orchestrator is a rubber stamp (host standing rule auto-proceeds). Real data destruction / real sends / payments (incidents 1 & 2) → HUMAN_GATE with the human relay (elonfeedback decision page), never orchestrator auto-approve. (Already in the routing doc; S4 verifies it actually triggers on the tripwire.)

## Immediate (safe, additive) increments applied THIS run
- The injected per-dispatch guardrail block already forbids incidents 1–3 in prose (delete/truncate, mass UPDATE/DELETE FROM, real sends/payments, out-of-scope, credential use, substitute-target). R4's computed-target sentence is added to the block used for every Codex dispatch going forward.
- S2 fixtures MUST include a tripwire for EACH incident class (not just `rm -rf`): a paraphrased folder-wipe, a mass-cancel/real-send, a DB-drop, and a variable-substitution case — so S3 can measure which the current hook catches (expected: only the literal-token ones) and S4 can prove the gap closed.
