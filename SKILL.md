---
name: zsxq-knowledge
description: >-
  管理知识星球（zsxq）内容的知识库：同步帖子与精华、下载附件、抽取 docx/pdf 正文、转成 Markdown、
  补全主题分类/关键词/摘要、提取金句、重建索引、按标签或日期检索。
  当用户提到知识星球、zsxq、星球文章、精华帖、星主问答、星球语音、同步星球、
  搜索星球内容、按标签或日期查找、语音转文字时使用。
---

# 知识星球知识库

把订阅的知识星球内容整理成可检索的本地 Markdown 知识库：**同步 → 富化 → 建索引 → 检索**。

## 0. 先判断环境（必读）

动手前先确认当前会话属于哪种环境，两种模式的执行方式**完全不同**：

| 环境 | 判断方式 | 走哪一节 |
|---|---|---|
| **A. DSH 插件模式** | 会话工具里有 `zsxq_doctor`、`zsxq_sync`、`zsxq_search`、`zsxq_status` | 第 1 节 |
| **B. 通用 Agent 模式** | 没有上述工具（Claude Code / Cursor / 未装插件的 DSH 等） | 第 2 节 |

判断方法：先看有没有 `zsxq_doctor` 工具；没有就按 B 处理，并在动手前告诉用户「当前是脚本模式，需要本机 Python 环境」。

- 在 A 模式下**不要**自己拼 `python3 scripts/...` 命令——工具已经封装好参数校验、错误分类和破坏性守卫；
- 在 B 模式下**不要**假装调用不存在的工具——按第 2 节跑脚本；
- 两种模式产出的文件格式完全一致，可以读写同一个数据目录。

## 1. DSH 插件模式

### 1.1 工具

| 工具 | 作用 | 副作用 |
|---|---|---|
| `zsxq_doctor` | 自检：脚本/依赖/Cookie 是否有效（真实探测一次 API）/索引健康度 | 无 |
| `zsxq_list_channels` | 列出配置的频道（key、中文名、group_id、默认 scope） | 无 |
| `zsxq_status` | 文章/金句数量、索引是否落后、同步状态 | 无 |
| `zsxq_search` | 关键词/标签/频道/分类/日期检索元数据索引 | 无 |
| `zsxq_sync` | 同步帖子（today/date/month/count/hashtag），下载附件并抽取正文 | **写 `channels/`、`assets/`** |
| `zsxq_rebuild_index` | 重建 `INDEX.md`、`index/**`、`index.json` | 写 `index/`、`INDEX.md` |

关键约束（工具已内置，不要绕过）：

- `zsxq_sync` 的 `count` 上限是 **30**（知识星球接口硬上限，超过返回 `code=14001`）；
- `refresh`（整月重拉覆盖）默认被拦，必须用户明确确认后传 `confirmDestructive`；
- Cookie 失效时工具会返回 `ZSXQ_COOKIE_EXPIRED` 并给出重新获取步骤，照做即可。

### 1.2 标准工作流

```
① zsxq_doctor            环境/凭据是否就绪（换机器、换 Cookie、同步失败时先跑）
② zsxq_sync              同步帖子（用户说"今天"就只同步今天）
③ enrichment（本手册 1.3） 模型逐篇读全文，补 frontmatter + 写金句文件
④ zsxq_rebuild_index     重建索引
⑤ zsxq_search            检索验证
```

用户只说「同步今天的内容」时，执行 ②；同步完成后**必须**继续 ③④，否则新内容搜不到（索引只读 `index.json`）。

### 1.3 enrichment 规范（模型必须执行）

对 `zsxq_sync` 返回的**每个**新增文件，做以下三件事：

**① 补 frontmatter 的 4 个字段**

```yaml
# 替换前
topic_category:
keywords: []
summary: ""
quotes_count: 0

# 替换后
topic_category: 宏观经济
keywords:
  - 降息
  - 流动性
  - 债市
summary: "停战压油价缓和通胀，年内降息预期升温。"
quotes_count: 2
```

