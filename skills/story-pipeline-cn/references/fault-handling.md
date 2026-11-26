# Fault Handling and Fallbacks

## 1. Irregular input format

| Symptom | Handling |
|---|---|
| No scene header (pure narration) | Split on double blank lines; infer location/time from keywords; mark as `[OPENING]` when no header exists |
| Dialogue not in `Character: line` form (quoted dialogue only) | Treat as "quotation inside narration"; character extraction may be incomplete; ask the user to add speaker names |
| Mixed-language source | Both `[SCENE]` / `INT.` / `EXT.` markers are accepted; fall back to double blank lines on parse failure; adapt all output into English |

## 2. Character recognition issues

- **Aliases:** if "Lin Chen", "Xiao Lin", and "he" refer to the same person, ask the user to normalize; the script matches exact strings, so aliases become separate characters.
- **Narration / OS / VO:** filter `Narrator` / `OS` / `VO` automatically; they are not character cards.
- **Too many characters:** with more than 10 main characters, list only those appearing ≥3 times; put the rest in notes.

## 3. Long text and truncation

- Pasted text is suitable for **up to about 5,000 words**; longer input should use file mode (`scripts/extract_storyboard.py`).
- File mode processes everything by default; if one output is too large, split by scene into `SCENE_01.md` etc. without dropping segments.
- If Markdown lists are too long, split character/scene cards into separate files and keep only a summary table in the main report.

## 4. English-prompt validation

- If any `image_prompt` / `video_prompt` is not English or requests visible text, mark it `⚠ REWRITE IN ENGLISH — NO VISIBLE TEXT` and never feed it to an image model.
- Batch fixes can be done with an LLM over `storyboard.json`, rewriting `description_cn` values into `image_prompt` values; keep all keys unchanged.

## 5. Downstream image/video dependencies

- This skill calls no API; if the user wants actual images/video, point them to a downstream image/video tool and its API key configuration.
- Running downstream video generation while `reference_image` is `null` produces "reference image not found"; generate storyboard frames first.
- If generated video appearance does not match the storyboard frame, check that `video_prompt` accidentally repeats appearance (it must cover motion only).

## 6. Files and encoding

- Input encoding is auto-detected: `utf-8` / `utf-8-sig` / `gbk` / `gb2312` / `big5`; if all fail, report the error and ask the user to transcode.
- Windows GBK terminals may raise `UnicodeEncodeError` when printing emoji; scripts use safe-print fallbacks. Written files are always `utf-8`.
- Keep all intermediate files so a failed run can be resumed incrementally.
