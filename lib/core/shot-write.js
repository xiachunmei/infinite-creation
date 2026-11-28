// Shot content-field whitelist, normalization, and business validation shared by the
// external write API (harness) and the built-in Agent.
//
// Only content fields are accepted; status / error / video_path / video_prompt_used / prompt_id
// belong to the generation pipeline and are written by render stages. External writes must reject
// them, otherwise a client could fake a "done" artifact and bypass rendering.
//
// Besides field names/types, this module enforces business constraints: duration range,
// dialogue rate, speaker count, resolution enum. These used to exist only in the Agent's
// set_storyboard / update_shot; direct API writes bypassed them and failed minutes later
// during rendering (or produced unintelligible speech).

import { dialogueSpeakerNames, MAX_SPEAKERS_PER_SHOT } from './prompts.js';
import { VIDEO_ASPECT_RATIOS, VIDEO_RESOLUTIONS, VIDEO_MODES } from '../shared/index.js';

export const SHOT_STRING_FIELDS = ['chapter', 'scene_name', 'camera', 'visual', 'dialogue', 'narration', 'sub_shots', 'resolution', 'aspect_ratio', 'video_prompt', 'mode', 'first_frame_path', 'last_frame_path', 'reference_image_path'];
export const SHOT_ARRAY_FIELDS = ['character_ids', 'scene_ids', 'prop_ids', 'costume_ids', 'age_ids', 'audio_ids', 'references'];
export const SHOT_NUMBER_FIELDS = ['idx', 'duration'];
// `seed` is deliberately not writable: it is a render parameter/artifact. generateShotVideo
// always draws a fresh random seed at render time and the render chain never reads shots.seed
// as input. It is also in changelog VOLATILE.shot (not logged and not restorable). Accepting it
// would mean "the API accepted it but silently ignored it" — same policy as status/video_path.
// Supporting pinned seeds would require render-side changes and is out of scope here.

// Value domains match their consumers. The tables live in lib/shared/index.js (single source of
// truth shared with workflow mapping and UI dropdowns); tests keep all three from drifting.
// - resolution: unknown values are passed through to ComfyUI by mapRoleValue and fail only at
//   submission, so reject at the write boundary.
// - aspect_ratio: keys of the workflow aspect_ratio.map.
// Empty string is valid: inherit the project setting (shot.resolution || project.video_resolution).
export const SHOT_RESOLUTIONS = VIDEO_RESOLUTIONS;
export const SHOT_ASPECT_RATIOS = VIDEO_ASPECT_RATIOS;
// Duration bounds: H3 单镜硬上限 10s（超过必须拆成两镜）；dialogue rate follows tools.js MAX_RATE = 5.5 units/sec.
export const SHOT_DURATION_MIN = 1;
export const SHOT_DURATION_MAX = 10;
export const SHOT_DIALOGUE_MAX_RATE = 5.5;
// Keep in sync with db.js Shots.create / Shots.update defaults: validation must use the value
// actually stored, otherwise "duration omitted + long dialogue" computes the wrong limit.
export const SHOT_DURATION_DEFAULT = 5;

const ALL = new Set([...SHOT_STRING_FIELDS, ...SHOT_ARRAY_FIELDS, ...SHOT_NUMBER_FIELDS]);

// Count dialogue length in language-appropriate units. English text uses words; any text with
// CJK characters uses characters for backward compatibility with legacy Chinese projects.
// The returned `unit` is only for error messages.
export function dialogueLengthUnits(text) {
  const s = String(text ?? '');
  if (!s.trim()) return { count: 0, unit: 'words' };
  if (/[\u3400-\u9fff]/.test(s)) return { count: s.length, unit: 'characters' };
  const words = s.trim().split(/\s+/).filter(Boolean).length;
  return { count: words, unit: 'words' };
}

