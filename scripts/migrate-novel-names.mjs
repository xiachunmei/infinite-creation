import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH, ROOT } from '../lib/core/config.js';
import { Chapters, Projects, getDb, loadNovelState, saveNovelState } from '../lib/core/index.js';
import { withWriteContext } from '../lib/core/changelog.js';

const PROJECT_ID = '749806b2-688f-4fc2-bc1d-fc1baa761fcf';
const APPLY = process.argv.includes('--apply');
const DRY = process.argv.includes('--dry-run') || !APPLY;

const EXACT = [
  ['Su Nian', 'Sophie Bennett'],
  ['Shen Zhiyi', 'Serena Hayes'],
  ['Gu Qinghan', 'Gabrielle Quinn'],
  ['Lin Xiaoman', 'Lily Carter'],
  ['Xu Yan', 'Ethan Brooks'],
  ['Jiang Yue', 'Julia Morgan'],
  ['Zhiyi-jie', 'Serena'],
  ['Zhizhi', 'Rina'],
  ['mid-sized Chinese city', 'mid-sized Pacific Northwest city'],
  ['neighbor sister', 'girl next door'],
  ['Neighbor Sister', 'Girl Next Door'],
  ['双女主 求邻居姐姐爱我 女同文', 'Please Love Me, Girl Next Door'],
  ['邻居姐姐', 'girl next door'],
];

const WORD = [
  [/\bZhiyi\b/g, 'Serena'],
  [/\bQinghan\b/g, 'Gabrielle'],
  [/\bXiaoman\b/g, 'Lily'],
  [/\bSu\b/g, 'Sophie'],
  [/\bShen\b/g, 'Serena'],
  [/\bGu\b/g, 'Gabrielle'],
  [/\bLin\b/g, 'Lily'],
  [/\bXu\b/g, 'Ethan'],
  [/\bJiang\b/g, 'Julia'],
  [/(?<![A-Za-z])Nian(?![A-Za-z])/g, 'Sophie'],
];

const RESIDUE_PATTERNS = [
  'Su Nian', 'Shen Zhiyi', 'Gu Qinghan', 'Lin Xiaoman', 'Xu Yan', 'Jiang Yue',
  'Zhiyi-jie', 'Zhizhi', 'mid-sized Chinese city', 'neighbor sister', 'Neighbor Sister',
  '双女主 求邻居姐姐爱我 女同文', '邻居姐姐',
];
const RESIDUE_WORD = [
  /\bSu\b/, /\bShen\b/, /\bGu\b/, /\bLin\b/, /\bXu\b/, /\bJiang\b/,
  /\bZhiyi\b/, /\bQinghan\b/, /\bXiaoman\b/, /(?<![A-Za-z])Nian(?![A-Za-z])/,
];

function replaceText(text, stats) {
  let out = String(text ?? '');
  for (const [old, next] of EXACT) {
    const count = out.split(old).length - 1;
    if (count) {
      stats[old] = (stats[old] || 0) + count;
      out = out.split(old).join(next);
    }
  }
  for (const [re, next] of WORD) {
    out = out.replace(re, (m) => {
      stats[re.source] = (stats[re.source] || 0) + 1;
      return next;
    });
  }
  return out;
}

function mapValue(value, stats, key = '') {
  if (typeof value === 'string') return replaceText(value, stats);
  if (Array.isArray(value)) return value.map((v) => mapValue(v, stats));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      // Stable ids stay unchanged; they are routing/storage keys, not display names.
      out[k] = (k === 'id' || k.endsWith('_id')) ? v : mapValue(v, stats, k);
    }
    return out;
  }
  return value;
}

function stringifyCounts(stats) {
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([k, v]) => `  ${String(v).padStart(4)}  ${k}`).join('\n') : '  (none)';
}

function backup(projectDir) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(ROOT, 'data', 'backups', 'novel-western-names-' + stamp);
  fs.mkdirSync(dir, { recursive: true });

  // Consistent SQLite snapshot including uncheckpointed WAL data.
  const snap = path.join(dir, 'ic.db.snapshot');
  getDb().exec("VACUUM INTO '" + snap.replace(/'/g, "''") + "'");
  for (const suffix of ['', '-wal', '-shm']) {
    const src = DB_PATH + suffix;
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, path.basename(DB_PATH) + suffix));
  }
  fs.cpSync(projectDir, path.join(dir, 'project'), { recursive: true });
  return dir;
}