| 字段 | 规则 |
|---|---|
| `topic_category` | 从内容判断；已按 `tag_to_category` 预填的保留 |
| `keywords` | 3–5 个，YAML 列表 |
| `summary` | 一句话概括核心观点，**≤50 字**，双引号包裹 |
| `quotes_count` | 与下面 ② 创建的金句条数一致 |

常见分类：宏观经济、市场分析、时事分析、投资理念与方法、书籍笔记、哲学与思维方法、历史分析、领导力与组织、房地产与金融、职业发展、人生感悟、社会观察、行业分析、知识科普、投资入门。

**② 提取金句，创建 `{主文件名}.quotes.md`**

金句标准：脱离上下文也有独立含义；表达深刻观点或独特见解；不是事实性陈述（"今天涨了 3%" 不算）；不是标题重复。

格式（同目录，`.md` 前插入 `.quotes`）：

```markdown
> 金句内容第一条

> 金句内容第二条
```

没有合格金句就不建文件，`quotes_count: 0`。

**③ 检查正文完整性**

打开文件确认正文非空。如果只有标题、正文空但有附件，说明附件抽取失败——在汇报里明确指出，不要假装成功。

**取文优先级**：同一篇帖子里同时有「提炼问答/全文 docx」和「mp3 语音」时，**以 docx 文字稿为准**；逐字稿口语重复多（"这个这个"），做摘要/金句时优先用整理过的问答稿。

### 1.4 两种模式的边界

以下能力脚本与插件都没有实现，按本手册约定处理：

- **语音 ASR**：`> ⚠️ 语音内容需要 ASR 转文字` 占位需接火山 ASR；没有 ASR 时如实告知用户「全文在 mp3 里」；
- **海报生图**：金句海报交给图像生成模型，**不要**用 HTML/PPT 类技能画卡片；至少给 2–3 个风格方向。

## 2. 通用 Agent 脚本模式

### 2.1 前置条件

1. **Python ≥ 3.10**（脚本用了 `dict | None`、`list[str]` 语法）；
2. 安装依赖：

   ```bash
   python3 -m pip install -r requirements.txt
   ```

   依赖：`requests`、`python-docx`、`PyMuPDF`、`beautifulsoup4`、`pyyaml`。
3. 准备数据目录：复制 `config.example.json` 为 `config.json`，填入 Cookie（见 3.1）；
4. 目录布局（数据目录与 skill 可以分离）：

   ```
   <知识库数据目录>/
   ├── config.json      # 不提交 Git
   ├── .synced_ids      # 同步去重状态，不提交 Git
   ├── channels/        # 生成的 Markdown
   ├── assets/          # 下载的附件（docx/pdf/mp3/图片）
   ├── data/raw/        # 原始 JSON
   └── index/           # 索引产物
   ```

   数据目录如何确定：设 `ZSXQ_BASE_DIR` 环境变量最稳；否则若在数据目录下运行则用当前目录；旧布局（`<repo>/skills/zsxq-knowledge/scripts`）自动兼容。

### 2.2 命令

```bash
# 只同步今天（用户说"今天"就只同步今天）
python3 scripts/sync.py --channel all --today

# 首次使用：列出你加入的星球，把生成的片段合并进 config.json
python3 scripts/channels.py

# 指定日期 / 最近 N 条 / 单频道
python3 scripts/sync.py --channel all --date 2026-11-06
python3 scripts/sync.py --channel all --count 10
python3 scripts/sync.py --channel <频道key> --today

# 按标签筛选（标签名不带 #）
python3 scripts/sync.py --channel <频道key> --hashtag <标签名> --count 5

# 整月分页拉取（单频道）
python3 scripts/sync.py --channel <频道key> --month 2026-11

# ⚠️ 整月重拉覆盖：会删除本地该月 md/assets，连同已填的富化字段与金句
python3 scripts/sync.py --channel <频道key> --month 2026-11 --refresh

# 重建索引（全量，约 0.3s / 130 篇）
python3 scripts/build_index.py

# 检索（--json 适合程序化；不加则人类可读）
python3 scripts/search.py "降息" --json
python3 scripts/search.py --tag 宏观策略 --limit 20
python3 scripts/search.py --channel <频道key> --date-from 2026-04-01
```

