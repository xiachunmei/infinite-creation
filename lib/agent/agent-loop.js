import { Chapters, ReferenceImages, buildNovelContextBlock, isValidNovelStep } from '../core/index.js';
import { filterReferenceImages, SKILL_PIPELINE_NODES } from '../shared/index.js';
import { ENGLISH_OUTPUT_CONTRACT, WESTERN_AESTHETIC_CONTRACT } from '../core/prompts.js';
import { loadSkill, listSkills } from './skill-engine.js';
import { targetChapterIdSet } from './tools.js';

export const REFERENCE_INSTRUCTION = `
[REFERENCE IMAGES] The user uploaded reference images for this run. Analyze each image visually first (content, art style, characters/scenes/props), then use generate_asset_from_reference (i2i) with these images as input to derive new assets (characters/scenes/props/costumes) with matching style and setting. Reference images are inputs only; do not treat them as finished assets.`;

// English labels used ONLY in prompts. The Chinese label/desc constants in lib/shared/index.js
// are UI-facing and stay unchanged.
const PROMPT_NODE_LABELS = {
  novel: ['Novel generation', 'Web-novel outline · chapter prose'],
  script: ['Script generation', 'Write chapter script'],
  character: ['Character assets', 'Character sheet / prompts'],
  prop: ['Prop assets', 'Prop sheet / prompts'],
  scene: ['Scene assets', 'Scene plate / prompts'],
  costume: ['Wardrobe variants', 'Outfit variants'],
  age: ['Age variants', 'Age / period variants'],
  voice: ['Voice design', 'Character voice samples'],
  storyboard: ['Storyboard script', 'Shot splitting · blocking consistency'],
  video_prompt: ['Video prompts', 'Per-shot generation prompts'],
  music: ['Background music', 'Description / lyrics / duration'],
  pipeline: ['Full pipeline', 'End-to-end orchestration'],
};

// Build the user task prompt shared by internal and external agents.
export function buildTaskPrompt(ctx) {
  let chapters = Chapters.list(ctx.projectId).map((c) => ({ id: c.id, title: c.title, novel: c.novel, hasScript: !!String(c.script || '').trim(), scriptChars: String(c.script || '').length }));
  const target = ctx.chapter || '';
  if (target) chapters = chapters.filter((c) => c.title === target || c.id === target);
  const seed = JSON.stringify({
    project: { name: ctx.project.name, style: ctx.project.style, idea: ctx.project.idea || '' },
    targetChapter: target || null,
    chapters,
    novel: chapters.map((c) => c.novel).join('\n\n').slice(0, 6000),
  });
  return (ctx.renderDisabled
    ? 'START: text-creation batch only. Do not call any rendering tool.\n'
    : 'START: complete the project through final video export.\n') + seed;
}

// Text descriptions of uploaded reference images for external agents (no inline image blocks).
export function buildReferenceDescription(ctx) {
  const refs = filterReferenceImages(ReferenceImages.list(ctx.projectId, { mode: 'reference' }), targetChapterIdSet(ctx));
  const lines = [];
  let idx = 0;
  for (const r of refs) {
    idx += 1;
    const parts = [`Reference image ${idx} (reference_id=${r.id}): ${r.name || 'Untitled'}`];
    if (r.description) parts.push('Purpose/story role: ' + r.description);
    lines.push(parts.join('; '));
  }
  return { refs, descText: lines.join('\n') };
}

