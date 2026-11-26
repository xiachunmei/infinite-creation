import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENGLISH_OUTPUT_CONTRACT,
  buildScriptMessages,
  buildChapterScriptMessages,
  buildAssetPromptMessages,
  fallbackAssetPrompt,
  buildStoryboardMessages,
} from '../lib/core/prompts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('shared English output contract covers every creative artifact', () => {
  for (const phrase of [
    'novel prose',
    'scripts',
    'character bibles',
    'storyboards',
    'image prompts',
    'video prompts',
    'TTS text/descriptions',
    'music lyrics',
    'translate and adapt its meaning into English',
  ]) {
    assert.ok(ENGLISH_OUTPUT_CONTRACT.includes(phrase), `missing contract phrase: ${phrase}`);
  }
});

test('direct LLM builders inject the English contract and English formats', () => {
  const script = buildScriptMessages({ idea: 'a story' });
  assert.match(script[0].content, /LANGUAGE: Write every creative value in English/);
  assert.match(script[0].content, /Work Title/);

  const chapter = buildChapterScriptMessages({ chapterTitle: 'Chapter 1', novel: 'Source text', mode: 'generate' });
  assert.match(chapter[0].content, /\[Scene N \| Time \| Location\]/);
  assert.match(chapter[0].content, /colloquial English/);

  const asset = buildAssetPromptMessages({ type: 'character', name: 'Lin Mo', description: 'young detective' });
  assert.match(asset[0].content, /English prompts/);
  assert.match(asset[1].content, /entirely in English/);

  const storyboard = buildStoryboardMessages([{ shot: 1 }], 'comic-drama');
  assert.match(storyboard[0].content, /LANGUAGE: Write every creative value in English/);

  const fallback = fallbackAssetPrompt({ type: 'prop', name: 'Brass Key', description: 'old key' });
  assert.ok(!/[\u4e00-\u9fff]/.test(fallback.prompt));
  assert.ok(!/[\u4e00-\u9fff]/.test(fallback.negative_prompt));
});

test('core skill docs no longer contain Chinese-output rules', () => {
  const cases = [
    ['skills/novel-to-video/SKILL.md', ['中文场景头', '中文台词', '把中文台词逐句写进英文提示词']],
    ['skills/story-pipeline-cn/SKILL.md', ['中文优先', '提示词草稿默认中文']],
    ['skills/image-prompt-writing/SKILL.md', ['编写中英文提示词', '纯中文']],
    ['skills/tts-voice-design/SKILL.md', ['voice_description 中文', '20~30 字']],
    ['skills/webnovel-writing/SKILL.md', ['中文网文写作 Skill', '面向中文网文']],
    ['skills/h3-prompt-writing/SKILL.md', ['preserve dialogue, lyrics, and visible scene text in their original language', '保留对白、歌词']],
    ['lib/agent/agent-loop.js', ['完整中文剧本', '华语普通话/粤语/英语等']],
    ['lib/agent/tools.js', ['中文旁白约 4-5 字/秒']],
    ['lib/core/music-caption.js', ['保留原语言与原意']],
  ];
  for (const [file, banned] of cases) {
    const text = read(file);
    for (const phrase of banned) {
      assert.ok(!text.includes(phrase), `${file} still contains banned phrase: ${phrase}`);
    }
  }
});

test('English-output rules are explicitly present in key files', () => {
  assert.match(read('skills/novel-to-video/SKILL.md'), /All creative artifacts—script, bible, style, storyboard, dialogue, image prompts, video prompts, TTS text\/descriptions, and music lyrics—are written in English/);
  assert.match(read('skills/story-pipeline-cn/SKILL.md'), /every creative artifact/);
  assert.match(read('skills/h3-prompt-writing/SKILL.md'), /Dialogue, lyrics, and any visible scene text must also be English/);
  assert.match(read('skills/tts-voice-design/SKILL.md'), /voice_description` must be English/);
  assert.match(read('skills/webnovel-writing/SKILL.md'), /All fiction output is English/);
  assert.match(read('lib/core/music-caption.js'), /Translate\/rewrite the lyrics into English/);
});
