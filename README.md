# zsxq-skill

把订阅的**知识星球**内容整理成本地 Markdown 知识库的 Agent Skill：同步帖子与附件、抽取 docx/pdf 正文、补全分类/摘要/金句、重建索引、检索查询。

仓库根目录就是 skill 目录（`SKILL.md` + `scripts/` + `reference/`），因此它有**两种用法**：装成 DSH 插件，或直接放进任意 agent 的 skills 目录。

---

## 1. 这是什么

一个「说明书 + 参考实现」组合：

| 部分 | 作用 |
|---|---|
| `SKILL.md` | 给模型看的操作手册：什么时候用、按什么顺序、富化标准（分类/摘要/金句）、安全规则 |
| `scripts/*.py` | 参考实现：同步、附件下载与抽取、索引重建、检索（Python ≥3.10） |
| `reference/` | API 参考、知识库目录与 frontmatter 规范 |
| `lib/index.js` + `package.json` | 让 DSH 能把本 skill 注册进去的 30 行 provider（DSH 专用，其它 agent 用不到） |

**它做什么**：把你自己订阅的星球帖子（含附件/语音）同步到本地 `channels/<频道>/<年>/<月>/<日>/*.md`，富化成可检索的知识库。
**它不做什么**：不替你关注/加入星球、不下载你无权访问的内容、不内置 ASR 与生图（这两项按手册交给对应模型）。

## 2. 快速开始

### 方式 A：装进 DSH（推荐，开箱即用）

```sh
# 从 GitHub 安装（尚未发布 npm 时）
dsh plugin --profile web add github:zhangcaiqian/zsxq-skill

# 发布 npm 之后
dsh plugin --profile web add dsh-skill-zsxq

# 本地开发（改完代码即时生效需要重启）
dsh plugin --profile web add link:/path/to/zsxq-skill
```

安装后**重启 DSH**（配置改动会热更新，skill 模块不会），新会话里就能看到 `zsxq-knowledge` 这个 skill。

> **DSH Desktop 用户注意**：桌面端有自己的 profile，请优先在 **设置 → 插件** 里安装。若用命令行，必须把 `DSH_HOME` 指向桌面用的 harness 目录，否则会装进另一个无关的 profile。桌面端自带的运行方式：
> ```sh
> DSHNODE="$HOME/Library/Application Support/dsh-desktop/harness/.desktop-bin/node"
> DSHCLI="/Applications/DSH Desktop.app/Contents/Resources/app.asar/node_modules/@deepseek-ai/dsh/lib/bin.js"
> DSH_HOME="$HOME/Library/Application Support/dsh-desktop/harness" \
>   "$DSHNODE" "$DSHCLI" plugin --profile web add github:zhangcaiqian/zsxq-skill
> ```

### 方式 B：放进任意 agent 的 skills 目录（不需要 DSH）

```sh
# 1) 克隆（目录名建议就是 skill 名）
git clone https://github.com/zhangcaiqian/zsxq-skill.git ~/.agents/skills/zsxq-knowledge
```

放到哪个目录，取决于你的 agent：

| 宿主 | skills 根 |
|---|---|
| DSH（用户级，全项目可见） | `~/.agents/skills/` 或 `~/.dsh/skills/` |
| DSH（项目级，只对该项目生效） | `<项目根>/.dsh/skills/` 或 `<项目根>/.agents/skills/` |
| Claude Code | `~/.claude/skills/`（项目级 `<repo>/.claude/skills/`） |
| 其他支持 Agent Skills 的工具 | 见各自文档，本质是「一个含 `SKILL.md` 的目录」 |

> DSH 的加载优先级（实测）：项目 `.dsh/skills` > 项目 `.agents/skills` > 插件运行时注册 > 用户 `~/.dsh/skills` > 用户 `~/.agents/skills` > 宿主内置。**同名时优先级高的覆盖低的**——所以你可以把本仓库放进项目里定制，而插件自带的那份会被覆盖。

## 3. 前置条件

两条路都需要的：

1. **Python ≥ 3.10**（脚本使用了 `dict | None`、`list[str]` 等语法）；
2. **依赖**：

   ```sh
   python3 -m pip install -r requirements.txt
   ```
   `requests`、`python-docx`、`PyMuPDF`、`beautifulsoup4`、`pyyaml`
3. **知识星球 Cookie**（见第 4 节）；
4. **一个数据目录**（放 `config.json`、`channels/`、`assets/`、`index/`）。这就是「你的知识库」，可以是任意空目录：

   ```sh
   mkdir -p ~/my-knowledge-base && cd ~/my-knowledge-base
   ```

## 4. 配置 Cookie

