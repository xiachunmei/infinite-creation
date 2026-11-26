---
name: switch-core-skills-to-english-output
overview: 将项目核心视频/小说链路的技能文档与驱动生成的 LLM 提示词全面改为英文产物规范：小说、剧本、人物圣经、风格、分镜、对白、图片/视频/TTS 提示词、音乐歌词全部英文，前端与 README/docs 保持中文。
todos:
  - id: audit-english-targets
    content: 用 [subagent:code-explorer] 复核中文产物规则并列出精确改动点
    status: completed
  - id: rewrite-core-skills
    content: 用 [skill:skill-creator] 将核心技能文档改为英文规范
    status: completed
    dependencies:
      - audit-english-targets
  - id: rewrite-core-prompts
    content: 重写 lib/core/prompts.js 与 music-caption.js 英文提示词
    status: completed
    dependencies:
      - audit-english-targets
  - id: adapt-agent-and-tools
    content: 改造 agent-loop.js、tools.js、shot-write.js 英文约束与校验
    status: completed
    dependencies:
      - audit-english-targets
      - rewrite-core-prompts
  - id: verify-english-output
    content: 更新测试，用 [subagent:code-explorer] 复核残留规则后运行 pnpm test
    status: in_progress
    dependencies:
      - rewrite-core-skills
      - rewrite-core-prompts
      - adapt-agent-and-tools
---

## User Requirements
把当前项目的核心创作链路改成「全英文产物」模式：用户要英文视频生成 skill、英文小说生成 skill，以及英文人物圣经 bible、style、分镜、对白、图片/视频/TTS/音乐提示词等相关 skill 和提示词。

## Product Overview
保持项目原有「小说/故事 → 剧本与 bible/style → 资产提示词 → 分镜 → 视频提示词 → 成片」流程不变，只把技能文档和驱动生成的提示词切换为英文输出规范。前端界面、README、docs 保持中文。

## Core Features
- 英文小说、分卷、章纲、正文，以及英文人物设定与连续性记忆生成。
- 英文剧本、人物圣经 bible、风格指南 style、分镜脚本和英文对白生成。
- 英文图片提示词、MiniMax H3 视频提示词、TTS 音色文案和音色描述生成。
- 英文背景音乐 caption 和 lyrics 生成。
- 中文输入小说在进入改编链路时译为英文后再产出；存量中文数据不自动迁移或覆盖。
- 技能文档和 references 英文化，但技能 `name`、工具名、存储文件名和 API 保持不变。

## Tech Stack Selection
沿用现有栈：Node.js ESM、Markdown skill 文档、pnpm 测试脚本 `pnpm test`。不新增依赖，不引入新框架。

## Implementation Approach
采用「单一英文输出契约 + 分层落地」策略：先在代码提示词层定义统一的全英文输出规则，再逐层改写技能文档、Agent 系统提示词、直接 LLM builder、工具描述和校验提示。

关键决策：
- 技能目录的 `name` 字段保持原样，因为 `lib/shared/index.js` 的流水线默认技能和用户配置都按名字路由；只英文化 `description` 和正文。
- 中文字段名如 `总纲.md`、`卷纲.md`、`章纲.md` 保持原样，避免改动 `lib/core/novel.js` 存储契约和 API；只要求写入内容为英文。
- 中文小说输入不新增独立翻译技能，而是在剧本、bible/style、分镜生成提示词中要求先理解并转写为英文产物。
- `SKILL_PIPELINE_NODES` 的中文 label/desc 同时供 UI 使用，UI 不改；在 `lib/agent/agent-loop.js` 内增加仅用于 prompt 的英文标签映射。
- 台词时长校验从纯中文「字/秒」升级为语言自适应：英文按 words/second 计数，含中日韩字符的旧数据继续走原字符速率，保证兼容。

性能方面，文档改写零运行时开销；台词校验增加一次线性词数扫描，复杂度 O(n)，仅在写入分镜时触发，无新增网络调用。

