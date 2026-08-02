// 一次性工具：把当前零散的 JS 数据（数据分片 + 场景/心情体系）合并成
// 唯一数据源 data/词句数据.xlsx。以后改数据只改这个 Excel，构建从它读取。
// 运行：node build/make-xlsx.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { loadAll } from './load.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', '词句数据.xlsx');

const D = await loadAll();

const groupName = Object.fromEntries(D.groups.map(g => [g.id, g.name]));

// ── 大类 ──────────────────────────────────────
const groupsRows = [['id', '名称', '标签'], ...D.groups.map(g => [g.id, g.name, g.tag])];

// ── 场景 ──────────────────────────────────────
const sceneRows = [['id', '大类id', '大类名', '名称', '描述', '关键词'],
  ...D.scenes.map(s => [s.id, s.g, groupName[s.g] || '', s.name, s.desc, (s.kw || []).join('、')])];

// ── 心情 ──────────────────────────────────────
const moodRows = [['id', '名称', '描述'], ...D.moods.map(m => [m.id, m.name, m.desc || ''])];

// ── 词句（核心数据）────────────────────────────
const pieceRows = [['正文', '作者', '作品', '年代国别', '场景id', '心情id', '怎么用', '外文原句', '白话'],
  ...D.pieces.map(p => [
    p.t, p.a || '', p.w || '', p.d || '',
    (p.s || []).join(','), (p.m || []).join(','),
    p.n || '', p.o || '', p.x || ''
  ])];

// ── 说明 ──────────────────────────────────────
const helpRows = [
  ['词句数据 · 使用说明'],
  [''],
  ['本表是网站「词句」的唯一数据源。改完保存后运行：node build/build.mjs 重新生成网站。'],
  [''],
  ['【词句】工作表：每一行是一条可复制的好词好句。'],
  ['  正文     ：必填。要展示的句子本身。'],
  ['  作者     ：如 李白 / 泰戈尔。可空，空则记「佚名」。'],
  ['  作品     ：出处，如 将进酒。可空。'],
  ['  年代国别 ：如 唐 / 现代 / 印度。用于判断「古典/现代/外国」来源。'],
  ['  场景id   ：逗号分隔，可多个。须与【场景】表的 id 一致，如 dengding,fangbang。'],
  ['  心情id   ：逗号分隔，可多个。须与【心情】表的 id 一致，如 haomai,shiran。'],
  ['  怎么用   ：给用户的实用提示，说明适合什么渠道/怎么搭配。'],
  ['  外文原句 ：填了即标记为「外国」来源（金句/诗歌/电影台词原句）。'],
  ['  白话     ：通俗解释，可选。'],
  [''],
  ['【场景】工作表：83 个具体处境。大类id 须对应【大类】表的 id。不要随意改 id，改了要同步改词句里的引用。'],
  ['【心情】工作表：20 种情绪标签。'],
  ['【大类】工作表：12 个场景大类。'],
  [''],
  ['构建会做去重（同句只保留首次）与 id 纠错，并把告警打印在终端。'],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(groupsRows), '大类');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sceneRows), '场景');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(moodRows), '心情');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pieceRows), '词句');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(helpRows), '说明');

XLSX.writeFile(wb, OUT);
console.log(`\n  已生成数据源：${path.relative(ROOT, OUT)}`);
console.log(`  词句 ${D.pieces.length} 条 · 场景 ${D.scenes.length} 个 · 大类 ${D.groups.length} 个 · 心情 ${D.moods.length} 种\n`);
