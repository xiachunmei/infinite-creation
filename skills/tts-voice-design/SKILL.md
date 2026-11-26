---
name: tts-voice-design
description: Write English voice parameters for the Qwen3-TTS voice-design workflow. Use when designing a distinctive voice sample (`voice_ref`) for a comic-drama character, producing a short English `text` line and an English `voice_description`. Outputs text and voice_description.
---

# Voice Design (Qwen3-TTS)

Design one distinctive English voice sample per speaking character for later use as `voice_ref` in video generation.

## Inputs

- The character's `voice` entry in `bible.md` (English).
- The character's dialogue style in the chapter: age, gender, personality, and emotional baseline.

## Prerequisite: asset `voice_desc`

Before voice design, the character asset must carry an English `voice_desc`: gender + age group + timbre, for example `young adult male, deep resonant voice`.

- If `create_asset` was called without `voice_desc`, patch it with `update_asset(asset_id, { voice_desc })`. `design_voice` relies on it to avoid wrong-gender or wrong-age voices.
- `voice_desc` is not `description`: `description` is appearance for text-to-image; `voice_desc` is voice for TTS. Never mix them.

## `text` (narration sample · short self-introduction)

Write one colloquial English self-introduction of about **8–15 words (~5 seconds)** that fits the character's tone. Example: `Hi, I'm Sophie. I love quiet afternoons and warm light.`

Do not paste a long speech, plot summary, or description. Overlong text produces an overlong voice sample.

## `voice_description` (voice description · no length limit)

Describe the target voice in English in as much detail as needed: gender + age group + timbre (bright / deep / hoarse / clear / warm) + pace + emotional tone + accent/style. Example: `young adult male, deep and gentle voice, slow pace, calm bookish tone with a faint hint of amusement`.

## Output and tool usage

For each character return `{"text":"...","voice_description":"..."}`, then call `design_voice(asset_id, text, voice_description)` to generate the sample (stored as the project's `voice_ref`). Call `design_voice` for multiple characters consecutively to avoid reloading the image-generation workflow.

## Constraints

- Match the voice to the character's age, gender, and personality; differentiate characters clearly.
- `voice_description` must be English, concrete, and specific; avoid vague words such as "nice voice".
- **Always include gender and age group** (for example `young adult male`, `older woman`). Missing these makes TTS default to a young female voice.
