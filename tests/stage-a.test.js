'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const root = __dirname + '/..';

function createStorage(seed = {}, failWrites = false) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (failWrites) throw new Error('quota exceeded');
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key); },
  };
}

function createContext(storage) {
  const commands = {};
  const output = [];
  const context = vm.createContext({
    console,
    navigator: { userAgent: 'TermResume test' },
    localStorage: storage,
    setTimeout,
    clearTimeout,
    Blob,
    URL: {
      createObjectURL() { return 'blob:test'; },
      revokeObjectURL() {},
    },
    document: {
      createElement() { return { click() {}, remove() {}, files: null }; },
      body: { appendChild() {} },
      getElementById() { return null; },
      querySelector() { return null; },
    },
    addCmd(name, cat, desc, usage, run) { commands[name] = { cat, desc, usage, run }; },
    writeText(text, cls) { output.push({ text, cls }); },
    writeHTML(text, cls) { output.push({ text, cls }); },
    blankLine() {},
    esc(value) { return String(value); },
  });
  context.commands = commands;
  context.output = output;
  return context;
}

function runFiles(context, files) {
  files.forEach((file) => {
    vm.runInContext(fs.readFileSync(root + '/' + file, 'utf8'), context, { filename: file });
  });
}

function value(context, expression) {
  return vm.runInContext(expression, context);
}

{
  const context = createContext(createStorage());
  runFiles(context, ['config.js', 'data.js', 'session.js']);
  assert.equal(value(context, 'getProfile().awards.length'), 2);
  assert.equal(value(context, 'VFS.home[CONFIG.user].blog["first-post.md"].content[0]'), '# 你好，博客');
  assert.equal(value(context, 'getProfile().school'), '成都理工大学');
  assert.equal(value(context, 'getProfile().projects.length'), 3);
  assert.equal(JSON.parse(value(context, 'exportProfileJson()')).schemaVersion, 3);
}

{
  const legacy = {
    name: '旧用户',
    role: '开发者',
    awards: [
      { id: 'a1', title: '示例奖项' },
      { id: 'custom', title: '保留的奖项' },
    ],
    certificates: [{ id: 'c1', name: '示例证书' }],
    blogs: [{ id: 'b1', title: '旧博客', date: '2026-01-01', tags: [], content: '正文' }],
  };
  const context = createContext(createStorage({ 'guestos-profile': JSON.stringify(legacy) }));
  runFiles(context, ['config.js', 'data.js', 'session.js']);
  assert.equal(value(context, 'getProfile().awards.length'), 3);
  assert.equal(value(context, 'getProfile().awards.some((a) => a.id === "custom")'), true);
  assert.equal(value(context, 'getProfile().certificates.length'), 0);
  assert.equal(value(context, 'getProfile().blogs[0].slug'), 'first-post');
  assert.equal(value(context, 'getProfile().school'), '成都理工大学');
  assert.equal(value(context, 'getProfile().projects.length'), 3);
  assert.equal(JSON.parse(context.localStorage.dump('guestos-profile')).schemaVersion, 3);
}

{
  const context = createContext(createStorage());
  runFiles(context, ['config.js', 'data.js', 'session.js']);
  assert.equal(value(context, 'importProfileData("{}")'), false);
  assert.match(value(context, 'getLastStorageError()'), /TermResume/);
  assert.equal(value(context, 'importProfileData(JSON.stringify({ schemaVersion: 99, profile: { name: "x" } }))'), false);
  assert.match(value(context, 'getLastStorageError()'), /高于当前支持/);
}

{
  const storage = createStorage();
  const context = createContext(storage);
  runFiles(context, ['config.js', 'data.js', 'session.js']);
  value(context, 'getProfile().name = "保存前"; saveProfile()');
  storage.setItem = () => { throw new Error('quota exceeded'); };
  assert.equal(value(context, 'getProfile().name = "不能保存"; saveProfile()'), false);
  assert.equal(value(context, 'getProfile().name'), '保存前');
  assert.match(value(context, 'getLastStorageError()'), /quota exceeded/);
}

{
  const context = createContext(createStorage());
  runFiles(context, ['config.js', 'data.js', 'session.js', 'admin.js']);
  context.commands.awards.run(['list']);
  assert.equal(context.output.some((line) => /Python/.test(line.text)), true);
  context.commands.awards.run(['del', 'a-lqb-python-2026']);
  assert.match(context.output.at(-1).text, /只读模式/);
  value(context, 'setSession(AUTH.username, "admin")');
  context.commands.profile.run(['set', 'school=测试大学']);
  assert.equal(value(context, 'getProfile().school'), '测试大学');
  value(context, 'getProfile().projects.push({ id: "p-test", slug: "test-project", title: "测试项目", summary: "测试简介", stack: "JS", url: "", readme: [] }); saveProfile()');
  assert.equal(value(context, 'VFS.home[CONFIG.user].projects["test-project"]["README.md"].content[2]'), '**测试项目**');
  context.commands.blog.run(['add', '参数测试', '-d', '2026-09-04', '-t', '技术,终端']);
  assert.equal(value(context, 'getProfile().blogs.at(-1).title'), '参数测试');
  assert.equal(value(context, 'getProfile().blogs.at(-1).date'), '2026-09-04');
  assert.equal(value(context, 'getProfile().blogs.at(-1).tags.join(",")'), '技术,终端');
  assert.equal(value(context, 'Object.keys(VFS.home[CONFIG.user].blog).filter((x) => x !== "_meta").length'), 2);
}

console.log('stage-a tests: ok');
