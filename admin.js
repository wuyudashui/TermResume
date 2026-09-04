'use strict';

/* =====================================================================
 * admin.js —— 认证命令 + 履历维护命令（guest 只读，admin 可写）
 * 纯前端演示：数据持久化在 localStorage；登录仅作前端校验。
 * =================================================================== */

let authActive = false; // 交互式登录输入中
let authPhase = '';     // 'user' | 'pass'
let authUserBuf = '';
let authPassBuf = '';

/* ---------- 交互输入 ---------- */
function setAuthPrompt(visible) {
  const input = document.getElementById('cmd-input');
  if (!input) return;
  const parts = {
    user: document.querySelector('.cmdline .p-user'),
    at: document.querySelector('.cmdline .p-at'),
    host: document.querySelector('.cmdline .p-host'),
    colon: document.querySelector('.cmdline .p-colon'),
    dollar: document.querySelector('.cmdline .p-dollar'),
  };
  if (visible) {
    input.dataset.promptMode = '1';
    input.type = authPhase === 'pass' ? 'password' : 'text';
    if (parts.dollar) parts.dollar.textContent = '';
    input.placeholder = '';
    input.focus();
  } else {
    delete input.dataset.promptMode;
    input.type = 'text';
    if (parts.user) parts.user.textContent = currentUser();
    if (parts.at) parts.at.textContent = '@';
    if (parts.host) parts.host.textContent = CONFIG.host;
    if (parts.colon) parts.colon.textContent = ':';
    if (parts.dollar) parts.dollar.textContent = currentRole() === 'admin' ? '#' : '$';
    input.placeholder = '输入 help 查看命令';
  }
}

function renderAuthPrompt() {
  const prefix = document.querySelector('.cmdline .p-user');
  const at = document.querySelector('.cmdline .p-at');
  const host = document.querySelector('.cmdline .p-host');
  const colon = document.querySelector('.cmdline .p-colon');
  const dollar = document.querySelector('.cmdline .p-dollar');
  const label = authPhase === 'pass' ? 'password' : 'username';
  if (prefix) prefix.textContent = label;
  if (at) at.textContent = '';
  if (host) host.textContent = '';
  if (colon) colon.textContent = '';
  if (dollar) dollar.textContent = '';
  const input = document.getElementById('cmd-input');
  if (input) {
    input.type = authPhase === 'pass' ? 'password' : 'text';
    input.value = '';
    input.focus();
  }
}

function startInteractiveLogin() {
  authActive = true;
  authPhase = 'user';
  authUserBuf = '';
  authPassBuf = '';
  blankLine();
  writeText('登录 guestos · 输入用户名（输入 admin 进入管理模式）');
  setAuthPrompt(true);
  renderAuthPrompt();
}

function handlePromptInput(value) {
  const input = document.getElementById('cmd-input');
  if (!authActive) return;
  if (authPhase === 'user') {
    authUserBuf = value.trim();
    if (!authUserBuf) {
      writeText('用户名不能为空，请重新输入：');
      renderAuthPrompt();
      return;
    }
    authPhase = 'pass';
    writeText('密码（输入过程隐藏）：');
    renderAuthPrompt();
  } else {
    authPassBuf = value;
    finishLogin(authUserBuf, authPassBuf);
  }
}

function finishLogin(user, pass) {
  authActive = false;
  authPhase = '';
  setAuthPrompt(false);
  const ok = loginWithCredential(user, pass);
  if (ok) {
    writeText('✅ 登录成功：' + user + '（管理模式）', 'green');
    writeText('输入 goto manage 打开图形管理台，或输入 admin-help 查看管理命令。', 'dim');
  } else {
    writeText('❌ 登录失败：用户名或密码错误（默认 admin / 123456）', 'red');
    /* 重新从密码阶段开始，用户名保持不变 */
    authActive = true;
    authPhase = 'pass';
    setAuthPrompt(true);
    writeText('密码：');
    renderAuthPrompt();
  }
}

/* ---------- 命令参数 ---------- */
function parseLoginArgs(args) {
  let user = '';
  let pass = '';
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-u' || args[i] === '--user') && args[i + 1]) {
      user = args[i + 1];
      i++;
    } else if ((args[i] === '-p' || args[i] === '--password') && args[i + 1]) {
      pass = args[i + 1];
      i++;
    }
  }
  return { user, pass };
}

function storageFailureText(action) {
  const detail = typeof getLastStorageError === 'function' ? getLastStorageError() : '';
  return action + '失败，数据未保存' + (detail ? '：' + detail : '。');
}

function writeSaveResult(ok, successText, action = '保存') {
  writeText(ok ? successText : storageFailureText(action), ok ? 'green' : 'red');
  return ok;
}

