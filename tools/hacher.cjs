#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const dataFile = process.env.HACHER_DATA_FILE || path.join(process.env.APPDATA || '', 'hacher-workbench', 'hacher-data.json');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const cleanArgs = args.filter(arg => arg !== '--apply');

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
      inventoryImports: Array.isArray(parsed.inventoryImports) ? parsed.inventoryImports : [],
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      briefings: Array.isArray(parsed.briefings) ? parsed.briefings : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      englishPlans: Array.isArray(parsed.englishPlans) ? parsed.englishPlans : [],
      papers: Array.isArray(parsed.papers) ? parsed.papers : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      userProfile: parsed.userProfile && typeof parsed.userProfile === 'object' ? {...parsed.userProfile,avatar:parsed.userProfile.avatar?'[本地头像已设置]':''} : {},
      updatedAt: parsed.updatedAt || null,
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { tasks: [], inventory: [], inventoryImports: [], conversations: [], memories: [], briefings: [], topics: [], englishPlans: [], papers: [], events: [], projects: [], userProfile: {}, updatedAt: null };
    fail(`无法读取工作台数据：${error.message}`);
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const backup = `${dataFile}.agent-backup`;
  const temporary = `${dataFile}.${process.pid}.tmp`;
  if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, backup);
  fs.writeFileSync(temporary, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
  try {
    fs.renameSync(temporary, dataFile);
  } catch {
    fs.copyFileSync(temporary, dataFile);
    fs.unlinkSync(temporary);
  }
}

function option(name, fallback = '') {
  const index = cleanArgs.indexOf(`--${name}`);
  return index >= 0 && cleanArgs[index + 1] ? cleanArgs[index + 1] : fallback;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function preview(action, changes) {
  if (!apply) {
    output({ status: 'preview', action, changes, message: '尚未修改。获得用户确认后，用同一命令加 --apply。' });
    process.exit(0);
  }
}

function findByIdOrTitle(items, value, titleKey = 'title') {
  return items.find(item => String(item.id) === value) || items.find(item => String(item[titleKey]).toLowerCase() === value.toLowerCase());
}

function normalizeTopicName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN');
}

const state = readState();
const [area = 'help', command = ''] = cleanArgs;

if (area === 'context') {
  output({
    updatedAt: state.updatedAt,
    tasks: { total: state.tasks.length, open: state.tasks.filter(item => !item.done).length, items: state.tasks },
    inventory: { types: state.inventory.length, total: state.inventory.reduce((sum, item) => sum + (Number(item.qty) || 0), 0), items: state.inventory },
    memories: state.memories,
    englishPlans: state.englishPlans,
    papers: state.papers,
    events: state.events,
    projects: state.projects,
    topics: state.topics.map(t => ({ id: t.id, name: t.name, results: (t.results || []).length, searchedAt: t.searchedAt })),
  });
} else if (area === 'task' && command === 'list') {
  output(state.tasks);
} else if (area === 'task' && command === 'add') {
  const title = cleanArgs[2];
  if (!title) fail('用法：task add "任务标题" [--time "今天"] [--apply]');
  const task = { id: Date.now(), title, meta: option('meta', 'Agent 创建 · 待处理'), time: option('time', '待安排'), done: false, createdAt: new Date().toISOString() };
  preview('task.add', task);
  state.tasks.unshift(task); writeState(state); output({ status: 'applied', task });
} else if (area === 'task' && command === 'complete') {
  const value = cleanArgs[2];
  const task = value && findByIdOrTitle(state.tasks, value);
  if (!task) fail('没有找到对应任务，请先运行 task list。');
  preview('task.complete', { id: task.id, title: task.title, done: true });
  task.done = true; task.completedAt = new Date().toISOString(); writeState(state); output({ status: 'applied', task });
} else if (area === 'inventory' && command === 'list') {
  output(state.inventory);
} else if (area === 'inventory' && command === 'add') {
  const name = cleanArgs[2];
  if (!name) fail('用法：inventory add "元件名" [--qty 1] [--category 分类] [--spec 型号] [--location 位置] [--apply]');
  const qty = Math.max(0, Number(option('qty', '1')) || 0);
  const part = { name, category: option('category', '未分类'), spec: option('spec', '待补充'), location: option('location', '未分配'), qty, createdAt: new Date().toISOString() };
  preview('inventory.add', part);
  state.inventory.unshift(part); writeState(state); output({ status: 'applied', part });
} else if (area === 'inventory' && command === 'set') {
  const name = cleanArgs[2];
  const qty = Number(cleanArgs[3]);
  const part = name && findByIdOrTitle(state.inventory, name, 'name');
  if (!part) fail('没有找到对应元件，请先运行 inventory list。');
  if (!Number.isFinite(qty) || qty < 0) fail('库存数量必须是大于或等于 0 的数字。');
  preview('inventory.set', { name: part.name, from: part.qty, to: qty });
  part.qty = qty; part.updatedAt = new Date().toISOString(); writeState(state); output({ status: 'applied', part });
} else if (area === 'memory' && command === 'list') {
  output(state.memories);
} else if (area === 'memory' && command === 'add') {
  const text = cleanArgs[2];
  if (!text) fail('用法：memory add "需要记住的内容" [--apply]');
  const memory = { text, source: 'Claude Agent', createdAt: new Date().toISOString() };
  preview('memory.add', memory);
  state.memories.unshift(memory); writeState(state); output({ status: 'applied', memory });
} else if (area === 'topic' && command === 'list') {
  output(state.topics.map(t => ({
    id: t.id,
    name: t.name,
    results: (t.results || []).length,
    searchedAt: t.searchedAt || '未搜索',
    createdAt: t.createdAt,
  })));
} else if (area === 'topic' && command === 'add') {
  const name = cleanArgs[2];
  if (!name) fail('用法：topic add "主题名称" [--apply]');
  const existing = state.topics.find(t => normalizeTopicName(t.name) === normalizeTopicName(name));
  if (existing) { output({ status: 'exists', topic: existing }); process.exit(0); }
  const topic = { id: Date.now(), name: name.trim(), createdAt: new Date().toISOString(), searchedAt: null, results: [] };
  preview('topic.add', topic);
  state.topics.push(topic); writeState(state); output({ status: 'applied', topic });
} else if (area === 'topic' && command === 'delete') {
  const value = cleanArgs[2];
  const topic = value && (state.topics.find(t => String(t.id) === value) || state.topics.find(t => t.name.toLowerCase() === value.toLowerCase()));
  if (!topic) fail('没有找到对应主题，请先运行 topic list。');
  preview('topic.delete', { id: topic.id, name: topic.name });
  state.topics = state.topics.filter(t => t.id !== topic.id); writeState(state); output({ status: 'applied', deleted: topic.name });
} else {
  output({
    name: 'hacher 数据桥',
    dataFile,
    commands: ['context', 'task list', 'task add', 'task complete', 'inventory list', 'inventory add', 'inventory set', 'memory list', 'memory add', 'topic list', 'topic add', 'topic delete'],
    safety: '写入命令默认预览；确认后添加 --apply。',
  });
}
