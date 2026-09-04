'use strict';

/* =====================================================================
 * terminal.js —— 虚拟终端命令引擎
 * 支持 cd / ls / cat / tree 等命令漫游 data.js 里的虚拟文件系统。
 * =================================================================== */

/* ---------- DOM ---------- */
const screenEl = document.getElementById('screen');
const historyEl = document.getElementById('history');
const inputEl = document.getElementById('cmd-input');
const formEl = document.getElementById('cmdline');
const pathEl = document.querySelector('.prompt .p-path');
const liveUserEl = document.querySelector('.cmdline .p-user');
const liveHostEl = document.querySelector('.cmdline .p-host');
const titleEl = document.querySelector('.term-title');

/* ---------- 会话 / 履历（由 session.js、admin.js 提供） ---------- */
function activeUser() {
  return typeof currentUser === 'function' ? currentUser() : CONFIG.user;
}

function activeRole() {
  return typeof currentRole === 'function' ? currentRole() : 'guest';
}

/* ---------- 终端状态 ---------- */
let cwd = CONFIG.home;
let oldPwd = CONFIG.home;
const shellHistory = [];
let histPos = 0;
const bootTime = Date.now();
let autoTimer = null;
let autoDemoing = false;
let booting = true;
let skipBoot = false;

/* =====================================================================
 * 基础工具
 * =================================================================== */
