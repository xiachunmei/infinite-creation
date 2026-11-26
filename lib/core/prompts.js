// English-output contract shared by all direct LLM prompt builders.
// Non-English source text is understood and adapted into English artifacts.
export const ENGLISH_OUTPUT_CONTRACT = [
  'LANGUAGE: Write every creative value in English — novel prose, scripts, story headers, action, dialogue, character bibles, style guides, storyboards, image prompts, video prompts, TTS text/descriptions, and music lyrics.',
  'If the supplied source text is in another language, translate and adapt its meaning into English before producing any artifact. Do not leave source-language dialogue or descriptions in the output.',
  'Keep proper nouns, character names, and place names stable; romanize them consistently when needed.',
  'Preserve the exact JSON keys, field names, and file names required by the caller. Only the values change to English.',
  'Never request visible text, subtitles, watermarks, logos, slogans, or signatures in generated images or videos. Dialogue is carried by voice only.',
].join('\n');

// —— Script generation ——
export function buildScriptMessages({ idea, novel, style }) {
  const source = novel?.trim()
    ? 'Novel text supplied by the user:\n' + novel.trim()
    : 'Story idea supplied by the user:\n' + (idea?.trim() || '(none)');
  const styleLine = style?.trim() ? `Visual style: ${style.trim()}. All visual elements (characters, scenes, props) must follow this style.` : '';
  const system = [
    'You are a professional comic-drama (motion comic / voiced comic) screenwriter and storyboard artist.',
    'Create a complete English script suitable for comic-drama production from the supplied novel text or story idea.',
    ENGLISH_OUTPUT_CONTRACT,
    styleLine,
    'Output only strictly valid JSON with exactly these keys (do not rename them):',
    JSON.stringify({
      title: 'Work Title',
      logline: 'One-sentence premise',
      characters: [{ name: 'Character Name', appearance: 'English visual description of appearance, wardrobe, and temperament for text-to-image', voice: 'English voice characteristic description for voice-reference' }],
      scenes: [{ name: 'Scene Name', description: 'English environment, lighting, and style description for text-to-image' }],
      props: [{ name: 'Prop Name', description: 'English appearance description for text-to-image' }],
      storyboard: [{ shot: 1, scenes: ['Scene Name'], duration: 12, characters: ['Character Name'], props: ['Prop Name'], sub_shots: '0-3s (close-up, short distance, frontal eye-level, static camera): English visual description; camera: static; background sound; dialogue: Character Name + English line. 3-7s (medium shot, frontal eye-level, tracking): English visual description; background sound; dialogue: Character Name + English line. 7-12s (wide shot, high angle, slow push in): English visual description; background sound; dialogue: Character Name + English line.' }],
    }, null, 2),
    'Requirements:',
    '- characters: 1–5 entries, each with appearance and voice;',
    '- scenes: 1–5 entries;',
    '- Each storyboard entry is one scene-level long take: merge continuous action/dialogue/blocking in the same scene into one take; duration 8–15s (max 15s); avoid 3–5s fragment cuts;',
    '- A main take may include multiple characters, 1–2 scenes, and several props (name arrays);',
    '- Use sub_shots for a contiguous timeline (e.g. 0-3s, 3-7s, 7-12s). Intervals must meet end-to-end and sum to duration. Each sub-shot states shot size/distance/angle/camera, visual, camera move, background sound, and dialogue (Character: line);',
    '- Dialogue must be colloquial, voice-ready English with no action annotations. Use punctuation (! ? …) and short breaks for rhythm; never write "angrily" or "speaks quickly" into the dialogue text;',
    '- Output JSON only, with no extra text or explanation.',
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: source },
  ];
}

// —— Chapter script generation / rewriting ——
// Outputs a storyboard-ready English script: scene + action + dialogue + narration, not JSON.
const SCRIPT_SOURCE_LIMIT = 12000;
const SCRIPT_DEFAULT_INSTRUCTION = 'Polish the script without changing plot direction or ending; tighten pacing and make dialogue more colloquial so every scene can be split directly into shots.';