1. 浏览器打开 <https://wx.zsxq.com> 扫码登录，确认能正常刷出星球帖子；
2. `F12` → **Network** → 过滤 `api.zsxq.com` → 刷新页面 → 点任意一条请求；
3. **Headers → Request Headers → `Cookie:`**，复制冒号后整串，形如：
   `zsxq_access_token=xxxx; abtest_env=product`
4. 放进数据目录的 `config.json`：

   ```sh
   cd ~/my-knowledge-base
   cp /path/to/zsxq-skill/config.example.json config.json
   # 编辑 config.json，把 zsxq_cookie 换成刚复制的整串
   ```

> ⚠️ Cookie 等同于账号凭据：不要贴到聊天、不要提交 Git（本仓库 `.gitignore` 已排除 `config.json`）。
> Cookie 实测有效期约 1 个月，失效表现为 **HTTP 401**，重新获取即可。

`config.json` 字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `zsxq_cookie` | ✅ | 星球 Cookie |
| `channels` | ✅ | 频道表：`key` / `name` / `group_id` / `default_scope`，用 `scripts/channels.py` 生成 |
| `tag_to_category` | 可选 | 标签→分类映射，用于富化时预填 `topic_category` |

### 4.1 配置你的星球（channels）

`channels` 决定同步哪些星球，**不需要手抄 group_id**：

```sh
python3 scripts/channels.py          # 列出可访问的星球 + 生成配置片段
python3 scripts/channels.py --json   # 只要 JSON
```

把输出里的 `channels` 合并进 `config.json`，删掉不需要同步的条目。key 由脚本按星球名生成，
也可以改成更好记的名字，后续 `--channel <key>` 用它。

## 5. 数据目录怎么指定

脚本按以下顺序找数据目录：

1. 环境变量 `ZSXQ_BASE_DIR`（最稳，推荐显式设置）：
   ```sh
   export ZSXQ_BASE_DIR=~/my-knowledge-base
   ```
2. 当前工作目录（其下存在 `config.json` 或 `channels/`）；
3. 旧布局兼容：`<repo>/skills/zsxq-knowledge/scripts` 会自动识别仓库根；
4. 都没有则回退到 skill 目录，并在报错里提示缺少 `config.json`。

## 6. 怎么用

### 方式 A（DSH 里，用自然语言）

不需要记命令，直接说需求，模型会按 `SKILL.md` 的流程执行：

| 你说 | 会发生什么 |
|---|---|
| 「自检一下知识星球环境」 | 检查 Cookie、依赖、索引状态 |
| 「同步今天知识星球的内容」 | 同步今天的精华帖，下载附件、抽取 docx/pdf 正文 |
| 「补一下 11 月 6 日」/「拉 2026-11 整月」 | 按日期或整月同步 |
| 「同步最近 5 条带某个标签的帖子」 | 按标签同步 |
| 「把新同步的文章做富化」 | 逐篇补分类/关键词/摘要 + 提取金句 |
| 「重建索引」 | 重建 `INDEX.md` / `index.json` / 分片索引 |
| 「搜一下降息」「找 4 月以来讲黄金的文章」 | 检索并返回路径与摘要 |

### 方式 B（脚本模式）

```sh
export ZSXQ_BASE_DIR=~/my-knowledge-base
cd /path/to/zsxq-skill      # 或者把 scripts/ 复制到你的项目里

# 首次使用：列出可访问的星球，生成 config.json 的 channels 片段
python3 scripts/channels.py

# 同步
python3 scripts/sync.py --channel all --today
python3 scripts/sync.py --channel all --date 2026-11-06
python3 scripts/sync.py --channel <频道key> --count 10
python3 scripts/sync.py --channel <频道key> --hashtag <标签名> --count 5
python3 scripts/sync.py --channel <频道key> --month 2026-11

# 重建索引
python3 scripts/build_index.py

# 检索
python3 scripts/search.py "降息"
python3 scripts/search.py --tag 宏观策略 --limit 20 --json
python3 scripts/search.py --channel <频道key> --date-from 2026-04-01
```

完整参数说明见 [`SKILL.md`](SKILL.md) 第 2 节。

## 7. 完整工作流

```
① 同步（脚本/插件）      拉帖子 → 下载附件 → 抽 docx/pdf 正文 → 写 md
② 富化（模型）           逐篇读全文 → 填 topic_category/keywords/summary → 提金句写 .quotes.md
③ 重建索引（脚本/插件）  INDEX.md / index.json / by-date|tag|topic|channel
④ 检索（脚本/插件）      只读 index.json，不扫正文
```

**② 必须由模型做**：分类、摘要、金句需要读懂全文，脚本只做搬运与解析。规范写在 `SKILL.md` 第 1.3 节（分类枚举、摘要 ≤50 字、金句标准、`quotes_count` 一致性）。