function esc(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function fill(str) {
  return String(str)
    .replaceAll('{name}', CONFIG.name)
    .replaceAll('{title}', CONFIG.title)
    .replaceAll('{school}', CONFIG.school || '')
    .replaceAll('{user}', CONFIG.user)
    .replaceAll('{host}', CONFIG.host)
    .replaceAll('{location}', CONFIG.location)
    .replaceAll('{email}', CONFIG.email)
    .replaceAll('{website}', CONFIG.website)
    .replaceAll('{github}', CONFIG.github || '')
    .replaceAll('{osName}', CONFIG.osName)
    .replaceAll('{VERSION}', VERSION);
}

function padRight(str, width) {
  str = String(str);
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function scrollDown() {
  screenEl.scrollTop = screenEl.scrollHeight;
}

function writeHTML(html, cls = '') {
  const div = document.createElement('div');
  div.className = 'o' + (cls ? ' ' + cls : '');
  div.innerHTML = html;
  historyEl.appendChild(div);
  scrollDown();
}

function writeText(text, cls = '') {
  writeHTML(esc(text), cls);
}

function blankLine() {
  historyEl.appendChild(document.createElement('div')).className = 'o gap';
  scrollDown();
}

function writeError(msg) {
  writeText(msg, 'red');
}

/* =====================================================================
 * 简易 Markdown 行渲染（够用即可）
 * =================================================================== */
function styleInline(html) {
  html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="bold">$1</span>');
  html = html.replace(/`([^`]+)`/g, '<span class="green">$1</span>');
  html = html.replace(
    /\[([^\]]+)\]\(((?:https?:|mailto:)[^)]+)\)/g,
    '<a class="link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return html;
}

function mdToHtml(rawLine) {
  const text = fill(rawLine);
  let html = esc(text);

  const heading = html.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    return '<span class="yellow bold">' + styleInline(heading[2]) + '</span>';
  }

  const quote = html.match(/^&gt;\s*(.*)$/);
  if (quote) {
    return '<span class="dim">▍ ' + styleInline(quote[1]) + '</span>';
  }

  const dash = html.match(/^[-*]\s+(.*)$/);
  if (dash) {
    return '<span class="cyan">-</span> ' + styleInline(dash[1]);
  }

  const num = html.match(/^(\d+)\.\s+(.*)$/);
  if (num) {
    return '<span class="cyan">' + num[1] + '.</span> ' + styleInline(num[2]);
  }

  return styleInline(html);
}

/* =====================================================================
 * 虚拟文件系统：路径解析与访问
 * =================================================================== */
function isDir(node) {
  return !!(node && node._meta && node._meta.type === 'dir');
}

function isFile(node) {
  return !!(node && node._meta && node._meta.type === 'file');
}

function childNames(node) {
  return Object.keys(node).filter((k) => k !== '_meta');
}

function normalizePath(path) {
  const stack = [];
  String(path)
    .split('/')
    .forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') {
        if (stack.length) stack.pop();
        return;
      }
      stack.push(part);
    });
  return '/' + stack.join('/');
}

function absPath(raw) {
  let p = String(raw || '').trim() || cwd;
  if (p === '~') p = CONFIG.home;
  else if (p.startsWith('~/')) p = CONFIG.home + p.slice(1);
  else if (!p.startsWith('/')) p = cwd + '/' + p;
  return normalizePath(p);
}

function getNode(path) {
  const parts = normalizePath(path).split('/').filter(Boolean);
  let node = VFS;
  for (const part of parts) {
    if (!isDir(node) || !Object.prototype.hasOwnProperty.call(node, part)) return null;
    node = node[part];
  }
  return node;
}

function canAccess(node, mode) {
  const perms = node._meta.perms || '';
  if (perms.length < 10) return true;
  const sameOwner = node._meta.owner === CONFIG.user;
  const index = mode === 'exec' ? (sameOwner ? 3 : 9) : sameOwner ? 1 : 7;
  const c = perms.charAt(index);
  if (mode === 'exec') return c === 'x' || c === 's' || c === 't';
  return c === 'r';
}

function contentOf(node) {
  if (!isFile(node)) return [];
  const c = node.content;
  return typeof c === 'function' ? c() : c;
}

function calcSize(node) {
  if (isDir(node)) return 4096;
  const lines = contentOf(node);
  return Array.isArray(lines) ? lines.join('\n').length + lines.length : String(lines).length;
}

function sortedEntries(node, all) {
  return childNames(node)
    .filter((n) => all || !n.startsWith('.'))
    .sort((a, b) => {
      const da = isDir(node[a]) ? 1 : 0;
      const db = isDir(node[b]) ? 1 : 0;
      if (da !== db) return db - da;
      return a.localeCompare(b);
    });
}

function statLine(node, name) {
  const m = node._meta;
  const isD = isDir(node);
  const color = isD ? 'cyan' : m.owner !== CONFIG.user ? 'yellow' : '';
  const shown = name + (isD ? '/' : '');
  const size = String(calcSize(node)).padStart(6);
  const user = padRight(m.owner, 6);
  const group = padRight(m.group, 6);
  const head =
    `<span class="dim">${m.perms}   1 ${user} ${group} ${size} ${m.mtime}</span>`;
  return (
    head +
    ' <span class="' +
    color +
    '">' +
    esc(shown) +
    '</span>'
  );
}

function notFound(path) {
  writeError(`bash: ${path || ''}: 没有那个文件或目录`);
}

/* =====================================================================
 * 提示符
 * =================================================================== */
function prettyPath() {
  if (cwd === CONFIG.home) return '~';
  if (cwd.startsWith(CONFIG.home + '/')) return '~' + cwd.slice(CONFIG.home.length);
  return cwd;
}

function refreshPrompt() {
  pathEl.textContent = prettyPath();
}

/* hero 区粗体快捷入口：点击 -> 逐字敲命令 -> 跳转 */
function bindHeroLinks() {
  historyEl.querySelectorAll('.hero-link[data-cmd]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      if (booting) return;
      stopAutoDemo();
      gotoWithTyping(a.getAttribute('data-cmd'));
    });
  });
}

function promptHTML() {
  const ps = activeRole() === 'admin' ? '#' : '$';
  return (
    `<span class="p-user">${activeUser()}</span>` +
    '<span class="p-at">@</span>' +
    `<span class="p-host">${CONFIG.host}</span>` +
    '<span class="p-colon">:</span>' +
    `<span class="p-path">${prettyPath()}</span>` +
    '<span class="p-dollar">' + ps + '</span>'
  );
}

/* =====================================================================
 * 侧栏：个人资料 / 快捷目录 / 会话状态
 * =================================================================== */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* 标题与顶部品牌：全部跟随 config，避免写死 user@host / GuestOS */
function initTitles() {
  const ps = activeRole() === 'admin' ? '#' : '$';
  const admin = activeRole() === 'admin';
  if (liveUserEl) liveUserEl.textContent = activeUser();
  const liveAtEl = document.querySelector('.cmdline .p-at');
  const liveColonEl = document.querySelector('.cmdline .p-colon');
  const liveDollarEl = document.querySelector('.cmdline .p-dollar');
  if (liveHostEl) liveHostEl.textContent = CONFIG.host;
  if (liveAtEl) liveAtEl.textContent = '@';
  if (liveColonEl) liveColonEl.textContent = ':';
  if (liveDollarEl) liveDollarEl.textContent = ps;
  if (titleEl) titleEl.textContent = `${activeUser()}@${CONFIG.host}: ~`;
  document.title = `${activeUser()}-${SITE_CONTENT.productName}`;
  const brandEl = document.getElementById('app-brand-name');
  if (brandEl) brandEl.textContent = SITE_CONTENT.productName;
  setText('availability-text', SITE_CONTENT.availabilityText);
  const descriptionEl = document.getElementById('document-description');
  if (descriptionEl) descriptionEl.setAttribute('content', SITE_CONTENT.documentDescription);
  setText('session-tag', admin ? 'admin' : 'zsh');
  setText('session-status', admin ? 'ADMIN · 本地维护会话' : 'NORMAL · 虚拟只读系统');
  document.documentElement.setAttribute('data-role', admin ? 'admin' : 'guest');
}

/* 登录 / 登出 / 资料变化后刷新全部展示 */
function refreshAllUI() {
  initTitles();
  refreshPrompt();
  if (liveUserEl) liveUserEl.textContent = activeUser();
}

/* 侧栏快速指令动画：先逐字敲出命令，再回车执行 / 跳转 */
function gotoWithTyping(cmd) {
  /* 图形页里输入行不可见：跳到终端（#/terminal）播放指令 */
  const play = () => {
    if (autoTimer) stopAutoDemo();
    inputEl.value = '';
    inputEl.focus();
    autoTypeCommand(cmd);
  };
  if (typeof location !== 'undefined') {
    const route = (location.hash.replace(/^#\/?/, '') || 'terminal').toLowerCase();
    const onTerminal = route === 'terminal' || route === 't' || route === 'home';
    if (onTerminal) { play(); return; }
    location.hash = '#/terminal';
    setTimeout(play, 260);
  } else {
    play();
  }
}

/* =====================================================================
 * 白天 / 黑夜模式切换
 * =================================================================== */
const DAY_MODE_START_HOUR = 6;
const DAY_MODE_END_HOUR = 18;

function modeFromLocalTime(date = new Date()) {
  const hour = date.getHours();
  return hour >= DAY_MODE_START_HOUR && hour < DAY_MODE_END_HOUR ? 'day' : 'night';
}

function applyMode(mode) {
  const isDay = mode === 'day';
  document.documentElement.setAttribute('data-theme', isDay ? 'day' : 'night');
  const btn = document.getElementById('mode-toggle');
  const icon = document.getElementById('mode-icon');
  const text = document.getElementById('mode-text');
  if (btn) btn.setAttribute('aria-pressed', String(isDay));
  if (icon) icon.textContent = isDay ? '☀' : '☾';
  if (text) text.textContent = isDay ? '白天模式' : '暗黑模式';
}

function initMode() {
  const btn = document.getElementById('mode-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'day' ? 'night' : 'day';
      applyMode(next);
    });
  }
  applyMode(modeFromLocalTime());
}

/* =====================================================================
 * 输出：neofetch / 帮助 / 文件视图
 * =================================================================== */
function tuxArt() {
  const width = Math.max(...TUX.map((l) => l.length));
  return TUX.map((l) => l.padEnd(width + 2)).join('\n');
}

function asciiBannerLines() {
  return (SITE_CONTENT.asciiArt || []).map((r) => r.replace(/\s+$/, ''));
}

function nameBlockHTML() {
  const banner = asciiBannerLines(CONFIG.asciiName || '');
  const title = banner
    ? '<pre class="name-banner">' + banner.join('\n') + '</pre>'
    : '<div class="hero-title">' + esc(CONFIG.name || 'Welcome') + '</div>';
  return (
    '<section class="identity-block">' +
    '<div class="identity-kicker"><span>~/identity</span><i></i><span>PUBLIC PROFILE</span></div>' +
    title +
    '<div class="identity-footer">' +
    '<strong>' + esc(CONFIG.name) + ' / ' + esc(CONFIG.asciiName) + '</strong>' +
    '<span>' + esc(CONFIG.title) + (CONFIG.school ? ' · ' + esc(CONFIG.school) : '') + '</span>' +
    '</div>' +
    '</section>'
  );
}

function renderNeo() {
  const rows = [
    ['用户', `<span class="green bold">${esc(activeUser())}@${esc(CONFIG.host)}</span>`],
    ['主机', esc(CONFIG.host)],
    ['身份', esc(CONFIG.title)],
  ];
  if (CONFIG.location) rows.push(['位置', esc(CONFIG.location)]);
  rows.push(
    ['系统', esc(CONFIG.osName) + ' ' + VERSION],
    ['内核', esc(CONFIG.osId) + '-kernel ' + VERSION + ' (web)'],
    ['Shell', 'zsh 5.9 (仿制版)']
  );
  if (CONFIG.website) {
    rows.push([
      '站点',
      `<a class="link" href="${esc(CONFIG.website)}" target="_blank" rel="noopener noreferrer">${esc(CONFIG.website)}</a>`,
    ]);
  }
  const meta = rows
    .map(
      ([k, v]) =>
        '<div class="r"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>'
    )
    .join('');

  const p = typeof getProfile === 'function' ? getProfile() : {};
  const items = SITE_CONTENT.quickLinks || [];
  const links =
    '<div class="command-deck"><div class="command-deck-title"><span>QUICK ACCESS</span><span>点击或输入 goto</span></div>' +
    '<div class="hero-links">' +
    items
      .map(
        (it, index) =>
          '<a class="hero-link" data-cmd="goto ' + esc(it.route) + '" href="#/' + esc(it.route) + '">' +
          '<span class="hero-link-index">0' + (index + 1) + '</span>' +
          '<span><b>' + esc(it.route) + '</b><small>' + esc(it.label) + '</small></span></a>'
      )
      .join('') +
    (p.github
      ? '<a class="hero-link external" href="https://github.com/' + esc(p.github) + '" target="_blank" rel="noopener noreferrer"><span class="hero-link-index">↗</span><span><b>GitHub</b><small>源代码</small></span></a>'
      : '') +
    '</div></div>';

  return (
    '<section class="hero">' +
    '<div class="hero-system"><div class="hero-system-label">SYSTEM AVATAR</div><pre class="tux">' + tuxArt() + '</pre><span>STATUS / ONLINE</span></div>' +
    '<div class="hero-data"><div class="hero-system-label">SYSTEM PROFILE</div><div class="meta">' + meta + '</div></div>' +
    '<div class="hero-note"><div class="hero-system-label">README.EXCERPT</div><p>' + esc(p.bio || '保持好奇，把想法变成可以运行的东西。') + '</p><span class="hero-note-sign">— ' + esc(CONFIG.name) + '</span></div>' +
    '</section>' + links
  );
}

/* =====================================================================
 * 命令注册表
 * =================================================================== */
const COMMANDS = {};

function addCmd(name, cat, desc, usage, run, options = {}) {
  COMMANDS[name] = {
    name,
    cat,
    desc,
    usage,
    run,
    access: options.access || 'guest',
    guestDesc: options.guestDesc || '',
    guestUsage: options.guestUsage || '',
  };
}

const CATEGORIES = ['导航', '查看文件', '系统信息', '其他', '管理'];

function commandVisible(cmd) {
  return Boolean(cmd) && (cmd.access !== 'admin' || activeRole() === 'admin');
}

function visibleCommandNames() {
  return Object.values(COMMANDS)
    .filter(commandVisible)
    .map((cmd) => cmd.name);
}

function commandDescription(cmd) {
  if (activeRole() !== 'admin' && cmd.access === 'mixed') {
    return cmd.guestDesc || cmd.desc;
  }
  return cmd.desc;
}

function commandUsage(cmd) {
  if (activeRole() !== 'admin' && cmd.access === 'mixed') {
    return cmd.guestUsage || cmd.usage;
  }
  return cmd.usage;
}

/* ---------- 导航 ---------- */
function cmdCd(args) {
  let target;
  if (args[0] === '-') {
    target = oldPwd || CONFIG.home;
  } else {
    target = absPath(args[0] || '~');
  }
  const node = getNode(target);
  if (!node) {
    writeError(`bash: cd: ${args[0] || ''}: 没有那个文件或目录`);
    return;
  }
  if (!isDir(node)) {
    writeError(`bash: cd: ${args[0] || ''}: 不是目录`);
    return;
  }
  if (!canAccess(node, 'exec')) {
    writeError(`bash: cd: ${args[0] || ''}: 权限不够 (Permission denied)`);
    return;
  }
  oldPwd = cwd;
  cwd = target;
  refreshPrompt();
}

function cmdPwd() {
  writeText(cwd);
}

function cmdLs(args) {
  let flags = '';
  const targets = [];
  args.forEach((a) => {
    if (a.startsWith('-') && a.length > 1) flags += a.slice(1);
    else targets.push(a);
  });
  const long = flags.includes('l');
  const all = flags.includes('a') || flags.includes('A');
  if (!targets.length) targets.push('.');

  // 多目标：目录之间用标题分隔，文件单独列出
  const showList = (node, raw) => {
    if (!node) {
      writeError(`ls: 无法访问 '${raw}': 没有那个文件或目录`);
      return false;
    }
    if (!isDir(node)) {
      writeHTML(
        long
          ? statLine(node, raw)
          : '<span class="dim">' + esc(raw) + '</span>'
      );
      return true;
    }
    if (!canAccess(node, 'read')) {
      writeError(`ls: 无法打开目录 '${raw}': 权限不够`);
      return false;
    }
    const entries = sortedEntries(node, all);
    if (!entries.length) {
      blankLine();
      return true;
    }
    if (long) {
      let total = 0;
      entries.forEach((name) => {
        total += Math.ceil(calcSize(node[name]) / 1024) || 1;
      });
      writeHTML('<span class="dim">total ' + total + '</span>');
      entries.forEach((name) => writeHTML(statLine(node[name], name)));
    } else {
      const visible = (name) => name + (isDir(node[name]) ? '/' : '');
      const width = Math.max(...entries.map((n) => visible(n).length));
      const perRow = Math.max(2, Math.floor(62 / (width + 2)));
      for (let i = 0; i < entries.length; i += perRow) {
        const row = entries.slice(i, i + perRow).map((name) => {
          const isD = isDir(node[name]);
          const padded = padRight(visible(name), width + 2);
          if (isD) return `<span class="cyan">${esc(padded)}</span>`;
          if (name.startsWith('.')) return `<span class="dim">${esc(padded)}</span>`;
          return esc(padded);
        });
        writeHTML(row.join(''));
      }
    }
    return true;
  };

  const rawTargets = targets.map((t) => t);
  const multi = rawTargets.length > 1;
  rawTargets.forEach((raw, idx) => {
    const path = absPath(raw);
    const node = getNode(path);
    if (multi && isDir(node)) {
      const shown = raw.endsWith('/') ? raw.slice(0, -1) : raw;
      writeHTML(`<span class="dim">${esc(shown)}/:</span>`);
    } else if (multi && node && !isDir(node) && idx > 0) {
      // 文件目标之间也留一行分隔
      blankLine();
    }
    showList(node, raw);
  });
}

function cmdTree(args) {
  const all = args.includes('-a') || args.includes('-A');
  const dirOnly = args.includes('-d');
  const targets = args.filter((a) => !a.startsWith('-'));
  if (!targets.length) targets.push('.');
  const showOne = (target) => {
    const path = absPath(target);
    const node = getNode(path);
    if (!node) {
      writeError(`tree: ${target}: 没有那个文件或目录`);
      return;
    }
    if (!isDir(node)) {
      writeText(target + '（文件，用 cat / head 查看）', 'dim');
      return;
    }
    const lines = [];
    function walk(cur, prefix, dirName) {
      if (dirName) lines.push(prefix + (dirName === '/' ? '/' : esc(dirName) + '/'));
      const entries = sortedEntries(cur, all).filter((n) => {
        if (dirOnly) return isDir(cur[n]);
        return true;
      });
      entries.forEach((name, idx) => {
        const last = idx === entries.length - 1;
        const branch = last ? '└── ' : '├── ';
        const child = cur[name];
        if (isDir(child)) {
          lines.push(prefix + branch + `<span class="cyan">${esc(name)}/</span>`);
          walk(child, prefix + (last ? '    ' : '│   '), '');
        } else {
          const cls = name.startsWith('.') && !all ? 'dim' : '';
          const tag = cls ? `<span class="${cls}">${name}</span>` : esc(name);
          lines.push(prefix + branch + tag);
        }
      });
    }

    const rootName = path === '/' ? '/' : path.split('/').filter(Boolean).pop();
    walk(node, '', rootName);
    lines.push('');
    writeHTML(lines.join('\n'));
  };
  targets.forEach((target, idx) => {
    if (targets.length > 1) {
      if (idx > 0) blankLine();
      writeHTML('<span class="dim">' + esc(target) + ':</span>');
    }
    showOne(target);
  });
}

/* ---------- 查看文件 ---------- */
function openFile(rawPath, opts = {}) {
  const path = absPath(rawPath);
  const node = getNode(path);
  if (!node) {
    writeError(`cat: ${rawPath}: 没有那个文件或目录`);
    return;
  }
  if (isDir(node)) {
    writeError(`cat: ${rawPath}: 是一个目录（试试 cd 进入，再 cat README.md）`);
    return;
  }
  if (!canAccess(node, 'read')) {
    writeError(`cat: ${rawPath}: 权限不够 (Permission denied)`);
    return;
  }
  const lines = contentOf(node);
  lines.forEach((line, idx) => {
    const num = opts.number ? padRight(String(idx + 1) + ' ', 5) + '' : '';
    writeHTML((opts.number ? `<span class="dim">${num}</span>` : '') + mdToHtml(line));
  });
}

function cmdCat(args) {
  const targets = args.filter((a) => a !== '-n' && !/^\d+$/.test(a));
  const numbered = args.includes('-n');
  if (!targets.length) {
    writeText('用法: cat [-n] <文件>…', 'yellow');
    return;
  }
  if (targets.length > 1) {
    targets.forEach((t, i) => {
      writeHTML('<span class="dim">==&gt; ' + esc(t) + ' &lt;==</span>');
      openFile(t, { number: numbered });
      if (i < targets.length - 1) blankLine();
    });
  } else {
    openFile(targets[0], { number: numbered });
  }
}

function cmdHeadTail(args, isTail) {
  let count = 10;
  const files = [];
  for (const a of args) {
    if (/^-?\d+$/.test(a)) count = Math.abs(Number(a));
    else if (!a.startsWith('-')) files.push(a);
  }
  if (!files.length) {
    writeText(`用法: ${isTail ? 'tail' : 'head'} [-n] <文件>`, 'yellow');
    return;
  }
  const tool = isTail ? 'tail' : 'head';
  files.forEach((file, idx) => {
    const path = absPath(file);
    const node = getNode(path);
    if (!node || !isFile(node)) {
      writeError(`${tool}: ${file}: 无法读取`);
      return;
    }
    if (!canAccess(node, 'read')) {
      writeError(`${tool}: ${file}: 权限不够`);
      return;
    }
    if (files.length > 1) {
      if (idx > 0) blankLine();
      writeHTML('<span class="dim">==&gt; ' + esc(file) + ' &lt;==</span>');
    }
    const lines = contentOf(node);
    const part = isTail ? lines.slice(-count) : lines.slice(0, count);
    part.forEach((line) => writeHTML(mdToHtml(line)));
  });
}

/* ---------- 系统信息 ---------- */
function cmdHelp(args) {
  if (args[0]) {
    const target = args[0].replace(/^--?/, '');
    const cmd = COMMANDS[target];
    if (!cmd) {
      writeError(`help: 没有主题匹配 "${target}"`);
      return;
    }
    if (!commandVisible(cmd)) {
      writeError(`help: ${target} 仅管理员可用，请先输入 login`);
      return;
    }
    const accessNote = cmd.access === 'mixed'
      ? (activeRole() === 'admin' ? ' <span class="green">[可维护]</span>' : ' <span class="yellow">[只读]</span>')
      : '';
    const usage = commandUsage(cmd);
    writeHTML(`<span class="green bold">${cmd.name}</span>${accessNote}  ${esc(commandDescription(cmd))}`);
    if (usage) writeHTML(`<span class="dim">用法</span>  ${esc(usage)}`);
    return;
  }

  CATEGORIES.forEach((cat) => {
    const rows = Object.values(COMMANDS)
      .filter((c) => c.cat === cat && commandVisible(c))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!rows.length) return;
    const categoryLabel = cat === '管理' && activeRole() !== 'admin' ? '公开内容（只读）' : cat;
    writeHTML('<span class="help-cat">' + categoryLabel + '</span>');
    rows.forEach((c) => {
      const badge = c.access === 'mixed'
        ? (activeRole() === 'admin' ? ' <span class="green">[可维护]</span>' : ' <span class="yellow">[只读]</span>')
        : '';
      writeHTML(
        '<div class="help-row">' +
          `<span class="cyan">${padRight(c.name, 18)}</span>` +
          `<span class="dim">${esc(commandDescription(c))}</span>${badge}` +
          '</div>'
      );
    });
  });
  blankLine();
  writeHTML(
    '<span class="dim">先看页面：</span> `goto awards` · `goto resume` · `goto projects` · `goto certificates`'
  );
  writeHTML(
    '<span class="dim">目录漫游：</span> `cd projects` · `cat about.md` · `ls -la ~` · `tree ~`'
  );
  writeHTML(
    '<span class="dim">技巧：Tab 自动补全 · ↑/↓ 历史命令 · 支持 &amp;&amp; 连接 · ls/cat/head/tail/tree 支持 * 与 ? 通配符</span>'
  );
  if (activeRole() === 'admin') {
    writeHTML('<span class="green">当前为 Admin 管理模式，可维护公开内容。输入 logout 退出。</span>');
    writeHTML('<span class="dim">图形管理台：</span> `goto manage` · <span class="dim">管理命令速查：</span> `admin-help`');
  } else {
    writeHTML('<span class="yellow">当前为 Guest 只读模式。输入 login 进入管理模式。</span>');
  }
}

function cmdWhoami() {
  writeText(activeUser());
  writeHTML(
    `<span class="dim">uid=1000(${esc(activeUser())}) gid=1000(${esc(activeUser())}) groups=1000(${esc(activeUser())})</span>`
  );
}

function cmdDate() {
  const d = new Date();
  let str;
  try {
    str = d.toLocaleString('zh-CN', {
      timeZone: CONFIG.timezone,
      dateStyle: 'full',
      timeStyle: 'long',
    });
  } catch (_) {
    /* 时区名非法时回退到系统本地时间 */
    str = d.toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'long' });
  }
  writeText(str);
}

function cmdUname() {
  writeText(`Linux ${CONFIG.host} ${VERSION}-${CONFIG.osId} #1 SMP PREEMPT_DYNAMIC Web x86_64 GNU/Linux`);
}

function cmdUptime() {
  const mins = Math.max(1, Math.floor((Date.now() - bootTime) / 60000));
  const load = '0.12, 0.18, 0.15';
  writeText(
    ` ${CONFIG.host} up ${mins} min,  1 user,  load average: ${load}`
  );
}

function cmdNeofetch() {
  writeHTML(renderNeo());
}

function cmdBanner() {
  writeHTML(nameBlockHTML());
  writeHTML(renderNeo());
}

function cmdEcho(args) {
  writeText(args.join(' '));
}

function cmdHistory(args) {
  if (args[0] === '-c') {
    shellHistory.length = 0;
    writeText('历史记录已清空');
    return;
  }
  shellHistory.forEach((line, i) => {
    writeHTML(
      `<span class="dim">${String(i + 1).padStart(4)}</span>  <span class="green">${esc(line)}</span>`
    );
  });
}

function cmdClear() {
  historyEl.innerHTML = '';
  scrollDown();
}

function cmdSudo(args) {
  const joined = args.join(' ');
  if (/(^|\s)rm(\s|$)|-rf|--recursive/.test(joined)) {
    writeHTML('<span class="red">[sudo] 正在删除 / --force --recursive…</span>');
    blankLine();
    writeText('开玩笑的。这是一台只读演示机，你连自己的家目录都删不掉 : )');
    return;
  }
  writeHTML(
    `<span class="red">${esc(activeUser())} 不在 sudoers 文件中。</span>` +
      '<span class="dim"> 此事件已记录，并已上报给页面管理员。</span>'
  );
}

function cmdExit() {
  writeText('logout', 'green');
  blankLine();
  writeText('这里只是一个网页：没有真实的系统可以退出。', 'dim');
  writeText('想继续浏览的话，直接输入命令就好 —— 或者关掉标签页。', 'dim');
}

/* ---------- 注册命令 ---------- */
addCmd('help', '系统信息', '显示帮助或某个命令的用法', 'help [命令]', cmdHelp);
addCmd('whoami', '系统信息', '显示当前用户身份', 'whoami', cmdWhoami);
addCmd('pwd', '导航', '显示当前工作目录', 'pwd', cmdPwd);
addCmd('cd', '导航', '切换目录，支持 ~ / .. / - / 绝对与相对路径', 'cd [目录]（如 cd projects、cd /etc）', cmdCd);
addCmd('ls', '导航', '列出目录内容，-a 含隐藏文件，-l 显示详情', 'ls [-a] [-l] [目录]', cmdLs);
addCmd('tree', '导航', '以树状递归显示目录', 'tree [-a] [目录]', cmdTree);
addCmd('cat', '查看文件', '读取文件内容，-n 显示行号', 'cat [-n] <文件>', cmdCat);
addCmd('head', '查看文件', '查看文件开头（默认 10 行）', 'head [-n] <文件>', (a) => cmdHeadTail(a, false));
addCmd('tail', '查看文件', '查看文件结尾（默认 10 行）', 'tail [-n] <文件>', (a) => cmdHeadTail(a, true));
addCmd('neofetch', '系统信息', '用经典方式展示系统与个人信息', 'neofetch', cmdNeofetch);
addCmd('banner', '其他', '重新显示欢迎横幅', 'banner', cmdBanner);
addCmd('date', '系统信息', '显示当前日期时间', 'date', cmdDate);
addCmd('uname', '系统信息', '显示虚拟系统内核信息', 'uname', cmdUname);
addCmd('uptime', '系统信息', '显示页面运行时长', 'uptime', cmdUptime);
addCmd('history', '其他', '显示命令历史，-c 清空', 'history [-c]', cmdHistory);
addCmd('clear', '其他', '清空屏幕（alias: cls）', 'clear', cmdClear);
addCmd('echo', '其他', '输出一行文字', 'echo <文本>', cmdEcho);
addCmd('sudo', '其他', '尝试提权（本机为演示机）', 'sudo <命令>', cmdSudo);
addCmd('exit', '其他', '注销当前会话', 'exit', cmdExit);

/* 别名：ls、la、.. 等按真实 shell 习惯处理 */
const ALIASES = {
  ll: 'ls -la',
  la: 'ls -A',
  cls: 'clear',
  '..': 'cd ..',
  '.': 'echo .',
};

/* =====================================================================
 * 命令执行
 * =================================================================== */
function tokenize(str) {
  const match = str.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return match.map((t) =>
    t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))
      ? t.slice(1, -1)
      : t
  );
}

