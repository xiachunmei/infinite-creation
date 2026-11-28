---
name: enforce-western-names-and-migrate-current-novel
overview: 修复小说生成仍产出亚洲人名的根因，并把当前已保存小说项目的角色、总纲、卷纲、章节正文和记忆统一替换为自然欧美英文名。
todos:
  - id: audit-western-names
    content: 用 [subagent:code-explorer] 复核旧名映射与残留
    status: completed
  - id: enforce-name-rules
    content: 用 [skill:skill-creator] 改写小说命名规则
    status: completed
    dependencies:
      - audit-western-names
  - id: build-name-migration
    content: 实现迁移脚本的 dry-run 和备份
    status: completed
    dependencies:
      - audit-western-names
  - id: migrate-current-project
    content: 执行当前项目迁移并校验残留
    status: completed
    dependencies:
      - enforce-name-rules
      - build-name-migration
  - id: verify-name-migration
    content: 更新测试并运行 pnpm test
    status: completed
    dependencies:
      - migrate-current-project
---

## 用户需求
把小说生成的命名规则从“保留并音译源语言人名”改为“直接生成自然欧美英文名”，并同时清理当前已保存小说项目中的亚洲人名。

## 产品概述
保持现有小说生成流程、API、数据库字段和存储文件名不变，只改生成约束与当前项目内容。后续新生成或重生成的小说、角色设定、章节正文必须使用自然欧美英文名；当前项目里已有的角色卡、总纲、卷纲、章节正文和记忆文件要统一替换为欧美名。

## 核心功能
- 小说生成不再保留中文或亚洲姓名，不再使用拼音音译。
- 新增明确的 Western-English names 规则，覆盖角色名、地名、称呼、宠物名和作品内专名。
- `webnovel-writing` skill 增加欧美姓名硬要求。
- 修复 `ENGLISH_OUTPUT_CONTRACT` 中导致亚洲名保留的“romanize”规则。
- 当前项目角色数据、总纲、卷纲、章节正文和上下文记忆统一迁移为欧美名。
- 迁移前备份，迁移中执行 dry-run，迁移后校验残留亚洲名为 0。
- 不改数据库表结构、工具名、API 路由、技能 `name`、存储文件名、change_logs 历史记录。


## 技术栈
沿用现有栈：Node.js ESM、Markdown skill 文档、SQLite、`lib/core` 现有读写模块、pnpm 测试脚本 `pnpm test`。不新增依赖，不引入新框架。

## 实施策略
采用“改规则 + 一次性数据迁移 + 回归验证”：

1. 先改统一契约：在 `ENGLISH_OUTPUT_CONTRACT` 中删除“保留专名并音译”的规则，改为“所有人物名、地名、专名必须是自然欧美英文名”。
2. 在 `WESTERN_AESTHETIC_CONTRACT` 中增加 NAMES 条款，避免只约束面孔、服装和场景却遗漏姓名。
3. 在小说 Agent 系统提示词、`webnovel-writing` skill 和 `novel_save_characters` 工具描述中补充 Western-English names 硬要求。
4. 新增一次性迁移脚本，读取当前项目 `749806b2-688f-4fc2-bc1d-fc1baa761fcf`，按固定映射替换当前项目文本。
5. 数据写入优先使用现有模块 `Chapters.update`、`saveNovelState`、`withWriteContext`，保证变更日志和回滚能力；不直接裸写 SQL。
6. SQLite 备份使用一致性快照，避免只复制 `ic.db` 而忽略 `ic.db-wal` 和 `ic.db-shm`。

## 关键决策
- 修复 `ENGLISH_OUTPUT_CONTRACT` 是第一优先级，因为它直接影响所有 Agent 提示词，是亚洲人名持续出现的根因。
- `webnovel-writing/SKILL.md` 当前只要求英文输出，没有姓名规则，必须补上，否则 skill 层仍可能生成亚洲名。
- 当前项目已经保存了 6 个亚洲姓名和 48 章正文，仅改提示词不会清理历史内容，必须执行一次性迁移。
- `change_logs` 保存历史快照，属于审计记录，不改写；`backups/` 也不改写。
- `characters.json` 的 `id` 字段保持稳定，避免因改名破坏资产绑定或上下文索引；只改 `name`、`description`、`notes`。
- 替换采用“长名优先 + 词边界短姓 + 称呼/专名映射”的顺序，避免误伤普通英文词。