**③ 之后才搜得到**：检索只读 `index.json`，同步后不重建索引，新文章不可检索。

## 8. 生成的数据

```
~/my-knowledge-base/
├── config.json                      # 不提交 Git
├── .synced_ids                      # 去重状态，不提交 Git
├── channels/<channel>/<YYYY>/<MM>/<DD>/<标题>.md
│                                   └── <标题>.quotes.md     # 金句
├── assets/<channel>/<YYYY>/<MM>/<DD>/   # docx/pdf/mp3/图片
├── data/raw/                        # 原始 JSON（调试用）
├── index/                           # 索引产物（index.json 是检索数据源）
└── INDEX.md
```

字段含义与目录细节见 [`reference/knowledge-base-layout.md`](reference/knowledge-base-layout.md)。

## 9. 与 `dsh-plugin-zsxq` 的关系

同作者的另一个仓库 [dsh-plugin-zsxq](https://github.com/zhangcaiqian/dsh-plugin-zsxq) 把本 skill 的**确定性脚本能力**做成了 DSH 原生工具（`zsxq_sync` / `zsxq_search` / `zsxq_rebuild_index` / `zsxq_doctor` 等，纯 JS，不需要 Python）。

- **只装本仓库**：skill 走「脚本模式」，需要 Python；
- **装了插件**：skill 检测到工具后走「插件模式」，不需要 Python，且工具自带参数校验与破坏性操作守卫；
- **两个都装**：插件依赖本包并复用同一条 skill 条目，不会重复；你在项目里放的同名 skill 仍可覆盖它。

配合方式与版本兼容说明以插件仓库 README 为准。

## 10. 常见问题

| 现象 | 原因与处理 |
|---|---|
| `401 Unauthorized` | Cookie 过期，重新获取并更新 `config.json` |
| `code=14001` | 参数非法，最常见是 `count > 30`（接口硬上限） |
| `code=1059` | 触发限流，脚本会自动重试 3 次；仍失败等 10–30 分钟 |
| 搜不到刚同步的文章 | 索引过期——先 `build_index`（富化之后必须重建一次） |
| md 只有标题没有正文 | 附件抽取失败被静默跳过：检查 `assets/` 里文件是否存在、`files:` 字段是否指向它 |
| `--refresh` 后富化内容没了 | `--refresh` 会物理删除该月 md（含已填字段与金句），没有回收站——执行前先备份 |
| 星主问答/晚课拉不到 | 这些常是非精华帖，默认 `scope=digests` 拉不到，需 `scope=all` |
| 当天帖子漏了 | `--today` 是「先取 count 条再过滤」，把 `count` 调到 30 |
| `assets/` 很大 | 附件原样保存在本地，是磁盘占用主要来源；`.gitignore` 已排除 |
| 日期对不上 | `create_time` 按 +0800 截断，`--today` 用本机时区；非 +0800 机器注意边界 |

## 11. 仓库结构

```
zsxq-skill/
├── SKILL.md                    # 给模型的操作手册（核心）
├── README.md                   # 本文件：给人看的使用说明
├── lib/index.js                # DSH provider：把 SKILL.md 注册进 ctx.skills
├── cordis.patch.yml            # DSH bundle patch
├── package.json                # npm 包清单（dsh.bundle）
├── scripts/                    # Python 参考实现
│   ├── sync.py                 # 同步
│   ├── build_index.py          # 建索引
│   ├── search.py               # 检索
│   ├── zsxq_api.py             # API 客户端
│   └── utils.py                # 数据目录定位、富文本/附件解析
├── reference/
│   ├── api-reference.md        # 星球 Web API + 错误码
│   └── knowledge-base-layout.md# 数据目录/frontmatter/索引规范
├── config.example.json
└── requirements.txt
```

## 12. 版本与兼容

- 遵循 SemVer；`engines.dsh` 覆盖 DSH `0.2.0-rc.2` 起的 0.2.x（含预发布分支）。
- `SKILL.md` 与工具型插件之间靠「工具名 + frontmatter 字段」契约耦合：字段/工具名变更视为破坏性变更，会同时升 minor/major 并在 README 记迁移说明。
- 脚本模式的 CLI 参数保持向后兼容。

## 13. 免责声明

- 本项目仅用于**整理你自己已订阅/有权访问**的知识星球内容，请遵守知识星球服务条款；
- 不要用它批量分发付费内容；
- Cookie 是账号凭据，泄露等于交出账号控制权；任何丢失与本项目无关；
- 第三方接口可能随时变更，接口行为变化不在本项目可控范围内。

## License

[MIT](LICENSE)