function expandVars(str) {
  const vars = {
    HOME: CONFIG.home,
    USER: activeUser(),
    USERNAME: activeUser(),
    HOSTNAME: CONFIG.host,
    PWD: cwd,
    OLDPWD: oldPwd,
    SHELL: '/bin/zsh',
    PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  };
  return str.replace(/\$(HOME|USER|USERNAME|HOSTNAME|PWD|OLDPWD|SHELL|PATH)\b/g, (m, k) => vars[k] || m);
}

/* =====================================================================
 * 通配符（glob）展开：支持 * 与 ?，只匹配当前层，不跨 /
 * 例如 ~/*.md、~/projects/*、*.txt
 * =================================================================== */
function globToRegExp(pattern) {
  let re = '';
  for (const ch of String(pattern)) {
    if (ch === '*') re += '[^/]*';
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

function hasGlob(str) {
  return /[*?]/.test(String(str));
}

/* 把一个路径模式展开成多个“显示用路径”，顺序稳定、目录/文件都保留 */
function globExpand(rawPattern) {
  const pattern = String(rawPattern || '').trim();
  if (!pattern || !hasGlob(pattern)) return [pattern];

  // 先转成绝对路径再分段逐层展开
  let abs;
  if (pattern === '~' || pattern.startsWith('~/')) abs = CONFIG.home + pattern.slice(1);
  else if (!pattern.startsWith('/')) abs = cwd + '/' + pattern;
  else abs = pattern;
  const segments = abs.split('/').filter(Boolean);
  // 找最后一个含通配符的段；它之后的段保持字面量，不做目录渗透
  let wildIdx = -1;
  segments.forEach((s, i) => { if (hasGlob(s)) wildIdx = i; });
  const wildSeg = wildIdx >= 0 ? segments[wildIdx] : null;
  const literalSegs = wildSeg === null ? segments : segments.slice(0, wildIdx);

  // 先沿字面段直接下钻（这些段必须逐字匹配）
  let level = [{ node: VFS, absPath: '/' }];
  let ok = true;
  for (const seg of literalSegs) {
    const next = [];
    level.forEach(({ node, absPath }) => {
      if (!isDir(node)) return;
      if (Object.prototype.hasOwnProperty.call(node, seg) && isDir(node[seg])) {
        next.push({ node: node[seg], absPath: absPath + seg + '/' });
      }
    });
    level = next;
    if (!level.length) break;
  }
  if (!level.length || !wildSeg) return [];

  // 在最后一层做单层 glob 匹配（不跨目录）
  const re = globToRegExp(wildSeg);
  const results = [];
  level.forEach(({ node, absPath }) => {
    if (!isDir(node)) return;
    childNames(node).forEach((name) => {
      if (name.startsWith('.') && !wildSeg.startsWith('.')) return; // 隐藏文件不被 * 带出
      if (!re.test(name)) return;
      results.push(absPath + name);
    });
  });
  results.sort((a, b) => a.localeCompare(b));

  // 还原成用户可读的路径形式（~ / 绝对 / 相对）
  const prefixTilde = pattern === '~' || pattern.startsWith('~/');
  const display = results
    .map((p) => {
      if (prefixTilde && p.startsWith(CONFIG.home)) return '~' + p.slice(CONFIG.home.length);
      if (!pattern.startsWith('/') && p.startsWith(cwd)) {
        const rel = p.slice(cwd.length);
        return rel.startsWith('/') ? rel.slice(1) : rel || '.';
      }
      return p;
    })
    .filter((p) => p && p !== '/');
  return display;
}

function runSegment(raw) {
  let args = tokenize(expandVars(raw));
  const name = args.shift();
  if (!name) return;
  const alias = ALIASES[name];
  if (alias) {
    runSegment(alias + (args.length ? ' ' + args.join(' ') : ''));
    return;
  }
  const cmd = COMMANDS[name];
  if (cmd) {
    if (!commandVisible(cmd)) {
      writeError(`${name}: 仅管理员可用，请先输入 login`);
      return;
    }
    /* 文件类命令：对含 * 或 ? 的参数做路径展开（echo 等不展开） */
    if (['ls', 'cat', 'head', 'tail', 'tree'].includes(name)) {
      const expanded = [];
      let failed = false;
      for (const arg of args) {
        if (arg.startsWith('-') || !hasGlob(arg)) {
          expanded.push(arg);
          continue;
        }
        const hits = globExpand(arg);
        if (!hits.length) {
          writeError(`bash: 无匹配: ${arg}`);
          failed = true;
          break;
        }
        expanded.push(...hits);
      }
      if (failed) return;
      args = expanded;
    }
    cmd.run(args);
  } else {
    writeError(`bash: ${name}: 未找到命令`);
    const candidates = visibleCommandNames()
      .concat(Object.keys(ALIASES))
      .filter((c) => c.startsWith(name))
      .slice(0, 5);
    if (candidates.length) {
      writeHTML('<span class="dim">最接近的命令：' + candidates.join('、') + '</span>');
    } else {
      writeHTML('<span class="dim">输入 help 查看所有可用命令。</span>');
    }
  }
}

/* 遮罩 login -p 的密码内容，避免明文出现在回显/历史里 */
function maskSensitive(raw) {
  const first = String(raw).trim().split(/\s+/)[0];
  if (first !== 'login') return raw;
  const parts = String(raw).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const out = [];
  parts.forEach((p, i) => {
    if (i > 0 && (parts[i - 1] === '-p' || parts[i - 1] === '--password')) {
      out.push('********');
    } else {
      out.push(p);
    }
  });
  return out.join(' ');
}

function echoCommand(raw) {
  const shown = maskSensitive(raw);
  const div = document.createElement('div');
  div.className = 'o';
  div.innerHTML = promptHTML() + ' <span class="p-cmd">' + esc(shown) + '</span>';
  historyEl.appendChild(div);
  scrollDown();
}

function processInput() {
  const raw = inputEl.value.trim();
  /* 交互登录（admin.js 提供 handlePromptInput）期间，输入走登录流程 */
  if (inputEl.dataset && inputEl.dataset.promptMode === '1' && typeof handlePromptInput === 'function') {
    const value = inputEl.value;
    inputEl.value = '';
    handlePromptInput(value);
    return;
  }
  inputEl.value = '';
  if (!raw) {
    blankLine();
    return;
  }
  shellHistory.push(maskSensitive(raw));
  histPos = shellHistory.length;
  echoCommand(raw);
  raw
    .split(/\s*&&\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach(runSegment);
}

formEl.addEventListener('submit', (e) => {
  e.preventDefault();
  if (booting) return;
  stopAutoDemo();
  processInput();
});

/* =====================================================================
 * 历史 / Tab 补全
 * =================================================================== */
function moveHistory(dir) {
  if (!shellHistory.length) return;
  histPos += dir;
  if (histPos < 0) histPos = 0;
  if (histPos > shellHistory.length) histPos = shellHistory.length;
  inputEl.value = histPos < shellHistory.length ? shellHistory[histPos] : '';
}

function listPossible(items) {
  writeHTML('<span class="dim">' + items.map(esc).join('　') + '</span>');
}

function completePathToken(prefix, token) {
  const slash = token.lastIndexOf('/');
  const base = token.slice(0, slash + 1);
  const partial = token.slice(slash + 1);
  const parentRaw = slash >= 0 ? base : cwd + '/';
  const parent = getNode(absPath(parentRaw));
  if (!parent || !isDir(parent)) return;
  const hits = childNames(parent)
    .filter((n) => n.startsWith(partial))
    .sort();
  if (hits.length === 1) {
    const hit = hits[0];
    const suffix = isDir(parent[hit]) ? '/' : ' ';
    inputEl.value = prefix + base + hit + suffix;
  } else if (hits.length > 1) {
    listPossible(hits.map((n) => n + (isDir(parent[n]) ? '/' : '')));
  }
}

function doComplete() {
  const value = inputEl.value;
  const spaceIdx = value.lastIndexOf(' ');
  const prefix = spaceIdx >= 0 ? value.slice(0, spaceIdx + 1) : '';
  const token = value.slice(spaceIdx + 1);
  if (!token) return;

  /* goto 子命令补全 */
  const head = prefix.trim().split(/\s+/)[0];
  if (head === 'goto') {
    const pages = ['awards', 'certificates', 'resume', 'projects', 'blog', 'docs', 'terminal', 't'];
    if (activeRole() === 'admin') pages.push('manage');
    const hits = pages.filter((p) => p.startsWith(token)).sort();
    if (hits.length === 1) {
      inputEl.value = prefix + hits[0];
    } else if (hits.length > 1) {
      listPossible(hits);
    }
    return;
  }

  if (token.includes('/') || token.startsWith('.') || token.startsWith('~')) {
    completePathToken(prefix, token);
    return;
  }
  const names = visibleCommandNames().concat(Object.keys(ALIASES)).filter((n) => n.startsWith(token)).sort();
  if (names.length === 1) {
    inputEl.value = prefix + names[0] + ' ';
  } else if (names.length > 1) {
    listPossible(names);
  }
}

function stopAutoDemo() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (autoDemoing) {
    autoDemoing = false;
    inputEl.value = '';
  }
}

inputEl.addEventListener('keydown', (e) => {
  /* 登录输入流程中不做命令历史/补全处理 */
  if (inputEl.dataset && inputEl.dataset.promptMode === '1') return;
  if (autoTimer || autoDemoing) stopAutoDemo();
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (!shellHistory.length) return;
    histPos = histPos > 0 ? histPos - 1 : 0;
    inputEl.value = shellHistory[histPos];
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (!shellHistory.length) return;
    histPos = histPos < shellHistory.length - 1 ? histPos + 1 : shellHistory.length;
    inputEl.value = histPos < shellHistory.length ? shellHistory[histPos] : '';
  } else if (e.key === 'Tab') {
    e.preventDefault();
    doComplete();
  }
});

/* 点击屏幕任意处聚焦输入框 */
screenEl.addEventListener('click', () => {
  if (!booting) inputEl.focus();
});

/* 图形页快捷唤起终端；使用物理键位以兼容中英文键盘布局。 */
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.altKey || e.metaKey || e.code !== 'Backquote') return;
  e.preventDefault();

  const focusCommandLine = () => {
    if (!inputEl.disabled) inputEl.focus();
  };
  const route = location.hash.replace(/^#\/?/, '').toLowerCase();
  if (!route || route === 'terminal' || route === 't' || route === 'home') {
    focusCommandLine();
    return;
  }

  location.hash = '#/terminal';
  requestAnimationFrame(focusCommandLine);
});