// Reject unknown fields rather than silently dropping them: a typo must be visible immediately,
// consistent with the Agent tool's closed-parameter validation.
export function pickShotFields(body) {
  const patch = {};
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { patch, errors: ['Request body must be a JSON object'] };

  for (const k of Object.keys(body)) {
    if (!ALL.has(k)) errors.push('Field not accepted: ' + k);
  }

  for (const k of SHOT_STRING_FIELDS) {
    if (body[k] === undefined) continue;
    const v = String(body[k] ?? '');
    if (k === 'resolution' && v && !SHOT_RESOLUTIONS.includes(v)) {
      errors.push(`resolution must be one of ${SHOT_RESOLUTIONS.join('/')} (got: ${v})`);
      continue;
    }
    if (k === 'aspect_ratio' && v && !SHOT_ASPECT_RATIOS.includes(v)) {
      errors.push(`aspect_ratio must be one of ${SHOT_ASPECT_RATIOS.join('/')} (got: ${v})`);
      continue;
    }
    if (k === 'mode' && v && !VIDEO_MODES.includes(v)) {
      errors.push(`mode must be one of ${VIDEO_MODES.join('/')} (got: ${v})`);
      continue;
    }
    patch[k] = v;
  }
  for (const k of SHOT_ARRAY_FIELDS) {
    if (body[k] === undefined) continue;
    if (!Array.isArray(body[k])) { errors.push(k + ' must be an array of strings'); continue; }
    // An object in the array becomes "[object Object]" through String(): *_ids would be
    // silently dropped by db as invalid ids, while refs would store garbage. Reject immediately.
    const bad = body[k].find((v) => v !== null && v !== undefined && typeof v === 'object');
    if (bad !== undefined) { errors.push(k + ' elements must be strings (found object/array)'); continue; }
    patch[k] = body[k].map((v) => String(v ?? '')).filter(Boolean);
  }
  for (const k of SHOT_NUMBER_FIELDS) {
    if (body[k] === undefined) continue;
    const n = Number(body[k]);
    if (!Number.isFinite(n)) { errors.push(k + ' must be a finite number'); continue; }
    if (k === 'idx') {
      // idx is numbered within a chapter: ≥1 matches the Agent side (chapter max+1) and
      // Shots.list ordering.
      const i = Math.trunc(n);
      if (i < 1) { errors.push('idx must be an integer ≥ 1'); continue; }
      patch[k] = i;
      continue;
    }
    // duration must be checked explicitly by name: a generic fallback branch previously
    // applied duration bounds to any numeric field (e.g. seed=123456 → nonsense error).
    if (k === 'duration') {
      if (n < SHOT_DURATION_MIN || n > SHOT_DURATION_MAX) {
        errors.push(`duration must be between ${SHOT_DURATION_MIN} and ${SHOT_DURATION_MAX} seconds (got: ${n})`);
        continue;
      }
      patch[k] = n;
    }
  }

  return { patch, errors };
}

// Cross-field validation. `patch` is this write; `current` is the stored row ({} on create).
// "Dialogue changed but duration did not" still needs the stored duration to compute the limit.
export function validateShotContent(patch, current = {}) {
  const errors = [];
  // chapter is the shot's ownership key (shots.chapter stores the chapter title; chapter views,
  // todo counts, and final assembly all group by it). An explicit empty string removes the shot
  // from chapter views while still exporting it. Omitting the field means "keep ownership".
  if (patch.chapter !== undefined && !String(patch.chapter).trim()) {
    errors.push('chapter cannot be empty — a shot must belong to a chapter; omit the field to keep ownership');
  }
  const dur = patch.duration !== undefined ? patch.duration : (Number(current.duration) > 0 ? Number(current.duration) : SHOT_DURATION_DEFAULT);
  const dialogue = patch.dialogue !== undefined ? patch.dialogue : (current.dialogue || '');

  // Dialogue rate is cross-field (duration + dialogue), so only validate when this write actually
  // changes a dependency. Recomputing from stored values would make legacy/overspeed rows
  // uneditable — even a binding-only PATCH with six *_ids would be rejected with 400.
  if (patch.dialogue !== undefined || patch.duration !== undefined) {
    // Same formula as tools.js hSetStoryboard (punctuation included). Overspeed speech is
    // compressed by TTS/H3 into unintelligible audio.
    const { count, unit } = dialogueLengthUnits(dialogue);
    if (count && dur > 0 && count / dur > SHOT_DIALOGUE_MAX_RATE) {
      errors.push(
        `Dialogue too long for the shot: ${count} ${unit} / ${dur}s (max ${Math.floor(dur * SHOT_DIALOGUE_MAX_RATE)} ${unit}, about ${SHOT_DIALOGUE_MAX_RATE} ${unit}/sec). Shorten the dialogue, extend the duration (max ${SHOT_DURATION_MAX}s), or split the shot.`
      );
    }
  }

  // Speaker count depends only on dialogue, so validate only when dialogue is written.
  if (patch.dialogue !== undefined) {
    const speakers = dialogueSpeakerNames(dialogue);
    if (speakers.length > MAX_SPEAKERS_PER_SHOT) {
      errors.push(`Too many speakers in one shot: ${speakers.length} > ${MAX_SPEAKERS_PER_SHOT} (${speakers.join(', ')}). Split the shot.`);
    }
  }

  return errors;
}