function clipScriptSource(text, limit = SCRIPT_SOURCE_LIMIT) {
  const s = String(text == null ? '' : text).trim();
  if (!s) return '';
  return s.length > limit ? s.slice(0, limit) + `\n… (truncated; only the first ${limit} characters were kept)` : s;
}

export function buildChapterScriptMessages({ chapterTitle, novel, idea, style, script, instruction, mode }) {
  const rewrite = mode === 'rewrite';
  const styleLine = style?.trim() ? `Visual style: ${style.trim()}.` : '';
  const system = [
    'You are a professional English comic-drama screenwriter. Write a chapter script that can be split directly into shots.',
    ENGLISH_OUTPUT_CONTRACT,
    styleLine,
    'Output format (strict):',
    '1. Organize by scenes; each scene starts with `[Scene N | Time | Location]`;',
    '2. In each scene write, in order: characters present, scene/action description, dialogue (`CHARACTER: line`), and necessary narration;',
    '3. Dialogue must be colloquial English and directly voiceable. Use punctuation (! ? …) for emotion and pace; never write "angrily" or "speaks quickly" into dialogue text;',
    '4. Cover the whole source scene by scene without dropping key events; keep character, location, and prop names stable;',
    '5. Output only the script body — no JSON, Markdown tables, title explanations, or extra notes.',
  ].filter(Boolean).join('\n');

  const parts = [`Chapter: ${chapterTitle || '(untitled)'}`];
  if (rewrite) {
    parts.push('Revision request: ' + (String(instruction || '').trim() || SCRIPT_DEFAULT_INSTRUCTION));
    parts.push('Existing script to rewrite:\n' + clipScriptSource(script));
    if (clipScriptSource(novel)) parts.push('Chapter novel text (plot/character reference only):\n' + clipScriptSource(novel));
    parts.push('Output the complete revised script body, not a change log.');
  } else if (clipScriptSource(novel)) {
    parts.push('Chapter novel text. Write a complete English script from it:\n' + clipScriptSource(novel));
    parts.push('Output the complete script body.');
  } else {
    parts.push('Story idea. Expand it into a complete English script:\n' + (String(idea || '').trim() || '(none)'));
    parts.push('Output the complete script body.');
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: parts.join('\n\n') },
  ];
}

const QWEN_IMAGE_GUIDE = [
  '1. Prefer structured description over narrative prose: subject → environment/background → lighting/material/palette/camera angle; avoid long run-on sentences.',
  '2. Priority: core subject features first, then environment, then details (material, light, palette, viewpoint).',
  '3. Concise over verbose: 1–3 English sentences, about 80–150 words.',
  '4. State camera view explicitly: close-up / medium / wide, front / side / back, eye-level / high / low.',
  '5. Real text belonging to the subject (signage, book title, packaging label, screen copy, brand/logo) may appear and must be written in English with its content and placement. No unrelated subtitle bars, watermarks, signatures, or gibberish.',
  '6. Always provide negative_prompt: general exclusions `blurry, low quality, pixelated, distorted, watermark, oversaturated, artificial, plastic-looking`; characters additionally `extra fingers, deformed hands, mutated hands, fused fingers, plastic skin, over-smoothed`.',
].join('\n');

