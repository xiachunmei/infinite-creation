# Mode C · Novel → Storyboard (Fast Path)

Skip the intermediate script file and extract a novel directly into a **shot script + character feature cards + scene feature cards**, producing a downstream-compatible `storyboard.json`. Use for fast shot lists, image-model input, and batch files. All output is English.

Mode C = mode A's script structure + mode B's shot extraction in one pass, without writing `script.md`.

## Trigger

The user asks for novel storyboard, shot breakdown, character/scene cards, or AI image prompts, or supplies a novel file with direct extraction intent. If no mode is specified, return to the `SKILL.md` menu.

## Two usages

### Usage 1 · Pasted text (direct chat output)

Output structured content in English:

- Summary (total shots / scenes / characters).
- Shot script per shot: shot size, visual, characters, camera, lighting, palette, sound, dialogue.
- Character cards: appearances, personality, representative lines, English image prompt.
- Scene cards: location/time/mood/palette/lighting/English scene prompt.

Write `storyboard.md` + `storyboard.json` if files are required.

### Usage 2 · File batch (script)

```bash
python "<skill_root>/scripts/extract_storyboard.py" "C:/path/to/novel.txt" -o "outputs/work" -f both
python "<skill_root>/scripts/extract_storyboard.py" "C:/path/to/novel.txt" -f json
```

The script handles multi-encoding read → paragraph segmentation/tagging → scene grouping → character extraction (`CHAR_xxx` map) → shot generation → cards → English `storyboard.md` + `storyboard.json`.

## Logic aligned with the script

1. **Read & clean:** detect `utf-8/utf-8-sig/gbk/gb2312/big5`.
2. **Segment & tag:** scene header / chapter / dialogue / action / narration.
3. **Group scenes:** by header or double blank lines; infer location type, time, and mood from English keywords.
4. **Extract characters:** dialogue speakers + appearance/personality regexes; count appearances; build `CHAR_xxx` map.
5. **Generate shots:** aggregate continuous segments into 2–15s takes (max 15s); never pad short lines into long shots. Combine continuous action + connected dialogue into one take; split only on scene/time/emotion breaks. At most 2 speakers per shot. Infer shot size; add camera/lighting/palette/sound from `style-guide.md`. Duration ≈ dialogue word count ÷ 2.5 + 1–3s action/emotion buffer, clamped to 2–15s; keep each shot's dialogue within a realistic speaking rate or split/compress it.
6. **Cards:** include English AI image prompts; no Chinese draft is produced.
7. **Write and summarize:** write `storyboard.md` + `storyboard.json`, print statistics.

## Output content

### Shot script (per shot)

Shot ID / scene / shot size / visual / characters / wardrobe / camera move / lighting / palette / sound/music / dialogue / action cue. English dialogue uses `Character: line`.

### Character card (per character)

Total appearances / dialogue lines / shots on screen / appearance / personality / representative line / English image prompt.

### Scene card (per scene)

Location type / time / mood / palette / lighting / sound / characters present / English scene prompt.

## Text format for best results

```text
[SCENE 01] Outside · Old Street · Dusk
Few pedestrians on the street; the orange sunset stretches shadows long.
LIN MO (standing at the crossroads, looking into the distance): I know you've been here all along.
A JIU (stepping out of the shadows, low voice): You finally came.
```

Pure novel narration also works (double blank lines split paragraphs; character names are inferred from context and may be incomplete).

## Notes

- Both English `INT./EXT.` and legacy Chinese scene markers are accepted by the script for backward compatibility, but all **outputs** are English.
- Dialogue recognition depends on `Character: line`; irregular formats may miss speakers (see `fault-handling.md`).
- Keyword-based feature extraction is heuristic; supplement subtle descriptions manually.
- **Wardrobe:** mark shots after a real change event (bath/shower/change clothes/fresh clothes) with the new costume name in the corresponding `costumes` field; do not mark earlier shots.
- `image_prompt`/`video_prompt` in `storyboard.json` are English only.

## Handoff

- Adjacent shots must connect: same-scene continuous shots keep position/facing/action direction/lighting/palette consistent; write the handoff from the previous closing frame.
- Shot duration must match content rhythm; never stretch a short line to 10 seconds.
- `storyboard.json` can be passed directly to downstream image/video tools (`references/workflow-chain.md`).