// —— Chapter-unique shot index ——
// idx must be unique within a chapter: assemble_video / final export sort by chapter seq →
// chapter idx. Collisions make ordering nondeterministic.
export function idxTakenBy(shots, chapter, idx, excludeId = '') {
  const n = Number(idx);
  if (!Number.isFinite(n)) return null;
  return shots.find((s) => s.chapter === chapter && Number(s.idx) === n && s.id !== excludeId) || null;
}

// —— Chapter content-field whitelist ——
export const CHAPTER_STRING_FIELDS = ['title', 'novel', 'script', 'outline'];
export const CHAPTER_NUMBER_FIELDS = ['volume'];

export function pickChapterFields(body) {
  const patch = {};
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { patch, errors: ['Request body must be a JSON object'] };
  const accepted = new Set([...CHAPTER_STRING_FIELDS, ...CHAPTER_NUMBER_FIELDS]);
  for (const k of Object.keys(body)) {
    if (!accepted.has(k)) errors.push('Field not accepted: ' + k);
  }
  for (const k of CHAPTER_STRING_FIELDS) {
    if (body[k] === undefined) continue;
    const v = String(body[k] ?? '');
    // Title is a business key (shots group by title) and must be non-empty; an empty title
    // removes the chapter's shots from views and bypasses the uniqueness check.
    if (k === 'title' && !v.trim()) { errors.push('title cannot be empty — shots are grouped by chapter title; omit the field to keep it'); continue; }
    patch[k] = v;
  }
  for (const k of CHAPTER_NUMBER_FIELDS) {
    if (body[k] === undefined) continue;
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < 1) { errors.push(k + ' must be an integer ≥ 1'); continue; }
    patch[k] = Math.floor(n);
  }
  return { patch, errors };
}

// —— Project content-field whitelist ——
export const PROJECT_STRING_FIELDS = ['name', 'novel', 'idea', 'style'];
export const PROJECT_ENUM_FIELDS = ['video_resolution', 'video_aspect_ratio', 'image_resolution'];
export const PROJECT_NUMBER_FIELDS = ['video_width', 'video_height', 'target_duration'];
export const PROJECT_BOOL_FIELDS = ['enable_bgm', 'enable_subtitles', 'is_public', 'auto_script'];
const PROJECT_ALL = new Set([...PROJECT_STRING_FIELDS, ...PROJECT_ENUM_FIELDS, ...PROJECT_NUMBER_FIELDS, ...PROJECT_BOOL_FIELDS]);

export function pickProjectFields(body) {
  const patch = {};
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { patch, errors: ['Request body must be a JSON object'] };
  for (const k of Object.keys(body)) {
    if (!PROJECT_ALL.has(k)) errors.push('Field not accepted: ' + k);
  }
  for (const k of PROJECT_STRING_FIELDS) if (body[k] !== undefined) patch[k] = String(body[k] ?? '');
  for (const k of PROJECT_ENUM_FIELDS) if (body[k] !== undefined) patch[k] = String(body[k] ?? '');
  for (const k of PROJECT_NUMBER_FIELDS) {
    if (body[k] === undefined) continue;
    const n = Number(body[k]);
    if (!Number.isFinite(n) || n < 0) { errors.push(k + ' must be a number ≥ 0 (got: ' + body[k] + ')'); continue; }
    // Width/height are INTEGER pixel columns; target_duration is a REAL seconds column.
    // Bounds are generation-side constraints checked in db.js projectDims so UI / Agent / harness
    // share one rule.
    patch[k] = k === 'target_duration' ? n : Math.trunc(n);
  }
  for (const k of PROJECT_BOOL_FIELDS) {
    if (body[k] === undefined) continue;
    const v = body[k];
    patch[k] = !(v === false || v === 0 || v === '0' || v === 'false');
  }
  return { patch, errors };
}
