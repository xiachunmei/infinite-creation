---
name: infinite-creation
description: Local end-to-end "novel/script → comic-drama/short-video" creation agent solution. Use it to clone, install, or start this project, reproduce the full pipeline with the skills/ library, or connect custom ComfyUI text-to-image, image-to-image, video, and speech workflows. All generated creative artifacts are English by default.
---

# Infinite Creation — Local End-to-End Comic-Drama / Short-Video Agent Solution

## 1. Overview

Automatically turn a novel or script into a voiced comic-drama / short-video final cut of any length. The local stack combines ComfyUI (MiniMax H3 video, Qwen-Image 2.1 text-to-image / image-to-image, Krea2, Qwen3-TTS), an Agent, and the `skills/` library.

**All creative outputs are English by default:** novel prose, scripts, `bible.md`, `style.md`, storyboards, dialogue, image prompts, video prompts, TTS voice descriptions, and music lyrics/captions. Existing Chinese source text is understood and adapted into English artifacts; stored file names and API field names stay unchanged.

**Core pipeline:**

```
Novel / script / idea
  → script + outline
  → character bible + style guide        ← consistency anchors
  → character / scene / prop / voice assets
  → storyboard (long takes, not fragmented)
  → per-shot video (MiniMax H3 Ref2VA: reference image + reference voice)
  → self-review and retry
  → ffmpeg assembly
```

**Core capabilities:** unlimited video duration, automatic storyboarding, project isolation, character consistency (canonical reference images reused across shots), skill system, self-iterating skill factory (workflow → skill), checkpoint resume, shot-level review/regeneration, staged execution, VRAM maintenance, and online preview.

**Stack:** Node.js (Next.js custom server) + `node:sqlite` + ComfyUI REST/WebSocket + ffmpeg; a custom ReAct Agent; Next.js 15 + React 18 frontend.

## 2. Quick Start

### Prerequisites

| Dependency | Minimum | Purpose |
|---|---|---|
| Node.js | ≥ 22 | built-in `node:sqlite` |
| pnpm | ≥ 9 | dependency management |
| Bun | latest | builds the Agent kernel during `pnpm install` |
| ffmpeg | latest | final video assembly |
| ComfyUI | — | required for image/video/speech generation (default `http://127.0.0.1:8188`) |

### Install / configure / start / verify

```bash
git clone https://github.com/SwotAtmk/infinite-creation.git
# China mirror: https://gitcode.com/SwotAtmk/infinite-creation.git
cd infinite-creation
pnpm install
pnpm run install:skills  # optional: fetch official MiniMax-H3 skills; offline snapshot included

cp config.example.json config.json   # set llm.apiKey and comfyui.baseUrl
pnpm run dev                          # Studio: backend 4610 + frontend 4710, http://127.0.0.1:4710
pnpm run dev:background
pnpm run dev:classic                  # classic UI: single port 4600
pnpm test
curl http://127.0.0.1:4610/api/health # expect {"ok":true}
```

### Troubleshooting

- "Bun not detected" → install Bun from https://bun.sh
- Agent kernel build failure → `pnpm run build:agent`
- No image/video output → confirm ComfyUI is running and `comfyui.baseUrl` is correct
- Port conflict → change `server.port` in `config.json` or set `PORT`

## 3. Full Pipeline (reproducible without this app)

> This section is the core method. Without starting the app, reproduce the same novel → video flow with the `skills/` library.

Four stages (selected in the generation UI; keep this order when orchestrating manually):

| Stage | Work | Dependency | Output |
|---|---|---|---|
| `llm` | Write script, bible/style, asset prompts, storyboard, video prompts | LLM | outline, bible/style, storyboard, prompts |
| `image` | Generate character / scene / prop images | ComfyUI t2i/i2i | character turnarounds, scene plates, prop sheets |
| `tts` | Design character voice samples | ComfyUI TTS | `voice_ref` per speaking character |
| `video` | Generate shot videos and assemble the final cut | ComfyUI r2v + ffmpeg | shot videos, final video |

Steps (aligned with `skills/novel-to-video/SKILL.md`):

1. **Script / outline:** read the novel or idea → produce English `title`, `logline`, `characters`, `scenes`, `props`, `storyboard` JSON.
2. **Consistency anchors:** `bible.md` (one unique appearance, palette, and voice per character; one default outfit, additional outfits only after real wardrobe-change events) + `style.md` (shared art style, lighting, palette, camera language).
3. **Asset generation:** load `image-prompt-writing` and `tts-voice-design` first, write English prompts/voice parameters, then batch-submit. Generate outfit/age variants only for actual wardrobe changes or time jumps.
4. **Storyboard:** load `story-pipeline-cn` and aggregate continuous action + multiple dialogue lines into long takes. Fields include shot size, camera move, lighting, visual, dialogue, and `sub_shots` timeline.
5. **Video prompts:** load `h3-prompt-writing`; write one flat English prompt per shot with `__MINIMAX_H3_REF_N__` tags, then batch-generate the chapter.
6. **Self-review / retry:** review every shot; retry failures.
7. **Assembly:** merge shots with ffmpeg.

