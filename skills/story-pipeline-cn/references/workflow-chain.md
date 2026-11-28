# Workflow Chain and Downstream Bridge

This skill splits novel → script → storyboard into three independently callable, chainable modes. This document defines their contracts and how downstream image/video tools consume the result. Every creative value is English.

## 1. Mode contracts

| Mode | Input | Direct output | Downstream |
|---|---|---|---|
| A Novel → Script | Novel/source (pasted or file) | `script.md` (literary script) | → B |
| B Script → Storyboard | `script.md` or existing script | `storyboard.md` + `storyboard.json` + character cards | → image/video tools |
| C Novel → Storyboard | Novel (pasted or file) | `storyboard.md` + `storyboard.json` + character/scene cards | → image/video tools |

Mode C is equivalent to A's script structure plus B's shot extraction, completed in one pass without writing an intermediate script file.

## 2. Same-source consistency rules

1. **One stable character name:** use one name per character across the whole chain. Mode C generates `CHAR_xxx` IDs and a `Name → CHAR_xxx` map; `storyboard.json` uses `CHAR_xxx` in `characters`.
2. **Continuous scene numbering:** scenes start at `S01`; shots are `S01_01`, `S01_02`, … matching downstream `shot_id`.
3. **One art-style prefix:** set `art_style_prefix` once (for example `anime style, cel shading, vibrant colors`) and reuse it for every shot.
4. **Prompt division of labor:** `image_prompt` describes the static frame only (shot size + character + scene + lighting). `video_prompt` describes motion only (camera movement + character action). Video models derive appearance from the first frame, so never repeat appearance in `video_prompt`.

## 3. Downstream bridge

This skill **does not call image/video APIs**. It produces structured storyboards. Downstream tools consume `image_prompt` / `video_prompt`.

| story-pipeline-cn output | Downstream expectation | Note |
|---|---|---|
| `storyboard.json` | `storyboard.json` | File name and structure are reusable |
| `title` | `title` | English work title |
| `art_style_prefix` | `art_style_prefix` | Must be filled |
| `shots[].shot_id` (`S01_01`) | `shots[].shot_id` | Exact match |
| `shots[].duration` | `shots[].duration` | Seconds; 2–10s (>10s must be split into two shots) |
| `shots[].description_cn` | (no counterpart, human-readable) | **KEEP the key name** for compatibility but write its value in English |
| `shots[].image_prompt` | `image_prompt` | English only |
| `shots[].video_prompt` | `video_prompt` | English only, motion only |
| `shots[].characters` (`CHAR_xxx`) | `characters` | Exact match |
| `shots[].dialogue` | `dialogue` | English dialogue / sound cues |
| `shots[].reference_image` | `reference_image` | Starts as `null`; backfilled after image generation |

### Operation order

```text
1. This skill produces storyboard.json (CHAR_xxx / shot_id / duration / English prompts).
2. Downstream tool creates character cards and reference images under each CHAR_xxx directory.
3. Copy English character prompts into the downstream tool's character configuration.
4. Generate character sheets → storyboard frames (backfill reference_image) → video clips.
```

All prompt fields are English at the end of mode B/C; no translation stage is required.

## 4. Typical combinations

- **Careful adaptation:** A (iterate on the script) → B (split shots).
- **Fast image-model input:** C (one pass, file batch, one JSON).
- **Existing script:** B directly.
- **Fully automated novel → short:** C (`--format both`) → downstream image/video tools.
