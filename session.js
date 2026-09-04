'use strict';

/* =====================================================================
 * session.js —— 会话与履历数据层（纯前端演示，localStorage 持久化）
 * - GUEST 模式：只读浏览，永不出现维护入口
 * - ADMIN 模式：admin 登录后可用 admin 命令维护资料 / 获奖 / 证书
 * 后期接入自研 agent / 简历导出 / 真后端时，替换本文件即可。
 * =================================================================== */

const SESSION_KEY = 'guestos-session';
const PROFILE_KEY = 'guestos-profile';
const PROFILE_BACKUP_KEY = 'guestos-profile-backup';

/* ---------- 会话状态 ---------- */
let sessionUser = CONFIG.user; // guest / admin
let sessionRole = 'guest';     // guest / admin

function currentUser() {
  return sessionUser;
}

function currentRole() {
  return sessionRole;
}

function isAdmin() {
  return sessionRole === 'admin';
}

function saveSession() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: sessionUser, role: sessionRole }));
  } catch (_) {
    /* 忽略 */
  }
}

function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.role === 'admin' && s.user === AUTH.username) {
        sessionUser = s.user;
        sessionRole = 'admin';
      } else {
        sessionUser = CONFIG.user;
        sessionRole = 'guest';
      }
    }
  } catch (_) {
    sessionUser = CONFIG.user;
    sessionRole = 'guest';
  }
}

function setSession(user, role) {
  sessionUser = user;
  sessionRole = role;
  saveSession();
  emitSessionChange();
}

function loginWithCredential(user, pass) {
  if (user === AUTH.username && pass === AUTH.password) {
    setSession(AUTH.username, 'admin');
    return true;
  }
  return false;
}

function logoutSession() {
  setSession(CONFIG.user, 'guest');
}

/* ---------- 履历数据 ----------
 * 结构：{ ...个人字段, awards: [], certificates: [] }
 * avatar 可存图片 URL 或 base64 data URL。
 */
let profile = null;
let lastStorageError = '';
let lastSavedProfile = null;

function cloneDefaults() {
  return JSON.parse(JSON.stringify(PROFILE_DEFAULTS));
}

function profileEnvelope(value) {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: value,
  };
}

function normalizeProfile(value, sourceVersion = 0) {
  const d = cloneDefaults();
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = { ...d, ...input };

  normalized.name = typeof input.name === 'string' ? input.name : d.name;
  normalized.role = typeof input.role === 'string' ? input.role : d.role;
  normalized.bio = typeof input.bio === 'string' ? input.bio : d.bio;
  normalized.email = typeof input.email === 'string' ? input.email : d.email;
  normalized.github = typeof input.github === 'string' ? input.github : d.github;
  normalized.website = typeof input.website === 'string' ? input.website : d.website;
  normalized.location = typeof input.location === 'string' ? input.location : d.location;
  normalized.avatar = typeof input.avatar === 'string' ? input.avatar : d.avatar;
  normalized.awards = Array.isArray(input.awards) ? input.awards : d.awards;
  normalized.certificates = Array.isArray(input.certificates) ? input.certificates : d.certificates;
  normalized.blogs = Array.isArray(input.blogs) ? input.blogs : d.blogs;

  /* 首次升级时只替换仓库自带的示例记录，不影响用户自己创建的内容。 */
  if (sourceVersion < 1) {
    const hasDemoAward = normalized.awards.some((a) => a && a.id === 'a1' && a.title === '示例奖项');
    if (hasDemoAward) {
      const defaultIds = new Set(d.awards.map((a) => a.id));
      const customAwards = normalized.awards.filter(
        (a) => !(a && a.id === 'a1' && a.title === '示例奖项') && !defaultIds.has(a && a.id)
      );
      normalized.awards = [...d.awards, ...customAwards];
    }
    normalized.certificates = normalized.certificates.filter(
      (c) => !(c && c.id === 'c1' && c.name === '示例证书')
    );
    normalized.blogs = normalized.blogs.map((b) =>
      b && b.id === 'b1' && !b.slug ? { ...b, slug: 'first-post' } : b
    );
  }

  return normalized;
}

function parseProfilePayload(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('数据必须是一个 JSON 对象');
  }
  if (parsed.profile) {
    const version = Number(parsed.schemaVersion) || 0;
    if (version > DATA_SCHEMA_VERSION) {
      throw new Error(`数据版本 ${version} 高于当前支持的版本 ${DATA_SCHEMA_VERSION}`);
    }
    return normalizeProfile(parsed.profile, version);
  }
  return normalizeProfile(parsed, 0);
}

function validateImportPayload(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('备份文件必须是一个 JSON 对象');
  }
  const candidate = parsed.profile || parsed;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new Error('备份文件缺少 profile 数据');
  }
  const knownFields = ['name', 'role', 'bio', 'email', 'awards', 'certificates', 'blogs'];
  if (!knownFields.some((field) => Object.prototype.hasOwnProperty.call(candidate, field))) {
    throw new Error('这不是有效的 TermResume 数据文件');
  }
  return parsed;
}

function blogFileName(blog, index, used) {
  const base = String(blog.slug || blog.id || `post-${index + 1}`)
    .trim()
    .replace(/\.md$/i, '')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/^-+|-+$/g, '') || `post-${index + 1}`;
  let name = base + '.md';
  let suffix = 2;
  while (used.has(name)) name = base + '-' + suffix++ + '.md';
  used.add(name);
  return name;
}

