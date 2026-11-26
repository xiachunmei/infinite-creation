---
name: story-pipeline-cn
description: English novel/script production pipeline: novel-to-script (premise mining → three-act structure → scene script), script-to-storyboard (shot list + character cards + AI image/video prompts), and novel-to-storyboard (one-pass character/scene/shot extraction with downstream-compatible JSON). Use when converting a novel into a script, splitting a script into shots, or generating character cards and English AI prompts. All creative outputs are English.
version: "2.0.0"
user-invocable: true
argument-hint: "[optional: novel/script path / mode A novel-to-script B script-to-storyboard C novel-to-storyboard]"
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Novel / Script / Storyboard Pipeline (story-pipeline-cn)

A modular single-package skill covering the full chain from **novel → script → storyboard**. `SKILL.md` is a thin router; step-by-step instructions live in `references/`, output templates in `templates/`, and batch scripts in `scripts/`. Read the corresponding mode file before executing.

**Language contract:** every creative artifact—scene headers, action, dialogue, character cards, scene cards, `image_prompt`, `video_prompt`, notes, and summaries—must be English. Source novels in other languages are adapted into English before downstream generation. JSON keys, file names, and tool names are fixed contracts and stay unchanged.

## Entry: mode menu (show on first activation)

If the user has not clearly specified a mode (no novel/script path and no explicit "script" / "storyboard" / "split shots" intent), **show the menu below and ask the user to choose**. Do not assume a mode. Prefer an interactive selector; otherwise list the options as text.

```text
Choose a mode (A–C):
A · Novel → Script — source mining → three-act structure → finished scene script (.md)
B · Script → Storyboard — existing script → shot list + character cards + AI prompts (.md/.json)
C · Novel → Storyboard — one-pass extraction of shots, character cards, and scene cards (file batch supported)
```

After selection, follow the corresponding `references/` entry.

## Three modes + one pipeline

| Mode | When to use | Entry |
|---|---|---|
| **A · Novel → Script** | A novel/source exists and must become a shootable literary script | `references/novel-to-script.md` |
| **B · Script → Storyboard** | An existing `.md`/`.txt` script needs shots, character cards, and AI prompts | `references/script-to-storyboard.md` |
| **C · Novel → Storyboard** | Skip the intermediate script and extract shots/character cards directly | `references/direct-storyboard.md` |

```text
A (Novel → Script) ──→ B (Script → Storyboard) ──→ [optional downstream image/video generation]
                       ▲
C (Novel → Storyboard) = A + B fast path, no intermediate script file
```

- Novel/source + wants a script → mode A.
- Existing script + wants shots → mode B.
- Novel + wants direct shots/character cards/image-model input → mode C.
- Any mode's `storyboard.json` can feed downstream image/video tools; see `references/workflow-chain.md`.

## Directory layout (thin router)

```text
SKILL.md                       # main control (this file)
requirements.txt               # merged dependencies (standard library only)
references/                    # mode instructions and specs
  workflow-chain.md            # chain overview and downstream bridge
  novel-to-script.md           # mode A
  script-to-storyboard.md      # mode B
  direct-storyboard.md         # mode C
  style-guide.md               # shared scene/shot/camera/prompt syntax
  output-schemas.md            # JSON/MD output contracts
  fault-handling.md            # fallbacks
templates/
  script-template.md
  storyboard-template.md
  character-card-template.md
scripts/
  extract_storyboard.py        # file mode: novel → storyboard JSON/MD
```

## Environment and conventions

- **Paths:** use absolute paths with `/`. `<skill_root>` is this skill directory.
- **Output location:** write artifacts under the user-specified project directory (default `<skill_root>/outputs/<work>/`); create directories first and keep intermediates.
- **English first:** all scene headers, dialogue, prompt drafts, cards, and summaries are English from the start. Never produce a Chinese draft that must be translated later.
- **Character consistency:** keep names unique and stable across the whole chain. Mode C builds a `Name → CHAR_xxx` map for downstream tools.
- **Gates:** modes A/B may show a fragment for user confirmation at key milestones; mode C defaults to one full pass, but long texts should be processed in segments by `scripts/extract_storyboard.py`.
- **Downstream bridge:** this skill only performs text → structured storyboard; it never calls image/video APIs.

## Triggers

- **Novel → script:** novel to script, adapt a novel, literary script, screenplay adaptation.
- **Script → storyboard:** script storyboard, shot list, shot script, split a script into shots.
- **Novel → storyboard:** novel storyboard, split shots, character card, scene card, AI image prompt.

## Quick reference

| Step | File | Purpose |
|---|---|---|
| Chain overview | `references/workflow-chain.md` | Mode linkage and downstream fields |
| A | `references/novel-to-script.md` + `templates/script-template.md` | Mining / three acts / script |
| B | `references/script-to-storyboard.md` + `templates/storyboard-template.md` + `templates/character-card-template.md` | Shots / cards / prompts |
| C | `references/direct-storyboard.md` + `scripts/extract_storyboard.py` | Direct extraction |
| Shared syntax | `references/style-guide.md` | Scene headers / shot sizes / cameras / prompts |
| Outputs | `references/output-schemas.md` | JSON/MD formats |
| Faults | `references/fault-handling.md` | Fallbacks |

## Agent checklist

```text
□ If the mode was unspecified, the A–C menu was shown and the user chose.
□ Modes A/B/C were not mixed.
□ A: premise/characters/conflict/theme mined; three-act structure; script-template followed.
□ B: scenes and characters parsed; shot list includes shot size/camera/duration; cards and English prompts produced.
□ C: pasted text or extract_storyboard.py produced storyboard.json and the CHAR_xxx map.
□ All creative content is English; no Chinese draft or translation step remains.
□ image_prompt/video_prompt are English and contain no visible text, subtitles, watermarks, or logos.
□ Artifacts were written to the project directory; intermediates were kept.
□ Downstream tools were not called by this skill.
```