export function buildAssetPromptMessages({ type, name, description, scriptSummary, style }) {
  const typeLabel = { character: 'character', scene: 'scene', prop: 'prop' }[type] || 'asset';
  const typeRule = type === 'character'
    ? '- This is a character turnaround sheet: include (1) the left third as a head-and-shoulders face close-up (features, hairstyle, expression, temperament) and (2) the right two thirds as full-body front/side/back views from head to toe, fully in frame and uncropped. Appearance, wardrobe, and palette must be identical across views. Simple light background, horizontal layout;'
    : type === 'scene'
      ? '- This is a scene environment plate: emphasize atmosphere, spatial perspective, lighting, and style; the whole frame must work as a background;'
      : '- This is a prop image: pure white background, only the prop itself, no people, no scene, no unrelated elements. Real text/labels/packaging/brand logos belonging to the prop must be kept and written in English with placement; describe only the prop\'s shape, material, and details;';
  const user = [
    `Write English text-to-image prompts for a ${typeLabel} in a comic-drama project.`,
    `Type: ${typeLabel}`,
    `Name: ${name}`,
    'Setting description: ' + (description || '(none; infer reasonably from the name and script)'),
    'Script summary: ' + (scriptSummary || '(none)'),
    'Requirements:',
    typeRule,
    '- Visual style: ' + (style?.trim() || 'polished comic-drama illustration style') + ' (keep consistent with the whole project);',
    '- Follow the English image-guide principles in the system prompt: structured categories (subject → environment → details), concise (80–150 words), explicit camera view;',
    '- Provide negative_prompt as well;',
    '- Write prompt and negative_prompt entirely in English, ready to feed directly to the text-to-image model;',
    '- Output only JSON: {"prompt":"...","negative_prompt":"..."}.',
  ].join('\n');
  return [
    { role: 'system', content: 'You are a professional AI image-prompt expert specializing in English prompts for Qwen-Image-2512 / Krea2. Follow these English image-guide principles strictly:\n\n<Image Guide>\n' + QWEN_IMAGE_GUIDE + '\n</Image Guide>\n\n' + ENGLISH_OUTPUT_CONTRACT + '\n\nOutput only JSON: {"prompt":"...","negative_prompt":"..."}.' },
    { role: 'user', content: user },
  ];
}

export function fallbackAssetPrompt({ type, name, description, style }) {
  const s = style?.trim() || 'polished comic-drama illustration style';
  const d = description?.trim() || '';
  const textRule = '; allow real text belonging to the subject (signage, book title, packaging label, brand name/logo), written in English with placement; no unrelated subtitle bars, watermarks, signatures, or gibberish';
  const commonNeg = 'blurry, low quality, pixelated, watermark';
  if (type === 'character') {
    return {
      prompt: `Character turnaround sheet: ${name}${d ? ', ' + d : ''}; left 1/3 is a head-and-shoulders face close-up (features, hairstyle, expression, temperament); right 2/3 shows full-body front, side, and back views, head to toe fully in frame and uncropped; identical appearance and wardrobe palette across views; simple light background, horizontal layout${textRule}; visual style: ${s}`,
      negative_prompt: commonNeg + ', extra fingers, deformed hands, mutated hands, fused fingers, plastic skin, over-smoothed',
    };
  }
  if (type === 'scene') {
    return {
      prompt: `Scene: ${name}${d ? ', ' + d : ''}; emphasize environment mood, spatial perspective, lighting, and style; complete frame usable as a background${textRule}; visual style: ${s}`,
      negative_prompt: commonNeg + ', oversaturated, artificial, plastic-looking',
    };
  }
  return {
    prompt: `Prop: ${name}${d ? ', ' + d : ''}; pure white background, only the prop itself, no people or unrelated elements; real text/labels/packaging/brand logos belonging to the prop must be kept and written in English${textRule}; emphasize shape, material, and details; visual style: ${s}`,
    negative_prompt: commonNeg + ', person, extra elements',
  };
}

// Fixed composition constraint for Qwen-Image 2.1 / Krea2 character assets.
export const CHARACTER_T2I_LAYOUT_CONSTRAINT = 'The left 1/3 of the frame is a head-and-shoulders face close-up (features, hairstyle, expression, and temperament clearly visible). The right 2/3 contains three neat full-body turnaround views — front, side, and back — from head to toe, fully in frame and uncropped. Pure white background. Good body proportions.\nVisual alignment: all three views must match exactly in height, facial-feature placement, wardrobe folds, and overall form.';