## Implementation Notes
- 保留前端 UI、README、README_EN、docs、harness-skills 不动。
- 保留所有工具名、数据库字段、API 路由和工作流配置不变。
- 存量中文小说/剧本/bible 不自动覆盖；后续新生成或重生成按英文规范输出。
- TTS 示例改为约 8 到 15 个英文单词、约 5 秒；`voice_description` 必须英文且包含 gender 和 age group。
- H3 skill 中「保留对白、歌词、画面文字原语言」的规则改为「除专有名词外统一译为英文」。
- 图片提示词中道具招牌、书封、标签等真实文字也要求英文。
- 背景音乐 lyrics 固定英文；caption 继续英文。
- 工具描述和 Agent 可见错误提示改为英文优先；必要时保留中文外壳以兼容 UI 文案习惯。
- 不新增日志；不记录用户小说原文或提示词全文到日志。

## Architecture Design
改动只发生在「语言规范层」，不改流水线编排和数据流：

- Skill 文档层：`skills/` 下核心 SKILL.md、references、templates 定义产物语言规则。
- Agent 提示词层：`lib/agent/agent-loop.js` 负责把英文契约和技能路由映射注入 Agent 系统提示词。
- 直接 LLM builder 层：`lib/core/prompts.js` 负责剧本、资产提示词、分镜、兜底视频提示词的英文输出。
- 工具约束层：`lib/agent/tools.js` 负责 tool description、图生图指令、提示词改写和台词时长校验。
- 音乐层：`lib/core/music-caption.js` 负责英文 caption 和 lyrics。
- 验证层：静态检索禁用中文产物规则，扩展 `tests/unit.test.mjs`，新增英文输出回归测试。

## Directory Structure Summary
本次修改核心技能文档、代码提示词、校验逻辑和测试；其余技能、前端和文档不动。