## 当前项目替换映射
- `Su Nian` → `Sophie Bennett`
- `Shen Zhiyi` → `Serena Hayes`
- `Gu Qinghan` → `Gabrielle Quinn`
- `Lin Xiaoman` → `Lily Carter`
- `Xu Yan` → `Ethan Brooks`
- `Jiang Yue` → `Julia Morgan`
- `Zhiyi-jie` → `Serena`
- `Zhizhi` → `Rina`
- `Nian` 作为花瓶题名时 → `Sophie`
- 单独出现的 `Su` / `Shen` / `Gu` / `Lin` / `Xu` / `Jiang` 按词边界分别替换为上述名字。
- `mid-sized Chinese city` → `mid-sized Pacific Northwest city`
- `neighbor sister` / `Neighbor Sister` → `girl next door` / `Girl Next Door`

## 性能与可靠性
- 迁移规模约 48 章正文和 6 个文本文件，替换复杂度为线性扫描，无网络调用。
- dry-run 阶段输出每个文件的命中数和每个映射的替换数；apply 阶段要求目标项目 ID 明确匹配。
- 迁移脚本应幂等：再次执行时残留亚洲名应为 0，不重复改写。
- 如果缺少项目、映射冲突、备份失败或替换后仍有残留，脚本应失败退出，不静默继续。

## 目录结构
```text
d:/global/infinite-creation/
├── lib/
│   ├── core/prompts.js
│   │   # [MODIFY] 删除保留并音译专名规则；增加自然欧美英文名规则；在 WESTERN_AESTHETIC_CONTRACT 增加 NAMES 条款。
│   ├── agent/agent-loop.js
│   │   # [MODIFY] 在小说系统提示词和任务提示词中增加 Western-English character names 硬要求。
│   └── agent/tools.js
│       # [MODIFY] novel_save_characters 的 name 字段和角色描述增加欧美名示例与约束。
├── skills/
│   └── webnovel-writing/SKILL.md
│       # [MODIFY] 增加 Character naming 章节：所有人物名、地名、专名必须自然欧美化，禁止中文名和拼音音译。
├── scripts/
│   └── migrate-novel-names.mjs
│       # [NEW] 一次性迁移脚本：支持 --dry-run 和 --apply；备份、替换、统计、校验小说项目中的亚洲名。
├── data/
│   ├── backups/novel-western-names-<timestamp>/
│   │   # [NEW] 迁移前备份 SQLite 快照和项目目录。
│   └── projects/749806b2-688f-4fc2-bc1d-fc1baa761fcf/novel/
│       # [MODIFY via migration] characters.json、总纲.md、volumes.json、memory/*.md 统一替换为欧美名。
├── tests/
│   ├── english-output.test.mjs
│   │   # [MODIFY] 修复 Lin Mo 测试夹具；断言不再包含 romanize 规则，并验证欧美名规则存在。
│   ├── westernization.test.mjs
│   │   # [MODIFY] 增加 Western-English names 规则断言。
│   └── unit.test.mjs
│       # [VERIFY] 确认既有小说测试和角色测试不受影响。
└── README.md / docs / app UI
    # [UNCHANGED] 本轮不改前端整体语言和文档，只改生成规则与当前项目数据。
```

## 验证方式
- dry-run 输出当前项目命中计数：characters.json、总纲、volumes、memory、48 章正文。
- apply 后再次扫描：6 个旧名、单独姓氏、Zhiyi-jie、Zhizhi、Nian 花瓶题名、Chinese city、neighbor sister 残留为 0。
- 运行 `pnpm test`。
- 用 [subagent:code-explorer] 做最终只读复核，确认提示词、skill、工具描述和当前项目数据中没有导致亚洲名的规则或残留。


## Agent Extensions
### SubAgent
- **code-explorer**
  - Purpose: 复核所有小说命名规则、当前项目旧名命中点和迁移后的残留。
  - Expected outcome: 产出精确文件清单、禁用短语清单、替换后残留报告，确认没有遗漏亚洲姓名规则。

### Skill
- **skill-creator**
  - Purpose: 指导更新 `webnovel-writing` skill，保持 `name` 路由稳定，并把欧美姓名规则写成可执行的 skill 指令。
  - Expected outcome: `webnovel-writing/SKILL.md` 增加清晰的 Character naming 规则，且 frontmatter `name` 不变。
