'use strict';

/* =====================================================================
 * session.js —— 会话与履历数据层（纯前端演示，localStorage 持久化）
 * - GUEST 模式：只读浏览，永不出现维护入口
 * - ADMIN 模式：admin 登录后可用 admin 命令维护资料 / 获奖 / 证书
 * 后期接入自研 agent / 简历导出 / 真后端时，替换本文件即可。
 * =================================================================== */

const SESSION_KEY = 'guestos-session';
const PROFILE_KEY = 'guestos-profile';

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

function cloneDefaults() {
  return JSON.parse(JSON.stringify(PROFILE_DEFAULTS));
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    profile = raw ? JSON.parse(raw) : cloneDefaults();
  } catch (_) {
    profile = cloneDefaults();
  }
  // 保证必要字段存在
  const d = PROFILE_DEFAULTS;
  profile.name = profile.name || d.name;
  profile.role = profile.role || d.role;
  profile.email = profile.email || d.email;
  profile.github = profile.github || d.github;
  profile.awards = Array.isArray(profile.awards) ? profile.awards : [];
  profile.certificates = Array.isArray(profile.certificates) ? profile.certificates : [];
  profile.blogs = Array.isArray(profile.blogs) ? profile.blogs : [];
  applyProfileToConfig();
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
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (_) {
    /* 图片过大会超出 localStorage 配额，前端演示阶段提示即可 */
  }
  applyProfileToConfig();
  emitProfileChange();
}

function getProfile() {
  if (!profile) loadProfile();
  return profile;
}

function resetProfile() {
  profile = cloneDefaults();
  saveProfile();
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
