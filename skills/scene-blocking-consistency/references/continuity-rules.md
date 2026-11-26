# Blocking Continuity Rules and Failure Checks

Six hard rules with concrete failure cases. Review them while writing `sub_shots` / `visual` and `video_prompt`. All descriptions are English.

## 1. 180-degree axis

- **Check:** draw an imaginary line between the two main interacting characters. Every camera in the scene must stay on the same side of that line.
- **Why:** crossing the line instantly swaps their left/right screen relationship, making the audience think the characters changed places.
- **Allowed crossings:** first re-establish with a wide two-shot, show a motivated walk that changes sides, or use an on-axis transition shot.
- **Failure:** shot A from the left, shot B from the right, with no establishing wide.

## 2. Screen direction

- **Check:** the same character stays on the same side of the frame across cuts.
- **Exceptions:** plot-motivated movement with a visible path, or a scene change that rebuilds the map.
- **Failure:** moving a character from left to right in a close-up purely for composition.

## 3. Eyeline match

- **Check:** in face-to-face dialogue, one character looks screen-left and the other screen-right; their eyelines meet. State each speaker/listener's exact facing (left/right/front/back to camera).
- **Failure:** both written as facing right or both facing left, so they appear to talk past each other.
- **Reaction shots:** a listener's gaze must still point toward the speaker's side of the frame.

## 4. Prop anchor consistency

- **Check:** key props (picked up, close-up, or plot-driving) keep their position relative to characters or scene anchors across shots.
- **Failure:** the teapot moves from between the characters to the windowsill without a shot showing it; a prop is picked up on the left and handed over from the right.
- **Addendum:** if the plot moves a prop, show the movement and update the prop anchor.

## 5. Explicit repositioning

- **Check:** any change in relative character position needs a shot showing start → path → end, plus a map update.
- **Failure:** character A is on the left in one shot and on the right in the next with no movement shot.

## 6. Shot-to-shot handoff (check transition first)

- Before writing shot N, compare its `scene_name`/scene header and time with shot N-1:
  - Same scene + continuous time → inherit blocking and run the handoff check.
  - Transition (scene header change, location change, time jump, fade to black) → do not inherit; rebuild the map.
- **Continuous-scene check:** shot N's opening frame equals shot N-1's closing frame. Read the last `sub_shots` entry of shot N-1 to extract who is left/right, facing where, where props are, and the action direction.
- **Why:** if shot N does not start where shot N-1 ended, positions jump on screen.
- **Failure cases:** shot 1 ends with a character at the window (screen-right) but shot 2 opens with the default "character screen-left"; shot 1 ends with A facing right, shot 2 opens with A facing left.
- **Resume:** when appending shots, call `list_shots` to read the chapter's existing shots and use the last closing frame as the new opening; for a new scene, skip inheritance and rebuild the map.

## Self-check list (after writing all shots)

- [ ] Every scene has a blocking map (spatial anchors / character positions / prop anchors / axis and camera side).
- [ ] The map was merged into `bible.md` without overwriting characters or wardrobe.
- [ ] Every shot's `visual`/`sub_shots` states left/right positions and facing; no "same as above".
- [ ] Same-scene continuous shots keep left/right relationships; any change has a movement shot.
- [ ] Shot N opens from shot N-1's closing frame (positions, facing, props, action direction).
- [ ] Dialogue partners face opposite directions consistently across shots.
- [ ] Key prop positions are consistent; movement is shown.
- [ ] `video_prompt` (English) restates blocking and facing without contradicting `sub_shots`.