function residue(text) {
  const hits = [];
  for (const p of RESIDUE_PATTERNS) if (String(text ?? '').includes(p)) hits.push(p);
  for (const re of RESIDUE_WORD) if (re.test(String(text ?? ''))) hits.push(re.source);
  return hits;
}

const project = Projects.get(PROJECT_ID);
if (!project) throw new Error('Project not found: ' + PROJECT_ID);
const projectDir = path.join(ROOT, 'data', 'projects', PROJECT_ID);
if (!fs.existsSync(projectDir)) throw new Error('Project directory not found: ' + projectDir);

const stats = {};
const changes = [];

// Novel files via the existing state API.
const state = loadNovelState(PROJECT_ID);
const nextState = mapValue(state, stats);
for (const [kind, before, after] of [
  ['structure', state.structure, nextState.structure],
  ['characters', state.characters, nextState.characters],
  ['volumes', state.volumes, nextState.volumes],
  ['memory', state.memory, nextState.memory],
]) {
  if (JSON.stringify(before) !== JSON.stringify(after)) changes.push(`novel.${kind}`);
}

// Project-level stored text via existing repository.
const nextProjectFields = {
  name: replaceText(project.name, stats),
  idea: replaceText(project.idea || '', stats),
  novel: replaceText(project.novel || '', stats),
  context: mapValue(project.context || {}, stats),
};
for (const k of Object.keys(nextProjectFields)) {
  if (JSON.stringify(project[k] ?? {}) !== JSON.stringify(nextProjectFields[k])) changes.push(`project.${k}`);
}

// Chapter text via existing repository.
const chapters = Chapters.list(PROJECT_ID).map((ch) => {
  const patch = {
    title: replaceText(ch.title, stats),
    novel: replaceText(ch.novel, stats),
    script: replaceText(ch.script, stats),
    outline: replaceText(ch.outline, stats),
  };
  const changed = Object.keys(patch).filter((k) => patch[k] !== ch[k]);
  if (changed.length) changes.push(`chapter:${ch.id}:${changed.join(',')}`);
  return { id: ch.id, patch };
});

console.log(APPLY ? 'APPLY migration' : 'DRY-RUN migration');
console.log('project:', PROJECT_ID);
console.log('changed fields:', changes.length);
console.log(stringifyCounts(stats));
if (DRY) {
  console.log('Dry-run only. No writes were performed.');
  process.exit(0);
}

const backupDir = backup(projectDir);
console.log('backup:', backupDir);

withWriteContext('migrate-novel-names.mjs', () => {
  saveNovelState(PROJECT_ID, nextState);
  Projects.update(PROJECT_ID, nextProjectFields);
  for (const { id, patch } of chapters) {
    if (Object.values(patch).some((v) => v !== undefined)) Chapters.update(id, patch);
  }
});

const verify = [];
const afterProject = Projects.get(PROJECT_ID);
const afterState = loadNovelState(PROJECT_ID);
const projectText = JSON.stringify({ name: afterProject.name, idea: afterProject.idea, novel: afterProject.novel, context: afterProject.context });
const stateText = JSON.stringify(afterState);
if (residue(projectText).length) verify.push('project:' + residue(projectText).join('|'));
if (residue(stateText).length) verify.push('novel-state:' + residue(stateText).join('|'));
for (const ch of Chapters.list(PROJECT_ID)) {
  const text = JSON.stringify({ title: ch.title, novel: ch.novel, script: ch.script, outline: ch.outline });
  const hits = residue(text);
  if (hits.length) verify.push(`chapter:${ch.id}:${hits.join('|')}`);
}

console.log('residue hits:', verify.length);
if (verify.length) {
  console.error(verify.slice(0, 20).join('\n'));
  throw new Error('Migration left old-name residue; inspect backup and data before continuing');
}
console.log('Migration complete. Old names: 0');
