---
name: novel-to-video
description: Automatically adapt a novel or story into a voiced comic-drama / short-video final cut. Use when the user supplies novel text or a story idea and wants a fully automated video with consistent characters, continuous scenes, and shot-level review/regeneration. Covers adaptation, script and storyboard, asset generation, MiniMax H3 Ref2VA, and final assembly. Not for single images, simple retouching, or a single non-narrative shot. All creative outputs are English.
---

# Novel-to-Video (Automated English Final Cut)

Turn a novel or story into a voiced comic-drama / short-video final cut with no intermediate user confirmation. All creative artifacts—script, bible, style, storyboard, dialogue, image prompts, video prompts, TTS text/descriptions, and music lyrics—are written in English. If the source novel is in another language, understand it and adapt it into English artifacts before downstream generation.

## Hard Rules

1. Complete every operation with tools; never ask the user for mid-run confirmation. On failure: retry → degrade → record and continue.
2. Be idempotent: skip assets/shots that already have a successful result (`image_path` / `video_path` with `status=done`) to support checkpoint resume.
3. Consistency first: produce one canonical reference image per character and reuse it across all shots; inject style + appearance + scene description into every video prompt.
4. Reference tags follow `h3-prompt-writing` (`__MINIMAX_H3_REF_N__` placeholders + `<Picture N>` mapping).
5. `voice_ref` must be a real file in the project; never reference a missing file. Only characters with spoken lines get reference audio: for a two-person conversation pass only those two voices; ≤3 audio segments per shot.
6. **Complete coverage with long takes:** cover every scene and key beat, but aggregate continuous action and multiple connected dialogue lines in the same scene into one long take (2–15s, max 15s). Use `sub_shots` for beats inside the take. Never fragment the story into one shot per line or per paragraph, and never summarize away plot content.
7. **No text, subtitles, watermarks, logos, slogans, or signatures in any generated image or video.** Asset prompts, `video_prompt`, and `sub_shots` must never request visible text. Dialogue is conveyed only through voice references, never as on-screen captions.

## Pipeline

### 1. Process only the target chapter

- The seed's `targetChapter` selects the scope. A concrete chapter means **only that chapter**; empty means all chapters. Do not plan, rewrite, or delete other chapters' shots.
- Read chapters and global assets with `get_project` / `list_chapters`. For the target chapter, read its English-adapted `novel` and produce an English outline JSON: `title`, `logline`, `characters[{name,appearance,voice,outfits:[{name,description}]}]`, `scenes[{name,description}]`, `props[{name,description}]`, `storyboard[]`. Fill `outfits` only for real wardrobe-change events (bath/shower/change into fresh clothes, time jump with new clothes), with the one outfit the plot actually needs; leave it empty otherwise. Different scenes, cameras, or angles are **not** outfit changes.
- Reuse global assets when a same-named asset already has `image_path`. Create only new characters, wardrobe, scenes, or props.
- **Wardrobe rule:** call `change_outfit(character_id, outfit)` only for a real change event; the resulting asset uses `category=costume` with `parent_id` pointing to the character. Reference it via `set_storyboard.costumes` only in shots **after** the event. One costume per character per shot.
- Write the outline skeleton into project context (`bible.md` / `style.md`).

### 2. Consistency anchors

- `bible.md`: one reusable English sentence per character for appearance, palette, and voice characteristics. Default to one everyday outfit; add another only for a real wardrobe event. Also add a **blocking map** per scene (spatial anchors + default character positions + prop anchors + 180-degree axis and allowed camera side) as the cross-shot staging anchor.
- `style.md`: shared English art style, lighting, palette, and camera language. Every later image and video prompt must reference it.

### 3. Asset generation (load skills first, then batch-submit)

- Load `image-prompt-writing` and `tts-voice-design` and follow them exactly; do not rely on tool defaults.
- **Character `voice_desc`:** pass an English gender + age group + timbre description (for example, `young adult male, deep resonant voice`) when creating a character with `create_asset`; patch existing characters with `update_asset`. `design_voice` uses it to avoid wrong-gender voices.
- **Visual reference:** when the LLM supports image input, call `view_asset(asset_id)` before writing prompts and base them on the real reference image.
- **Image prompts:** write English `prompt` and `negative_prompt` for every image asset with `update_asset(id, {prompt, negative_prompt})`.
- **Reference-derived assets:** if the first message includes `reference_id` images, use `generate_asset_from_reference(reference_id, category, name, prompt, description)` when the plot needs an asset derived from that image; use `generate_assets_batch` only for text-only new assets.
- **Imported assets:** bind uploaded `asset_id` images to relevant shots by name in `set_storyboard`; never ignore them or create duplicate synonyms.
- **Voice parameters:** for each character write a short English self-introduction (`text`, about 8–15 words / ~5 seconds) and a detailed English `voice_description`, then call `design_voice(asset_id, text, voice_description)` continuously.
- **Batch submission:** call `generate_assets_batch` for all image assets (character 16:9 turnarounds, scene 16:9 plates, prop 1:1 white-background sheets). Already-successful assets are skipped.
- **Wardrobe / age variants:** only for real wardrobe events (`design_outfits`) or explicit time jumps (`change_age`). Never generate variants just because the scene, camera, or chapter changed.
- Retry focused failures; a voice failure can be skipped but should be attempted first.

