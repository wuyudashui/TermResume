'use strict';

/* =====================================================================
 * config.js —— 个人资料配置（单独一个文件，方便手动修改）
 * 页面会自动读取这里的内容并同步到侧栏 / neofetch / 文件占位符。
 *
 * 常用修改点：
 *   name       中文名字（about.md、侧栏等处展示）
 *   asciiName  终端开屏字符画对应的英文字母；修改时同步调整 SITE_CONTENT.asciiArt
 *   title      当前身份 / 方向
 *   school     学校或组织，可留空
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

const DATA_SCHEMA_VERSION = 3;

/* 个人资料的唯一默认来源：CONFIG 与可维护 Profile 都从这里初始化。 */
const IDENTITY_DEFAULTS = Object.freeze({
  name: '余浩',
  title: '在校学生 · Web 开发者',
  school: '成都理工大学',
  bio: '关注 Web 开发与工程实践，喜欢把复杂问题拆解成清晰、可靠且能够持续迭代的作品。',
  email: '2442078047@qq.com',
  github: 'wuyudashui',
  website: '',
  location: '',
  avatar: '',
});

/* 站点内容统一配置：主页文案、技能与项目只在这里维护。 */
const SITE_CONTENT = Object.freeze({
  productName: 'TermResume',
  documentDescription: '余浩的交互式终端简历：通过命令行浏览个人介绍、技能、项目与成长记录。',
  brandSubtitle: 'PERSONAL TERMINAL / PORTFOLIO',
  availabilityText: 'OPEN TO OPPORTUNITIES',
  asciiName: 'YUHAO',
  asciiArt: [
    '__   __   _   _    _   _      _       ___  ',
    '\\ \\ / /  | | | |  | | | |    / \\     / _ \\ ',
    ' \\ V /   | | | |  | |_| |   / _ \\   | | | |',
    '  | |    | |_| |  |  _  |  / ___ \\  | |_| |',
    '  |_|     \\___/   |_| |_| /_/   \\_\\  \\___/ ',
  ],
  quickLinks: [
    { route: 'awards', label: '荣誉' },
    { route: 'certificates', label: '证书' },
    { route: 'resume', label: '履历' },
    { route: 'projects', label: '项目' },
    { route: 'blog', label: '文章' },
    { route: 'docs', label: '指南' },
  ],
  readme: [
    '# ~/README.md',
    '',
    '**欢迎进入 {name} 的个人终端。**',
    '',
    '这里以一套可交互的 Linux 文件系统组织我的介绍、技能与作品。',
    '你可以直接点击快捷入口，也可以像使用真实终端一样探索：',
    '',
    '  - `cat about.md`              了解我的经历与关注方向',
    '  - `cat skills.md`             查看技术能力与工具栈',
    '  - `cd projects && ls`         浏览项目与实践',
    '  - `cat contact.md`            获取联系方式',
    '  - `tree ~`                    展开完整内容目录',
    '  - `goto resume`               打开图形化履历',
    '',
    '支持 Tab 路径补全与 ↑/↓ 历史命令。输入 `help` 查看全部指令。',
  ],
  about: [
    '# about.md',
    '',
    '你好，我是 **{name}**，目前就读于 **{school}**。',
    '{bio}',
    '',
    '## 我在关注',
    '- Web 前端、交互体验与可维护的工程结构',
    '- Linux、自动化工具与开发效率',
    '- 将学习过程沉淀为项目、文档和可复用经验',
    '',
    '## 我的方式',
    '> 先理解问题，再动手实现；让每一次迭代都比上一次更清晰。',
  ],
  skills: [
    '# skills.md',
    '',
    '## Web 开发',
    '- HTML / CSS / JavaScript / TypeScript',
    '- React / Vue 与响应式界面实现',
    '',
    '## 工程实践',
    '- Node.js / 数据库基础 / 接口协作',
    '- Git / GitHub / CI 与自动化流程',
    '',
    '## 开发工具',
    '- Linux / Shell / 终端工作流',
    '- Markdown / 技术文档 / 知识整理',
  ],
  contact: [
    '# contact.md',
    '',
    '邮箱：[{email}](mailto:{email})',
    'GitHub：[github.com/{github}](https://github.com/{github})',
    '',
    '> 欢迎交流技术、项目与成长经历，我会尽快回复。',
  ],
  projects: [
    {
      id: 'p-terminal-homepage',
      slug: 'terminal-homepage',
      title: 'TermResume · 交互式终端简历',
      summary: '将个人简历组织成一套可探索的虚拟 Linux 系统，支持命令行漫游、图形化页面、访客权限与本地内容管理。',
      stack: 'HTML · CSS · JavaScript',
      url: '',
      readme: [
        '# projects/terminal-homepage',
        '',
        '**TermResume · 交互式终端简历**',
        '',
        '将个人简历组织成一套可探索的虚拟 Linux 系统，',
        '支持命令行漫游、图形化页面、访客权限与本地内容管理。',
        '',
        '技术栈：HTML · CSS · JavaScript（零依赖）',
        '',
        '当前页面就是这个项目的实时运行版本。',
      ],
    },
    {
      id: 'p-dotfiles',
      slug: 'dotfiles',
      title: '开发环境配置集',
      summary: '对终端与常用开发工具配置进行版本化管理，让环境迁移、配置恢复和日常维护更加稳定高效。',
      stack: 'Shell · Git · 自动化',
      url: '',
      readme: [
        '# projects/dotfiles',
        '',
        '**开发环境配置集**',
        '',
        '对终端与常用开发工具配置进行版本化管理，',
        '让环境迁移、配置恢复和日常维护更加稳定高效。',
        '',
        '关键词：Shell · Git · 自动化 · 可复现环境',
      ],
    },
    {
      id: 'p-markdown-notes',
      slug: 'markdown-notes',
      title: '本地优先的 Markdown 笔记工具',
      summary: '围绕快速记录、标签整理与全文检索设计，用轻量命令完成知识的写入、查找和长期沉淀。',
      stack: 'Markdown · CLI · Local First',
      url: '',
      readme: [
        '# projects/markdown-notes',
        '',
        '**本地优先的 Markdown 笔记工具**',
        '',
        '围绕快速记录、标签整理与全文检索设计，',
        '用轻量命令完成知识的写入、查找和长期沉淀。',
        '',
        '关键词：Markdown · CLI · Local First',
      ],
    },
  ],
});

