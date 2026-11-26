# ComfyUI MiniMaxH3Easy Node Adapter

This project does not call the official MiniMax API directly. It runs Ref2VA through the local ComfyUI `MiniMaxH3Easy` node (`mode=reference`, `reference_mention_mode=index`). Two adaptations are required.

## 1. Reference tags: official → node placeholders

The official six-section format uses `<Subject N>` / `<Picture N>` / `<Audio N>` / `<Video N>`. This node recognizes only flat `__MINIMAX_H3_REF_N__` placeholders (`N` starts at 1).

`N` follows the upload order of `assembleShotReferences`: character images, scene images, prop images (in the shot's reference order), then `voice_ref` audio for **characters with spoken lines** (≤3 audio segments per shot). Therefore:

- First reference image → `__MINIMAX_H3_REF_1__`, second → `__MINIMAX_H3_REF_2__`, and so on.
- Voice audio follows the images, for example `__MINIMAX_H3_REF_3__` after two images. No audio tag for silent characters.

**Never mix formats:** once `__MINIMAX_H3_REF_N__` is used, do not use `<Picture N>` / `<Subject N>` / `<Audio N>` in the same prompt.

## 2. Six-section → flat prompt

The node's `prompt` field accepts **one flat English prompt**, not six JSON sections or multiple headings. Compress the official six sections into one paragraph:

1. Open by naming the references: `__MINIMAX_H3_REF_1__ is Lin Mo, __MINIMAX_H3_REF_2__ is the library, __MINIMAX_H3_REF_3__ is Lin Mo's voice.`
   **Identity only for characters:** the reference line states only "`__MINIMAX_H3_REF_N__` is [character name/identity]". Never copy age, facial features, face shape, hairstyle/hair colour, skin tone, build, outfit, shoes, accessories, material, pattern, or palette from upstream descriptions or `bible.md`. Scenes, props, and environments may be described normally. For cross-shot consistency write "match the appearance in `__MINIMAX_H3_REF_N__`" instead of restating appearance.
2. Describe the whole timeline (0–Ns): composition, subject positions and actions, environment and lighting, camera movement, and sound.
3. Dialogue: write what each speaker says in English inside quotation marks, carried by `voice_ref`, never as on-screen subtitles.
4. Close with quality and consistency constraints.

## 3. Hard constraints

- The entire prompt is English, including dialogue, lyrics, and any visible scene text.
- Duration matches the shot's `duration` (5–15 seconds).
- Be concrete and executable; avoid empty words such as "cinematic" or "beautiful".
- **No text, subtitles, watermarks, logos, slogans, or signatures in the frame.** Dialogue is voice only.
- Reference tag order matches actual references; no unused tags; only speaking characters get audio tags.
