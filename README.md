# TermResume

一个终端风格的个人简历主页（Terminal Resume）：默认打开是一台迷你虚拟 Linux 机器，访问者可以
`cd` 进入不同目录、`ls` 查看文件、`cat` 读取内容，像在真实终端里一样
浏览你的自我介绍、获奖、证书、项目与博客；也可以 `goto` 切换到图形化页面直接查看。

纯 HTML / CSS / JavaScript，**零依赖、零构建**，任何现代浏览器直接打开即可运行。

GitHub: <https://github.com/wuyudashui/TermResume>

## 两种模式

- **guest 浏览模式（默认）**：只能查看，无任何修改入口；
- **admin 管理模式**：终端输入 `login` 后按提示输入账号密码（默认 `admin / 123456`，
  在 `config.js` 的 `AUTH` 中修改）。支持一条命令直登：

  ```bash
  login -u admin -p 123456
  ```

  密码在输入与命令回显中都会打码。登出用 `logout`。
  admin 可维护个人资料、头像、获奖记录、证书与博客，修改保存在浏览器 localStorage；
  guest 看到的是维护后的内容（`resume` 命令与各图形页均可查看）。
  建议定期使用 `data export` 导出 JSON 备份，需要恢复时使用 `data import`。

### 图形管理台

登录 admin 后输入 `goto manage`，或在图形页面顶部点击“管理”，可以直接：

- 修改姓名、身份、学校、简介与公开联系方式；
- 通过图片 URL 或本地文件设置个人头像；
- 新增、编辑和删除项目经历。

本地头像建议控制在 900 KB 以内。当前 GitHub Pages 版本仍使用浏览器 `localStorage`，
管理台的修改只对当前浏览器生效；要让所有访客共享更新，仍需接入 Supabase 等云端数据源。

## 终端与图形页面（goto）

终端是默认首页与入口，`goto` 负责跳转到**图形化页面**（与 `cd` 的目录漫游分开）：

```bash
goto awards          # 图形页：获奖记录卡片
goto certificates    # 图形页：证书画廊
goto resume          # 图形页：个人履历
goto projects        # 图形页：项目卡片（读取虚拟文件系统）
goto blog            # 图形页：博客时间线（Markdown 增删改查）
goto docs            # 图形页：指令说明书（命令速查）
goto terminal        # 返回终端（别名 goto t / goto home）
```

输入 `goto` 会列出可用页面；初始化页面的加粗入口与图形页顶部导航提供等价点击。
图形页内：admin 可直接添加/删除（guest 只读），修改实时保存。

### 博客系统

`goto blog` 打开博客页：按上传日期倒序的时间线展示；点击标题阅读 Markdown 渲染后的文章。
admin 登录后可在页面内新建 / 编辑 / 删除博客（标题、日期、标签、Markdown 正文），
也可用终端命令 `blog list / blog add / blog show / blog del` 维护，数据同源（localStorage）。

## 界面一览

桌面尺寸下采用“工作台式”布局，从上到下分为三层：

1. **页面外框工具栏**：左侧是项目标题，右侧是 **外观** 切换按钮，
   在白天/黑夜两种模式间切换。黑夜模式是原版经典绿配色，
   白天模式是同一套绿/青配色的浅色变体；选择保存在浏览器本地，下次访问自动沿用。
2. **主工作台**：
   - 左侧信息栏：个人卡片（企鹅 ASCII 头像、名字、身份、邮箱/GitHub）、
     快捷目录按钮、实时会话状态（当前路径 / 历史命令数 / 运行时长）。
   - 右侧主终端：开机动画、可漫游的虚拟文件系统与全部命令交互。
3. **输入栏**：固定在终端底部，历史内容滚动时不会跟随移动；
   聚焦时带绿色（跟随当前模式）描边与光晕。

## 快速开始

直接双击 `index.html` 打开；或者启动一个本地静态服务器：