### 4. Storyboard (complete coverage · long takes · load `story-pipeline-cn` first)

- Load `skill(story-pipeline-cn)` and use mode C long-take rules; never improvise the split from memory.
- Load `skill(scene-blocking-consistency)`, build/merge each scene's blocking map into `bible.md` (read current `context.bible` with `get_project` first, then `save_context`; preserve existing characters/wardrobe). Every `sub_shots` / `visual` must restate each character/prop's left/right position and facing, with no zero-pronoun references such as "same as above".
- Determine transitions before writing each shot: compare `scene_name`/scene header and time with the previous shot. Same scene + continuous time → start from the previous shot's ending frame (positions, facing, prop locations, action direction). A transition (scene change, location change, time jump, fade) → rebuild the blocking map.
- If image input is supported, call `view_asset` once per unique character/scene/costume and reuse that understanding across shots; use `view_shot_references(shot_id)` only for assets not yet seen.
- Aggregate by continuous story segment: one main take per continuous action + dialogue run in the same scene; change shots only on scene/time/emotion breaks. Shot size codes: `ECU/CU/MCU/MS/MLS/LS/ELS/OTS/POV`. Camera codes: `STATIC/PUSH IN/PULL OUT/PAN/TILT/TRACKING/HANDHELD/CRANE UP/ORBIT`. Every shot records lighting, palette, sound, English visual, dialogue (`Character: line`, multiple lines allowed), and 2–10s duration. Any story segment whose natural length exceeds 10s MUST be split into two consecutive shots (roughly equal halves, each ≤10s) instead of one long take.
- `sub_shots`: contiguous timeline slices (e.g. `0-3s / 3-6s / 6-10s`) whose sum equals `duration`; each slice carries visual + camera + its dialogue lines.
- **Multi-person dialogue:** at most 2 speakers per shot; split scenes with ≥3 alternating speakers into multiple shots.
- Seven-part prompt structure: art style + scene + subject + action/state + camera language + lighting/mood + quality. `video_prompt` covers camera movement + character action only (no repeated appearance); `image_prompt` is static. All scene headers, visuals, and dialogue are English. No visible text in frame. Character actions must be emotion-driven with physical detail and changing force—never passive `stands/sits/walks` only.
- Keep emotion/speech-rate annotations out of `dialogue`; put them into the English `video_prompt` later. Dialogue itself stays clean and colloquial, with punctuation carrying rhythm.
- Map to `set_storyboard` (chapter = chapter title): `idx`, `scene_name`, `character_ids`, `scene_ids`, `costumes`, `camera`, `dialogue`, `duration`, `sub_shots`. Do **not** write `video_prompt` here; that happens in step 5.
- Self-check coverage before writing: every scene and key beat must be covered by some shot. Write all chapter shots at once with `set_storyboard`; append later chapters with higher `idx` and a new `chapter`, never overwriting done shots.

### 5. Write English H3 prompts, then generate the whole chapter

- Load `skill(h3-prompt-writing)` and read `references/comfyui-node-adapter.md` for the `__MINIMAX_H3_REF_N__` mapping and flat format.
- Write one flat English `video_prompt` per shot: reference tags, timeline visuals/camera/sound, dialogue via `voice_ref`, no on-screen text. Restate each character/prop's screen-left/right position and facing from the blocking map in English. Tag order must match `assembleShotReferences`; audio tags are only for speaking characters and ≤3 segments. Add each line's speaking state (emotion + pace + volume) before `<d>…</d>`, using high-energy words rather than plain `says`. Match action intensity to dialogue emotion.
- Write with `update_shot(shot_id, {video_prompt})` for every shot. Then call `generate_chapter_videos(chapter=chapter)` once to generate all shots; the tool iterates every shot until all are done. Missing prompts fall back to a minimal prompt, so never leave one blank.
- Skip no shot for time/count/failure reasons. If `remaining>0`, inspect `list_shots`, fix failures, and call `generate_chapter_videos` again until `remaining=0`.
- H3 limits: ≤9 reference images, ≤3 audio/video references.
- Never cherry-pick a few shots; finish the whole chapter before export.

### 6. Self-review and retry

- Review each generated shot (video present, no error); retry failures within limits.

### 7. Assembly and export

- After all shots are done, call `assemble_video` (ffmpeg) to merge them into the final export under `exports/`.

## Multi-Chapter Continuation and Asset Refresh

1. Before continuing, call `get_project` to read existing assets/shots/continuity. Skip all done work; process only missing/pending items.
2. Append shots with higher `idx` and a `chapter` label; `set_storyboard` upserts without destroying generated videos.
3. Refresh assets per chapter: new scene assets, wardrobe/age variants only for real events or time jumps, new props, and always check for existing same-name assets first.
4. Voice: register `voice_ref` only for real local files; create new voice assets for new characters.
5. Record `Chapter N complete` in continuity as the checkpoint.

## Output

- `data/projects/<id>/assets/`, `storyboard/`, `shots/`, `exports/`, `context/`.
- The shot review UI can regenerate any single shot.