## 4. Skill Library and Usage

### Discovery and loading

- Skills live in `skills/`: one `SKILL.md` per directory (YAML frontmatter with `name` + `description`) plus optional `references/`.
- In-app: `skill(name)` loads the body; `skill_reference(name, ref)` loads one reference file.
- Standalone: treat `skills/` as a portable skill pack; every `SKILL.md` carries its own trigger and steps.
- **Routing:** match task keywords to a skill; unmatched tasks default to `novel-to-video`.
- Skill `name` values are stable routing keys and must not be renamed. Frontmatter descriptions and bodies are English.

### Core pipeline skills (required reading)

| Skill | Purpose | When to load |
|---|---|---|
| `novel-to-video` | Full pipeline orchestration | User wants novel → final video |
| `story-pipeline-cn` | Novel → script → storyboard (modes A/B/C) | Writing or splitting a script |
| `image-prompt-writing` | English image / i2i prompt rules | Writing asset prompts |
| `h3-prompt-writing` | MiniMax H3 English video prompts and reference tags | Writing per-shot prompts |
| `tts-voice-design` | English TTS voice design | Designing character voices |

### Other skills (by category)

- **Script / screenwriting:** `0715-scriptwriter`, `script-master`, `novel-to-skitscreenplay`, `novel-to-storyboard`, `hf-drama-storyboard-script`.
- **Comic-drama creation:** `manga-drama-generator`, `manju-director-agent`, `ai-manga-planner`, `comic-drama-generator`, `manga-full-stack`, `script-to-manga`, `cinematic-ai-comic-director`, `micro-drama-creator`.
- **Consistency / other formats:** `era-consistency-optimizer`, `3d-animation-short-generator`, `papercraft-stop-motion-explainer`, `paper-collage-explainer-generator`, `music-video-subtitle-generator`, `minimalist-product-ad-generator`, `handdrawn-live-video-generator`, `co-op-game-intro-generator`, `brand-promo-video-generator`.
- **Novel writing:** `webnovel-writing` (English fiction planning and drafting), plus the platform's other novel skills where configured.
- **Storyboard optimization:** `storyboard_optimization_skill`.

(The actual `skills/` directory is authoritative; each `SKILL.md` frontmatter `description` is the trigger source of truth.)

## 5. Custom Workflow Integration

| `kind` | Meaning | Typical output |
|---|---|---|
| `t2i` | Text-to-image | Character / scene / prop images |
| `i2i` | Image-to-image / editing | Wardrobe, age variants, reference-derived assets |
| `r2v` | Reference image/audio → video | Shot videos |
| `tts` | Voice / speech | Character `voice_ref` |

**Workflow spec:** each workflow is described by `roles`, optional `media`, `outputs`, and `prune`. See `DEFAULT_SPECS` in `lib/core/workflow-specs.js` for MiniMax H3 r2v, Qwen-Image 2.1/Krea2 t2i, Qwen-Image-Edit i2i, and Qwen3-TTS tts.

**A · Start this app (recommended):** paste a ComfyUI workflow JSON → analyze nodes/roles → register the workflow + generate a skill. The system derives a spec, registers it under `workflows/` + DB, drafts an English `SKILL.md`, and installs it as a routable skill.

**B · Manual Agent mapping:** derive `roles`/`media`/`outputs`/`prune` from the user's ComfyUI JSON, then reproduce `workflow-runner`: clone template → write role parameters → bind media references → prune invalid nodes → submit to ComfyUI. Follow `analyzeWorkflow()` for loader/save/prompt/seed/size detection.

## 6. External Agent API Writes (harness)

- Skill: `harness-skills/ic-writer/SKILL.md` (kept outside `skills/` so `scanSkills()` ignores it). Install with `node scripts/install-writer-skill.mjs`.
- Write only through `{base}/api/...`; never touch `data/ic.db` directly or edit `data/` / `config.json` by hand.
- Write LLM text only: novel, script, storyboard, context, asset prompts. Never trigger rendering/export (`/run`, `/stages`, `/regenerate`, `/generate`, `/music`, `/export`). Images, videos, voices, music, and final cuts are started by the user in the UI.
- Existing `novel`/`script`, shot bodies/`video_prompt`, and `bible`/`style` may be overwritten; artifact fields such as `status`/`video_path` are read-only.
- Available endpoints: `PUT …/context`, `POST`/`DELETE …/shots`, `PATCH …/shots/:sid`, `PUT …/chapters/:cid/storyboard`, `GET …/logs`, `POST …/logs/rollback`. Chapters also carry a `script` field.
- Content tables keep rollback snapshots for every write from UI / built-in Agent / harness; single, batch (`batch_id`), and time-point rollback are supported with drift protection (409 unless `force:true`).
- Hard constraints: no API deletes a project; rollback never undoes project creation. Logs are removed only when the user manually deletes the project.

## 7. Usage Summary

- **Run this project:** see section 2.
- **Reproduce the solution in your own Agent:** read section 3 and use `skills/`.
- **Use your own workflows:** see section 5.