/* =====================================================================
 * 时钟
 * =================================================================== */
function tickClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;
  let text = '';
  try {
    text = new Date().toLocaleTimeString('zh-CN', {
      hour12: false,
      timeZone: CONFIG.timezone,
    });
  } catch (_) {
    /* 时区名非法时回退到系统本地时间，避免整个页面崩溃 */
    text = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }
  clockEl.textContent = text;
}

/* =====================================================================
 * 启动流程
 * =================================================================== */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function bootRow(label, text, cls) {
  const color = cls || 'green';
  writeHTML(
    `<span class="boot-prefix ${color}">[ ${label} ]</span> <span class="dim">${esc(text)}</span>`
  );
}

/* 页面打开后立刻显示：说明这块页面怎么玩 */
function showIntro() {
  const compactViewport = typeof matchMedia === 'function' && matchMedia('(max-width: 620px)').matches;
  if (compactViewport) {
    writeHTML(`<span class="green bold">${esc(activeUser())}@${esc(CONFIG.host)} · ${esc(CONFIG.asciiName)} / ${esc(SITE_CONTENT.productName.toUpperCase())}</span>`);
    writeHTML('<span class="dim">终端已连接。选择快捷入口，或输入 <span class="cyan">help</span> 开始探索。</span>');
    blankLine();
    return;
  }
  writeHTML(
    '<span class="dim">' + '─'.repeat(44) + '</span>'
  );
  writeHTML(
    `<span class="green bold">${esc(activeUser())}@${esc(CONFIG.host)} · ${esc(SITE_CONTENT.productName)} 交互式简历</span>`
  );
  writeHTML(
    '<span class="dim">输入 goto 打开履历、项目与荣誉页面，</span>'
  );
  writeHTML('<span class="dim">也可以像使用真实终端一样浏览内容：</span>');
  blankLine();
  writeHTML('<span class="cyan">goto awards</span>    <span class="dim">— 图形页：获奖记录</span>');
  writeHTML('<span class="cyan">goto resume</span>    <span class="dim">— 图形页：个人履历</span>');
  writeHTML('<span class="cyan">cd projects</span>    <span class="dim">— 目录漫游（纯终端体验）</span>');
  writeHTML('<span class="cyan">help</span>           <span class="dim">— 查看全部命令</span>');
  blankLine();
  writeHTML('<span class="dim">正在启动虚拟系统，请稍候…</span>');
  writeHTML(
    '<span class="dim">' + '─'.repeat(44) + '</span>'
  );
  blankLine();
}

