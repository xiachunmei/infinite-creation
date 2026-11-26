# Storyboard Contract (Multi-Segment Consistency)

This contract turns "hand-written H3 prompts" into "data contract → deterministic compiled prompt". `storyboard.json` is the single source of truth and `scripts/compile_storyboard.py` is the compiler. **The contract only produces prompts; it never submits generation jobs.** Execution (ComfyUI / Hub runner, frame concatenation) is external.

> Runtime note: the in-app Agent has no shell tool and cannot run `python scripts/...`. Those scripts are optional manual/offline tools. Use domain tools (`set_storyboard` / `update_shot`) inside the app.

## 1. Why the contract exists

H3 cannot generate long video in one pass; short segments are generated and concatenated using the previous segment's last frame as the next first frame. This creates three failure modes:

1. **Repeated prompts:** copying the previous prompt replays the same action.
2. **Blocking / identity drift:** FL2VA has no reference-image port; identity, position, and lighting must be restated in text.
3. **Scene / lighting jumps:** without a state ledger, continuity depends on human memory.

The contract + compiler turn these into deterministic checks.

## 2. File roles

| File | Role |
|---|---|
| `references/storyboard.schema.json` | Contract schema (field definitions, required fields, constraints) |
| `references/storyboard-from-novel.md` | Upstream: novel/script → contract |
| `references/manifest.example.json` | Asset index example: `@character` / `#scene` → view paths + metadata |
| `references/fallback-policy.md` | Runner interface contract: confirmation gates and fallback ladder |
| `storyboard.json` | One film's contract: characters / scenes / ordered shots |
| `manifest.json` | Asset index produced by `build_manifest.py` |
| `continuity-ledger.json` | Cross-shot state ledger produced by the compiler |
| `segments.json` | Segment list produced by the compiler |
| `scripts/compile_storyboard.py` | Compiler kernel |
| `scripts/gen_storyboard_llm.py` | Upstream generator: novel text → storyboard.json |
| `scripts/build_manifest.py` | Asset index builder and validator |

**Language convention:** every field value is English—including `art_style_prefix`, `static_features`, `beats[].action`, `lighting_en`, `camera_move_en`, `title`, `cut_reason`, and `continuity_risk`. H3 consumes English text and the whole project produces English artifacts. `@`/`#` label prefixes and field names are fixed syntax and are not translated.

## 3. Segment types and splitting

- The **first generated segment** is determined by the first shot's `refs`:
  - `refs` non-empty → **Ref2VA** (reference images).
  - `refs` empty → **T2VA** (text-only test draft; production should add reference images).
- **All later segments are FL2VA** (`refs` empty): no reference-image port, only the previous last frame, so identity/blocking/lighting must be restated in `static_features` + `positions` + `lighting_en`.
- **Auto-split:** a `shot.duration` above `video.default_max_duration` (default 5.0s) is split into N subsegments that repeat the same prompt. The compiler emits `auto_split_repeats_action`. Shorten the duration or split the action if this is unintended.
- **D11:** production segments require either reference images or a first frame plus full text.

Ref2VA reference order = `refs` key order → `<Picture 1>`, `<Picture 2>`, …; character order (`positions` key order) → `<Subject 1>`, …; scenes follow.

## 4. Contract → H3 assembly map

| H3 section | Ref2VA | T2VA | FL2VA | Source |
|---|:---:|:---:|:---:|---|
| `subject_definitions` | ✅ | — | — | `characters` + `scenes` |
| `summary` | ✅ | — | — | `shot.shot_purpose` with `[reference generation]` |
| `retention_analysis` | ✅ | — | — | `retention_en` or `do_not_change` |
| `detailed_description` | ✅ | — | — | `art_style_prefix` + shot size/angle + blocking + `lighting_en` + camera + beats |
| `integrated_multimodal_description` | — | ✅ | ✅ | Same content without reference tags |
| `overall_soundscape` | ✅ | ✅ | ✅ | `shot.overall_soundscape` or aggregated beats |
| `non_diegetic_music` | ✅ | ✅ | ✅ | `shot.non_diegetic_music` or `N/A` |
| Retain/avoid line | ✅ | ✅ | ✅ | Reference sheets never appear in output; no subtitles/logos |

## 5. Compiler-enforced prompt rules

1. **Zero pronoun:** no context-dependent phrases such as "previous shot", "continue", "same as above", "as before", "keep unchanged". Cross-shot state is always a full physical description.
2. **World position × screen position:** every shot states `world_pos` + `axis_en` + `positions[].screen_pos/facing/view_target`.
3. **No duplicated action:** normalized `beats[].action` must differ across shots unless `allow_repeat: true`; identity/blocking/lighting restatement is required and is not duplication.
4. **Duration budget:** `beats[].time` (`"start-end s"`) must cover `[0, duration]` contiguously.
5. **Field completeness:** `positions`, `world_pos`, `axis_en`, `lighting_en`, `first_frame_hard`, and eyelines are mandatory; `lighting_en` must appear in the prompt.
6. **Executable camera:** `camera_move_en` states start, end/target, follow target, and stopping reason.
7. **Camera-language repetition (soft):** ≥3 consecutive shots with the same size/angle/static camera trigger `shot_language_repeat`.
8. **Fidelity lock:** each beat's `source` is `original`, `added`, or `tbd`; `added` allows only performance/staging detail, never new plot events.

Any `error` fails compilation. `info` does not.

## 6. Usage

```bash
python scripts/gen_storyboard_llm.py --novel-file novel.md --out storyboard.json
python scripts/compile_storyboard.py --storyboard-file storyboard.json --check
python scripts/compile_storyboard.py --storyboard-file storyboard.json --dry-run
python scripts/compile_storyboard.py --storyboard-file storyboard.json --out segments/
python scripts/compile_storyboard.py --storyboard-file storyboard.json --json
python scripts/compile_storyboard.py --storyboard-file storyboard.json --check --strict-fidelity
python scripts/build_manifest.py --storyboard storyboard.json --out manifest.json
python scripts/build_manifest.py --assets-dir assets --out manifest.json
python scripts/compile_storyboard.py --storyboard-file storyboard.json --manifest manifest.json --out segments/
python scripts/compile_storyboard.py --prompt-file prompt.txt --check
```

Common flags: `--max-duration`, `--ref-root`, `--manifest`, `--strict-refs`, `--strict-fidelity`.
