/**
 * `zsxq-knowledge` skill 的 DSH provider。
 *
 * 本包有两种身份：
 *  1. 通用 Agent Skill —— 仓库根就是 skill 目录（`SKILL.md` + `scripts/` + `reference/`），
 *     直接复制/软链到任意 agent 的 skills 目录即可使用；
 *  2. DSH 插件（bundle）—— 通过本文件把 `SKILL.md` 注册进 `ctx.skills`，
 *     用户 `dsh plugin add dsh-skill-zsxq` 后无需再手动放置文件。
 *
 * @module dsh-skill-zsxq
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'
import { parse } from 'yaml'

/** provider 名（出现在 skill 摘要的 `provider` 字段）。 */
const PROVIDER_NAME = 'zsxq-skill'
/** skill 正文与资源目录（仓库根）。 */
const SKILL_URL = new URL('../SKILL.md', import.meta.url)
const RESOURCE_BASE = {
  kind: 'directory',
  path: fileURLToPath(new URL('../', import.meta.url)),
}
/** SKILL.md 缺失或 frontmatter 异常时的兜底描述。 */
const FALLBACK_DESCRIPTION =
  '管理知识星球知识库：同步帖子与附件、抽取 docx/pdf 正文、补全分类/摘要/金句、重建索引、检索内容。'

/**
 * 解析 Markdown 的 YAML frontmatter。
 *
 * @param raw 文件全文。
 * @returns frontmatter 对象；没有 frontmatter 或解析失败时返回空对象。
 */
function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return {}
  const end = raw.indexOf('\n---', 3)
  if (end === -1) return {}
  try {
    const parsed = parse(raw.slice(3, end))
    return parsed !== null && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * 读取并构造一份完整 skill 定义。
 *
 * @returns skill 定义（含正文 `content`）。
 */
async function loadSkill() {
  const content = await readFile(SKILL_URL, 'utf8')
  const meta = parseFrontmatter(content)
  const name = typeof meta.name === 'string' && meta.name.length > 0 ? meta.name : 'zsxq-knowledge'
  const description =
    typeof meta.description === 'string' && meta.description.length > 0
      ? meta.description.trim()
      : FALLBACK_DESCRIPTION
  return {
    name,
    description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: PROVIDER_NAME,
    source: 'zsxq-skill',
    resourceBase: RESOURCE_BASE,
    content,
  }
}

/** readonly skill provider：list 给摘要，get 返回正文。 */
const provider = {
  name: PROVIDER_NAME,
  async list() {
    const skill = await loadSkill()
    return [{ ...skill, rank: BUNDLED_SKILL_RANK, locator: SKILL_URL }]
  },
  async get() {
    return await loadSkill()
  },
}

/** Cordis 插件名。 */
export const name = 'zsxq-knowledge-skill'
/** 依赖 skill 注册表。 */
export const inject = ['skills']

/**
 * 把 `zsxq-knowledge` skill 注册进当前宿主。
 *
 * 用 `registerProvider`（而不是 `register`）是为了让正文按需读取：skill 只在
 * 模型真正加载时才读盘，不占启动时间。
 *
 * @param ctx 宿主上下文（含 `skills` 服务）。
 */
export function apply(ctx) {
  ctx.skills.registerProvider(() => provider)
}
