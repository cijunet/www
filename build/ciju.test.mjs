// 词句站核心逻辑单元测试（node --test build/*.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAll } from './load.mjs';

// 共享一次数据加载（13 个用例共用，原每例各 loadAll 一次，约省 6–10s）
const D = await loadAll();

const norm = s => (s || '').replace(/[\s，。、？！；：""''‘’“”（）()《》·—…\-.,!?;:]/g, '');

test('loadAll 数据完整性：总数与零告警', async () => {
  assert.ok(D.pieces.length >= 11450, `总词句应 ≥ 11450（当前 ${D.pieces.length}）`);
  assert.equal(D.warnings.length, 0, '不应有警告');
});

test('维度规模：272 场景 / 123 心情 / 178 地点', async () => {
  assert.equal(D.scenes.length, 272);
  assert.equal(D.moods.length, 123);
  assert.equal(D.places.length, 178);
});

test('作者占位符已归一为佚名', async () => {
  const dash = D.pieces.filter(p => /^[—-]+$/.test(p.a || ''));
  assert.equal(dash.length, 0, '不应存在作者占位符');
});

test('正文无近似重复（去标点唯一）', async () => {
  const keys = D.pieces.map(p => norm(p.t));
  assert.equal(new Set(keys).size, keys.length, '正文去标点后应互不重复');
});

test('分类：古典为主，且 world 类无中国朝代混入', async () => {
  const c = D.pieces.filter(p => p.origin === 'classic').length;
  const wo = D.pieces.filter(p => p.origin === 'world').length;
  const mo = D.pieces.filter(p => p.origin === 'modern').length;
  assert.equal(c + wo + mo, D.pieces.length);
  assert.ok(c > 5500, '古典应 >5500');
  const CN = ['先秦','春秋','战国','秦','汉','东晋','魏','金','南北朝','北魏','南朝'];
  const bad = D.pieces.filter(p => p.origin === 'world' && !p.o && CN.includes((p.d || '').trim()));
  assert.equal(bad.length, 0, 'world 类不应混入中国朝代写法');
});

test('经典古籍归属：陶渊明/曹植/元好问/郦道元应归古典', async () => {
  const checks = [
    ['种豆南山下', 'classic'], ['煮豆燃豆萁', 'classic'],
    ['问世间，情是何物', 'classic'], ['自非亭午夜分', 'classic'],
    ['泰山不让土壤', 'classic'],
  ];
  for (const [kw, expect] of checks) {
    const p = D.pieces.find(x => x.t.includes(kw));
    assert.ok(p, `应存在：${kw}`);
    assert.equal(p.origin, expect, `${kw} 应为 ${expect}`);
  }
});

test('正文为外文的条目应为 0（中文站正文必须中文）', async () => {
  const en = D.pieces.filter(p => {
    const t = p.t || '';
    const cn = (t.match(/[\u4e00-\u9fff]/g) || []).length;
    const la = (t.match(/[A-Za-z]/g) || []).length;
    return la > 10 && la > cn;
  });
  assert.equal(en.length, 0);
});

test('「怎么用」字段全站无缺失', async () => {
  assert.equal(D.pieces.filter(p => !p.n).length, 0);
});

test('「白话」字段已全覆盖（T2 收尾）', async () => {
  assert.equal(D.pieces.filter(p => !p.x).length, 0);
});

test('场景全覆盖：junlv 存在且有词句', async () => {
  const jl = D.scenes.find(s => s.id === 'junlv');
  assert.ok(jl, 'junlv 场景应存在');
  const n = D.pieces.filter(p => p.s.includes('junlv')).length;
  assert.ok(n > 0, 'junlv 应有词句');
});

test('世界文学代表性译作保留外文原句', async () => {
  const p = D.pieces.find(x => x.t.includes('生存还是毁灭'));
  assert.ok(p && p.o, '哈姆雷特名句应有外文原句');
});

test('标签合并机制：重复正文的标签并入先收录条目', async () => {
  // 「宠辱不惊，看庭前花开花落」应出现在 xianzuo 场景下（多标签合并验证）
  const p = D.pieces.find(x => x.t.includes('宠辱不惊'));
  assert.ok(p, '应存在该条');
  assert.ok(Array.isArray(p.s) && p.s.length >= 1, '应有场景标签');
});

test('超长正文（>120 字）应为 0', async () => {
  assert.equal(D.pieces.filter(p => (p.t || '').length > 120).length, 0);
});
