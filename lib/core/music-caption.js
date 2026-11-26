// Background-music "lyrics / arrangement" preprocessor.
// Calls the skills/music-caption-rewriter workflow to turn a one-line caption plus lyrics into
// a MiniMax Music 3 structured caption (Global Metadata / Vocal Details / Arrangement) and
// an arrangeable English lyric sheet with section tags ([Intro]/[Verse]/[Chorus]…).
//
// One-pass rewrite: route to 1–2 genre families via the Genre Router, read only that family's
// compact index card, then rewrite. No full-library scan and no script execution.
// If the skill file is missing or the LLM fails, throw; the caller falls back to the original input.
import fs from 'node:fs';
import path from 'node:path';
import { SKILLS_DIR } from './config.js';
import { llmChat, extractJson } from './llm.js';

const SKILL_NAME = 'music-caption-rewriter';
// One-to-one with references/genre-router.md Family map (route → references/index-<route>.md).
const FAMILIES = new Set([
  'western-pop-rock', 'western-country-folk', 'modern-rnb-neo-soul', 'soul-blues-gospel',
  'cinematic-pop-ballad', 'cinematic-orchestral-epic', 'electronic-synth-ambient-pop', 'jazz-swing-big-band',
  'traditional-vocal-stage', 'hip-hop-rap', 'metal-heavy-rock', 'pop-alternative-rock',
  'contemporary-folk-acoustic', 'roots-traditional-global', 'general-pop-ballad', 'dance-pop-disco-funk',
  'club-edm-house-trance', 'country-americana',
]);
// Family index cards can be very large; truncate to a safe size for small-context local models.
const INDEX_CHAR_LIMIT = 14000;

function readSkillFile(rel) {
  try {
    return fs.readFileSync(path.join(SKILLS_DIR, SKILL_NAME, rel), 'utf8');
  } catch {
    return '';
  }
}

function stripFrontmatter(text) {
  const m = /^---\s*\n[\s\S]*?\n---\s*\n?/.exec(text || '');
  return m ? String(text).slice(m[0].length) : String(text || '');
}

function familyCards(route) {
  const text = readSkillFile('references/index-' + route + '.md');
  if (!text) return '';
  return text.length > INDEX_CHAR_LIMIT ? text.slice(0, INDEX_CHAR_LIMIT) + '\n… (card index truncated)' : text;
}

// Step 1: follow Progressive Disclosure — route to 1–2 genre families.
// Routing only chooses which card index to read; failure falls back to general-pop-ballad.
async function routeFamilies(llm, router, caption) {
  try {
    const out = await llmChat(llm, [
      {
        role: 'system',
        content: [
          'You are the genre router for the music-caption-rewriter skill. Below is its Genre Router document:',
          router,
          'Only perform genre routing; do not write a caption. From the Family map choose primary (required) and secondary (only for an explicit fusion or a deliberate contrast; otherwise leave empty).',
          'Output only JSON: {"primary":"<route>","secondary":"<route or empty string>"}',
        ].join('\n\n'),
      },
      { role: 'user', content: 'Music description: ' + caption },
    ], { json: true, temperature: 0.2, maxTokens: 600, timeoutMs: 120000 });

    const data = extractJson(out.content || '{}');
    const primaryRaw = String(data.primary || '').trim();
    const secondaryRaw = String(data.secondary || '').trim();
    const primary = FAMILIES.has(primaryRaw) ? primaryRaw : 'general-pop-ballad';
    const secondary = FAMILIES.has(secondaryRaw) && secondaryRaw !== primary ? secondaryRaw : '';
    return { primary, secondary };
  } catch {
    return { primary: 'general-pop-ballad', secondary: '' };
  }
}

/**
 * Rewrite a music description and lyrics using the music-caption-rewriter skill.
 * @returns {Promise<{caption: string, lyrics: string, primary: string, secondary: string}>}
 */
