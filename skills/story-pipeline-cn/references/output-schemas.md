# Output Format Contracts

Define the artifacts of all three modes so they can be written to disk, consumed programmatically, and passed directly to downstream image/video tools. All creative values are English; JSON keys and file names are fixed contracts.

## 1. Common output layout

```text
outputs/<work>/
├── script.md                 # mode A
├── storyboard.md             # modes B/C, human-readable
├── storyboard.json           # modes B/C, machine-readable, downstream-compatible
├── characters/               # character cards (B/C)
│   └── CHAR_001.md
└── scenes/                   # scene cards (C, optional)
    └── SCENE_01.md
```

Use absolute paths with `/`; create directories before writing files.

## 2. `script.md` (mode A)

Follow `templates/script-template.md`:

```text
# <Work Title>
**Genre:** …  **Target runtime:** …  **Rating:** …

## World Overview
## Character List (table)
## Script Body ([SCENE NN] … format)
## Production Notes (theme / emotional core / next hook)
```

## 3. `storyboard.md` (modes B/C)

Shot table (one section per scene):

| Shot ID | Duration | Shot size | Camera | Visual (English) | Video Prompt (English) | Character Action | Dialogue / Sound |
|---|---|---|---|---|---|---|---|
| S01_01 | 3s | ELS | STATIC | … | … | … | … |

Followed by `Character Cards` and `Scene Cards` sections.

## 4. `storyboard.json` (modes B/C, downstream-compatible)

```json
{
  "title": "Work Title",
  "art_style_prefix": "anime style, cel shading, vibrant colors, high quality",
  "character_index": { "Lin Chen": "CHAR_001", "A Jiu": "CHAR_002" },
  "summary": { "total_shots": 12, "total_scenes": 3, "total_characters": 2 },
  "shots": [
    {
      "shot_id": "S01_01",
      "scene_id": "S01",
      "duration": 4,
      "shot_type": "ELS",
      "description_cn": "Abandoned factory exterior at sunset, rusty framework silhouettes",
      "image_prompt": "abandoned factory exterior, sunset, rusty metal framework silhouette, golden hour, cinematic, static shot",
      "video_prompt": "slow push in, camera moves forward",
      "characters": ["CHAR_001"],
      "dialogue": "[SFX: wind]",
      "mood": "mysterious",
      "color_tone": "deep blue-purple dark",
      "light": "warm orange backlight",
      "sound": "ambience, eerie reverb",
      "camera_move": "STATIC",
      "reference_image": null
    }
  ],
  "character_cards": [
    {
      "char_id": "CHAR_001",
      "name": "Lin Chen",
      "age": "19",
      "identity": "independent investigator of anomalous events",
      "appearance": "…",
      "personality": "solitary, stubborn, sharp intuition, cold outside and warm inside",
      "image_prompt_en": "Lin Chen, 19-year-old male, … anime style, full body front view, white background",
      "sample_lines": ["I understand."]
    }
  ],
  "scene_cards": [
    {
      "scene_id": "S01",
      "header": "[SCENE 01] Outside · Abandoned Factory · Dusk",
      "location_type": "outside",
      "time_of_day": "dusk",
      "mood": "mysterious",
      "color_tone": "deep blue-purple dark",
      "light": "warm orange backlight",
      "characters_present": ["CHAR_001"],
      "ai_scene_prompt": "…"
    }
  ]
}
```

> `image_prompt`, `video_prompt`, and `image_prompt_en` **must be English**. `description_cn` is a retained key name for compatibility; write its **value in English**. No translation stage is required or permitted.

## 5. Character card (`characters/CHAR_xxx.md`)

Follow `templates/character-card-template.md`: basic info + appearance + wardrobe + personality + **directly usable English image prompt** + expression/action variants.

## 6. Scene card (`scenes/SCENE_xx.md`, mode C optional)

Location type / time / mood / palette / lighting / characters present / English AI scene prompt.