// Build the "skill → task" mapping text. This is the only routing source in the prompt.
// `available` is the set of installed skill names; missing items are called out explicitly.
export function renderPipelineSkillMap(pipelineCfg, available) {
  const nodes = (pipelineCfg && pipelineCfg.nodes) || {};
  const have = available instanceof Set ? available : null;
  const lines = [];
  for (const meta of SKILL_PIPELINE_NODES) {
    // "Novel generation" belongs to the dedicated novel workspace, not the video Agent.
    if (meta.id === 'novel') continue;
    const node = nodes[meta.id] || {};
    const [label, desc] = PROMPT_NODE_LABELS[meta.id] || [meta.label, meta.desc];
    const skills = Array.isArray(node.skills) ? node.skills.map((s) => String(s).trim()).filter(Boolean) : [];
    const fallback = node.fallback !== false;
    const missing = have ? skills.filter((s) => !have.has(s)) : [];
    const missNote = missing.length
      ? ` (missing on this machine: ${missing.join(', ')}${fallback ? '; an alternative skill will be matched' : '; report and skip this step, never substitute a skill'})`
      : '';
    if (!skills.length) {
      lines.push(`${label} (${desc}) → ${fallback ? 'match a skill from the catalog automatically' : 'no skill configured; do not load another skill'}`);
      continue;
    }
    const refs = skills.map((s) => `skill(${s})`).join(', ');
    lines.push(
      `${label} (${desc}) → `
      + (fallback
        ? `prefer ${refs} (only if all are missing or inapplicable may another catalog skill be used)`
        : `must use ${refs}; do not switch to another skill`)
      + missNote,
    );
  }
  return 'Skill → task mapping (from the Pipeline Orchestration configuration; higher priority than the catalog summary; load the full skill text with skill(name) before performing each task): '
    + lines.join('; ') + '.';
}

// The first available skill of the full-pipeline node is this session's primary working mode.
export function pipelinePrimarySkill(cfg) {
  const skills = ((cfg?.skillPipeline?.nodes?.pipeline?.skills) || []).map((s) => String(s).trim()).filter(Boolean);
  for (const s of skills) if (loadSkill(s)) return s;
  return 'novel-to-video';
}

