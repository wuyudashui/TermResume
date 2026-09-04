'use strict';

/* =====================================================================
 * pages.js —— 路由（goto）与图形化页面层
 * 终端仍是入口，goto 负责“跳转页面”；cd 依旧只做目录切换。
 *   goto awards         -> 图形化奖项页（#/awards）
 *   goto certificates   -> 图形化证书页（#/certificates）
 *   goto terminal | t   -> 返回终端（#/terminal）
 * guest 只读；admin（login 后）在图形页内可直接维护。
 * =================================================================== */

const ROUTES = {
  terminal: 'terminal',
  awards: 'awards',
  certificates: 'certificates',
  resume: 'resume',
  projects: 'projects',
  blog: 'blog',
  docs: 'docs',
  guide: 'docs',
  help: 'docs',
  certs: 'certificates',
  t: 'terminal',
  home: 'terminal',
};

function normalizeHash() {
  let h = location.hash.replace(/^#\/?/, '').trim();
  if (!h) h = 'terminal';
  h = h.toLowerCase();
  return ROUTES[h] || 'terminal';
}

/* 页面元信息（title、命令等说明，后续可扩展 resume/projects…） */
const ROUTE_META = {
  terminal: { label: '终端', tagline: '回到终端继续浏览目录' },
  awards: { label: '获奖记录', tagline: '我的奖项与荣誉' },
  certificates: { label: '证书', tagline: '证书画廊' },
  resume: { label: '履历', tagline: '一句话概括我的经历' },
  projects: { label: '项目', tagline: '我做过的东西' },
  blog: { label: '博客', tagline: 'Markdown 时间线' },
  docs: { label: '指令说明书', tagline: '本站可用指令速查' },
};

/* 顶部导航中可跳转的图形页（按顺序） */
const NAV_PAGES = [
  { key: 'awards', label: '获奖' },
  { key: 'certificates', label: '证书' },
  { key: 'resume', label: '履历' },
  { key: 'projects', label: '项目' },
  { key: 'blog', label: '博客' },
  { key: 'docs', label: '说明书' },
];

/* ---------- 终端/图形页可见性切换 ---------- */
function applyRouteView() {
  const route = normalizeHash();
  const terminal = document.querySelector('.terminal');
  const pageView = document.getElementById('page-view');
  const isTerminal = route === 'terminal';
  if (terminal) terminal.style.display = isTerminal ? 'flex' : 'none';
  if (pageView) pageView.style.display = isTerminal ? 'none' : 'flex';
  renderPage(route);
}

function backBtn() {
  const el = document.getElementById('page-back');
  if (el) el.style.display = 'none';
}

/* 图形页里也提供统一的页头导航：页面间直接切换，不做动画 */
function renderPageHead(route) {
  const nav = document.getElementById('page-nav');
  if (!nav) return;
  nav.innerHTML = NAV_PAGES.map(
    (p) =>
      '<a class="' + (route === p.key ? 'active' : '') + '" href="#/' + p.key + '" data-route="' + p.key + '">' +
      escHtml(p.label) + '</a>'
  ).join('');
}

/* ---------- 页面渲染 ---------- */
function renderPage(route) {
  const titleEl = document.getElementById('page-title');
  const body = document.getElementById('page-body');
  const back = document.getElementById('page-back');
  if (!body) return;
  const meta = ROUTE_META[route] || ROUTE_META.terminal;
  if (titleEl) titleEl.textContent = meta.label;
  renderPageHead(route);
  if (back) {
    back.style.display = '';
    back.onclick = () => { location.hash = '#/terminal'; };
  }
  if (route === 'awards') body.innerHTML = renderAwardsPage();
  else if (route === 'certificates') body.innerHTML = renderCertsPage();
  else if (route === 'resume') body.innerHTML = renderResumePage();
  else if (route === 'projects') body.innerHTML = renderProjectsPage();
  else if (route === 'blog') body.innerHTML = renderBlogPage();
  else if (route === 'docs') body.innerHTML = renderDocsPage();
  else body.innerHTML = '';
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

let pageNotice = null;

function setPageNotice(message, type = 'error') {
  pageNotice = { message, type };
}

function takePageNotice() {
  if (!pageNotice) return '';
  const notice = pageNotice;
  pageNotice = null;
  return '<div class="page-notice ' + escHtml(notice.type) + '" role="status">' +
    escHtml(notice.message) + '</div>';
}

function pageStorageFailure(action) {
  const detail = typeof getLastStorageError === 'function' ? getLastStorageError() : '';
  return action + '失败，数据未保存' + (detail ? '：' + detail : '。');
}

function saveFromPage(successText, action = '保存') {
  const ok = saveProfile();
  setPageNotice(ok ? successText : pageStorageFailure(action), ok ? 'success' : 'error');
  return ok;
}

function profileHeader(p) {
  return (
    '<div class="gui-hero">' +
    (p.avatar
      ? '<img class="gui-avatar" src="' + escHtml(p.avatar) + '" alt="avatar" />'
      : '<div class="gui-avatar gui-avatar-txt">' + escHtml((p.name || '?').slice(0, 1)) + '</div>') +
    '<div class="gui-hero-meta">' +
    '<h2 class="gui-name">' + escHtml(p.name || '') + '</h2>' +
    '<div class="gui-role">' + escHtml(p.role || '') + '</div>' +
    (p.bio ? '<div class="gui-bio">' + escHtml(p.bio) + '</div>' : '') +
    '</div>' +
    '</div>'
  );
}

/* ---------- 博客：状态与 Markdown 渲染 ---------- */
let blogState = { view: 'list', id: null, edit: false };

function fmtDate(d) {
  if (!d) return '';
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function escapeMd(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* 轻量 Markdown：标题 / 列表 / 引用 / 行内代码 / 粗斜体 / 链接 / 代码块 */
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  const flushCode = () => {
    if (!inCode) return;
    out.push('<pre class="md-code">' + escapeMd(codeBuf.join('\n')) + '</pre>');
    codeBuf = [];
    inCode = false;
  };
  const inline = (t) =>
    escapeMd(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  for (const raw of lines) {
    if (/^```/.test(raw)) {
      if (inCode) flushCode();
      else inCode = true;
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }
    const t = raw.trim();
    if (!t) { out.push(''); continue; }
    let m;
    if ((m = t.match(/^#{1,6}\s+(.*)$/))) {
      const lv = Math.min(m[0].split(' ')[0].length, 6);
      out.push('<h' + lv + '>' + inline(m[1]) + '</h' + lv + '>');
    } else if (/^[-*]\s+/.test(t)) {
      out.push('<li>' + inline(t.replace(/^[-*]\s+/, '')) + '</li>');
    } else if ((m = t.match(/^(\d+)\.\s+(.*)$/))) {
      out.push('<li value="' + m[1] + '">' + inline(m[2]) + '</li>');
    } else if ((m = t.match(/^>\s?(.*)$/))) {
      out.push('<blockquote>' + inline(m[1]) + '</blockquote>');
    } else {
      out.push('<p>' + inline(t) + '</p>');
    }
  }
  flushCode();
  return out.join('\n');
}

function renderBlogPage() {
  const p = getProfile();
  const admin = currentRole() === 'admin';
  const blogs = (p.blogs || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if (blogState.view === 'read' && blogState.id) {
    const b = (p.blogs || []).find((x) => x.id === blogState.id);
    if (!b) blogState = { view: 'list', id: null, edit: false };
  }
  if (blogState.view === 'read' && blogState.id) {
    const b = (p.blogs || []).find((x) => x.id === blogState.id);
    return (
      takePageNotice() +
      '<div class="blog-toolbar">' +
      '<button class="page-mini-back" data-blog-back type="button">← 返回时间线</button>' +
      (admin
        ? '<span class="blog-toolbar-right"><button data-blog-edit="' + escHtml(b.id) + '" type="button">编辑</button>' +
          '<button class="danger" data-blog-del="' + escHtml(b.id) + '" type="button">删除</button></span>'
        : '') +
      '</div>' +
      '<article class="blog-article">' +
      '<h1>' + escHtml(b.title) + '</h1>' +
      '<div class="blog-date">' + escHtml(fmtDate(b.date)) + (b.tags && b.tags.length ? ' · ' + escHtml(b.tags.join(' · ')) : '') + '</div>' +
      '<div class="blog-md">' + renderMarkdown(b.content) + '</div>' +
      '</article>'
    );
  }

  if (blogState.view === 'edit') {
    const b = blogState.id
      ? (p.blogs || []).find((x) => x.id === blogState.id)
      : { title: '', date: new Date().toISOString().slice(0, 10), tags: [], content: '' };
    if (blogState.id && !b) blogState = { view: 'list', id: null, edit: false };
    return (
      takePageNotice() +
      '<div class="blog-editor">' +
      '<div class="blog-toolbar"><button class="page-mini-back" data-blog-cancel type="button">← 取消</button></div>' +
      '<label>标题 <input id="be-title" value="' + escHtml(b.title || '') + '" /></label>' +
      '<label>日期 <input id="be-date" type="date" value="' + escHtml(fmtDate(b.date)) + '" /></label>' +
      '<label>标签（逗号分隔）<input id="be-tags" value="' + escHtml((b.tags || []).join(',')) + '" placeholder="随笔,技术" /></label>' +
      '<label>内容（Markdown）</label>' +
      '<textarea id="be-content" rows="12" placeholder="用 Markdown 写作…">' + escHtml(b.content || '') + '</textarea>' +
      '<div class="blog-toolbar"><button class="primary" id="be-save" type="button">保存</button></div>' +
      '</div>'
    );
  }

  /* list / 时间线 */
  const timeline = blogs.length
    ? blogs
        .map(
          (b, i) =>
            '<div class="tl-item">' +
            '<div class="tl-dot' + (i === 0 ? ' first' : '') + '"></div>' +
            '<div class="tl-card">' +
            '<div class="tl-date">' + escHtml(fmtDate(b.date)) + '</div>' +
            '<button class="tl-title" data-blog-open="' + escHtml(b.id) + '" type="button">' + escHtml(b.title) + '</button>' +
            (b.tags && b.tags.length ? '<div class="tl-tags">' + b.tags.map((x) => '<span>' + escHtml(x) + '</span>').join('') + '</div>' : '') +
            '</div></div>'
        )
        .join('')
    : '';

  return (
    takePageNotice() +
    profileHeader(p) +
    '<div class="blog-bar">' +
    '<div class="gui-section-title">博客时间线 · Blog</div>' +
    (admin ? '<button id="blog-new" type="button">＋ 新建博客</button>' : '') +
    '</div>' +
    (timeline ? '<div class="tl-wrap">' + timeline + '</div>' : '<div class="gui-empty">（暂无博客，admin 登录后可新建）</div>')
  );
}

function renderAwardsPage() {
  const p = getProfile();
  const admin = currentRole() === 'admin';
  const list = (p.awards || [])
    .map((a) =>
      '<article class="gui-card">' +
      (a.image
        ? '<img class="gui-award-img" src="' + escHtml(a.image) + '" alt="' + escHtml(a.title) + ' 获奖证明" loading="lazy" />'
        : '') +
      '<div class="gui-card-year">' + escHtml(a.year || '—') + '</div>' +
      '<h3>' + escHtml(a.title) + '</h3>' +
      (a.level ? '<div class="gui-tag">' + escHtml(a.level) + '</div>' : '') +
      (a.note ? '<p>' + escHtml(a.note) + '</p>' : '') +
      (admin
        ? '<button class="gui-del" data-del-award="' + escHtml(a.id) + '" type="button">删除</button>'
        : '') +
      '</article>'
    )
    .join('');

  const editor = admin
    ? '<div class="gui-editor"><h4>添加获奖记录（admin）</h4>' +
      '<div class="gui-form">' +
      '<input id="f-a-title" placeholder="标题，如：三好学生" />' +
      '<input id="f-a-year" placeholder="年份，如 2025" />' +
      '<input id="f-a-level" placeholder="级别，如 校级" />' +
      '<input id="f-a-note" placeholder="备注（可选）" />' +
      '<button id="f-a-add" type="button">添加</button>' +
      '</div></div>'
    : '';

  return (
    takePageNotice() +
    profileHeader(p) +
    '<div class="gui-section-title">奖项 · Awards</div>' +
    (list ? '<div class="gui-grid">' + list + '</div>' : '<div class="gui-empty">（暂无获奖记录）</div>') +
    editor +
    '<div class="gui-tip">' +
    (admin
      ? '提示：可直接在下方添加；也可以用终端命令 awards add/list/del 维护。'
      : '提示：输入 login 后可在图形页或终端维护。') +
    '</div>'
  );
}

function renderCertsPage() {
  const p = getProfile();
  const admin = currentRole() === 'admin';
  const list = (p.certificates || [])
    .map((c) =>
      '<article class="gui-card gui-cert">' +
      (c.url
        ? '<img class="gui-cert-img" src="' + escHtml(c.url) + '" alt="' + escHtml(c.name) + '" loading="lazy" />'
        : '<div class="gui-cert-img gui-cert-ph">证书图片未设置</div>') +
      '<div class="gui-cert-meta">' +
      '<h3>' + escHtml(c.name) + '</h3>' +
      '<div class="gui-dim">' + escHtml(c.issuer || '') + (c.year ? ' · ' + escHtml(c.year) : '') + '</div>' +
      (c.note ? '<p>' + escHtml(c.note) + '</p>' : '') +
      (admin
        ? '<button class="gui-del" data-del-cert="' + escHtml(c.id) + '" type="button">删除</button>'
        : '') +
      '</div></article>'
    )
    .join('');

  const editor = admin
    ? '<div class="gui-editor"><h4>添加证书（admin）</h4>' +
      '<div class="gui-form">' +
      '<input id="f-c-name" placeholder="证书名，如：CET-6" />' +
      '<input id="f-c-issuer" placeholder="发证机构" />' +
      '<input id="f-c-year" placeholder="年份" />' +
      '<input id="f-c-url" placeholder="图片地址 https://…（可选）" />' +
      '<button id="f-c-add" type="button">添加</button>' +
      '</div></div>'
    : '';

  return (
    takePageNotice() +
    profileHeader(p) +
    '<div class="gui-section-title">证书 · Certificates</div>' +
    (list ? '<div class="gui-grid">' + list + '</div>' : '<div class="gui-empty">（暂无证书）</div>') +
    editor +
    '<div class="gui-tip">' +
    (admin
      ? '提示：证书图片填图片地址；也支持终端命令 certs add/list/del。'
      : '提示：证书图片可由维护者上传后在此展示。') +
    '</div>'
  );
}

function renderResumePage() {
  const p = getProfile();
  const awards = (p.awards || []).length
    ? p.awards
        .map(
          (a) =>
            '<div class="resume-line">' +
            '<span class="resume-year">' + escHtml(a.year || '—') + '</span>' +
            '<span class="resume-main">' + escHtml(a.title) + '</span>' +
            (a.level ? '<span class="resume-tag">' + escHtml(a.level) + '</span>' : '') +
            '</div>'
        )
        .join('')
    : '<div class="gui-empty">（暂无获奖记录）</div>';
  const certs = (p.certificates || []).length
    ? p.certificates
        .map(
          (c) =>
            '<div class="resume-line">' +
            '<span class="resume-year">' + escHtml(c.year || '—') + '</span>' +
            '<span class="resume-main">' + escHtml(c.name) + '</span>' +
            (c.issuer ? '<span class="resume-tag">' + escHtml(c.issuer) + '</span>' : '') +
            '</div>'
        )
        .join('')
    : '<div class="gui-empty">（暂无证书）</div>';

  return (
    takePageNotice() +
    profileHeader(p) +
    '<div class="gui-section-title">个人履历 · Resume</div>' +
    '<section class="resume-panel">' +
    '<h3>联系方式</h3>' +
    '<p>邮箱：' + escHtml(p.email || '—') + '</p>' +
    (p.github ? '<p>GitHub：' + escHtml(p.github) + '</p>' : '') +
    '<h3>获奖记录</h3>' + awards +
    '<h3>证书</h3>' + certs +
    '</section>'
  );
}

function renderProjectsPage() {
  const root = VFS.home[CONFIG.user];
  let cards = '';
  if (root && isDir(root) && root.projects && isDir(root.projects)) {
    const names = childNames(root.projects).sort();
    cards = names
      .map((name) => {
        const node = root.projects[name];
        let readme = '';
        if (node && isDir(node) && node['README.md']) {
          const c = node['README.md'].content;
          const lines = typeof c === 'function' ? c() : c;
          const text = Array.isArray(lines) ? lines.join('\n') : String(lines);
          const slice = text.replace(/#+/, '').trim().split('\n')[0] || '';
          readme = slice;
        }
        return (
          '<article class="gui-card proj-card">' +
          '<h3>' + escHtml(name) + '</h3>' +
          (readme ? '<p>' + escHtml(readme) + '</p>' : '') +
          '</article>'
        );
      })
      .join('');
  }
  return (
    takePageNotice() +
    profileHeader(getProfile()) +
    '<div class="gui-section-title">项目 · Projects</div>' +
    (cards ? '<div class="gui-grid">' + cards + '</div>' : '<div class="gui-empty">（项目目录为空）</div>')
  );
}

/* ---------- 指令说明书 ---------- */
function cmdDocsHTML() {
  if (typeof COMMANDS === 'undefined') return '<div class="gui-empty">指令表尚未加载</div>';
  const categories = ['导航', '查看文件', '系统信息', '其他', '管理'];
  const group = (cat) => {
    const rows = Object.values(COMMANDS)
      .filter((c) => c.cat === cat)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!rows.length) return '';
    return (
      '<div class="docs-cat">' +
      '<h3>' + escHtml(cat) + '</h3>' +
      rows
        .map(
          (c) =>
            '<div class="docs-row"><code>' + escHtml(c.name) + '</code>' +
            '<span class="docs-desc">' + escHtml(c.desc) + '</span>' +
            (c.usage ? '<span class="docs-usage">' + escHtml(c.usage) + '</span>' : '') +
            '</div>'
        )
        .join('') +
      '</div>'
    );
  };
  return categories.map(group).join('');
}

function renderDocsPage() {
  const p = getProfile();
  return (
    profileHeader(p) +
    '<div class="gui-section-title">指令说明书 · Commands</div>' +
    '<div class="docs-intro">' +
    '<p>站点用终端命令驱动：<code>goto</code> 跳图形页面，其余命令在终端里漫游 / 维护。</p>' +
    '<p>维护者：先 <code>login</code>（默认 admin / 123456），再使用「管理」类命令或在图形页内维护。</p>' +
    '</div>' +
    cmdDocsHTML()
  );
}

/* ---------- 事件：删除/添加 ---------- */
function bindPageEvents() {
  const body = document.getElementById('page-body');
  if (!body) return;
  body.onclick = (e) => {
    const delA = e.target.closest && e.target.closest('[data-del-award]');
    const delC = e.target.closest && e.target.closest('[data-del-cert]');
    const openB = e.target.closest && e.target.closest('[data-blog-open]');
    const backB = e.target.closest && e.target.closest('[data-blog-back]');
    const editB = e.target.closest && e.target.closest('[data-blog-edit]');
    const delB = e.target.closest && e.target.closest('[data-blog-del]');
    const cancelB = e.target.closest && e.target.closest('[data-blog-cancel]');
    if (openB) {
      blogState = { view: 'read', id: openB.getAttribute('data-blog-open'), edit: false };
      renderPage(normalizeHash());
    } else if (backB || cancelB) {
      blogState = { view: 'list', id: null, edit: false };
      renderPage(normalizeHash());
    } else if (editB) {
      if (currentRole() !== 'admin') return;
      blogState = { view: 'edit', id: editB.getAttribute('data-blog-edit'), edit: true };
      renderPage(normalizeHash());
    } else if (delB) {
      if (currentRole() !== 'admin') return;
      const p = getProfile();
      p.blogs = (p.blogs || []).filter((x) => x.id !== delB.getAttribute('data-blog-del'));
      saveFromPage('博客已删除。', '删除');
      blogState = { view: 'list', id: null, edit: false };
      renderPage(normalizeHash());
    } else if (delA) {
      if (currentRole() !== 'admin') return;
      const p = getProfile();
      p.awards = p.awards.filter((x) => x.id !== delA.getAttribute('data-del-award'));
      saveFromPage('获奖记录已删除。', '删除');
      renderPage(normalizeHash());
    } else if (delC) {
      if (currentRole() !== 'admin') return;
      const p = getProfile();
      p.certificates = p.certificates.filter((x) => x.id !== delC.getAttribute('data-del-cert'));
      saveFromPage('证书已删除。', '删除');
      renderPage(normalizeHash());
    }
  };

  const newB = document.getElementById('blog-new');
  if (newB) {
    newB.onclick = () => {
      if (currentRole() !== 'admin') return;
      blogState = { view: 'edit', id: null, edit: true };
      renderPage(normalizeHash());
    };
  }
  const saveB = document.getElementById('be-save');
  if (saveB) {
    saveB.onclick = () => {
      if (currentRole() !== 'admin') return;
      const p = getProfile();
      const title = (document.getElementById('be-title') || {}).value || '';
      if (!title.trim()) return;
      const date = (document.getElementById('be-date') || {}).value || new Date().toISOString().slice(0, 10);
      const tags = String((document.getElementById('be-tags') || {}).value || '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
      const content = (document.getElementById('be-content') || {}).value || '';
      if (blogState.id) {
        const b = p.blogs.find((x) => x.id === blogState.id);
        if (b) Object.assign(b, { title: title.trim(), date, tags, content });
      } else {
        p.blogs.push({ id: 'b' + Date.now(), title: title.trim(), date, tags, content });
      }
      saveFromPage('博客已保存。');
      const saved = blogState.id || (p.blogs[p.blogs.length - 1] && p.blogs[p.blogs.length - 1].id);
      blogState = { view: saved ? 'read' : 'list', id: saved, edit: false };
      renderPage(normalizeHash());
    };
  }

  const addA = document.getElementById('f-a-add');
  if (addA) {
    addA.onclick = () => {
      if (currentRole() !== 'admin') return;
      const title = (document.getElementById('f-a-title') || {}).value || '';
      if (!title.trim()) return;
      const p = getProfile();
      p.awards.push({
        id: 'a' + Date.now(),
        title: title.trim(),
        year: (document.getElementById('f-a-year') || {}).value || '',
        level: (document.getElementById('f-a-level') || {}).value || '',
        note: (document.getElementById('f-a-note') || {}).value || '',
        image: '',
      });
      saveFromPage('获奖记录已添加。');
      renderPage(normalizeHash());
    };
  }
  const addC = document.getElementById('f-c-add');
  if (addC) {
    addC.onclick = () => {
      if (currentRole() !== 'admin') return;
      const name = (document.getElementById('f-c-name') || {}).value || '';
      if (!name.trim()) return;
      const p = getProfile();
      p.certificates.push({
        id: 'c' + Date.now(),
        name: name.trim(),
        issuer: (document.getElementById('f-c-issuer') || {}).value || '',
        year: (document.getElementById('f-c-year') || {}).value || '',
        url: (document.getElementById('f-c-url') || {}).value || '',
        note: '',
      });
      saveFromPage('证书已添加。');
      renderPage(normalizeHash());
    };
  }
}

/* ---------- 注册 goto 命令 ---------- */
if (typeof addCmd === 'function') {
  addCmd('goto', '导航', '跳转到图形页面：goto awards/certificates/resume/projects/terminal', 'goto <页面>', (args) => {
    const target = (args[0] || '').toLowerCase();
    if (!target || !ROUTES[target]) {
      writeText('可用页面：awards · certificates · resume · projects · blog · docs · terminal（别名 t / home）', 'yellow');
      writeText('用法：goto blog | goto docs | goto terminal（或 goto t）', 'dim');
      return;
    }
    location.hash = '#/' + ROUTES[target];
  });
}

window.addEventListener('hashchange', () => {
  applyRouteView();
  setTimeout(bindPageEvents, 0);
});

/* 初始路由 + 返回按钮 */
applyRouteView();
setTimeout(bindPageEvents, 0);