export function buildStoryboardMessages(script, style) {
  const styleLine = style?.trim() ? `Visual style: ${style.trim()}.` : '';
  return [
    { role: 'system', content: `You are a comic-drama storyboard artist. From the script, output a storyboard list as JSON: {"storyboard":[{"shot":1,"scenes":["Scene Name"],"duration":12,"characters":["Character Name"],"props":["Prop Name"],"sub_shots":"0-3s (close-up, short distance, frontal eye-level, static camera): English visual; camera: static; background sound; dialogue: Character Name + English line. ..."}]}. Each shot is one scene-level long take; merge continuous action into one take, duration 8–15s (max 15s). Use name arrays for characters/scenes/props. sub_shots is a contiguous timeline of English visual prompts whose intervals meet end-to-end and sum to duration. Dialogue must be colloquial English with punctuation (! ? …) carrying emotion and pace; never write emotion labels into the dialogue text. ${styleLine}${ENGLISH_OUTPUT_CONTRACT}Output JSON only.` },
    { role: 'user', content: 'Script:\n' + JSON.stringify(script, null, 2) },
  ];
}

// —— MiniMax H3 video prompt fallback ——
// Used only when the LLM has not written shot.video_prompt via h3-prompt-writing.
// References are injected with __MINIMAX_H3_REF_N__ and style/character/scene consistency.
export function fallbackVideoPrompt({ references, style, characterDesc, sceneDesc, subShots, camera, visual, dialogue, characterName }) {
  const parts = [];
  if (style) parts.push('Visual style: ' + style);
  (references || []).forEach((ref, i) => {
    parts.push('__MINIMAX_H3_REF_' + (i + 1) + '__' + (ref.label || 'reference'));
  });
  if (characterDesc) parts.push('Keep the character consistent: ' + characterDesc);
  if (sceneDesc) parts.push('Keep the scene consistent: ' + sceneDesc);
  if (subShots) parts.push('Shot timeline: ' + subShots);
  else {
    if (camera) parts.push('Camera: ' + camera);
    if (visual) parts.push(visual);
    if (dialogue) parts.push(`${characterName || 'The character'} says "${dialogue}" with emotion and pace following the punctuation`);
  }
  parts.push('Reference images are for appearance/style/scene only (never treat them as first/last frames or keyframes). Reference sheets (character turnarounds, scene grids, prop boards) must never appear in the final frame. No text, subtitles, watermarks, logos, slogans, or signatures in the frame.');
  return parts.join(', ');
}

// —— Dialogue speaker parsing and reference-audio constraints ——
// A shot allows at most this many speakers (≥3 speakers must be split into multiple shots).
export const MAX_SPEAKERS_PER_SHOT = 2;
// Maximum audio segments in a single shot's reference list (MiniMax H3 maxAudioVideo limit).
export const MAX_AUDIO_REFS = 3;

// Extract speaker names from a dialogue string. Each line is `Character: line`.
// Strips parenthetical stage cues (English or Chinese) and trailing punctuation; skips lines without a colon.
export function dialogueSpeakerNames(dialogue) {
  if (!dialogue) return [];
  const names = new Set();
  for (const line of String(dialogue).split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^(.+?)[：:]/);
    if (!m) continue;
    const name = m[1]
      .replace(/[(（][^()（）]*[)）]/g, '')
      .replace(/[，。、,;；!！?？.·]+$/g, '')
      .trim();
    if (name) names.add(name);
  }
  return [...names];
}

// Parse the largest end time from a sub-shot timeline. Supports seconds, s, sec, secs, and 秒.
export function parseSubShotEndSeconds(text) {
  if (!text) return null;
  let max = null;
  const re = /(\d+(?:\.\d+)?)\s*[-~—–至到]\s*(\d+(?:\.\d+)?)\s*(?:秒|seconds?|secs?|s)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const end = parseFloat(m[2]);
    if (max === null || end > max) max = end;
  }
  return max;
}

export function validateSubShots(duration, subShots) {
  const maxEnd = parseSubShotEndSeconds(subShots);
  if (maxEnd !== null && maxEnd > (parseFloat(duration) || 0)) {
    return `Sub-shot timeline ends at ${maxEnd}s, which exceeds the shot duration of ${parseFloat(duration) || 0}s`;
  }
  return null;
}
