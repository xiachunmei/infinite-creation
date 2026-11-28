---
name: 拆分 Chapter 3 分镜 2 为两个 5 秒分镜
overview: 通过只读确认后，对当前项目中 Chapter 3 的 10 秒 done 分镜执行一次数据迁移：用 HTTP API 将它拆成两个连续 5 秒分镜，修正时间轴与提示词，并保留旧视频作废旧状态以便重新生成。
todos:
  - id: preflight-readonly
    content: 只读确认项目状态、目标分镜快照和旧候选数量
    status: completed
  - id: migrate-split-shot
    content: 通过 API 将目标镜拆为两个 5 秒分镜
    status: completed
    dependencies:
      - preflight-readonly
  - id: invalidate-old-video
    content: 删除旧候选视频使原镜回到待生成状态
    status: completed
    dependencies:
      - migrate-split-shot
  - id: verify-result
    content: 只读验证镜号、时长、时间轴、引用和总镜数
    status: completed
    dependencies:
      - invalidate-old-video
---

## User Requirements
将「Chapter 3: Borrowing Sugar」中「分镜 2 · Apartment Corridor Landing」从当前 10 秒拆成两个连续的 5 秒分镜。

## Product Overview
该镜当前状态为 done，已有旧视频。用户确认按此前“拆两镜”的处理方式执行：旧视频作废，后续需要重新生成两个新分镜的视频。

## Core Features
- 原分镜改为第一个 5 秒分镜，补充拆分后的画面时间轴、对白和视频提示词。
- 在原分镜后插入第二个 5 秒分镜，保持剧情连续性。
- 两个新分镜的时间轴都从 0 秒重新计时。
- 保留角色、场景、道具、服装、年龄、音频参考、分辨率、画幅等字段。
- 删除旧候选视频，使原分镜回到待重新生成状态。

## Tech Stack Selection
- 沿用项目现有 HTTP API：`http://127.0.0.1:4710/api/...`
- 一次性迁移使用 Node.js `fetch` 调用 API。
- 不修改应用代码，不直连 SQLite，不直接改动 `data/` 目录。

## Implementation Approach
执行一次单镜数据迁移：先只读确认项目状态与目标分镜快照，再通过 API 将原镜改成前半段并插入后半段，最后删除旧候选视频使旧成片失效。

关键决策：
- 目标是单条存量分镜，使用 API 迁移比新增永久功能更安全，避免扩大影响面。
- 先完成拆分再删除旧视频；若插入失败，可用快照回滚原分镜，旧视频仍保留。
- 第二个 5 秒分镜必须重新计时，避免沿用 `5s-10s` 的旧时间码。

## Implementation Notes
- 执行前必须确认项目状态不是 running；若为 running，停止操作并等待。
- 目标镜确认条件：id `da2048c3-5652-4bc9-bb85-fbf31062717e`，chapter `Chapter 3: Borrowing Sugar`，idx `2`，duration `10`，status `done`。
- 拆分参数：原镜 `5s + 5s`；新镜插入到 `insert_at=3`，原 idx 3 及之后顺移一位。
- 对 `sub_shots` 和 `video_prompt` 按 5 秒边界拆分；第二半所有时间码减去 5，统一从 0 开始。
- 若 `video_prompt` 含 `[0s-10s]` 前缀，两半都改为 `[0s-5s]`。
- 若提示词尾句包含 `No on-screen text`，两半都保留该约束。
- 对白按行或句子对半拆分；保持说话人归属和语义顺序。
- 不复制 `status`、`video_path`、`error`、`prompt_id`、`seed`、`videos` 等渲染产物字段。
- 旧候选视频通过 `DELETE /api/projects/:id/shots/:sid/videos/:vid` 删除；删除最后一条候选后，路由会把该镜重置为 pending。

## Architecture Design
数据流：

1. `GET /api/projects/:id`：确认项目可写。
2. `GET /api/projects/:id/shots`：读取目标镜和候选视频。
3. `PATCH /api/projects/:id/shots/:sid`：写入原镜的前 5 秒内容。
4. `POST /api/projects/:id/shots?insert_at=3`：插入第二个 5 秒分镜。
5. `DELETE /api/projects/:id/shots/:sid/videos/:vid`：删除旧候选视频。
6. `GET /api/projects/:id/shots`：只读验证结果。

## Directory Structure
本次没有持久代码文件修改；仅在确认执行后创建并删除一个临时迁移脚本。

```text
d:/global/infinite-creation/
└── .tmp-split-shot2.mjs  # [TEMP] 一次性迁移脚本。读取目标镜快照、调用 PATCH/POST/DELETE API、输出迁移结果；执行完成后删除。
```

受影响的数据：
- `shots` 中目标镜 `da2048c3-5652-4bc9-bb85-fbf31062717e`：duration、sub_shots、dialogue、video_prompt、status。
- `shots` 中新增一条 Chapter 3 的 5 秒分镜。
- `shot_videos` 中目标镜旧候选被删除或不再作为有效成片。
- Chapter 3 中原 idx 3 及之后的镜号整体顺移一位。
