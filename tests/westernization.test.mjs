import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WESTERN_AESTHETIC_CONTRACT,
  WESTERN_FACE_WARDROBE_RULE,
  buildScriptMessages,
  buildChapterScriptMessages,
  buildAssetPromptMessages,
  buildStoryboardMessages,
  fallbackAssetPrompt,
  fallbackVideoPrompt,
} from '../lib/core/prompts.js';
import { STYLE_GROUPS, STYLE_PRESETS, STYLE_COMMON, inferVoiceBaseline } from '../lib/shared/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ALLOWED = new Set(['.md', '.json', '.py', '.js', '.jsx', '.mjs', '.txt', '.yaml', '.yml', '.html']);

function* skillFiles(dir = path.join(ROOT, 'skills')) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* skillFiles(full);
    else if (ALLOWED.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

test('Western aesthetic contract is strict and injected into all prompt builders', () => {
  for (const phrase of [
    'WESTERN-ONLY OUTPUT',
    'European-American facial structure',
    'Do not include Hanfu',
    'NEGATIVE GUIDANCE',
    'all character names, place names, pet names, and work titles must be natural Western-English names',
  ]) {
    assert.ok(WESTERN_AESTHETIC_CONTRACT.includes(phrase), `contract missing: ${phrase}`);
  }
  assert.ok(WESTERN_FACE_WARDROBE_RULE.includes('Western/European-American clothing'));

  const builders = [
    buildScriptMessages({ idea: 'a story' })[0].content,
    buildChapterScriptMessages({ chapterTitle: 'Chapter 1', novel: 'source', mode: 'generate' })[0].content,
    buildAssetPromptMessages({ type: 'character', name: 'Ethan', description: 'detective' })[0].content,
    buildStoryboardMessages([{ shot: 1 }], 'Western Cinematic')[0].content,
  ];
  for (const prompt of builders) {
    assert.ok(prompt.includes('WESTERN-ONLY OUTPUT'), 'builder must inject Western contract');
  }

  const asset = fallbackAssetPrompt({ type: 'character', name: 'Ethan', description: 'detective' });
  assert.match(asset.negative_prompt, /hanfu, qipao, cheongsam, tangzhuang, mamianqun, kimono, hanbok/);
  assert.match(fallbackVideoPrompt({ style: 'Western Cinematic' }), /Western-only aesthetic/);
});

test('all skill docs are free of Chinese / East-Asian hard rules', () => {
  const banned = [
    '真实中国人面部结构', '单眼皮', '汉服', '旗袍', '唐装', '马面裙', '黑发',
    '国漫', '仙侠', '武侠', '古风', '中式', '浮世绘', '皮影', '国内剧', '默认赛道',
    '中文输出', '提示词正文使用中文', '命名全中文', '[Chinese]', 'chinese-style',
    'Chinese comic style', '中国水墨',
  ];
  const hits = [];
  for (const file of skillFiles()) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const phrase of banned) {
      if (text.includes(phrase)) hits.push(`${path.relative(ROOT, file)} :: ${phrase}`);
    }
  }
  assert.deepEqual(hits, [], `残留中式/中文硬规则:\n${hits.join('\n')}`);
});

test('prompt-bozo western-style reference replaced Chinese-style reference', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'skills/prompt-bozo/references/western-style.md')));
  assert.ok(!fs.existsSync(path.join(ROOT, 'skills/prompt-bozo/references/chinese-style.md')));
  const evals = JSON.parse(read('skills/prompt-bozo/evals/evals.json'));
  assert.ok(evals.evals.every((e) => !/[\u3400-\u9fff]/.test(JSON.stringify(e))), 'evals must be English');
  assert.ok(evals.evals.some((e) => e.name.includes('western-style')));
});

test('style presets are Western-market only', () => {
  const all = [...STYLE_PRESETS, ...STYLE_COMMON, ...STYLE_GROUPS.map((g) => g.label)].join('|');
  assert.match(all, /Western Cinematic/);
  assert.match(all, /American Comic/);
  assert.match(all, /European Period Drama/);
  const banned = ['国漫', '东方玄幻', '中式水墨', '浮世绘', '皮影', '韩漫', '日漫', '国产都市', '韩国冷淡', '上美动漫'];
  for (const phrase of banned) assert.ok(!all.includes(phrase), `style preset still present: ${phrase}`);
});

test('music families and voice inference are Western/English', () => {
  const music = read('lib/core/music-caption.js');
  assert.match(music, /western-pop-rock/);
  assert.match(music, /western-country-folk/);
  assert.ok(!music.includes('east-asian-modern'));
  assert.ok(!music.includes('east-asian-ballad-heritage'));

  assert.match(inferVoiceBaseline('Daniel Reed', 'young adult male detective'), /adult male/);
  assert.match(inferVoiceBaseline('Sophie Bennett', '16-year-old girl'), /young female/);
  assert.equal(inferVoiceBaseline('Streetlight', 'old lamp at the corner'), '');
});

test('screenplay validator accepts Western English script format', () => {
  const validator = read('skills/0715-scriptwriter/scripts/check_script.py');
  assert.match(validator, /Episode\\s\+\\d\{1,3\}/);
  assert.ok(validator.includes('\\[(INT|EXT)\\]'));
  assert.match(validator, /CHARACTER: \\"line\\"/);
  assert.ok(!validator.includes('TIME_TAGS = "日|夜'));
});

test('novel generation enforces Western-English character names', () => {
  const skill = read('skills/webnovel-writing/SKILL.md');
  assert.match(skill, /## Character naming/);
  assert.match(skill, /natural Western-English names/);
  assert.match(skill, /Never keep Chinese, Japanese, Korean, or other Asian names/);

  const agent = read('lib/agent/agent-loop.js');
  assert.match(agent, /WESTERN-ENGLISH NAMES IRON RULE/);

  const tools = read('lib/agent/tools.js');
  assert.match(tools, /Natural Western-English character name/);

  for (const phrase of ['Su Nian', 'Shen Zhiyi', 'Gu Qinghan', 'Lin Xiaoman', 'Xu Yan', 'Jiang Yue']) {
    assert.ok(!read('data/projects/749806b2-688f-4fc2-bc1d-fc1baa761fcf/novel/characters.json').includes(phrase));
  }
});