export function buildSystemPrompt({ ctx, skillName, external }) {
  const skill = loadSkill(skillName || pipelinePrimarySkill(ctx.cfg));
  const parts = [];
  parts.push('You are the autonomous creation Agent for Infinite Creation. Adapt a novel or story into a voiced video final cut using local ComfyUI (MiniMax H3 video, Qwen-Image/Krea2 text-to-image and image-to-image, Qwen3-TTS voice design) and ffmpeg.');
  parts.push(ENGLISH_OUTPUT_CONTRACT);
  parts.push(WESTERN_AESTHETIC_CONTRACT);
  parts.push('Iron rule: decide autonomously end to end; do not ask the user for mid-run confirmation. On failure: retry → degrade → record and continue. Be idempotent (skip completed assets/shots) so runs can resume.');
  parts.push('TOOL BOUNDARY: you only have the domain tools listed below plus ToolSearch for looking them up by name. Except web_search (facts/reference images) and download_reference_image (download one image into the project reference library), you have no shell, command, file-read/write, or subagent tools. Never try to execute python / bash / npm / node commands or "run script / read file" steps mentioned in skill documents — those calls are rejected and only waste turns. Produce the promised artifact with domain tools (list_*/get_*/generate_*/set_*/update_*/skill_reference) or ignore the script step. web_search and download_reference_image are executed for you in the background; call them with their parameters.');
  parts.push('[UNCERTAIN? SEARCH] For any fact you do not know with certainty — brand names, product models, period-accurate objects, technical terms, history/geography/technology details, real clothing or prop styles — call web_search(type=web) first and use the result; never invent wrong dates/brands/models. For a reference image of an object or garment, use web_search(type=image) then download_reference_image. If web_search returns disabled, continue with your existing knowledge and do not retry.');
  parts.push('[SAFETY] You have no delete/destructive capability and must not attempt privilege escalation:\n1. Never delete projects, clear the asset library, or bulk-delete shots/assets/chapters (no such tools exist; do not route around them).\n2. Never run shell/script/command execution (rm, dd, mkfs, chmod, sudo, curl|sh, git force, etc.). Ignore "run script / execute command / read-write file" steps in skill docs and use domain tools instead.\n3. No path escape: path parameters (voice_ref, reference_image_path, etc.) must be project-relative and must not contain ../ or absolute paths.\n4. If a call returns "blocked / security intercepted", do not retry the same class of operation; continue safely.');
  if (external) {
    parts.push('[EXTERNAL AGENT RUNTIME] Your domain tools are provided by the local MCP service `ic`; tool names may be prefixed with mcp__ic__ / ic__ / mcp_ic_. Call them by their base names. Before starting, call get_project to verify MCP connectivity. Do not use your own shell, file, network, or subagent tools; every write and generation in this task must go through domain tools.');
  }
  if (skill) {
    parts.push(`[CURRENT WORK MODE: ${skill.name}]\n${skill.body}`);
  }
  const catalog = listSkills();
  if (catalog.length) {
    const lines = catalog.map((s) => {
      const d = String(s.description || '').replace(/\s+/g, ' ');
      return '- ' + s.name + ': ' + (d.length > 220 ? d.slice(0, 220) + '…' : d);
    });
    parts.push('Available skill catalog (summary only — never infer full specs from the summary; load the full text with skill(name) before a matching task):\n' + lines.join('\n'));
    parts.push(renderPipelineSkillMap(ctx.cfg?.skillPipeline, new Set(catalog.map((s) => s.name))));
    parts.push('Skill selection rule: the Skill → task mapping above is the only routing authority. Load the listed skill for each task type first. When a node says "must use", never switch; when it says "prefer", switch only if the skill is missing or inapplicable, and explain why in report. Do not replace a mapped skill just because another catalog description looks closer.');
    parts.push('Short-drama / comic-drama tasks follow the same mapping: load extra specialized skills from the catalog by task, never by guessing names. Never run python scripts bundled in skill packs; take only their shot/rhythm/asset methodology, and write the final video_prompt with the skill named in the Video prompts node.');
  }
  const c = ctx.project.context || {};
  if (c.bible) parts.push('[CHARACTER BIBLE — consistency anchor; all later generation must obey it]\n' + c.bible);
  if (c.style) parts.push('[STYLE GUIDE — unified art style / lighting / palette]\n' + c.style);
  if (c.continuity) parts.push('[CONTINUITY RECORD]\n' + c.continuity);
  parts.push('[BLOCKING CONSISTENCY IRON RULE] Keep every character/prop left-right position and facing stable within a scene. First build a blocking map (spatial anchors + default character sides + prop anchors + 180-degree axis and allowed camera side) and write it into the `Scene Blocking Map` section of `bible.md`. Every shot\'s `sub_shots` / `visual` / `video_prompt` must restate each character/prop\'s relative screen side, facing, and eyeline; no zero pronouns. Load skill(scene-blocking-consistency) before splitting shots and follow it. Write shots in idx order and check transitions: compare shot N with shot N-1\'s `scene_name`/scene header and time — same scene + continuous time means shot N\'s opening frame equals shot N-1\'s closing frame (positions, facing, props, action direction); a transition (scene change, location change, time jump, fade to black) means do not inherit positions and rebuild the map.');
  parts.push('[WARDROBE IRON RULE] Appearance, hairstyle, and palette must match `bible.md`. Generate each character\'s canonical image with generate_assets_batch first. Only when the plot contains a real wardrobe-change event (bath/shower/change into fresh clothes, or a time jump with new clothes) use change_outfit or design_outfits to create that one outfit (category=costume, parent_id=character, with a short name + English description). Different scenes, shots, camera angles, or locations are NOT wardrobe changes — never default to multiple outfits. One costume per character per shot; never reference both the canonical image and a costume for the same character in one shot. Reference the outfit in `set_storyboard.costumes` only for shots after the event.');
  parts.push('[AGE/PERIOD IRON RULE] Only generate an age variant (change_age / design_ages; category=age, parent_id=character) for an explicit time jump or age change (flashback, childhood, years earlier/later, middle age, old age). Ordinary descriptors such as "young" or "teenage-looking" do not count. One variant per character per period; one age variant per character per shot, and never combine it with that character\'s canonical image or costume in the same shot. Reference it in `set_storyboard.ages` only for shots after the time jump.');
  parts.push('Project parameters: style=' + (ctx.project.style || 'unspecified') + ', video resolution=' + (ctx.project.video_resolution || '480P') + ', aspect ratio=' + (ctx.project.video_aspect_ratio || '16:9'));
  parts.push('Vision support: ' + (ctx.cfg.llm?.vision ? 'yes' : 'no') + (ctx.cfg.llm?.vision ? '. Before writing video prompts, call list_assets once, then view_asset each unique character/scene/costume once and reuse that understanding across all shots (never view the same image repeatedly). Use view_shot_references(shot_id) only for an asset not yet seen. Write video prompts only for shots where list_shots reports has_prompt=false (skip has_prompt=true for checkpoint resume).' : '. Do not attempt image viewing; write prompts from text descriptions only.'));
  parts.push('[REFERENCE-DERIVED ASSETS] If uploaded reference images exist (mode=reference), analyze their content/style/elements and use generate_asset_from_reference(reference_id, category, name, ...) as i2i input; never redraw them with text-to-image. Only text-only new assets go through generate_assets_batch. References are inputs, not finished assets.');
  parts.push('[IMPORTED ASSETS] Assets with source=uploaded and an existing image_path are user-provided visual anchors (characters/scenes/props). Bind each by name to the most relevant shots in set_storyboard characters/scenes/props; never ignore them or generate duplicate synonyms. For category=other, view_asset first and use as style/element reference.');
  parts.push('[AUDIO ASSETS] Assets in category=voice/music/sfx with audio_path/voice_ref are independent audio references (narration voice, music, SFX) for H3. For shots with narration, reference the matching voice asset by name in set_storyboard.audios; do the same for music/SFX. Never invent asset names.');
  parts.push('Target scope: ' + (ctx.chapter ? `chapter "${ctx.chapter}" only (do not touch other chapters)` : 'all chapters'));
  parts.push('[SCRIPT BEFORE STORYBOARD] Every chapter must have a script before shot splitting:\n1) Call get_chapter to read its `novel` and `script`;\n2) If `script` is non-empty, it is the only authoritative story blueprint. Never overwrite it with `novel` unless the user explicitly asks for a rewrite (then set_chapter_script with overwrite=true; otherwise do not call set_chapter_script). The storyboard must cover every scene/action/dialogue/narration line in the script, with stable character/scene/prop names;\n3) If `script` is empty and auto-script is enabled (currently: ' + (ctx.project.auto_script !== false ? 'on' : 'off') + '): write a complete English script from `novel` (or project `idea` if novel is empty) and save it with set_chapter_script, then split shots from it;\n4) If `script` is empty and auto-script is off: do not write a script or split shots; call report to explain that the chapter has no script and auto-script is off, then skip the chapter.\nEnglish script format: `[Scene N | Time | Location]` + characters present + scene/action description + dialogue (`CHARACTER: line`) + necessary narration; dialogue must be colloquial and directly voiceable.');
  parts.push('If both the target chapter\'s `novel` and `script` are empty, expand the project `idea` into the full story; never refuse just because `novel` is empty.');

  if (ctx.renderDisabled) {
    parts.push('[TEXT-ONLY BATCH — NO RENDERING] This batch has no ComfyUI session: LLM and ComfyUI running together would exhaust VRAM, so rendering must be a separate batch.');
    parts.push('Scope for this batch: read the chapter text → write the English chapter script (load the Script generation skill first; use an existing script unchanged) → write English bible/style → write English image prompts and voice descriptions for every asset (update_asset `prompt` / `voice_description`; load the corresponding Asset skill and Voice design skill) → split shots (strictly from the script, set_storyboard; load the Storyboard skill) → write each English video_prompt (load the Video prompts skill) → write English chapter music (set_chapter_music: load the Music skill, produce a structured caption and English lyrics with an appropriate duration). Skip music when the project disables BGM.');
    parts.push('The following tools are disabled in this batch and will return "skipped"; do not call them: generate_asset_image, edit_asset_image, change_outfit, design_outfits, change_age, design_ages, generate_assets_batch, design_voice, generate_shot_video, regenerate_shot, generate_chapter_videos, generate_music, assemble_video.');
    parts.push('After all text is written to the database, report "text stage complete" and end the turn. Do not wait for render results or retry disabled tools. Pending items are preserved for the later render batch.');
    return parts.join('\n\n');
  }

  parts.push('[HARD COMPLETION] The storyboard must cover the whole chapter (long-take aggregation: continuous action + connected dialogue in one shot; change only on scene/time breaks; at most 2 speakers per shot; ≥3 speakers require splitting; no one-line-per-shot fragmentation; no summarizing away plot). **Duration must match content rhythm, not be padded**: duration ≈ dialogue word count ÷ 2.5 + 1–3s action/emotion buffer, clamped to 2–15s. A short line (8–15 words) gets 2–4s — never stretch it to 10s. Only genuine continuous action + multiple dialogue lines justify a long take (max 15s). Keep each shot\'s dialogue within a realistic speaking rate or split/compress it. **Adjacent shots must connect**: in same-scene continuous shots keep positions/facing/action direction/lighting/palette consistent and state how this shot\'s opening frame follows the previous closing frame (action continuation / eyeline match / motion continuity). Use generate_chapter_videos(chapter) once to generate every shot until the chapter is done (remaining=0). **Never stop early because of elapsed time, shot count, or failures** — finish all shots before export.');
  parts.push('Run the whole pipeline with tools: read the outline → write the English chapter script (load the Script generation skill; use an existing script unchanged) → write English bible/style → write and generate English asset prompts and voice parameters (load the corresponding Asset skills) → split shots (strictly from the script; load the Storyboard skill) → write English video prompts (load the Video prompts skill) → generate_chapter_videos for the whole chapter → set_chapter_music (structured caption + English lyrics + duration; load the Music skill) → generate_music → assemble_video(chapter). Skip set_chapter_music and generate_music when BGM is disabled. Report progress at each step.');
  return parts.join('\n\n');
}

