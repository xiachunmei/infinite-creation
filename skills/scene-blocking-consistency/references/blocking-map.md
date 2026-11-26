# Blocking Map Templates and Examples

## Blank template (copy and use)

```text
[SCENE NN] Scene Name
- Spatial anchors: door = screen-left; window = screen-right; table = slightly left of centre; (add/remove as needed)
- Character positions:
  - Character A: screen-left, facing right, about one step from the door
  - Character B: screen-right, facing left, back to the window
- Prop anchors:
  - Prop X: on the table, slightly left between the two characters
- Axis and camera side: axis = the Character A—Character B line; camera stays on one side (below/above); no crossing
```

Notes: list only fixed objects used as directional references. Character positions state screen-left/right + facing left/right + distance from an anchor. Prop anchors list only props that will be picked up or emphasized. Axis/camera side is mandatory whenever multiple characters share a scene.

## Example 1: two-person conversation (tea across a table)

```text
[SCENE 01] Teahouse · Afternoon
- Spatial anchors: door = screen-left; window = screen-right; tea table = centre frame; counter = rear right
- Character positions:
  - Lu Chuan: screen-left, facing right (toward Shen Li), seated on the left side of the tea table
  - Shen Li: screen-right, facing left (toward Lu Chuan), seated on the right side
- Prop anchors:
  - Teapot: centre of the tea table, between them
  - Teacups: one in front of each character
- Axis and camera side: axis = the Lu Chuan—Shen Li line; camera stays below the axis (in front of both, slightly low); no crossing
```

The continuous shots in this scene should look like this (same blocking, only size/move changes):

- Shot 1 (two-shot, STATIC): Lu Chuan screen-left facing right, Shen Li screen-right facing left, teapot between them.
- Shot 2 (Lu Chuan close-up, PUSH IN): Lu Chuan stays screen-left, facing right, looking at Shen Li on screen-right.
- Shot 3 (Shen Li close-up, PUSH IN): Shen Li stays screen-right, facing left, looking at Lu Chuan on screen-left.

## Example 2: three characters (≥3 speakers require shot splitting, ≤2 speakers per shot)

```text
[SCENE 02] Council Hall · Night
- Spatial anchors: door = screen-left; long head table = centre; brazier = rear right
- Character positions:
  - Lord: centre, facing camera (toward the lower end of the table), seated at the head
  - Guest A: screen-left, facing right (toward the Lord), seated on the left side
  - Guest B: screen-right, facing left (toward the Lord), seated on the right side
- Prop anchors:
  - War report: centre of the long table, in front of the Lord
- Axis and camera side: axis = the Guest A—Guest B line; camera stays below the axis; no crossing
```

A three-person exchange is split into multiple shots (≤2 speakers each), but the blocking map is still the same: Guest A always screen-left, Guest B always screen-right, Lord always centre. Splitting shots never swaps left/right.

## Example 3: motivated repositioning (show it and update the map)

```text
[SCENE 03] Courtyard · Morning
- Spatial anchors: stone table = centre; moon gate = rear left; corridor = right
- Character positions (before):
  - A Man: screen-left, facing right
  - A Qing: screen-right, facing left
- Prop anchors:
  - Long sword: on the stone table, on A Man's side
- Axis and camera side: axis = the A Man—A Qing line; camera stays below the axis
```

Movement shot (write the path in `sub_shots`):

```text
0-3s: A Man rises from screen-left, walks around the right side of the stone table to screen-right; A Qing rises from screen-right and walks to screen-left. Camera: STATIC wide shot.
```

Update the map after the move:

```text
- Character positions (after):
  - A Man: screen-right, facing left
  - A Qing: screen-left, facing right
```

All later shots follow the "after" positions: A Man on screen-right, A Qing on screen-left.
