---
name: webnovel-writing
description: Plan, draft, continue, and revise English web fiction from a short premise. Use when the user supplies a brief story idea and needs concept diagnosis, three-act/volume planning, chapter outlines, opening pages, chapter prose, ending hooks, pacing review, reference scouting, or de-AI-voice editing. All fiction output is English.
---

# English Web Fiction Writing Skill

## Positioning

This skill writes English web fiction. It focuses on practical questions, not abstract literary theory:

- Is the idea worth serializing?
- What is the book actually selling?
- What sustains momentum through the first 10–20 chapters?
- How does the opening close the deal?
- How does the middle avoid drifting?
- How does each chapter end with forward pull?
- How can similar reference works be found and structurally borrowed from?
- How can AI-sounding prose be avoided from concept through chapter end?

## Default input

A brief description of the target novel. Default behavior:

1. Extract genre, selling points, conflict, story engine, and target length from the premise.
2. Classify the current task as planning, opening, chapter outline, single chapter, local repair, or full-manuscript review.
3. If information is sufficient, work on the most needed layer immediately; otherwise ask only the minimum clarifying questions.

All prose, outlines, character notes, and module feedback are written in English. Runtime storage file names such as `总纲.md`, `卷纲.md`, and `章纲.md` are fixed API contracts; their **content** must be English.

## Character naming

Use natural Western-English names for every character, surname, nickname, pet name, place name, and in-work title. Replace source-language names instead of translating, transliterating, or romanizing them.

Hard rules:
- Use English/Western given names and surnames, e.g. `Sophie Bennett`, `Ethan Brooks`, `Serena Hayes`.
- Never keep Chinese, Japanese, Korean, or other Asian names, even in pinyin/romanized form.
- Never keep Asian honorifics such as `-jie`, `-san`, `-kun`; express relationships in natural English.
- Apply the same Western-English name consistently across outlines, character cards, prose, dialogue tags, memory, and chapter titles.
- If a saved project already contains Asian names, treat those names as source material to replace during any rewrite or continuation.

## Output principle

Output only the layer currently needed. Do not dump everything at once.

Common layers:

- Genre diagnosis
- One-line hook
- Premise
- Story engine explanation
- Volume-one plan
- First 10–20 chapter outlines
- Opening rewrite
- Single chapter prose
- Chapter-end pressure
- Pacing check
- Reference list

## Overall flow

1. Decide whether the problem is in planning, structure, chapter execution, or full-manuscript review.
2. If the problem is already localized, call the specialized module instead of giving generic advice.
3. Match a module example or local reference first, then summarize structure, then write new content.
4. De-AI-voice is not a final polish step; constrain it from concept, scene, dialogue, and chapter endings.
5. Every finished chapter must pass the review module before delivery.

## Module responsibilities

- `concept_planning`: compress a premise into genre, consumption hooks, hook, premise, story engine, length judgment, and volume-one direction. Stage: planning.
- `opening`: land selling points, anomalous situation, and protagonist entrance in the opening close-the-deal zone. Stage: opening execution.
- `volume_outline`: expand the story engine into golden three chapters, volumes, and first 10–20 chapter outlines. Stage: mid/long structure.
- `plot_logic`: repair motivation → trigger → decision → consequence → payoff chains. Stage: prose structure.
- `character_consistency`: repair goal, emotion, relationship, body, and voice continuity. Stage: character state.
- `transition`: handle time jumps, spatial cuts, emotional handoff, POV shifts, and chapter-to-chapter continuity. Stage: scene bridges.
- `dialogue`: handle relationship pressure, character voice, information embedding, and dialogue edge. Stage: dialogue.
- `chapter_ending`: handle ending pull, aftertaste, re-hook, and next-chapter handoff. Stage: chapter closure.
- `anti_ai_voice`: remove empty summary, cliché atmosphere, expository dialogue, and a single uniform voice. Stage: style constraint.
- `consistency_review`: recheck six kinds of consistency and block weak chapters from delivery. Stage: final gate.

## Module relationships

Treat the modules as three chained layers, not ten independent switches:

1. Planning chain: `concept_planning -> opening / volume_outline`
2. Prose execution chain: `plot_logic + character_consistency + transition + dialogue + chapter_ending + anti_ai_voice`
3. Final gate: `consistency_review`

When an issue spans modules, prioritize `plot_logic` / `character_consistency`, then `transition` / `dialogue` / `chapter_ending`, then `anti_ai_voice`. Do not mistake a structural problem for a style problem.

## Planning

Call `concept_planning` for: whether the idea can sustain a web serial; genre and consumption points; selling points and anomalous situation; hook / premise validity; whether the story engine runs for 10–20 chapters; short / medium / long / serial length; volume-one minimum goal and end-of-volume change.

Hard requirements: judge viability before drafting; give selling points, conflict, and story engine before large worldbuilding; do not start prose before the premise compresses into a minimal skeleton.

## Golden three chapters, volumes, and chapter outlines

Call `volume_outline` for weak golden-three-chapter momentum, unclear volume-one trajectory, scattered 10–20 chapter outlines, mid-story drift, or missing volume-end payoff.

Long web fiction requires chapter outlines. Without them, subplots bloat, worldbuilding inflates, chapter endings weaken, and continuation hooks disappear.

## Chapter drafting

Every chapter must answer four questions:

1. What does the protagonist want in this chapter?
2. Who or what blocks them?
3. What changes by the end of the chapter?
4. Why does the reader continue?

Minimum scene structure: goal, obstacle, change. Delete, merge, or compress scenes with no change.

Default routing:

- Time jumps, spatial cuts, emotional handoff, POV shifts, chapter-to-chapter continuity → `transition`
- High-tension dialogue, character voice, relationship pressure, information embedding → `dialogue`
- Chapter closure, aftertaste, re-hook, continuation pull → `chapter_ending`
- Broken causality, weak motivation, invalid trigger, unlanded consequence → `plot_logic`
- Broken character voice, drifting goals, emotional/relationship discontinuity, lost body or information state → `character_consistency`
- Empty summary, cliché atmosphere, expository dialogue, uniform voice → `anti_ai_voice`

## Mandatory chapter review

Never deliver a finished chapter directly. Call `consistency_review` and check six kinds of consistency:

1. Plot logic
2. Character goals
3. Emotion and relationships
4. Body and information state
5. Scenes and transitions
6. Chapter-end handoff

If any two are unstable, return to the relevant module and repair before delivery.

## De-AI-voice

This is a hard requirement. Call `anti_ai_voice` when the text has: too much empty summary; too many atmosphere sentences and adjective clichés; expository dialogue; characters all speaking in one voice; overly even, tidy, template-like sentences.

Hard rules retained:

- Prefer action over summary.
- Prefer dialogue over explanation.
- Write specifics, not abstractions.
- Every speaker must carry identity.
- "De-AI-voice" does not mean intentionally sloppy writing.

## Boundaries

Do not:

- Give vague advice such as "make characters three-dimensional" or "give the story a soul".
- Offer only worldbuilding without the first-chapter plan.
- Offer only character profiles without conflicts and events.
- Default to slow burn.
- Treat imitation as copying.
- Let all dialogue share one voice.
- Output lecture-like filler paragraphs.

Do:

- Give many concrete examples.
- Give positive/negative contrasts.
- Give actionable writing moves.
- Check local reference material.
- Prefer structural borrowing over empty advice.