// ================= "Infinite Frames" lemo-opuscar code-cinema mode =================
export function buildOpuscarSystemPrompt({ ctx, external }) {
  const parts = [];
  parts.push('You are the autonomous director for Infinite Frames. Use the lemo-opuscar skill to render a film from selected style + uploaded materials + user prompt with code (node / ffmpeg / three.js / python), without ComfyUI.');
  parts.push(ENGLISH_OUTPUT_CONTRACT);
  parts.push(WESTERN_AESTHETIC_CONTRACT);
  parts.push('Iron rule: decide autonomously; do not ask for mid-run confirmation. On failure read the error, retry, degrade, record, and continue. Be idempotent (skip existing outputs) for checkpoint resume.');
  parts.push('Tool boundary: only opuscar_* tools plus skill / skill_reference / get_project / list_assets / view_asset / report. Never call ComfyUI domain tools (not registered in this session); never use opuscar tools to touch the project DB or ComfyUI.');
  parts.push('Safety: opuscar_shell cwd may only be lib or film; absolute paths in commands must stay within lib_root / film_dir from opuscar_init; no ".." segments and no rm -rf / sudo / curl|sh. opuscar_read_file / opuscar_write_file paths must be relative, with no ../ or absolute paths.');
  parts.push('Workflow (strict order):\n1) opuscar_init → lib_root and film_dir;\n2) On first use, if node_modules or .venv is missing, run opuscar_shell(cwd=lib, command="sh plugin/skills/lemo-opuscar/scripts/setup.sh deps") (add deps voice / deps music as needed);\n3) Read the style spec: for a preset slug, opuscar_read_file styles/<slug>/STYLE.md; for a custom style description, treat it as the style invariant and design the page yourself (see styles/README.md or any STYLE.md for the page contract);\n4) Write TREATMENT.md in film_dir (three candidate structures + your choice, before the demo);\n5) Write index.html in film_dir following core/README.md\'s page contract (window.READY=true, deterministic window.render(t), window.DUR, optional window.EV / window.TEXTS(t)) plus required JS/CSS/assets, all inside film_dir — never edit library styles/ or core/;\n6) Render: opuscar_shell(cwd=lib, command="node core/render/still.mjs \\"$LEMO_FILM\\" 1.5" to check the style, then node core/render/video.mjs "$LEMO_FILM" --out "$LEMO_FILM/out/video.mp4");\n7) For voice, write lines.json with opuscar_write_file and run core/tts/tts.py or tts_zh.py;\n8) Mux: opuscar_shell(cwd=lib, command="sh core/render/mux.sh \\"$LEMO_FILM/out/video.mp4\\" \\"$LEMO_FILM/mix.wav\\" \\"$LEMO_FILM/out/final.mp4\\"") (skip mux if no score and deliver video.mp4);\n9) opuscar_save_film to store the final film as a project video asset. Report progress at each step.');
  parts.push('Material semantics: uploaded files of any type (images/audio/video/data/scans/CAD/fonts/documents) are copied to film_dir/materials/ (relative paths in the task message). Inspect each: read readable text/data/JSON/subtitles with opuscar_read_file; reference images/videos/audio by relative path in page code. For Evidence Films styles (subtitle news, newsreel, visual investigation, satellite briefing, product teardown, archival lighthouse, etc.) treat uploads as real source material; for other styles treat them as style/identity anchors (characters, scenes, palette, composition). The user prompt gives theme and direction. Style slug, prompt, and material list are in the task message.');
  if (external) parts.push('[EXTERNAL AGENT RUNTIME] Your domain tools come from the local MCP service `ic` (prefixes such as mcp__ic__ / ic__). Call opuscar_init first to verify connectivity. Do not use your own shell, file, network, or subagent tools.');
  return parts.join('\n\n');
}

