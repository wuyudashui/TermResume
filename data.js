'use strict';

/* =====================================================================
 * data.js —— 虚拟文件系统 + 静态资源
 * 个人资料已拆到 config.js；这里的占位符会自动读取 config.js。
 * 注意：config.js 必须先于 data.js 加载（index.html 中已保证顺序），
 *       本文件的文件名/属主/文本内容都会跟随 config 自动同步。
 * 文字里支持 {name} {title} {user} {host} {github} 这类占位符。
 * =================================================================== */

const VERSION = '1.0.0';

/* ---------- neofetch 用的小企鹅 ---------- */
const TUX = [
  '    .--.',
  '   |o_o |',
  '   |:_/ |',
  '  //   \\ \\',
  ' (|     | )',
  "/'\\_   _/`\\",
  ' \\___)=(___/',
];

/* =====================================================================
 * 虚拟文件系统
 * dir(meta, children)   —— 目录
 * file(content, meta)   —— 文件，content 可以是字符串数组或函数
 * 权限简化为 Linux 风格：drwxr-xr-x / -rw-r--r-- 等
 * =================================================================== */

function dir(meta = {}, children = {}) {
  return {
    _meta: {
      type: 'dir',
      owner: CONFIG.user,
      group: CONFIG.user,
      perms: 'drwxr-xr-x',
      mtime: 'Sep  3 09:41',
      ...meta,
    },
    ...children,
  };
}

function file(content, meta = {}) {
  return {
    _meta: {
      type: 'file',
      owner: CONFIG.user,
      group: CONFIG.user,
      perms: '-rw-r--r--',
      mtime: 'Sep  3 09:41',
      ...meta,
    },
    content,
  };
}