function autoTypeCommand(word) {
  if (autoTimer) return;
  inputEl.value = '';
  let i = 0;
  autoDemoing = true;
  autoTimer = setInterval(() => {
    i += 1;
    inputEl.value = word.slice(0, i);
    if (i >= word.length) {
      clearInterval(autoTimer);
      autoTimer = null;
      autoDemoing = false;
      formEl.requestSubmit();
    }
  }, 52);
}

async function boot() {
  /* 让提示符与窗口标题跟随 data.js 里的 CONFIG */
  initTitles();
  const compactViewport = typeof matchMedia === 'function' && matchMedia('(max-width: 620px)').matches;

  const fullLines = [
    ['  OK  ', `正在启动 ${CONFIG.osName} 个人主页系统…`, 'green'],
    ['  OK  ', '正在挂载虚拟文件系统 /', 'green'],
    ['  OK  ', `已载入用户资料 ${esc(activeUser())}@${esc(CONFIG.host)}`, 'green'],
    ['  OK  ', 'Reached target Multi-User System.', 'green'],
    [' INFO ', '已打开会话 /dev/pts/1（只读演示模式）', 'yellow'],
  ];
  const lines = compactViewport
    ? [fullLines[1], fullLines[4]]
    : fullLines;
  for (const [label, text, cls] of lines) {
    bootRow(label, text, cls);
    await sleep(compactViewport ? 80 : 210);
    if (skipBoot) break;
  }
  blankLine();
  writeHTML(nameBlockHTML());
  writeHTML(renderNeo());
  bindHeroLinks();
  blankLine();
  booting = false;
  inputEl.disabled = false;
  inputEl.placeholder = '输入 help 查看命令，输入 login 可进入管理模式';
  scrollDown();

  if (!skipBoot) {
    if (compactViewport) {
      writeHTML('<span class="mobile-ready"><span class="green">READY</span> 输入 <span class="cyan">help</span> 开始探索，或点击上方快捷入口。</span>');
      screenEl.scrollTop = 0;
    } else {
      await sleep(350);
      autoTypeCommand('cat /etc/motd');
    }
  } else {
    writeHTML('<span class="dim">— 启动已跳过，随时输入 help 查看命令 —</span>');
  }
}

/* 启动期间任意按键可跳过动画 */
document.addEventListener('keydown', () => {
  if (booting) skipBoot = true;
}, { passive: true });

tickClock();
setInterval(tickClock, 1000);
if (typeof setUiRefreshHook === 'function') {
  setUiRefreshHook(refreshAllUI);
}
initMode();
initTitles();
refreshAllUI();
showIntro();
boot();
