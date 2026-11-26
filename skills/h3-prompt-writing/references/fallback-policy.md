# Fallback Strategy and Stage Confirmation Gates

> This skill produces only portable segment artifacts (`compile_storyboard.py --out segments/` → `*.prompt.txt` + `segments.json`).
> Actual submission, retry, and fallback happen in an external runner (local ComfyUI: `comfyui-node-adapter.md`; or an H3 Hub tool).
> This document defines the confirmation gates and fallback ladder the runner must follow. All notes and user-facing messages produced by this flow are English.

## 1. Stage confirmation gates (`--confirm`)

From Phase 2 onward, any action consuming compute/credits advances in three stages: assets → sample → batch. Each stage pauses automatically, lists the manifest, and waits for a human `y`; `n` stops and returns to the previous stage.

| Stage | Required manifest | Example (chapter 01, 8 shots) |
|---|---|---|
| Assets | Character/scene views + manifest validation report (`build_manifest.py --check`) | 3 character views + 3 scene wide plates, validation passed |
| Sample | First segment (Ref2VA/T2VA) artifact + actual specs (resolution/duration/reference count/unit cost) | Segment 0, one mp4, ~5s, 2 refs |
| Batch | All segments (`segments.json`) + estimated total cost + actual specs | 8 segments × ~5s, including handoff strategy |

The gate only lists and waits; it never decides automatically. A rejection is recorded and returned to the human.

## 2. H3 generation failure ladder (shrink first, then ask)

Classify the failure first; the class determines whether automatic fallback is allowed.

| Class | Signal | Automatic action | Ask user |
|---|---|---|---|
| Transient | Timeout, rate limit, network jitter, retryable node error | Retry in place with same parameters ≤2 times, 3–10s backoff | No |
| Length | Repeated timeout/truncation/413; high `duration` in `segments.json` | **Shorten the segment**: split the shot duration (recompile via `--max-duration` or contract edit) and resubmit | Yes if shortening still fails |
| Content | Moderation rejection, explicit content error (wrong character/scene, visible text) | None. Never auto-rewrite plot, style, or reference images | **Yes** |
| Quality | Generated successfully but human review is unsatisfied | None (human review is final authority) | Yes, with resubmit parameters or a contract edit |

**Hard rules:**

- Automatic fallback is limited to retry and segment shortening; the boundary is *no plot-content change* (fidelity lock).
- Any "delete shot / change model / change style / switch to Seedance / change reference image" requires stopping and asking the user.
- If shortening causes repeated action, the compiler emits `auto_split_repeats_action` (warn); the runner forwards it unchanged.
- A question must state what was tried, the failure reason, and 2–3 candidate actions; never just ask "what now?"

## 3. Seedance interface (interface only, no implementation)

Seedance (or another alternate video model) exists only as a **replaceable backend** with the same interface as H3 for in-place switching:

```text
submit(segment: {prompt, duration, refs, voice_refs?}) -> job_id
poll(job_id) -> {status: queued|running|done|failed, urls?, error?}
```

The switch point is runner configuration (`backend: h3 | seedance`). Contract and prompt artifacts are never Seedance-specific. No Seedance dependency or call code is introduced.

## 4. Runner minimum interface

| Skill output | Runner consumption |
|---|---|
| `segments.json` | Batch submission list; stage-3 confirmation manifest |
| `*.prompt.txt` | `prompt` body for `submit` |
| `continuity-ledger.json` | Source of the previous segment's last frame for handoff (motion only; blocking rebuilt from the contract) |
| `--json` compile output / gate report | Pre-submit check: any `error` (exit 1) blocks submission; `tbd` items require human confirmation (`--strict-fidelity` can enforce) |
