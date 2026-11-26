# Shared Syntax and Specs (style-guide)

All three modes share this script/storyboard language. Read it before writing scripts, splitting shots, or writing prompts so downstream image/video tools can consume the result. All examples and outputs are English.

## 1. Scene header

```text
[SCENE 01] Outside · Abandoned Factory · Dusk
```

| Part | Form | Example |
|---|---|---|
| Scene marker | `[SCENE NN]` | `[SCENE 01]` |
| Location · sub-location | `Interior/Exterior · Specific place` | `Outside · Abandoned factory` |
| Time (optional) | `Dawn / Day / Dusk / Night` | `Dusk` |

`INT.` / `EXT.`, `Scene N`, and legacy Chinese markers are also parsed; scene header first, then double blank lines.

## 2. Shot size

| Code | Name | Framing | Use |
|---|---|---|---|
| `ECU` | Extreme close-up | Eye / lips / hand detail | Extreme emotion, key prop |
| `CU` | Close-up | Head to shoulders | Emotion, dialogue |
| `MCU` | Medium close-up | Head to chest | Conversation, reaction |
| `MS` | Medium shot | Head to waist | Action + dialogue |
| `MLS` | Medium long shot | Full body + a little environment | Full action |
| `LS` | Long shot | Full body + environment | Establish relationships |
| `ELS` | Extreme long shot | Wide scene, small figure | Establish setting, epic scale |
| `OTS` | Over the shoulder | Over one shoulder to another | Dialogue tension |
| `POV` | Point of view | What the character sees | Immersion |

## 3. Camera movement

| Code | Prompt keywords |
|---|---|
| `STATIC` | `static shot, fixed camera` |
| `PUSH IN` | `slow push in, camera moves forward` |
| `PULL OUT` | `pull back shot, camera pulls away` |
| `PAN L/R` | `pan left/right, horizontal sweep` |
| `TILT U/D` | `tilt up/down` |
| `TRACKING` | `tracking shot, following character` |
| `HANDHELD` | `handheld, shaky cam, documentary` |
| `CRANE UP` | `crane up, ascending aerial` |
| `ORBIT` | `orbit shot, 360 rotation` |

## 4. Mood → palette / lighting / sound

| Mood | Palette | Lighting | Sound |
|---|---|---|---|
| Tense | High-contrast cool blue-green | Low light, cool | Low-frequency alarm, quick heartbeat |
| Warm | Warm yellow-orange, low saturation | Warm orange backlight / natural | Soft piano, faint crowd murmur |
| Oppressive | Desaturated cool grey | Low light, cool | Silence, low strings |
| Fierce | Saturated red-orange | Harsh / chaotic | Percussion, impact bursts |
| Mysterious | Deep blue-purple dark | Low light, cool | Ambience, eerie reverb |
| Calm | Neutral natural colour | Natural, diffuse | Natural environmental sound |

## 5. Seven-part prompt structure (image/video models)

```text
[1. art style] + [2. scene/environment] + [3. subject/character] + [4. action/state] +
[5. camera language] + [6. lighting/mood] + [7. quality tags]
```

- **Art style:** from `art_style_prefix`, shared by every shot.
- **`image_prompt`:** parts 1–6 (static frame), no motion.
- **`video_prompt`:** part 5 (camera movement) + part 4 (character action) only; never repeat appearance.
- **Mandatory:** no text, subtitles, watermarks, logos, slogans, or signatures in the frame. Dialogue is carried by voice only.

### Complete English example

```text
anime style, 2D animation, cel shading, vibrant colors —
dark abandoned factory interior, evening light through broken windows, dusty atmosphere —
young male character with light brown hair wearing dark hoodie, holding flashlight, full body —
slowly walking forward scanning walls, cautious expression —
tracking shot following character —
dramatic chiaroscuro lighting —
high quality, smooth animation, fluid motion, 1280x720
```

## 6. Dialogue and emotion annotation

```text
LIN CHEN (slipping through the gate gap, wary): "Three times now. Each time I was almost too late."
[VISUAL: The flashlight sweeps the wall and stops on strange runes.]
[SFX: Wind, distant city noise fading out]
[EMOTION: shock→fear→resolve]
```

Parentheses are performance/action cues and do not enter visual descriptions. `[VISUAL: …]`, `[SFX: …]`, `[MUSIC: …]`, and `[EMOTION: A→B→C]` are structured annotations for shot splitting and expression design.

## 7. Duration reference (long-take mode)

One main take = one continuous story segment (continuous action + connected dialogue in the same scene), **5–15s (max 15s)**. Use `sub_shots` to carry multiple beats on a timeline.

| Beat type | Duration |
|---|---|
| Action / combat | 0.5–2s |
| Dialogue / exchange | 2–5s (merge multiple lines, never one shot per line) |
| Emotional close-up | 2–4s |
| Environment establishment | 3–8s |
| Transition / interlude | 1–3s |

Sub-shot intervals must be contiguous and sum to the main shot's `duration` (≤15s). No one-line-per-shot or one-paragraph-per-shot fragmentation.
