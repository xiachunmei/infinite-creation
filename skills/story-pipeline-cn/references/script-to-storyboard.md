# Mode B · Script → Storyboard

Split an existing English script (mode A's `script.md` or a user-supplied `.md`/`.txt`) into a **shot list + character cards + English AI prompts**, producing a downstream-compatible `storyboard.json`. All output is English.

## Trigger

The user asks for a script storyboard, shot list, or shot breakdown, or provides a script with visualization intent. If no mode is specified, return to the `SKILL.md` menu.

## Input

- `script.md` or an existing script (`.md` / `.txt`).
- If no art style is provided, confirm `art_style_prefix` (for example `anime style, cel shading, vibrant colors`).

## Steps

### Step 1 · Parse script structure

- Split on `[SCENE NN]` / `INT.` / `EXT.` / `Scene N`; fall back to double blank lines.
- Tag each block: scene header / visual / dialogue / action / emotion note.
- Collect characters (dialogue speakers + names mentioned in visuals) and build a `Name → CHAR_xxx` map.

### Step 2 · Generate the shot list

Aggregate continuous story segments into long takes (5–15s, max 15s). Combine continuous action and connected dialogue in the same scene into one take, using `sub_shots` for beats. Change shots only on scene or time/space breaks. **At most 2 speakers per shot; scenes with ≥3 alternating speakers must be split into multiple shots.**

Choose shot size and camera using `style-guide.md`:

- Environment / wide description → `ELS` / `LS`
- Entrance / full body → `MLS` / `LS`
- Dialogue / exchange → `MCU` / `CU`
- Expression / eyes / detail → `CU` / `ECU`
- Interior / psychology → `ECU`
- Chase / action → `TRACKING` / `HANDHELD`

For each shot record: `S{scene}_{n}` ID, duration, shot size, camera move, English visual, character action, and dialogue/sound.

### Step 3 · Character cards

For each main character, write `characters/CHAR_xxx.md` following `templates/character-card-template.md`:

- Basic information (age / gender / identity / personality keywords).
- Appearance (hair / eyes / build / signature features).
- Wardrobe (everyday / combat).
- **Directly usable English image prompt** (front full-body sheet + expression/action variants).
- Representative English line.

### Step 4 · Prompt division of labor (critical)

Write two English prompts per shot using `style-guide.md`'s seven-part structure:

- `image_prompt`: art-style prefix + scene/environment + subject/character + static action/state + camera language + lighting + quality. **No motion**, and no visible text, subtitles, watermarks, or logos.
- `video_prompt`: **camera movement + character action only**, no repeated appearance (the first frame fixes appearance), and no visible text.

Example:

```text
image_prompt: "anime style, cel shading — dark factory interior, evening — young male, dark hoodie, flashlight — cautious scanning — tracking shot — dramatic lighting — high quality"
video_prompt: "slowly walking forward, looking around, tracking shot"
```

### Step 5 · Write and self-check

- Write `storyboard.md` (human-readable shot list + character/scene cards, all English).
- Write `storyboard.json` (see `output-schemas.md`; `art_style_prefix` filled, `characters` use `CHAR_xxx`, `reference_image` starts as `null`).
- Self-check: are `image_prompt`/`video_prompt` English? Is there any visible text? Are IDs and scene numbers consistent? Is duration 5–15s?

Show the shot list to the user for review (cheapest point to adjust before image generation).

## Output

- `outputs/<work>/storyboard.md`
- `outputs/<work>/storyboard.json` (downstream-compatible)
- `outputs/<work>/characters/CHAR_xxx.md`

## Handoff

`storyboard.json` can be passed directly to downstream image/video tools; see `references/workflow-chain.md`. This skill calls no APIs.