export async function optimizeMusicBrief({ llm, caption, lyrics, duration, style }) {
  const srcCaption = String(caption || '').trim();
  if (!srcCaption) throw new Error('Missing music caption');

  const skill = stripFrontmatter(readSkillFile('SKILL.md'));
  if (!skill) throw new Error('Could not find skills/' + SKILL_NAME + '/SKILL.md');
  const router = readSkillFile('references/genre-router.md');
  if (!router) throw new Error('Could not find skills/' + SKILL_NAME + '/references/genre-router.md');

  const { primary, secondary } = await routeFamilies(llm, router, srcCaption);
  const cards = [primary, secondary]
    .filter(Boolean)
    .map((route) => '### Family index: ' + route + '\n' + familyCards(route))
    .filter((block) => block.trim())
    .join('\n\n');

  const system = [
    'You are executing the music-caption-rewriter skill: rewrite the user\'s music description and lyrics into a structured caption that directly drives MiniMax Music 3, and arrange the lyrics into an English, arrangement-ready lyric sheet.',
    'The skill body below gives input constraints, output contract, and self-checks. The English-output overrides that follow take precedence over any conflicting language rule in the skill.',
    '<skill_content>',
    skill,
    '</skill_content>',
    '',
    'One-pass rewrite overrides:',
    '1. Output only one JSON object: {"caption":"…","lyrics":"…"}; no Markdown fences, no explanation, no reasoning.',
    '2. caption must be English and contain exactly these three level-3 headings in this order: ### Global Metadata, ### Vocal Details, ### Arrangement.',
    '3. caption must not contain any lyric text, song title, template ID, or routing diagnostics.',
    '4. If the original lyrics are empty, lyrics must be an empty string (instrumental) and Vocal Details must explicitly state that this is instrumental.',
    '5. If the original lyrics are non-empty, treat the piece as having vocals. Translate/rewrite the lyrics into English while preserving meaning, emotion, and imagery; do not leave source-language lyrics. Add section tags ([Intro]/[Verse]/[Pre-Chorus]/[Chorus]/[Bridge]/[Outro]) and reorder for arrangement (chorus may repeat). Do not invent new narrative content.',
    '6. Do not override explicit user constraints on style, instrumentation, vocal gender, duration, or mood. Do not invent exact BPM/key when unspecified, and do not write meta notes such as "BPM unspecified"; use qualitative tempo and tonality instead.',
    '7. All labels and any human-readable notes must be English.',
    '8. Target Western-market music aesthetics only: use Western genre references, English/Latin-script artist-agnostic descriptors, and European-American production language. Do not describe East Asian or Chinese genres, instruments, scales, or vocal styles.',
  ].join('\n');

  const user = [
    'Original music caption:\n' + srcCaption,
    'Original lyrics (may be empty):\n' + (String(lyrics || '').trim() || '(none — instrumental)'),
    duration ? 'Expected duration: ' + duration + ' seconds' : '',
    style ? 'Visual / project style (mood reference only; do not copy): ' + style : '',
    cards ? 'Genre cards selected by routing (use only to calibrate style; do not copy sentences):\n' + cards : '',
    'Output JSON.',
  ].filter(Boolean).join('\n\n');

  // JSON is occasionally truncated by proxies/rate limits: retry once before giving up.
  let nextCaption = '';
  let nextLyrics = '';
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const out = await llmChat(llm, [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], { json: true, temperature: 0.7, maxTokens: 4096, timeoutMs: 300000 });
      const data = extractJson(out.content || '{}');
      nextCaption = String(data.caption || '').trim();
      nextLyrics = String(data.lyrics || '').trim();
      if (nextCaption) break;
      lastError = new Error('LLM did not return an optimized caption');
    } catch (e) {
      lastError = e;
      // Timeouts/connection failures only double the wait (llmChat already has a long timeout).
      if (/timeout|timed out|cannot connect|connection|request failed|超时|无法连接|请求失败/i.test(String(e?.message || ''))) break;
    }
  }
  if (!nextCaption) throw lastError || new Error('LLM did not return an optimized caption');
  const srcLyrics = String(lyrics || '').trim();
  if (!srcLyrics) nextLyrics = '';
  else if (!nextLyrics) nextLyrics = srcLyrics;

  return { caption: nextCaption, lyrics: nextLyrics, primary, secondary };
}