```bash
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

打开后页面会先显示一段引导说明，随后播放开机画面并自动执行 `cat /etc/motd`，
照着提示输入命令即可开始探索。

关键数据与命令回归测试可直接运行：

```bash
node tests/stage-a.test.js
```

## 推荐体验路径

```bash
help                                        # 查看全部命令
neofetch                                    # 经典系统信息展示
cd /etc && cat os-release                   # 查看虚拟系统发行信息
cd ~                                        # 回到主目录
ls -la                                      # 看看有什么（含隐藏文件）
cat README.md                               # 主页使用说明
cd projects && ls                           # 我的项目
cat terminal-homepage/README.md             # 查看某个项目
cat blog/first-post.md                      # 读一读博客
cat /proc/version                           # 浏览器信息伪装成内核
cd /root                                    # 猜猜会发生什么（权限拒绝）
sudo rm -rf /                               # 一个无伤大雅的彩蛋
```

支持的终端细节：

- `cd -` 回到上一个目录，`&&` 串联多条命令
- `Tab` 自动补全命令或路径（目录补全后自动加 `/`）
- `↑ / ↓` 浏览历史命令，`history` 查看、`history -c` 清空
- `$HOME`、`$USER`、`$PWD` 等环境变量展开
- `ls` / `cat` / `head` / `tail` / `tree` 支持 `*`、`?` 通配符展开，
  例如 `ls ~/*.md`、`cat ~/notes/*.md`、`tree ~/projects/*`
- `ls -la`、`cat -n`、`head -n`、`tail -n` 等常用参数
- `clear` / `cls` 清屏；`..` 快捷返回上级目录

## 命令一览

| 类别 | 命令 |
| --- | --- |
| 导航 | `pwd` `cd` `ls` `tree` |
| 查看文件 | `cat [-n]` `head [-n]` `tail [-n]` |
| 系统信息 | `neofetch` `whoami` `date` `uname` `uptime` `help` |
| 其他 | `banner` `history` `echo` `clear` `sudo` `exit` |
| 管理 | `login` `logout` `profile` `avatar` `awards` `certs` `blog` `data` |

输入 `help <命令>`（例如 `help cd`）可以查看单个命令的用法说明。

## 虚拟目录速览

```text
/
├── etc/                 系统配置（os-release、motd、hostname…）
├── home/guest/          个人主页主目录
│   ├── README.md        浏览指南
│   ├── about.md         自我介绍
│   ├── skills.md        技能清单
│   ├── contact.md       联系方式
│   ├── projects/        项目（每个项目一个子目录 + README.md）
│   ├── blog/            博客文章
│   ├── notes/           备忘 / 速查表
│   └── .bashrc 等       隐藏文件（需要 ls -a）
├── root/                root 专属目录（guest 无权进入）
├── var/log/             虚拟日志
├── usr/share/doc/       文档
├── tmp/                 临时文件
└── proc/                虚拟内核信息
```

## 改成你自己的内容

### 1. 个人资料与站点内容（改 `config.js`）

`config.js` 是站点内容的唯一默认配置入口，包含：

- `IDENTITY_DEFAULTS`：姓名、身份、学校、简介与联系方式
- `SITE_CONTENT`：字符画、顶部品牌文案、关于我、技能、项目和终端引导
- `PROFILE_DEFAULTS`：获奖、证书和博客的初始数据
- `CONFIG`：终端用户名、主机名、时区和系统名
- `email`、`website`（暂无则留空）、`github` 用户名

页面侧栏、`neofetch`、虚拟文件和图形页面都会读取这些配置。修改个人化内容时，
优先只编辑这一个文件；登录 admin 后的修改仍会保存在浏览器 `localStorage`。

### 2. 虚拟文件系统结构（改 `data.js`）

`data.js` 中的 `VFS` 负责虚拟目录结构。个人介绍、技能与项目内容来自
`config.js` 的 `SITE_CONTENT`；只有新增系统目录或非个人化文件时才需要修改这里。

新增目录/文件的写法：

```js
guest: dir({}, {
  'hello.md': file([
    '# hello.md',
    '欢迎来到我的页面 {name}！',
  ]),
  newFolder: dir({}, {
    'notes.txt': file(['一些笔记']),
  }),
}),
```

文件内容支持占位符与轻量 Markdown：

```text
# 一级标题（黄色加粗）
## 二级标题
**加粗文字**
`行内代码`（绿色）
[链接文字](https://example.com)
- 列表项
> 引用
```

占位符：`{name}`、`{title}`、`{user}`、`{host}`、`{location}`、
`{email}`、`{website}`，运行时自动替换成 `CONFIG` 里的值。

权限字段是 Linux 风格字符串，例如 `drwx------` 表示只有 owner 能进入，
`-r--------` 表示只有 owner 能读——所以 `guest` 进不了 `/root`，
这是有意保留的真实感。

### 3. 白天 / 黑夜配色（可选）

两套配色都定义在 `style.css` 顶部：

1. `:root` —— 黑夜模式（默认，经典绿）；
2. `:root[data-theme="day"]` —— 白天模式（浅色变体）。

调整任一处的颜色变量即可改对应模式的配色；不需要动 HTML 或 JavaScript。

### 4. 其他界面定制

- 初始化页的加粗快捷入口渲染在 `terminal.js`（`renderNeo` 的 hero 区）
- 图形页面与顶部导航在 `pages.js`
- 输入栏、终端外观、主题变量都在 `style.css`

## 项目结构

```text
.
├── index.html     页面结构（外框工具栏 / 终端 / 图形页视图）
├── config.js      个人资料配置（名字 / 身份 / 邮箱 / GitHub 等）
├── style.css      全部样式（白天/黑夜两组变量、响应式布局、动画）
├── data.js        虚拟文件系统 + 静态资源
├── terminal.js    命令引擎与前端交互（漫游/补全/历史/主题）
├── pages.js       图形页与 goto 路由（awards/certs/resume/projects/blog/docs）
├── session.js     会话与履历数据层（guest/admin 角色、localStorage 持久化）
├── admin.js       认证与管理命令（login/logout/profile/awards/certs/avatar/blog/resume）
├── PROJECT_PLAN.md 产品、架构与分阶段实施规划
├── src/            奖项与证书等静态图片资源
├── tests/          零依赖数据与命令回归测试
└── README.md      本文档
```

## 部署

这是纯静态页面，直接扔到 GitHub Pages、Vercel、Netlify 或任意静态托管即可，
不需要任何后端。推送本仓库后，在 GitHub 仓库 Settings → Pages 选择分支即可部署；
或使用任意静态托管工具将本项目目录直接上传。
