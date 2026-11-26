---
name: westernize-all-skills-and-presets
overview: 对全项目 50+ 技能、代码提示词、风格库、示例/evals/脚本和 UI 风格预设做一次全量“欧美化”改造：严格默认并强制 Western/European-American 面孔、发型、服装与审美，禁止中式/东亚面相和服饰进入生成提示词。
todos:
  - id: audit-westernization-targets
    content: 用 [subagent:code-explorer] 全量锁定欧美化改动点
    status: completed
  - id: define-western-contract
    content: 建立欧美审美契约并注入核心提示词
    status: completed
    dependencies:
      - audit-westernization-targets
  - id: rewrite-all-skills
    content: 用 [skill:skill-creator] 重写全部技能文档
    status: completed
    dependencies:
      - define-western-contract
  - id: fix-hardcoded-scripts
    content: 清理脚本校验、evals 和国内剧默认
    status: completed
    dependencies:
      - define-western-contract
      - rewrite-all-skills
  - id: replace-style-presets
    content: 替换风格预设并同步 Studio 与测试
    status: completed
    dependencies:
      - define-western-contract
  - id: verify-westernization
    content: 新增回归测试并运行 pnpm test
    status: completed
    dependencies:
      - rewrite-all-skills
      - fix-hardcoded-scripts
      - replace-style-presets
---

## Product Overview
将当前项目从默认中文或东亚创作语境切换为严格面向欧美市场的视觉与叙事生成规范。保持现有「小说或故事、剧本与一致性锚点、资产提示词、分镜、视频提示词、成片」流程不变，只把技能文档、提示词、示例、脚本校验、风格预设和人物设定规则改造为欧美化审美。

## Core Features
- 新增统一 Western aesthetic contract：默认且强制欧美面孔、发型、服装、场景气质与镜头审美。
- 禁止中式或东亚面相、服饰、场景元素进入生成提示词；保留旧字段名、工具名和 API 兼容。
- 全量清理 50+ 技能目录中的中文输出硬规则、汉服或中式风格示例、国漫或东方骨相偏置、脚本断言与 evals。
- 替换 `lib/shared/index.js` 与 Studio 中的风格预设为 Western cinematic、American comic、European period drama 等欧美市场选项。
- 修复上一轮全英文改造遗留的测试断言，并新增 westernization 回归测试。


## Tech Stack Selection
沿用现有栈：Node.js ESM、Markdown skill 文档、Python 辅助脚本、pnpm 测试脚本 `pnpm test`。不新增依赖，不引入新框架。

## Implementation Approach
采用「单一契约 + 全量清理 + 分层验证」策略：

1. 在代码提示词层定义 `WESTERN_AESTHETIC_CONTRACT` 与负面约束常量，统一注入 Agent、剧本、资产提示词、视频提示词、TTS 和音乐提示词。
2. 用 skill-creator 方法全量重写技能文档、references、templates、examples 和 evals，使所有可路由技能都遵守同一欧美化契约。
3. 对 `short-drama-director`、`prompt-bozo`、`sd-asset-engine` 等硬编码中式规则的技能做定点替换，包括中文输出、国内剧默认、真实中国人面部结构、汉服与中式发型预设。
4. 替换风格预设并同步 Studio 复制文件、组件引用与测试断言，避免 UI 显示与运行时提示词漂移。
5. 静态搜索禁用词、运行新增回归测试和 `pnpm test` 完成验证。

关键决策：
- 严格 obeys 用户选择：所有生成默认且必须欧美化，禁止中式或东亚面相与服饰进入提示词。
- 不改动 API 字段、工具名、数据库字段、章节文件名与技能目录名，避免破坏路由、持久化和兼容数据。
- 旧中文场景头和中文章节文件名只作为兼容输入保留，不作为生成输出或审美示例。
- `sd-overseas-engine` 已偏欧美市场，可作为可复用措辞基线。
- 风格预设属于前端可见配置，用户已确认允许改变。

性能方面：文档与提示词修改为静态开销；增强提示词长度有限。风格预设替换是常量级改动。脚本校验仍为线性扫描，无新增网络调用。

## Implementation Notes
- 先完成欧美化改造，再恢复此前暂停的 install-skill 安装与启动任务。
- 保留上一轮 `ENGLISH_OUTPUT_CONTRACT`，在其旁边叠加欧美审美契约，不回退英文输出要求。
- 负面提示词需排除中式或东亚面部特征、汉服、旗袍、唐装、中式发髻、东亚文字招牌等视觉元素，但不要误伤纯英文画面文字控制。
- 对音乐技能：`east-asian-modern` 与 `east-asian-ballad-heritage` 等风格族需替换为 Western 风格族，并同步 `lib/core/music-caption.js` 的 `FAMILIES` 与 genre router 文档。
- 对 short-drama-director：删除“默认国内剧”逻辑，改为默认 Western overseas track；把中文命名规则改为英文命名规则；把 `<d>[Chinese]` 示例改为 `<d>[English]`。
- 不记录用户小说原文或完整提示词到日志。

## Architecture Design
- Contract layer: `lib/core/prompts.js` 统一定义英文输出与欧美审美契约。
- Agent layer: `lib/agent/agent-loop.js` 和 `lib/agent/tools.js` 注入契约，并约束工具描述与改写提示词。
- Skill layer: `skills/**/SKILL.md`、references、templates、examples、evals 全部按契约改写。
- Script layer: `short-drama-director` 与 `prompt-bozo` 等 Python 脚本中的校验、推荐表和断言同步替换。
- UI config layer: `lib/shared/index.js` 与 `studio/src/lib/shared.js` 替换风格预设；`StylePicker.jsx` 按需验证。
- Test layer: `tests/westernization.test.mjs` 新增静态回归，原英文输出测试继续保留。