/* ---------- 根目录 / ---------- */
const VFS = dir(
  { owner: 'root', group: 'root', perms: 'drwxr-xr-x' },
  {
    home: dir(
      { owner: 'root', group: 'root', perms: 'drwxr-xr-x' },
      {
        [CONFIG.user]: dir({}, {
          'README.md': file([
            '# ~/README.md',
            '',
            '欢迎来到我的 Linux 终端个人主页。',
            '',
            '这里不是静态网页，而是一台**迷你虚拟 Linux 机器**。',
            '请像平时使用终端一样去探索：',
            '',
            '  - `cd projects && ls`      浏览我的项目',
            '  - `cat about.md`           认识一下我',
            '  - `cat skills.md`          看看我的技能栈',
            '  - `cat contact.md`         找到联系方式',
            '  - `cd /etc && cat os-release`  查看这台"系统"',
            '  - `tree ~`                 一屏看完整棵目录树',
            '',
            '小提示：Tab 自动补全路径，↑/↓ 浏览历史命令。',
            'Enjoy your stay ~',
          ]),

          'about.md': file([
            '# about.md',
            '',
            '你好，我是 **{name}** —— {title}。',
            '',
            '关于我：',
            '- 白天写业务代码，晚上折腾 Linux / 开源小工具',
            '- 喜欢把重复的事情自动化，也喜欢把事情做得干净漂亮',
            '- 最近在钻研：终端美化、Web 性能、TypeScript',
            '',
            '人生格言：',
            '> 先跑起来，再逐步优化 —— 毕竟系统里总有一个 TODO 在等你。',
          ]),

          'skills.md': file([
            '# skills.md',
            '',
            '## 前端 / Web',
            '- HTML/CSS/JavaScript',
            '- React / Vue / TypeScript',
            '',
            '## 后端 / 工程化',
            '- Node.js · 数据库基础',
            '- Git / GitHub · CI 与自动化',
            '',
            '## 其他',
            '- Linux / Shell 脚本',
            '- Markdown · 文档写作',
            '- 摄影 · 咖啡因耐受测试',
          ]),

          'contact.md': file([
            '# contact.md',
            '',
            '邮箱：[{email}](mailto:{email})',
            'GitHub：[github.com/{github}](https://github.com/{github})',
            '',
            '> 回复速度取决于此刻终端里有多少个进程在跑 : )',
          ]),

          projects: dir({}, {
            'terminal-homepage': dir({}, {
              'README.md': file([
                '# projects/terminal-homepage',
                '',
                '**Linux 终端风格个人主页**',
                '',
                '一套把个人主页伪装成虚拟 Linux 机器的页面：',
                '支持 `cd / ls / cat / tree` 目录漫游，',
                '带启动动画、Tab 补全与历史记录。',
                '',
                '技术栈：HTML · CSS · JavaScript（零依赖）',
                '',
                '现在你正运行在它里面，边看边体验。',
              ]),
            }),
            dotfiles: dir({}, {
              'README.md': file([
                '# projects/dotfiles',
                '',
                '**dotfiles**',
                '',
                '管理终端与桌面开发环境的配置文件：',
                'zsh、tmux、Neovim、Git 等的版本化与一键安装脚本。',
                '',
                '特点：',
                '- 重装系统后几分钟恢复生产力',
                '- 配置按工具拆分、注释齐全',
              ]),
            }),
            'markdown-notes': dir({}, {
              'README.md': file([
                '# projects/markdown-notes',
                '',
                '**Markdown 笔记小工具**',
                '',
                '一个本地优先、命令行驱动的笔记工具。',
                '',
                '命令：',
                '- `add`    快速新建带日期的笔记',
                '- `list`   按标签/目录浏览',
                '- `search` 全库关键词检索',
              ]),
            }),
          }),

          /* 博客文件由 session.js 根据 profile.blogs 动态生成。 */
          blog: dir({}, {}),

          notes: dir({}, {
            'linux-cheatsheet.md': file([
              '# notes/linux-cheatsheet.md',
              '',
              '| 命令 | 作用 |',
              '| --- | --- |',
              '| pwd | 显示当前路径 |',
              '| cd - | 回到上一个目录 |',
              '| ls -la | 查看所有文件详情 |',
              '| tree | 递归显示目录 |',
              '| cat | 查看文件内容 |',
              '| head -3 | 只看开头三行 |',
            ]),
          }),

          '.bashrc': file([
            '# ~/.bashrc —— 我的 shell 配置（隐藏文件）',
            '',
            "alias ll='ls -la'",
            "alias la='ls -A'",
            "alias cls='clear'",
            "alias ..='cd ..'",
            '',
            '# 提示：隐藏文件需要用 ls -a 才能看到',
          ]),

          '.secret': file([
            '🤫 你发现了隐藏文件！',
            '',
            '这说明你已经掌握了 `ls -a` / `ls -la`。',
            '作为奖励：输入 `sudo rm -rf /` 会得到一句冷笑话（千万别真敲）。',
          ]),

          '.ssh': dir(
            { perms: 'drwx------' },
            {
              'id_rsa.pub': file([
                'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILinuxDemoOnlyDoNotUseMe {user}@{host}',
              ]),
            }
          ),
        }),
      }
    ),

    etc: dir(
      { owner: 'root', group: 'root' },
      {
        hostname: file(function hostnameFile() {
          return [CONFIG.host];
        }, { owner: 'root', group: 'root' }),
        issue: file(function issueFile() {
          return [CONFIG.osName + ' Linux ' + VERSION + ' \\l'];
        }, { owner: 'root', group: 'root' }),
        motd: file([
          'Welcome to {host} · {osName} 个人主页版',
          '',
          '这台机器没有真实的文件系统，但你可以这样探索：',
          '  cd projects     进入项目目录（相对 ~/projects）',
          '  ls -la          查看所有文件（含隐藏文件）',
          '  cat about.md    看看我是谁',
          '  tree ~          一屏看完整棵目录树',
          '  cd /etc && cat os-release   查看发行信息',
          '',
          '输入 help 获取完整命令列表。',
        ], { owner: 'root', group: 'root' }),
        'os-release': file([
          'PRETTY_NAME="' + CONFIG.osName + ' Linux (个人主页版)"',
          'NAME="' + CONFIG.osName + '"',
          'ID=' + CONFIG.osId,
          'VERSION_ID="1.0"',
          'VERSION="1.0 (Terminal)"',
          'BUILD_ID=rolling',
          'HOME_URL="https://example.com"',
        ], { owner: 'root', group: 'root' }),
      }
    ),

    root: dir(
      { owner: 'root', group: 'root', perms: 'drwx------' },
      {
        'secret.txt': file(
          ['THIS IS ROOT ONLY.', 'Nothing to see here — thanks for trying.' ],
          { owner: 'root', group: 'root', perms: '-r--------' }
        ),
      }
    ),

    var: dir(
      { owner: 'root', group: 'root', perms: 'drwxr-xr-x' },
      {
        log: dir(
          { owner: 'root', group: 'root' },
          {
            syslog: file(function syslogFile() {
              return [
                `Sep  3 09:41:01 ${CONFIG.host} systemd[1]: Starting ${CONFIG.osName} Personal Homepage…`,
                `Sep  3 09:41:01 ${CONFIG.host} kernel: [0.000000] Booted a webpage pretending to be a kernel`,
                `Sep  3 09:41:02 ${CONFIG.host} systemd[1]: Started Terminal Session for ${CONFIG.user}.`,
                `Sep  3 09:41:02 ${CONFIG.host} login[1]: ${CONFIG.user} logged in from the browser`,
                `Sep  3 09:41:03 ${CONFIG.host} ${CONFIG.osId}: Everything looks fine. Have a nice day.`,
              ];
            }, { owner: 'root', group: 'root' }),
          }
        ),
      }
    ),

    usr: dir(
      { owner: 'root', group: 'root' },
      {
        share: dir(
          { owner: 'root', group: 'root' },
          {
            doc: dir(
              { owner: 'root', group: 'root' },
              {
                [CONFIG.osId + '.txt']: file([
                  CONFIG.osName + ' Documentation',
                  '====================',
                  '',
                  CONFIG.osName + ' 是一个纯 HTML/CSS/JavaScript 实现的',
                  'Linux 风格个人主页演示系统，可在现代浏览器运行。',
                  '',
                  '目录结构：',
                  '  /etc           系统配置与欢迎信息',
                  '  /home/' + CONFIG.user + '     个人主页主要内容',
                  '  /usr/share/doc 文档',
                  '  /var/log       系统日志',
                  '  /proc          虚拟内核信息',
                  '',
                  '更多说明：cat /home/' + CONFIG.user + '/README.md',
                ], { owner: 'root', group: 'root' }),
              }
            ),
          }
        ),
      }
    ),

    tmp: dir(
      { owner: 'root', group: 'root', perms: 'drwxrwxrwt' },
      {
        'hello.txt': file([
          'this is /tmp.',
          '临时文件都住这里 —— 每次刷新页面都会被清空（大概吧）。',
        ]),
      }
    ),

    proc: dir(
      { owner: 'root', group: 'root', perms: 'dr-xr-xr-x' },
      {
        version: file(function procVersion() {
          return [
            CONFIG.osName + ' version 1.0 (personal-homepage) #1 SMP',
            'Browser: ' + (navigator.userAgent || 'Unknown Browser'),
            '',
            'You are running this virtual Linux inside a real webpage.',
          ];
        }, { owner: 'root', group: 'root' }),
      }
    ),
  }
);
