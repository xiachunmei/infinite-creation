---
name: image-prompt-writing
description: Write English prompts for Krea2 photoreal text-to-image (t2i) and Qwen-Image-Edit-2511 image-to-image (i2i). Use when generating character turnarounds, scene environment plates, or prop sheets for a comic-drama project, or when deriving consistent variants from a reference image. Outputs prompt and negative_prompt.
---

# Image Prompt Writing (Krea2 t2i / Qwen i2i)

Write asset-generation prompts exclusively in English. Text-to-image uses the Krea2 photoreal workflow (CLIPTextEncode); image-to-image uses Qwen-Image-Edit-2511 (reference image + instruction).

## Size and composition by asset type

- **Character → 16:9:** character sheet. Left third: head-and-shoulders close-up of the face (facial features, hairstyle, expression, temperament). Right two thirds: full-body front/side/back turnaround from head to toe, fully in frame and uncropped. The same character must have identical appearance, outfit, and palette across all views. Simple light background, horizontal layout.
- **Scene → 16:9:** environment mood, spatial perspective, lighting, and style; the whole frame must work as a background plate.
- **Prop → 1:1:** pure white background; only the prop itself, with shape, material, and details clearly visible. Real text belonging to the prop (signage, book title, packaging label, screen copy, brand/logo) must be kept and written in English with its placement.

## Prompt rules

1. Prefer structured description over narrative prose: subject → environment/background → lighting/material/palette/camera angle; 1–3 sentences, about 80–150 words.
2. Lead with the subject's core features, then environment, then details (material, light, palette, viewpoint).
3. State the camera view explicitly (close-up / medium / wide, front / side / back, eye-level / high / low).
4. Keep style consistent with the project's `style.md`.
5. **Allowed real text:** signage, book covers, packaging labels, on-screen copy, and prop brand names/logos may appear, and their English content and position must be written explicitly. No unrelated subtitle bars, watermarks, signatures, or gibberish.

## Negative prompt rules

General exclusions: `blurry, low quality, pixelated, distorted, watermark, oversaturated, artificial, plastic-looking`.

Characters additionally: `extra fingers, deformed hands, mutated hands, fused fingers, plastic skin, over-smoothed`.

Do not exclude `text, letters, words, logo, signature`; doing so erases legitimate packaging, book-cover, and signage text.

## Output

For each asset return `{"prompt":"...","negative_prompt":"..."}`. Both strings must be English, clear, specific, and directly executable by the model.

## Tool usage

Write the result with `update_asset(id, {prompt, negative_prompt})`, then submit with `generate_asset_image(asset_id)` or `generate_assets_batch` (prefer batch to avoid model reloads). Use `edit_asset_image(asset_id, prompt, reference_asset_id)` for i2i variants and `change_outfit(character_id, outfit)` for wardrobe assets. If the model supports image input, call `view_asset(asset_id)` before writing prompts and base them on the real reference image.
