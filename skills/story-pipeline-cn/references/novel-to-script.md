# Mode A · Novel → Script

Adapt a novel or source material into a **shootable English literary script**. The target is clear structure, standardized scene headings, and separated dialogue/action so mode B can split shots directly. All output is English; translate and adapt non-English source meaning before writing.

## Trigger

The user asks to adapt a novel into a script, or provides a novel file with adaptation intent. If no mode is specified, return to the `SKILL.md` menu.

## Input

- Pasted novel text, or a `.txt` / `.md` novel/source path.
- If only a premise/idea is given, confirm core settings before drafting.

## Steps

### Step 1 · Source mining

Extract or confirm four elements:

| Element | Question |
|---|---|
| Premise | One-sentence core setting: "If a ___, what happens?" |
| Protagonist and desire | Who, what they want, what blocks them |
| Core conflict | Character vs character / environment / self |
| Theme | What the story expresses, in one sentence |

Output an English adaptation brief for confirmation (gate 1).

### Step 2 · Three-act structure

Build the skeleton using `references/style-guide.md` and `templates/script-template.md`:

- **Act I (~25%):** hook (grab the audience in the first 30 seconds) → world presentation → protagonist entrance → inciting incident.
- **Act II (~50%):** rising action → midpoint turn → deepening crisis (All Is Lost).
- **Act III (~25%):** climactic confrontation → resolution → aftertaste / optional hook.

Give an English scene-by-scene outline (one sentence + function per scene) for confirmation (gate 2).

### Step 3 · Finished scene script

Write each scene as an English literary script with standardized headings:

```text
[SCENE 01] Outside · Abandoned Factory · Dusk
───────────────────────────────────────
[VISUAL: Orange-red sunset stretches the factory's iron frames into long shadows. The rusted gate is half open.]
[SFX: Wind, distant city noise fading out.]

LIN CHEN (slipping through the gap, flashlight in hand, wary): "Three times now. Each time I was almost too late."

[VISUAL: The beam sweeps the wall and stops on a set of strange runes.]
SYSTEM VOICE (mechanical): "Energy residue detected — class S."
```

Rules:

- Scene header: `[SCENE NN] Location · Sub-location · Time`.
- Dialogue: `CHARACTER (action/emotion): "line"`.
- Objective visuals: `[VISUAL: …]`; sound: `[SFX: …]` / `[MUSIC: …]`; emotion arc: `[EMOTION: A→B→C]`.
- Every line has a purpose; keep spoken lines under about 20 English words; avoid explanatory dialogue.

### Step 4 · Self-review and iteration

Check against `templates/script-template.md`:

- Three-act proportions and hook strength.
- Each scene has a clear function (advance / reveal / turn).
- Distinct character voices.

Write `outputs/<work>/script.md` in English, including a next-episode hook. Ask for confirmation before delivery (gate 3).

## Output

- `outputs/<work>/script.md` (English literary script with world overview, character list, body, and notes).
- Optional placeholder `outputs/<work>/storyboard.md` for mode B.

## Handoff

Pass `script.md` directly to **mode B (Script → Storyboard)**; no re-extraction is needed.