/* 履历默认数据：首次进入或重置后以此为准，admin 的修改保存在浏览器 localStorage */
const PROFILE_DEFAULTS = {
  name: IDENTITY_DEFAULTS.name,
  role: IDENTITY_DEFAULTS.title,
  school: IDENTITY_DEFAULTS.school,
  bio: IDENTITY_DEFAULTS.bio,
  email: IDENTITY_DEFAULTS.email,
  github: IDENTITY_DEFAULTS.github,
  website: IDENTITY_DEFAULTS.website,
  location: IDENTITY_DEFAULTS.location,
  avatar: IDENTITY_DEFAULTS.avatar,
  projects: SITE_CONTENT.projects.map((project) => ({ ...project, readme: [...project.readme] })),
  awards: [
    {
      id: 'a-lqb-python-2026',
      title: '第十七届蓝桥杯全国大学生软件和信息技术大赛',
      year: '2026',
      level: '全国总决赛二等奖',
      note: '软件赛 Python 程序设计大学 B 组',
      image: 'src/awards/lqb_python_second.jpg',
    },
    {
      id: 'a-mtb-2026',
      title: '第八届码蹄杯程序设计大赛',
      year: '2026',
      level: '本科院校赛道国赛铜奖',
      note: '',
      image: 'src/awards/mtb_third.jpg',
    },
  ],
  certificates: [],
  blogs: [
    {
      id: 'b1',
      slug: 'first-post',
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

  name: IDENTITY_DEFAULTS.name,      // 你的名字 / 昵称
  asciiName: SITE_CONTENT.asciiName, // 终端里的大写字符画
  title: IDENTITY_DEFAULTS.title,    // 身份/方向（以后可细化）
  school: IDENTITY_DEFAULTS.school,
  location: IDENTITY_DEFAULTS.location,

  email: IDENTITY_DEFAULTS.email,
  website: IDENTITY_DEFAULTS.website,
  github: IDENTITY_DEFAULTS.github,

  timezone: 'Asia/Shanghai',       // 时区（必须是 IANA 名称，例如 Asia/Shanghai）
  osName: 'TermResumeOS',               // 虚拟系统名
  // osId 自动由 osName 派生，无需手动维护
  get osId() {
    return CONFIG.osName.toLowerCase().replace(/\s+/g, '-');
  },
};