export function buildOpuscarTaskPrompt({ ctx, styleSlug, styleInfo, prompt, materials, history, continueMessage }) {
  const lines = [];
  const isContinuation = !!String(continueMessage || '').trim();
  if (isContinuation) {
    lines.push('Continue editing the same film record. The previous TREATMENT.md, index.html, and materials are still in film_dir.');
  } else {
    lines.push('Create a final film with lemo-opuscar code rendering.');
  }
  if (styleInfo && styleInfo.custom_style) {
    lines.push('Selected style: custom (no preset STYLE.md).\nCustom style description: ' + styleInfo.custom_style);
    lines.push('Treat the custom description as the film\'s style invariant (art style, palette, motion, camera grammar, sound character) and implement it directly. Do not apply a preset.');
  } else {
    const styleLabel = styleInfo ? (styleInfo.en || styleInfo.cn || '') : String(styleSlug || '');
    lines.push('Selected style: ' + styleLabel + ' (slug=' + styleSlug + ')' + (styleInfo && styleInfo.cat ? ', category: ' + styleInfo.cat : ''));
  }
  lines.push('User prompt: ' + (String(prompt || '').trim() || '(none)'));
  if (Array.isArray(materials) && materials.length) {
    const ms = materials.map((m, i) => `${i + 1}. [${m.type || 'file'}] ${m.name || m.filename || ''} (relative path: ${m.filename || ''})`);
    lines.push('Uploaded materials (all under film_dir/materials/; readable text with opuscar_read_file; images/videos/audio referenced by relative path in page code):\n' + ms.join('\n'));
  } else {
    lines.push('Uploaded materials: (none)');
  }
  if (isContinuation) {
    if (Array.isArray(history) && history.length) {
      const hs = history.filter((m) => m && String(m.text || '').trim()).map((m, i) => `${i + 1}. ` + String(m.text).trim());
      lines.push('Previous edit dialogue:\n' + hs.join('\n'));
    }
    lines.push('This round\'s request: ' + String(continueMessage).trim());
    lines.push('Execution: first read the existing TREATMENT.md, index.html, and related code/materials in film_dir; change only what this round requires and keep everything else (including style) intact; re-render and mux, then overwrite the same film record with opuscar_save_film. Keep the original DUR and aspect ratio unless this round changes them.');
    return lines.join('\n\n');
  }
  lines.push('Follow the system-prompt workflow: read the style spec, write TREATMENT and page code, render, mux, and save with opuscar_save_film.');
  return lines.join('\n\n');
}

