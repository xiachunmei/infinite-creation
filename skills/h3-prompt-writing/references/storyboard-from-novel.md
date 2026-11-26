# Novel → Storyboard Contract (Upstream of the Compiler)

`compile_storyboard.py` compiles **storyboard.json** into H3 prompts. This document explains how to produce that `storyboard.json` from novel/script text. The source may be in any language; the resulting contract and all H3-bound values are English.

> Division of labor: **LLM writes, scripts gate.** The generator does not validate; it feeds compiler `error` messages back to the LLM until zero errors remain.

> Runtime note: the in-app Agent cannot run `python scripts/...`. Those scripts are manual/offline tools; use `set_storyboard` / `update_shot` inside the app.

## 1. Two paths to a contract

| Path | Use | Entry |
|---|---|---|
| **A · LLM draft (recommended)** | Novel/script text exists; need a compilable contract quickly | `scripts/gen_storyboard_llm.py` |
| **B · Manual / migration** | Fine control, or migrate an existing `prompt.txt` | Write `storyboard.json` per `references/storyboard.schema.json` |

Both produce the same format for `compile_storyboard.py`.

## 2. Path A: `gen_storyboard_llm.py`

Standard library only (`urllib`), compatible with any OpenAI-style endpoint. Environment variables: `H3_LLM_BASE_URL` / `H3_LLM_MODEL` / `H3_LLM_API_KEY`.

```bash
python scripts/gen_storyboard_llm.py --novel-file novel.md --out storyboard.json
python scripts/gen_storyboard_llm.py --novel-file novel.md --out storyboard.json --dump-prompt
python scripts/gen_storyboard_llm.py --novel-file novel.md --out storyboard.json \
    --base-url https://api.example.com/v1 --model some-model --api-key sk-xxx
python scripts/compile_storyboard.py --storyboard-file storyboard.json --out segments/
```

Common flags: `--shots-hint N`, `--target-total S`, `--seg-max S`, `--art-style "..."`, `--example-file PATH`, `--attempts N`, `--think`, `--json-mode`, `--no-gate`, `--keep-raw DIR`.

### Generate-gate loop

```text
Novel text → LLM (contract rules + schema + example) → JSON
                    ▲                                  │
                    │                          structure check
                    └── error list fed back ──── compile_storyboard.py --json
                                                       │
                                                  error=0 → write file
```

Up to `--attempts` retries; if still failing, write the best draft and exit 1 for human revision.

## 3. Contract rules enforced on the model

1. Output exactly one JSON object; no fences or prose.
2. **Every value is English**, including `title`, `cut_reason`, and `continuity_risk`.
3. **Characters:** key `"@" + English character name`; `name_en`, `static_features`, `dynamic_features`, `do_not_change`, `ref_role` (`identity`), `retention_en`. No `ref_front` until real assets exist.
4. **Scenes:** key `"#" + English scene name`; `name_en`, `static_features`, `slugline` (`EXT./INT. LOCATION - TIME`), `anchors`, `shared_by`, `ref_role` (`space`), `ref_wide: null`.
5. **Shots:** `id` (`S01_01`), `scene`, `duration` ≤ `--seg-max`, shot size/angle/camera, `world_pos`, `axis_en`, `positions`, `lighting_en`, contiguous `beats[].time`, `source` (`original`/`added`/`tbd`), `first_frame_hard`, `last_frame_hard`, `overall_soundscape`, `non_diegetic_music`, `shot_purpose`.
6. **Zero pronoun:** no "previous shot", "continue", "same as above", "as before", "keep unchanged", or English equivalents.
7. **No duplicated action:** every shot advances the story with a different visible action.
8. **Fidelity lock:** only events present in the source; `added` is performance/staging only.
9. **Restrained and non-sexual:** no nudity, undressing, or sexualized content; quiet suspense only at sensitive endings.
10. **English dialogue:** spoken lines from the source are translated into English verbatim in meaning, using `<d>…</d>` with stable speaker IDs. Do not leave Chinese or other source-language dialogue in the contract.

## 4. No assets vs assets

| First shot `refs` | First segment | Note |
|---|---|---|
| `{}` | **T2VA** | Text-only test draft |
| non-empty | **Ref2VA** | Production path with reference images |

Later segments are always **FL2VA** (previous last frame + restated text).

## 5. Self-check

- [ ] `python scripts/compile_storyboard.py --storyboard-file storyboard.json --check` → `error=0`
- [ ] Every `duration` ≤ segment limit; `beats` cover `[0, duration]`
- [ ] `positions` / `world_pos` / `axis_en` / `lighting_en` / `first_frame_hard` present
- [ ] No duplicate `beats[].action`
- [ ] No banned zero-pronoun phrases
- [ ] All values, including dialogue, are English
- [ ] Plot contains only source events
