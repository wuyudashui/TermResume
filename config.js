'use strict';

/* =====================================================================
 * config.js —— 个人资料配置（单独一个文件，方便手动修改）
 * 页面会自动读取这里的内容并同步到侧栏 / neofetch / 文件占位符。
 *
 * 常用修改点：
 *   name       中文名字（about.md、侧栏等处展示）
 *   asciiName  终端开屏字符画对应的英文字母；目前内置的是 YUHAO，
 *              改这里不会自动重画，若想换名字需同步重制字符画（见 terminal.js 的 BANNER_ART）
 *   title      身份/简介（现在先写“在校学生”，方向以后再改）
 *   location   城市，可留空；留空时页面不会显示所在地
 *   email      邮箱
 *   website    个人网址，暂时没有就留空，页面会自动隐藏相关入口
 *   github     GitHub 用户名（不含 https://github.com/）
 * =================================================================== */

/* 登录账号：默认 admin / 123456，改这里即可修改默认凭据 */
const AUTH = {
  username: 'admin',
  password: '123456',
};

/* 履历默认数据：首次进入或重置后以此为准，admin 的修改保存在浏览器 localStorage */
const PROFILE_DEFAULTS = {
  name: '余浩',
  role: '在校学生',
  bio: '一个喜欢把想法做成终端的在校学生。',
  email: '2442078047@qq.com',
  github: 'wuyudashui',
  website: '',
  location: '',
  avatar: '', // 图片 URL 或 base64，留空则显示默认企鹅
  awards: [
    {
      id: 'a1',
      title: '示例奖项',
      year: '2025',
      level: '校级',
      note: '这是一个示例，可在 admin 模式下维护。',
    },
  ],
  certificates: [
    {
      id: 'c1',
      name: '示例证书',
      issuer: '某某机构',
      year: '2025',
      url: '',
      note: '可在 admin 模式下维护或上传图片。',
    },
  ],
  blogs: [
    {
      id: 'b1',
      title: '你好，博客',
      date: '2026-09-01',
      tags: ['随笔'],
      content:
        '# 你好，博客\n\n这是我的第一篇博客。\n\n- 以 Markdown 存储\n- 支持增删改查\n\n`cat` 一下也可以。',
    },
  ],
};

const CONFIG = {
  user: 'guest',                    // 终端提示符用户名
  host: '001',                 // 终端主机名
  home: '/home/guest',              // 用户主目录（一般不用改）

  name: '余浩',                     // 你的名字 / 昵称
  asciiName: 'YUHAO',               // 终端里的大写字符画
  title: '在校学生',                 // 身份/方向（以后可细化）
  location: '',                     // 所在地，例如 '成都，中国'；留空则不显示

  email: '2442078047@qq.com',       // 邮箱
  website: '',                      // 个人网址，例如 https://example.com；暂无则留空
  github: 'wuyudashui',             // GitHub 用户名

  timezone: 'Asia/Shanghai',       // 时区（必须是 IANA 名称，例如 Asia/Shanghai）
  osName: 'TermResumeOS',               // 虚拟系统名
  // osId 自动由 osName 派生，无需手动维护
  get osId() {
    return CONFIG.osName.toLowerCase().replace(/\s+/g, '-');
  },
};