/* profile 是内容源，VFS 的 blog/ 只是终端浏览视图。 */
function syncProfileToVfs() {
  if (typeof VFS === 'undefined') return;
  const home = VFS.home && VFS.home[CONFIG.user];
  const blogDir = home && home.blog;
  if (!blogDir || typeof dir !== 'function' || typeof file !== 'function') return;

  Object.keys(blogDir).forEach((key) => {
    if (key !== '_meta') delete blogDir[key];
  });
  const used = new Set();
  (profile.blogs || []).forEach((blog, index) => {
    const meta = [blog.date || '', ...(blog.tags || [])].filter(Boolean).join(' · ');
    const lines = [
      '# ' + (blog.title || '未命名文章'),
      '',
      ...(meta ? ['**' + meta + '**', ''] : []),
      ...String(blog.content || '').replace(/\r\n/g, '\n').split('\n'),
    ];
    blogDir[blogFileName(blog, index, used)] = file(lines);
  });
}

function loadProfile() {
  let needsMigrationSave = false;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      const storedVersion = stored && stored.profile ? Number(stored.schemaVersion) || 0 : 0;
      profile = parseProfilePayload(stored);
      needsMigrationSave = !stored.profile || storedVersion < DATA_SCHEMA_VERSION;
    } else {
      profile = cloneDefaults();
    }
    lastStorageError = '';
  } catch (error) {
    profile = cloneDefaults();
    lastStorageError = error instanceof Error ? error.message : String(error);
  }
  applyProfileToConfig();
  syncProfileToVfs();
  lastSavedProfile = JSON.parse(JSON.stringify(profile));
  if (needsMigrationSave) {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profileEnvelope(profile)));
    } catch (error) {
      lastStorageError = '旧数据已读取，但升级结果无法保存：' +
        (error instanceof Error ? error.message : String(error));
    }
  }
  return profile;
}

/* 维护后的资料覆盖页面级 CONFIG 展示（fill/neofetch 等仍在读 CONFIG） */
function applyProfileToConfig() {
  if (!profile) return;
  CONFIG.name = profile.name || CONFIG.name;
  CONFIG.title = profile.role || CONFIG.title;
  CONFIG.location = profile.location || '';
  CONFIG.email = profile.email || CONFIG.email;
  CONFIG.github = profile.github || '';
  CONFIG.website = profile.website || '';
}

function saveProfile() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profileEnvelope(profile)));
    lastStorageError = '';
  } catch (error) {
    lastStorageError = error instanceof Error ? error.message : String(error);
    if (lastSavedProfile) profile = JSON.parse(JSON.stringify(lastSavedProfile));
    applyProfileToConfig();
    syncProfileToVfs();
    emitProfileChange();
    return false;
  }
  applyProfileToConfig();
  syncProfileToVfs();
  lastSavedProfile = JSON.parse(JSON.stringify(profile));
  emitProfileChange();
  return true;
}

function getProfile() {
  if (!profile) loadProfile();
  return profile;
}

function resetProfile() {
  profile = cloneDefaults();
  return saveProfile();
}

function getLastStorageError() {
  return lastStorageError;
}

function exportProfileJson() {
  return JSON.stringify(profileEnvelope(getProfile()), null, 2);
}

function downloadProfileData() {
  try {
    const blob = new Blob([exportProfileJson()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `termresume-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch (error) {
    lastStorageError = error instanceof Error ? error.message : String(error);
    return false;
  }
}

function importProfileData(raw) {
  let imported;
  try {
    imported = parseProfilePayload(validateImportPayload(raw));
  } catch (error) {
    lastStorageError = error instanceof Error ? error.message : String(error);
    return false;
  }

  try {
    localStorage.setItem(PROFILE_BACKUP_KEY, JSON.stringify(profileEnvelope(getProfile())));
  } catch (error) {
    lastStorageError = '无法创建导入前备份：' + (error instanceof Error ? error.message : String(error));
    return false;
  }
  profile = imported;
  if (!saveProfile()) {
    return false;
  }
  return true;
}

function pickProfileImport() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const selected = input.files && input.files[0];
      if (!selected) { resolve({ ok: false, cancelled: true }); return; }
      try {
        const ok = importProfileData(await selected.text());
        resolve({ ok, cancelled: false, error: ok ? '' : getLastStorageError() });
      } catch (error) {
        lastStorageError = error instanceof Error ? error.message : String(error);
        resolve({ ok: false, cancelled: false, error: lastStorageError });
      }
    };
    input.click();
  });
}

/* 变化通知：terminal.js 会注册一个“刷新全部界面”的回调 */
let uiRefreshHook = null;

function setUiRefreshHook(fn) {
  uiRefreshHook = fn;
}

function emitSessionChange() {
  if (typeof uiRefreshHook === 'function') uiRefreshHook();
}

function emitProfileChange() {
  if (typeof uiRefreshHook === 'function') uiRefreshHook();
}

/* 把 profile 同步给展示层（CONFIG 只读展示用；不在维护期直接改 CONFIG 本体） */
function profileForDisplay() {
  const p = getProfile();
  return {
    name: p.name,
    title: p.role,
    location: p.location || '',
    email: p.email,
    website: p.website || '',
    github: p.github || '',
    bio: p.bio || '',
    avatar: p.avatar || '',
    awards: p.awards || [],
    certificates: p.certificates || [],
  };
}

restoreSession();
loadProfile();