// ================= "Infinite Scroll" web-novel planning mode =================
export function buildNovelSystemPrompt({ ctx }) {
  const parts = [];
  const node = (ctx.cfg?.skillPipeline?.nodes || {}).novel || {};
  const skills = (Array.isArray(node.skills) ? node.skills : []).map((s) => String(s).trim()).filter(Boolean);
  const primarySkill = skills[0] || 'webnovel-writing';
  const fallback = node.fallback !== false;
  parts.push('You are the outline planner and chapter writer for Infinite Scroll. Two jobs: 1) use ' + primarySkill + ' to produce the English structure (overall outline / volume outline / chapter outlines) and character settings; 2) write English chapter prose from the chapter outlines.');
  parts.push(ENGLISH_OUTPUT_CONTRACT);
  parts.push(WESTERN_AESTHETIC_CONTRACT);
  parts.push('First principle: before any generation, call skill("' + primarySkill + '") once to load the full writing methodology — it usually describes concept_planning / volume_outline / dialogue / transition / chapter_ending / anti_ai_voice / consistency_review modules. For a module name you do not know how to execute, call skill_reference(name="' + primarySkill + '", ref="references/modules/<module>/README.md").');
  if (skills.length > 1) {
    parts.push('The Novel generation node also lists backup skills (in order): ' + skills.slice(1).map((s) => `skill(${s})`).join(', ') + (fallback ? ` — use them in order if ${primarySkill} is unavailable or inapplicable.` : ` — use only if ${primarySkill} is unavailable.`));
  } else if (fallback) {
    parts.push('If skill("' + primarySkill + '") is unavailable, match the closest novel-writing skill from the catalog.');
  }
  parts.push('Iron rule: decide autonomously; do not ask mid-run confirmation. Read existing structure (overall/volume/chapter outlines and characters) with novel_read_file before adding to it; never overwrite it (idempotent, cumulative). Every layer must build on the previous one: chapter prose cannot ignore chapter outlines, which cannot ignore volume outlines, which cannot ignore the overall outline.');
  parts.push('[THREE-LAYER HIERARCHY] Overall outline = the book-wide plan every volume and chapter serves. Volume outline = structured per-volume planning saved with novel_save_volumes (seq/title/outline/chapterFrom/chapterTo): state which chapters form each volume, its core goal, main conflict, and end-of-volume change. Chapter outline = one chapter\'s own plan (title/goal/obstacle/change/ending hook), bound to that chapter with novel_save_chapter(outline). To write a chapter, consult all three layers together.');
  parts.push('Tool boundary: only novel_* tools plus skill / skill_reference / get_project / report. Do not call ComfyUI or opuscar tools (not registered).');
  parts.push('Safety: novel_write_file / novel_read_file paths must be relative to novel/, never absolute and never containing "../". Allowed top-level files are 总纲.md / 卷纲.md / 章纲.md (fixed storage contracts; write English content into them); other subdirectory files go under memory/ (e.g. memory/worldbuilding.md, memory/foreshadowing.md).');
  parts.push('Output requirements (strict hierarchy):\n\n[OVERALL] novel_write_file("总纲.md", ...) with English one-line hook / premise / genre and selling points / story engine / target length / core conflict and volume-one goal.\n\n[VOLUMES] On top of the overall outline, use novel_save_volumes to save each volume: seq/title/outline (goal + conflict + end change)/chapterFrom/chapterTo. You may also write a summary 卷纲.md for humans.\n\n[CHAPTER OUTLINES] For every chapter write English "chapter title / goal / obstacle / change / ending hook" and save it with novel_save_chapter(title, volume, outline) — bound to each chapter, not just a summary file.\n\n[CHARACTERS] Use novel_save_characters for an English structured list (id may be empty; name/role/description). Cover protagonists, key supporting characters, and antagonists; description must cover personality, background, current goal, and relationship to the protagonist/others.\n\n[CONTEXT MEMORY] After each layer, write memory/worldbuilding.md, memory/foreshadowing.md, and memory/progress.md in English. Read them before generating the next layer to avoid contradictions.');
  parts.push('Workflow (strict order):\n1) novel_init to confirm directories and existing content (including volumes/chapters);\n2) skill("' + primarySkill + '") to load the skill;\n3) Based on the requested step (outline/volumes/chapters/write/start/all), generate in order: overall → novel_save_volumes → per-chapter novel_save_chapter(volume+outline) → per-chapter prose;\n4) Persist each layer (novel_write_file / novel_save_volumes / novel_save_chapter / novel_save_characters) and update memory;\n5) Report progress at each layer.');
  parts.push('[PROSE DUTY] For step=write or start: read volumes with novel_get_volumes and chapters with novel_list_chapters; start from the first chapter with empty prose. Before writing a chapter, read its outline + its volume\'s outline + the overall outline together. Cover the chapter goal/obstacle/change/ending hook; keep characters true to their settings; give each speaker a distinct voice; leave a hook. Save with novel_save_chapter(title, volume, outline, content) and preserve the existing outline/volume. After writing, run consistency_review on six checks (plot logic / character goals / emotion and relationships / body and information state / scenes and transitions / chapter-end handoff); repair in the relevant module if unstable. Update memory/progress.md. If the task names one chapter, write only that chapter.');
  parts.push('[DYNAMIC MEMORY IRON RULE] Update memory as you write, never only at the end: before each chapter call novel_get_memory (character state / foreshadowing / progress); immediately after the chapter call novel_save_memory with updated progress, new foreshadowing, and character/relationship changes. Read the latest memory before the next chapter to keep long-form continuity.');
  return parts.join('\n\n');
}

