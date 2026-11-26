---
name: scene-blocking-consistency
description: Maintain character and prop blocking consistency. Use before splitting shots or writing video prompts for scenes with multiple characters or key props, or when diagnosing left/right drift, reversed eyelines, prop teleportation, or axis violations. Every scene gets a blocking map; all shots restate it in English.
---

# Character / Prop Blocking Consistency

Treat blocking as a consistency anchor equal to appearance, wardrobe, and art style. First define one **blocking map** per scene. All shots in that scene take positions from the map; never improvise per shot.

## When to use

- Before splitting shots or writing video prompts for any scene with multiple characters on screen or a character interacting with a key prop.
- When repairing "the character was on the left in shot one and on the right in shot two", reversed eyelines, teleporting props, or axis jumps.

## Blocking map structure (one per scene)

Write the map into an English `Scene Blocking Map` section of `bible.md`. Each map has four parts:

```text
[SCENE 01] Library · Dusk
- Spatial anchors: door = screen-left; window = screen-right; desk = slightly left of centre; bookshelf = rear right
- Character positions:
  - Lin Mo: screen-left, facing right (toward Su Wan), about one step from the door
  - Su Wan: screen-right, facing left (toward Lin Mo), back to the window
- Prop anchors:
  - Teapot: on the desk, slightly left between the two characters
- Axis and camera side: axis = the Lin Mo—Su Wan line; camera stays on the lower side (in front of both, slightly left); no crossing
```

| Field | Meaning | Required |
|---|---|---|
| Spatial anchors | Fixed scene references (door/window/table/bed/stairs/counter) with screen-left/right and front/back positions | Yes |
| Character positions | Each on-screen character's position relative to anchors + facing (left/right/front/back to camera) | Yes |
| Prop anchors | Position of key props relative to characters or anchors, especially props that are picked up or emphasized | When props are present |
| Axis and camera side | The character-to-character axis and the single allowed camera side | When multiple characters share a scene |

## Six hard rules

1. **180-degree axis:** keep the camera on the same side of the character axis for the whole scene. Crossing requires a wide two-shot that re-establishes the geography, or a motivated walk that changes sides on screen.
2. **Screen direction:** the same character stays on the same side of the frame across cuts unless the plot explicitly moves them and the path is shown.
3. **Eyeline match:** in a face-to-face exchange, one character looks screen-left and the other screen-right; directions must match across cuts.
4. **Prop anchor consistency:** a key prop keeps its relative position unless its movement is shown.
5. **Explicit blocking changes:** any repositioning (standing, walking to the window, circling behind someone) must be written in that shot's `sub_shots` as start → path → end, and the map must be updated.
6. **Shot-to-shot handoff:** before writing shot N, compare its `scene_name`/scene header and time with shot N-1. Same scene + continuous time → shot N's opening frame equals shot N-1's closing frame (positions, facing, props, action direction). A transition (scene change, location change, time jump, fade to black) → do not inherit the previous positions; rebuild the map.

## Procedure

### 1. Before splitting: create or read the map

- Group the chapter by scene and create one map per scene.
- If `get_project` returns `context.bible` with an existing `Scene Blocking Map` for that scene, reuse it; update only for motivated movement.

### 2. Persist to bible (overwrite carefully)

- `bible` writes are full replacements: call `get_project` first, merge the new blocking-map section into the existing `context.bible` (preserving characters and wardrobe), then `save_context('bible', mergedText)`.
- Append or update maps per scene as the story progresses.

### 3. Restate blocking in storyboards

- Every `set_storyboard` `visual` and `sub_shots` entry must state "Character X is screen-left/right, facing left/right, near anchor Y". Never use zero pronouns such as "same as above" or "unchanged".
- If a character moves within a shot, write the start, path, and end point.
- Write shots in `idx` order and check for transitions before inheriting positions. When resuming, use `list_shots` to read the last shot's closing frame.

### 4. Restate blocking in English video prompts

- Translate the map into English and restate it in every `video_prompt`, for example: `Lin Mo stands on screen-left facing right; Su Wan stands on screen-right facing left`.
- Reference tags (`__MINIMAX_H3_REF_N__`) and blocking descriptions coexist; neither replaces the other.

## Self-check

- Axis jump: shot A from the left, shot B from the right with no establishing wide.
- Mirror jump: two characters facing each other are both written as facing right or both facing left.
- Prop teleport: the teapot moves from between them to the windowsill without a shot showing it.
- Zero pronoun: a `sub_shots` entry says "the character stays as before" without naming the actual position.