- `count` 单次最多 **30**（接口硬上限，31 以上返回 `code=14001`）；
- `--today`/`--date` 是「先取 `count` 条再按日期过滤」，当天帖多时要显式调大 `count`（≤30）；
- 脚本会下载附件、抽取 docx/pdf 正文、去重；**不**做分类/摘要/金句——那部分按 1.3 的规范由模型完成。

### 2.3 脚本自动完成 vs 模型需要做的

| 脚本自动完成 | 模型负责 |
|---|---|
| 拉取/分页/限流（1.5s）/去重/落盘 | 判断主题分类、写摘要与关键词 |
| 下载 docx/pdf/mp3 到 `assets/` | 从全文提取金句、创建 `.quotes.md` |
| docx/pdf 抽取文本与图片、写入 md | 检查正文完整性、汇报异常 |
| 富文本 `<e>` 标记转 Markdown | 语音转写（需 ASR）、海报生图（需文生图） |
| 文章贴 HTML → 正文 | |
| 重建索引（INDEX.md/index.json/by-*） | |

## 3. 频道与配置

### 3.1 Cookie 获取

1. 浏览器打开 <https://wx.zsxq.com> 扫码登录，确认能正常看到星球内容；
2. `F12` → **Network** → 过滤 `api.zsxq.com` → 刷新页面 → 点任意请求；
3. **Headers → Request Headers → Cookie**，复制冒号后**整串**（形如 `zsxq_access_token=…; abtest_env=product`）；
4. 写入 `config.json` 的 `zsxq_cookie`，**不要把 Cookie 贴进聊天/提交到 Git**。

Cookie 会随换设备/退出登录失效，表现为 **HTTP 401**；重新获取即可。

### 3.2 频道（channels）

`config.json` 的 `channels` 是「频道 key → 星球」的映射，**由用户自己的订阅决定**：

```json
{
  "channels": {
    "my-channel": {
      "name": "我的星球",
      "group_id": "123456789012",
      "default_scope": "digests"
    }
  }
}
```

不知道 `group_id`？运行 `python3 scripts/channels.py`，它会列出当前 Cookie 可访问的所有星球，
并输出可直接粘贴进 `config.json` 的片段。key 由脚本按星球名自动生成，也可以自己改成更好记的名字
（后续 `--channel <key>` 用它）。`tag_to_category` 用于按标签预填分类，可选。

### 3.3 范围（scope）

`digests`（默认，精华）｜ `all`（全部）｜ `by_owner`（星主）｜ `questions`（提问）｜ `with_files`｜ `with_images`。

注意：**星主问答、晚课、非精华讨论等常是非精华帖**，默认 `digests` 拉不到，要看它们得用 `scope=all`。

## 4. 关键规则（必须遵守）

1. **用户说"今天"就只同步今天**（`--today`），不要拉历史；
2. **每篇文章必须有完整正文**：只有标题 = 抽取失败，必须排查并在汇报里说明；
3. **docx/pdf 文本必须已在 md 里**（`## 📄 文件名` 段落）；附件必须下载到本地；
4. **金句必须读完整正文后提取**，不要从标题凑；
5. **不要跳过短文章**，所有新文件都要富化；
6. **`--refresh` 是破坏性操作**：会物理删除该月 md（含已填字段与金句），没有备份——先确认再执行；
7. **索引会过期**：每次富化后必须 `build_index`，否则 `search` 搜不到新内容（它只读 `index.json`）；
8. **Cookie 即账号凭据**：不写入仓库、不打印、不外传。

## 5. 数据目录与 frontmatter

见 [`reference/knowledge-base-layout.md`](reference/knowledge-base-layout.md)：完整的目录结构、frontmatter 字段表（脚本生成 vs 模型生成）、索引产物说明。

## 6. 参考

- [`reference/api-reference.md`](reference/api-reference.md) — 知识星球 Web v2 API（认证、接口、错误码 `1059`/`14001`、限流）
- [`reference/knowledge-base-layout.md`](reference/knowledge-base-layout.md) — 知识库目录、frontmatter、索引产物
- `scripts/` — Python 参考实现；`config.example.json` — 配置模板