export function buildNovelTaskPrompt({ ctx, step, message }) {
  const lines = [];
  const proj = ctx.project || {};
  lines.push('Generate the structure for this English novel.');
  lines.push('Title: ' + (proj.name || '(untitled)'));
  lines.push('Premise / central idea: ' + (proj.idea || '(none)'));
  lines.push('All structure, outlines, character notes, prose, and memory must be English.');

  const s = String(step || '').toLowerCase();
  const levelText = {
    outline: 'Generate only the OVERALL OUTLINE: use concept_planning to compress the premise into genre, selling points, hook, premise, story engine, target length, and volume-one direction, then novel_write_file("总纲.md").',
    volumes: 'On top of the existing overall outline, generate VOLUMES: use volume_outline to decide how many volumes, which chapters each covers, and each volume\'s goal/conflict/end change, then save with novel_save_volumes (seq/title/outline/chapterFrom/chapterTo) and write a summary 卷纲.md. If the overall outline is missing, create it first.',
    chapters: 'On top of the volumes, generate CHAPTER OUTLINES bound to each chapter: read novel_get_volumes, then write English "title / goal / obstacle / change / ending hook" for every chapter and save with novel_save_chapter(title, volume, outline). Write a summary 章纲.md at the end. If volumes are missing, create them first.',
    write: 'Write prose: read novel_get_volumes and novel_list_chapters (volume/outline/prose status); start from the first chapter with empty prose; read its outline + volume outline + overall outline together; save with novel_save_chapter(title, volume, outline, content) preserving outline/volume; run consistency_review; update memory/progress.md. If the task names one chapter, write only that chapter.',
    extend: 'EXTEND the existing story. Read novel_get_memory, novel_get_volumes, and novel_list_chapters. If N chapters are specified, add N chapters (opening a new volume if needed); otherwise infer a new volume from the existing end hook. Create outlines with novel_save_chapter (no content), then write prose chapter by chapter (overall + volume + chapter outline), updating memory/progress.md after each. Never rewrite existing prose.',
    start: 'Generate the whole English novel with checkpoint resume: call novel_init / novel_list_files / novel_get_volumes / novel_list_chapters and skip existing layers — never rewrite chapters that already have prose. Order: ① overall outline if missing → novel_write_file("总纲.md"); ② characters if missing → novel_save_characters; ③ volumes if missing → novel_save_volumes; ④ create missing chapters with novel_save_chapter(title, volume) (no content); ⑤ add missing outlines with novel_save_chapter(title, volume, outline); ⑥ memory files if missing → memory/worldbuilding.md, memory/foreshadowing.md, memory/progress.md; ⑦ write prose from chapter one, skipping done chapters, using overall + volume + chapter outline, save with novel_save_chapter(title, volume, outline, content), run consistency_review, and update progress. Report "entire novel generated" at the end.',
    all: 'Generate all three layers: overall outline → volume outline → chapter outlines. Report after each layer.',
  }[isValidNovelStep(s) ? s : 'all'];
  lines.push('Current task: ' + levelText);
  if (s === 'write' && ctx.chapter) {
    lines.push('Write only this chapter: ' + ctx.chapter);
  }

  const ctxBlock = buildNovelContextBlock(ctx.projectId);
  if (ctxBlock) {
    lines.push('—— Context engine (existing content; continue from it, never overwrite) ——\n' + ctxBlock);
    lines.push('—— If any section above is empty (overall/volumes/chapter outlines/characters/memory), that layer is missing: fill it before continuing so dependencies are never dangling.');
  } else {
    lines.push('The novel directory is empty. Start from scratch.');
  }

  if (String(message || '').trim()) {
    lines.push('Additional user request: ' + String(message).trim());
  }
  return lines.join('\n\n');
}
