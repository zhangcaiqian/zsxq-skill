# 知识库目录、frontmatter 与索引产物

本文件描述**数据目录**（知识库本体）的结构，与 skill 仓库本身无关。两种使用模式（DSH 插件 / 脚本）读写的是同一套格式，可以互相兼容。

## 1. 目录结构

```
<知识库数据目录>/                     # 由 ZSXQ_BASE_DIR 指定，或当前工作目录
├── config.json                      # 运行时配置（Cookie、频道），不提交 Git
├── .synced_ids                      # 已同步 topic_id 列表（去重），不提交 Git
├── channels/                        # 生成的文章
│   └── <channel>/<YYYY>/<MM>/<DD>/<文件名>.md
│                                                   ├── <文件名>.quotes.md   # 金句（模型生成）
│                                                   └── embedded-*.png       # 附件内嵌图片
├── assets/<channel>/<YYYY>/<MM>/<DD>/   # 下载的 docx / pdf / mp3
├── data/raw/<channel>/<date>/<id>.json  # 原始 API JSON（调试用）
├── index/
│   ├── index.json                   # 机器可读索引（检索唯一数据源）
│   ├── by-date/<YYYY>/<MM>.md
│   ├── by-tag/<tag>.md
│   ├── by-topic/<分类>.md
│   ├── by-channel/<channel>.md
│   └── quotes-index.md
└── INDEX.md                         # 人类可读总览
```

## 2. frontmatter 字段

| 字段 | 来源 | 说明 |
|---|---|---|
| `id` | 脚本 | topic_id，**字符串**（18 位整数超出 JS 安全范围，移植时不要转 number） |
| `source` / `channel` | 脚本 | 频道中文名 / 频道 key |
| `author` | 脚本 | 作者 |
| `date` | 脚本 | 发布日期 `YYYY-MM-DD`（按 +0800 截断） |
| `type` | 脚本 | `talk` / `q&a` / `article` |
| `content_type` | 脚本 | `text` / `voice` / `file` 的组合 |
| `is_digest` | 脚本 | 是否精华 |
| `likes` / `comments` | 脚本 | 互动数 |
| `tags` | 脚本 | 正文 hashtag |
| `voice` / `files` | 脚本 | 附件信息，含 `local_path` |
| `topic_category` | **模型** | 主题分类（已按标签预填的保留） |
| `keywords` | **模型** | 3–5 个关键词 |
| `summary` | **模型** | 一句话摘要，≤50 字 |
| `quotes_count` | **模型** | 金句条数 |

## 3. 金句文件

与主文件同目录，`<主文件名>.quotes.md`：

```markdown
> 金句内容第一条

> 金句内容第二条
```

## 4. 索引产物

- `index/index.json`：`{ total_articles, total_quotes, articles[], tag_index, topic_index }`。
  `articles[]` 每项含 `id/path/channel/source/author/date/type/content_type/is_digest/tags/topic_category/keywords/summary/quotes_count/quotes_path`。
- **检索只读 `index.json`**（匹配 `summary`、`keywords`、`tags`、`path`），不扫正文；因此 enrichment 完成后必须重建索引。
- `INDEX.md` 与 `index/by-*.md` 是人类视图；`by-*` 的链接生成存在已知缺陷（相对路径按固定层级计算），以 `index.json` 为准确数据源。

## 5. 一致性与已知缺陷

- 索引落后：`total_articles` 与 `channels/` 下带 frontmatter 的 md 数量不一致时，说明索引过期；只有手写笔记（无 frontmatter）不应计入。
- 附件抽取失败会被静默跳过：md 只有标题、但有 `files:` 字段时要人工确认。
- `--refresh` 会物理删除该月目录（含已填字段与 `.quotes.md`），没有回收站。
- 时区：`--today` 用本机时区，`create_time` 是 +0800；非 +0800 机器上边界日可能偏差。