/* ---------- 对外：注册到终端 ---------- */
function registerAuthAndAdminCommands() {
  if (typeof addCmd !== "function") return;
  const C = (n,c,d,u,r) => addCmd(n,c,d,u,r);
  const isAdminNow = () => currentRole() === 'admin';

  C('login', '其他', '登录管理模式，支持 login -u <用户> -p <密码>', 'login | login -u admin -p 123456', (args) => {
    const parsed = parseLoginArgs(args);
    if (parsed.user && parsed.pass) {
      finishLogin(parsed.user, parsed.pass);
      return;
    }
    if (parsed.user) {
      authUserBuf = parsed.user;
      authPhase = 'pass';
      authActive = true;
      writeText('用户：' + parsed.user);
      writeText('密码：');
      setAuthPrompt(true);
      renderAuthPrompt();
      return;
    }
    startInteractiveLogin();
  });

  C('logout', '其他', '退出管理模式，回到 guest 浏览模式', 'logout', () => {
    logoutSession();
    writeText('已退出。当前为 guest 浏览模式。', 'green');
  });

  C('admin-help', '其他', '管理模式帮助', 'admin-help', () => {
    if (!isAdminNow()) {
      writeText('仅 admin 可用：请先输入 login 登录。', 'red');
      return;
    }
    writeHTML('<span class="green bold">管理模式命令</span>');
    writeText('goto manage  打开图形管理台：资料、头像与项目维护', 'dim');
    writeText('profile  查看 / 修改个人资料：profile set name=余浩 email=xx@x.com', 'dim');
    writeText('awards   add/list/del 获奖记录：awards add "标题" -y 2025 -l 校级', 'dim');
    writeText('certs    add/list/del 证书：certs add "证书名" -i 机构 -y 2025 -u 图片URL', 'dim');
    writeText('avatar   set <图片URL|data:> 设置头像', 'dim');
    writeText('data     export/import 备份或恢复全部维护数据', 'dim');
    writeText('profile reset 恢复默认；guest 无法使用以上命令', 'dim');
  });

  /* ------- 资料 ------- */
  C('profile', '管理', '查看/修改个人资料', 'profile | profile set 字段=值 | profile reset', (args) => {
    if (!isAdminNow()) {
      writeText('只读模式：请先 login 进入管理模式。', 'red');
      return;
    }
    const p = getProfile();
    if (!args.length || args[0] === 'show') {
      writeText('姓名    ' + p.name);
      writeText('身份    ' + p.role);
      writeText('学校    ' + (p.school || '未设置'));
      writeText('邮箱    ' + p.email);
      writeText('GitHub  ' + p.github);
      writeText('简介    ' + p.bio);
      writeText('头像    ' + (p.avatar ? '已设置' : '未设置（avatar set 图片URL）'));
      return;
    }
    if (args[0] === 'reset') {
      writeSaveResult(resetProfile(), '个人资料已恢复默认。', '重置');
      return;
    }
    if (args[0] === 'set') {
      let changed = [];
      const fieldMap = {
        name: 'name', 姓名: 'name',
        role: 'role', 身份: 'role', title: 'role',
        school: 'school', 学校: 'school',
        bio: 'bio', 简介: 'bio',
        email: 'email', 邮箱: 'email',
        github: 'github',
        website: 'website', 网址: 'website',
        location: 'location', 城市: 'location',
      };
      args.slice(1).forEach((kv) => {
        const eq = kv.indexOf('=');
        if (eq <= 0) return;
        const key = kv.slice(0, eq);
        const val = kv.slice(eq + 1);
        const field = fieldMap[key];
        if (field) {
          p[field] = val;
          changed.push(key + ' → ' + val);
        }
      });
      if (changed.length) {
        writeSaveResult(saveProfile(), '已更新：' + changed.join('；'));
      } else {
        writeText('用法：profile set name=余浩 school=学校名称 email=xx@x.com bio=…', 'yellow');
      }
      return;
    }
    writeText('用法：profile | profile set 字段=值 | profile reset', 'yellow');
  });

  /* ------- 头像 ------- */
  C('avatar', '管理', '设置/查看头像图片', 'avatar set <图片URL> | avatar show | avatar clear', (args) => {
    if (!isAdminNow()) {
      writeText('只读模式：请先 login 进入管理模式。', 'red');
      return;
    }
    const p = getProfile();
    if (args[0] === 'set' && args[1]) {
      p.avatar = args[1];
      writeSaveResult(saveProfile(), '头像已更新。');
    } else if (args[0] === 'clear') {
      p.avatar = '';
      writeSaveResult(saveProfile(), '头像已清除。');
    } else {
      writeText('当前头像：' + (p.avatar || '未设置'));
      writeText('用法：avatar set <图片URL>（也支持 data:base64）', 'yellow');
    }
  });

  /* ------- 数据备份 ------- */
  C('data', '管理', '导出或导入全部维护数据', 'data export | data import', (args) => {
    if (!isAdminNow()) {
      writeText('只读模式：请先 login 进入管理模式。', 'red');
      return;
    }
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'export') {
      writeSaveResult(downloadProfileData(), '数据已导出为 JSON 文件。', '导出');
      return;
    }
    if (sub === 'import') {
      writeText('请选择 TermResume JSON 备份文件。', 'dim');
      pickProfileImport().then((result) => {
        if (result.cancelled) {
          writeText('已取消导入。', 'dim');
        } else {
          writeSaveResult(result.ok, '数据导入成功；导入前的数据已保留为本地备份。', '导入');
        }
      });
      return;
    }
    writeText('用法：data export | data import', 'yellow');
  });

  /* ------- 博客（数据与 GUI 的 goto blog 页共享 profile.blogs） ------- */
  C('blog', '管理', '博客维护（list/show/add/edit/del）', 'blog list | blog add "标题" -d 2026-09-01 | blog edit <id> | blog del <id>', (args) => {
    const p = getProfile();
    const sub = (args[0] || 'list').toLowerCase();
    if (!isAdminNow() && sub !== 'list' && sub !== 'show') {
      writeText('只读模式：请先 login 进入管理模式。', 'red');
      return;
    }
    if (sub === 'list') {
      if (!(p.blogs || []).length) { writeText('（暂无博客）', 'dim'); return; }
      (p.blogs || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).forEach((b) => {
        writeText('[' + b.id + '] ' + (b.date || '') + '  ' + b.title);
      });
      return;
    }
    if (sub === 'show') {
      const b = (p.blogs || []).find((x) => x.id === args[1]);
      if (!b) { writeText('未找到博客：' + args[1], 'red'); return; }
      writeText('#' + b.title, 'yellow bold');
      writeText('日期：' + (b.date || ''));
      writeText('标签：' + (b.tags || []).join(', '));
      writeText('---');
      (b.content || '').split('\n').forEach((line) => writeText(line));
      return;
    }
    if (sub === 'add') {
      if (!isAdminNow()) { writeText('只读模式：请先 login。', 'red'); return; }
      const rest = args.slice(1);
      let title = '';
      let date = new Date().toISOString().slice(0, 10);
      const tags = [];
      const titleParts = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-d') { date = rest[i + 1] || date; i++; }
        else if (rest[i] === '-t') { tags.push(...String(rest[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean)); i++; }
        else titleParts.push(rest[i]);
      }
      title = titleParts.join(' ');
      if (!title) { writeText('用法：blog add "标题" -d 2026-09-01 -t 标签', 'yellow'); return; }
      p.blogs.push({ id: 'b' + Date.now(), title, date, tags, content: '' });
      writeSaveResult(saveProfile(), '已创建博客。图形页：goto blog 继续编辑正文。');
      return;
    }
    if (sub === 'edit' || sub === 'del') {
      if (!isAdminNow()) { writeText('只读模式：请先 login。', 'red'); return; }
      const id = args[1];
      const b = (p.blogs || []).find((x) => x.id === id);
      if (!b) { writeText('未找到博客：' + id, 'red'); return; }
      if (sub === 'del') {
        p.blogs = (p.blogs || []).filter((x) => x.id !== id);
        writeSaveResult(saveProfile(), '已删除 ' + id + '。', '删除');
      } else {
        writeText('终端里暂不支持长文编辑，请用图形页：goto blog → 打开文章 → 编辑。', 'yellow');
      }
      return;
    }
    writeText('用法：blog list | blog add "标题" -d 2026-09-01 | blog show <id> | blog del <id>', 'yellow');
  });

  /* ------- 获奖记录 ------- */
  C('awards', '管理', '获奖记录维护（add/list/del）', 'awards add "标题" -y 2025 -l 校级 -n 备注 | awards list | awards del id', (args) => {
    const sub = (args[0] || 'list').toLowerCase();
    if (!isAdminNow() && sub !== 'list' && sub !== 'ls') {
      writeText('只读模式：请先 login 进入管理模式。', 'red');
      return;
    }
    const p = getProfile();
    if (sub === 'list' || sub === 'ls') {
      if (!p.awards.length) {
        writeText('（暂无获奖记录）', 'dim');
        return;
      }
      p.awards.forEach((a, i) => {
        writeText((i + 1) + '. [' + a.id + '] ' + (a.year ? a.year + ' ' : '') + a.title + (a.level ? '（' + a.level + '）' : ''));
        if (a.note) writeText('    ' + a.note, 'dim');
      });
      return;
    }
    if (sub === 'add') {
      const rest = args.slice(1);
      let title = '';
      const others = [];
      let y = '', lv = '', note = '';
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-y') { y = rest[i + 1] || ''; i++; }
        else if (rest[i] === '-l') { lv = rest[i + 1] || ''; i++; }
        else if (rest[i] === '-n') { note = rest[i + 1] || ''; i++; }
        else others.push(rest[i]);
      }
      title = others.join(' ');
      if (!title) {
        writeText('用法：awards add "标题" -y 2025 -l 校级 -n 备注', 'yellow');
        return;
      }
      p.awards.push({ id: 'a' + Date.now(), title, year: y, level: lv, note, image: '' });
      writeSaveResult(saveProfile(), '已添加获奖记录。');
      return;
    }
    if (sub === 'del' || sub === 'rm') {
      const id = args[1];
      const before = p.awards.length;
      p.awards = p.awards.filter((a) => a.id !== id);
      if (p.awards.length === before) writeText('未找到 id：' + id, 'red');
      else {
        writeSaveResult(saveProfile(), '已删除 ' + id + '。', '删除');
      }
      return;
    }
    writeText('用法：awards add/list/del', 'yellow');
  });

  /* ------- 证书 ------- */
  C('certs', '管理', '证书维护（add/list/del）', 'certs add "证书名" -i 机构 -y 2025 -u 图片URL -n 备注 | certs list | certs del id', (args) => {
    const sub = (args[0] || 'list').toLowerCase();
    if (!isAdminNow() && sub !== 'list' && sub !== 'ls') {
      writeText('只读模式：请先 login 进入管理模式。', 'red');
      return;
    }
    const p = getProfile();
    if (sub === 'list' || sub === 'ls') {
      if (!p.certificates.length) {
        writeText('（暂无证书）', 'dim');
        return;
      }
      p.certificates.forEach((c, i) => {
        writeText((i + 1) + '. [' + c.id + '] ' + c.name + (c.issuer ? ' · ' + c.issuer : '') + (c.year ? ' · ' + c.year : ''));
        if (c.url) writeText('    ' + c.url, 'cyan');
        if (c.note) writeText('    ' + c.note, 'dim');
      });
      return;
    }
    if (sub === 'add') {
      const rest = args.slice(1);
      let name = '';
      let issuer = '', y = '', url = '', note = '';
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-i') { issuer = rest[i + 1] || ''; i++; }
        else if (rest[i] === '-y') { y = rest[i + 1] || ''; i++; }
        else if (rest[i] === '-u') { url = rest[i + 1] || ''; i++; }
        else if (rest[i] === '-n') { note = rest[i + 1] || ''; i++; }
        else if (!name) name = rest[i];
        else name += ' ' + rest[i];
      }
      if (!name) {
        writeText('用法：certs add "证书名" -i 机构 -y 2025 -u 图片URL -n 备注', 'yellow');
        return;
      }
      p.certificates.push({ id: 'c' + Date.now(), name, issuer, year: y, url, note });
      writeSaveResult(saveProfile(), '已添加证书。');
      return;
    }
    if (sub === 'del' || sub === 'rm') {
      const id = args[1];
      const before = p.certificates.length;
      p.certificates = p.certificates.filter((c) => c.id !== id);
      if (p.certificates.length === before) writeText('未找到 id：' + id, 'red');
      else {
        writeSaveResult(saveProfile(), '已删除 ' + id + '。', '删除');
      }
      return;
    }
    writeText('用法：certs add/list/del', 'yellow');
  });

  /* ------- guest 只读展示 ------- */
  C('resume', '查看文件', '查看履历（获奖 / 证书，guest 可用）', 'resume', () => {
    const p = getProfile();
    writeHTML('<span class="green bold">' + esc(p.name) + ' · ' + esc(p.role) + '</span>');
    writeText(p.bio, 'dim');
    writeText('');
    writeHTML('<span class="yellow bold">— 获奖记录 —</span>');
    if (!p.awards.length) writeText('（暂无）', 'dim');
    p.awards.forEach((a) => {
      writeText('· ' + (a.year ? '[' + a.year + '] ' : '') + a.title + (a.level ? '（' + a.level + '）' : ''));
    });
    writeText('');
    writeHTML('<span class="yellow bold">— 证书 —</span>');
    if (!p.certificates.length) writeText('（暂无）', 'dim');
    p.certificates.forEach((c) => {
      writeText('· ' + c.name + (c.issuer ? ' — ' + c.issuer : '') + (c.year ? ' (' + c.year + ')' : ''));
    });
  });
}

/* terminal.js 与 session.js 加载完成后由 terminal 调用注册 */
if (typeof addCmd === 'function' && typeof CONFIG !== 'undefined') {
  registerAuthAndAdminCommands();
}