## Directory Structure
```text
d:/global/infinite-creation/
├── lib/
│   ├── core/prompts.js
│   │   # [MODIFY] 新增 WESTERN_AESTHETIC_CONTRACT 与负面约束；注入剧本、章节剧本、资产生图、分镜、兜底视频提示词。
│   ├── core/music-caption.js
│   │   # [MODIFY] 替换 east-asian 音乐族为 Western 风格族，锁定英文歌词与欧美市场风格。
│   ├── core/shot-write.js
│   │   # [MODIFY] 保留语言自适应校验，必要时补充 Western prompt 静态约束辅助。
│   ├── agent/agent-loop.js
│   │   # [MODIFY] 注入欧美审美契约，调整身份、服装、场景、音乐和视频提示词规则。
│   ├── agent/tools.js
│   │   # [MODIFY] 改写 design_outfits / change_age / design_ages 等中文描述，统一英文欧美化约束。
│   ├── shared/index.js
│   │   # [MODIFY] 替换 STYLE_GROUPS、STYLE_PRESETS、STYLE_COMMON 为欧美市场风格预设。
│   └── core/index.js
│       # [MODIFY] 若新增契约常量，需在此重新导出供 Agent 使用。
├── studio/
│   ├── src/lib/shared.js
│   │   # [MODIFY] 同步 lib/shared/index.js 的风格预设，避免 Studio 与主程序漂移。
│   └── src/components/StylePicker.jsx
│       # [MODIFY 或 VERIFY] 确认风格 chip 使用新预设，无需设计改版。
├── skills/
│   ├── SKILL.md
│   │   # [MODIFY] 项目总技能说明加入严格欧美化契约与禁用东亚元素说明。
│   ├── novel-to-video/SKILL.md
│   │   # [MODIFY] 总流水线要求所有 bible/style、资产、分镜和视频提示词欧美化。
│   ├── story-pipeline-cn/**
│   │   # [MODIFY] 模板、示例、style-guide、storyboard 示例中的黑发单眼皮等东亚特征改为 Western 特征。
│   ├── image-prompt-writing/SKILL.md
│   │   # [MODIFY] 人物三视图、场景、道具提示词强制 Western face, hair, wardrobe and styling。
│   ├── h3-prompt-writing/**
│   │   # [MODIFY] H3 契约、manifest 示例、storyboard-from-novel 与 schema 描述改为欧美角色设定。
│   ├── tts-voice-design/SKILL.md
│   │   # [MODIFY] 示例人名、语气和 voice_description 改为 Western English samples。
│   ├── scene-blocking-consistency/**
│   │   # [MODIFY] 站位表示例人物改为 Western names 与 Western wardrobe references。
│   ├── webnovel-writing/SKILL.md
│   │   # [MODIFY] 小说角色、场景和市场定位示例改为 Western fiction market。
│   ├── prompt-bozo/**
│   │   # [MODIFY] 删除中文输出硬规则；chinese-style 改为 western-style；hairstyles 与 evals 全量替换。
│   ├── sd-asset-engine/**
│   │   # [MODIFY] 删除中文提示词正文规则；角色模板与场景标签改为 Western 英文示例。
│   ├── short-drama-director/**
│   │   # [MODIFY] 删除中文命名、国内剧默认、中国人面部结构、国漫骨相与 Chinese 对白标签。
│   ├── cinematic-ai-comic-director/references/output-template.md
│   │   # [MODIFY] 删除 Chinese comic style 示例，改为 Western comic or cinematic style。
│   ├── music-caption-rewriter/**
│   │   # [MODIFY] genre router、index 文件与 README 中 East Asian 风格族替换为 Western 风格族。
│   ├── sd-overseas-engine/**
│   │   # [VERIFY 或 MINOR MODIFY] 作为欧美化参考基线，统一术语并补充严格 face/wardrobe 约束。
│   ├── lemo-opuscar/styles/ukiyoe/**
│   │   # [MODIFY 或 REMOVE FROM CATALOG] 避免浮世绘风格进入 Western-only 风格目录。
│   └── 其余 50+ 技能目录
│       # [MODIFY] 按全量扫描结果替换中式/Hanfu/国漫/东亚面相/中文输出示例；仅改生成规范，不改技能 name。
├── tests/
│   ├── english-output.test.mjs
│   │   # [MODIFY] 保留英文输出契约，补充与欧美化契约共存的断言。
│   ├── unit.test.mjs
│   │   # [MODIFY] 修复上一轮未完成的英文断言，更新 Western 契约相关断言。
│   ├── changelog.test.mjs
│   │   # [MODIFY] 修复上一轮英文错误断言并跑通。
│   └── westernization.test.mjs
│       # [NEW] 静态检查无中文输出硬规则、无东亚面相服饰默认、风格预设已欧美化。
└── README 不变
    # 按用户此前约束，README、docs 与前端整体语言不做英文化；本轮仅改用户已确认的风格预设。
```

## Key Code Structures
```js
export const WESTERN_AESTHETIC_CONTRACT;
export const WESTERN_FACE_WARDROBE_RULE;
export const WESTERN_STYLE_PRESETS;
```


## SubAgent
- **code-explorer**
  - Purpose: 全量扫描 50+ 技能、examples、evals、脚本、风格预设和测试中残留的中文或东亚审美硬规则，并在收尾阶段复核。
  - Expected outcome: 输出完整待改文件清单、禁用短语清单、Western-only 替换建议和最终残留报告。

## Skill
- **skill-creator**
  - Purpose: 指导全量技能文档、references、templates 和 evals 的重写，保持 frontmatter name 与路由稳定。
  - Expected outcome: 所有技能文档统一采用 Western aesthetic contract，description 和正文英文、可执行、可被 Agent 识别。