```text
d:/global/infinite-creation/
├── SKILL.md
│   # [MODIFY] 项目级技能总说明。英文化正文与流程描述，补充全英文产物铁律，保留技能名和既有流程。
├── skills/
│   ├── novel-to-video/
│   │   └── SKILL.md
│   │       # [MODIFY] 总流水线技能。删除中文场景头、中文台词规则，要求小说输入先转写为英文剧本、bible、style、分镜和提示词。
│   ├── story-pipeline-cn/
│   │   ├── SKILL.md
│   │   │   # [MODIFY] 保留 name，英文化模式菜单、触发条件、中文优先规则和检查清单。
│   │   ├── references/workflow-chain.md
│   │   │   # [MODIFY] 英文化三模式链路和下游桥接说明，明确所有文本产物英文。
│   │   ├── references/novel-to-script.md
│   │   │   # [MODIFY] 英文化小说转剧本规则、三幕结构和成稿要求。
│   │   ├── references/script-to-storyboard.md
│   │   │   # [MODIFY] 英文化剧本转分镜规则、人设卡和提示词要求。
│   │   ├── references/direct-storyboard.md
│   │   │   # [MODIFY] 英文化小说直转分镜规则，移除中文草稿默认设定。
│   │   ├── references/style-guide.md
│   │   │   # [MODIFY] 英文化场景头、景别、运镜、色调和提示词规范。
│   │   ├── references/output-schemas.md
│   │   │   # [MODIFY] 英文化输出 JSON/MD 字段说明，字段名保持不变。
│   │   ├── references/fault-handling.md
│   │   │   # [MODIFY] 英文化容错说明和示例。
│   │   ├── templates/script-template.md
│   │   │   # [MODIFY] 剧本模板改为英文场次、动作、对白和旁白格式。
│   │   ├── templates/storyboard-template.md
│   │   │   # [MODIFY] 分镜表模板改为英文表头和英文示例。
│   │   ├── templates/character-card-template.md
│   │   │   # [MODIFY] 角色卡模板改为英文外貌、声音和英文绘图提示词。
│   │   └── scripts/extract_storyboard.py
│   │       # [MODIFY] 更新 prompt_language 与注释/说明，输出英文草稿和英文提示词标记。
│   ├── image-prompt-writing/
│   │   └── SKILL.md
│   │       # [MODIFY] 从「中英文提示词」改为纯英文 prompt 和 negative_prompt 规范。
│   ├── h3-prompt-writing/
│   │   ├── SKILL.md
│   │   │   # [MODIFY] 移除保留对白/歌词原语言规则，要求所有新产物英文。
│   │   ├── references/comfyui-node-adapter.md
│   │   │   # [MODIFY] 英文化适配说明，明确对白和画面文字转写为英文。
│   │   ├── references/storyboard-contract.md
│   │   │   # [MODIFY] 英文化 storyboard 字段约束，保留字段结构和标签语法。
│   │   ├── references/storyboard-from-novel.md
│   │   │   # [MODIFY] 英文化小说转 storyboard 规则，要求英文对白和英文描述。
│   │   ├── references/storyboard.schema.json
│   │   │   # [MODIFY] 英文化 schema 描述文本，不改变字段名。
│   │   └── scripts/gen_storyboard_llm.py
│   │       # [MODIFY] 更新 LLM prompt：human-only 字段也英文，对白不保留中文原文。
│   ├── tts-voice-design/
│   │   └── SKILL.md
│   │       # [MODIFY] 英文自我介绍文案示例，英文 gender/age/tone voice_description 规则。
│   ├── scene-blocking-consistency/
│   │   ├── SKILL.md
│   │   │   # [MODIFY] 英文化站位表、轴线规则和英文复述要求。
│   │   ├── references/blocking-map.md
│   │   │   # [MODIFY] 英文化站位表模板和示例。
│   │   └── references/continuity-rules.md
│   │       # [MODIFY] 英文化跨镜连续性判定规则。
│   └── webnovel-writing/
│       └── SKILL.md
│           # [MODIFY] 从中文网文 skill 改为英文小说写作 skill，保留 name 与模块结构。
├── lib/
│   ├── core/prompts.js
│   │   # [MODIFY] 定义统一英文输出契约；英文化剧本、章节剧本、资产提示词、分镜和兜底视频提示词。
│   ├── core/music-caption.js
│   │   # [MODIFY] 英文化 system prompt，锁定 caption 和 lyrics 均为英文。
│   ├── core/shot-write.js
│   │   # [MODIFY] 新增英文 words/second 校验常量和语言自适应台词长度辅助函数。
│   ├── agent/agent-loop.js
│   │   # [MODIFY] 英文化 Agent system/task/novel prompts，加入 prompt-only 英文节点标签映射。
│   └── agent/tools.js
│       # [MODIFY] 英文化 tool descriptions、图生图 system prompts、改写提示词和台词校验提示。
└── tests/
    ├── unit.test.mjs
    │   # [MODIFY] 更新现有剧本/兜底视频提示词断言，新增英文输出和英文台词校验断言。
    └── english-output.test.mjs
        # [NEW] 静态检查目标技能文档和 prompt 模块无中文产物规则，验证英文输出契约未回退。
```

## Agent Extensions
### SubAgent
- **code-explorer**
  - Purpose: 复核核心技能文档、references、脚本和代码提示词中的中文产物规则，形成精确改动清单，并在收尾阶段复核残留规则。
  - Expected outcome: 输出完整目标文件列表和禁用短语清单，确认没有遗漏核心链路里的中文输出约束。

### Skill
- **skill-creator**
  - Purpose: 指导重写核心 SKILL.md、references 和 templates，保持技能路由字段稳定且规则可执行。
  - Expected outcome: 核心技能文档全英文、frontmatter name 不变、description 英文且触发语义清晰。
