import argparse
import html
import re
import sys
from dataclasses import dataclass
from pathlib import Path

STEEL_BLUE = "#4682B4"
KEY_RED = "#FF0000"
TIME_TAGS = "DAY|NIGHT|MORNING|DUSK|EVENING|DAWN|AFTERNOON"
SCENE_RE = re.compile(rf"^\d+-\d+\.\s+.+\s+\[(INT|EXT)\]\s+\[({TIME_TAGS})\]$")
EPISODE_RE = re.compile(r"\bEpisode\s+\d{1,3}\b", re.IGNORECASE)
DIALOGUE_RE = re.compile(r"^([^:\n]{1,40}):\s*(.*)$")
BLUE_SPAN_RE = re.compile(
    r'<span\b[^>]*style=["\'][^"\']*color\s*:\s*#4682B4[^"\']*["\'][^>]*>(.*?)</span>',
    re.IGNORECASE,
)
RED_SPAN_RE = re.compile(
    r'<span\b[^>]*style=["\'][^"\']*color\s*:\s*#FF0000[^"\']*["\'][^>]*>(.*?)</span>',
    re.IGNORECASE,
)
HALF_WIDTH_PRODUCTION = re.compile(
    r"\[(SFX|SUBTITLE|CLOSE-UP|SHOT SIZE|CAMERA|VFX|INSERT FLASHBACK|END FLASHBACK|MONTAGE|PARALLEL CUT|END OF EPISODE)"
)
FORBIDDEN_META = {
    "Scene Heading",
    "Action",
    "Dialogue",
    "Special Effects",
    "Glossary",
}


@dataclass
class Issue:
    level: str
    line: int
    message: str


def strip_markup(value: str) -> str:
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("**", "")
    return html.unescape(value).strip()


def is_bold(value: str) -> bool:
    stripped = value.strip()
    return (stripped.startswith("**") and stripped.endswith("**")) or bool(
        re.search(r"<strong\b[^>]*>.*?</strong>", stripped, re.IGNORECASE)
    )


def has_alignment(value: str, direction: str) -> bool:
    return bool(
        re.search(
            rf'<(?:div|p)\b[^>]*align=["\']?{direction}["\']?[^>]*>',
            value,
            re.IGNORECASE,
        )
    )


def terminal_groups(value: str) -> int:
    return len(re.findall(r"[.。!！?？]+", value))


def blue_text(value: str) -> str:
    return "".join(strip_markup(match) for match in BLUE_SPAN_RE.findall(value))


def prop_is_red(value: str, prop: str) -> bool:
    return any(prop in strip_markup(match) for match in RED_SPAN_RE.findall(value))


def is_forbidden_meta_line(plain: str) -> bool:
    normalized = plain.strip().strip("【】[]: ")
    return normalized in FORBIDDEN_META


def analyze(text: str, key_props: list[str]) -> list[Issue]:
    issues: list[Issue] = []
    found_title = False
    found_episode_cast = False
    found_scene = False
    found_scene_cast = False
    found_end = False

    for line_no, original in enumerate(text.splitlines(), 1):
        plain = strip_markup(original)
        if not plain:
            continue

        if is_forbidden_meta_line(plain):
            issues.append(Issue("ERROR", line_no, "Final script body must not contain tutorial section labels"))

        if "(0.S.)" in plain or "(V.0.)" in plain:
            issues.append(Issue("ERROR", line_no, "The O in (O.S.) and (V.O.) must be the letter O"))

        if EPISODE_RE.search(plain):
            found_title = True
            if not is_bold(original):
                issues.append(Issue("ERROR", line_no, "Episode title must be bold"))
            if not has_alignment(original, "center"):
                issues.append(Issue("WARN", line_no, "Rich-text episode title should be centred"))
            continue

        if plain.startswith("Episode Cast:"):
            found_episode_cast = True
            if not is_bold(original):
                issues.append(Issue("ERROR", line_no, "Episode cast list must be bold"))
            continue

        if SCENE_RE.match(plain):
            found_scene = True
            if not is_bold(original):
                issues.append(Issue("ERROR", line_no, "Scene heading must be bold"))
            continue

        if re.match(r"^\d+-\d+\.", plain) and not SCENE_RE.match(plain):
            issues.append(Issue("ERROR", line_no, "Scene heading format: 1-1. Abandoned Warehouse [INT] [NIGHT]"))
            continue

        if plain.startswith("Scene Cast:"):
            found_scene_cast = True
            if not is_bold(original):
                issues.append(Issue("ERROR", line_no, "Scene cast list must be bold"))
            continue

        if plain == "[END OF EPISODE]":
            found_end = True
            if not has_alignment(original, "right"):
                issues.append(Issue("WARN", line_no, "Rich-text [END OF EPISODE] should be right-aligned"))
            continue

        if "[SUBTITLE" in plain:
            if STEEL_BLUE.lower() not in original.lower():
                issues.append(Issue("ERROR", line_no, "Subtitle labels and content must use steel blue #4682B4"))

        if plain.startswith("△"):
            if terminal_groups(plain) > 1:
                issues.append(Issue("ERROR", line_no, "Write one complete action sentence per line"))
        elif plain.startswith("[") and plain.endswith("]"):
            pass
        else:
            dialogue = DIALOGUE_RE.match(plain)
            if dialogue:
                speaker, content = dialogue.groups()
                if is_bold(original):
                    issues.append(Issue("ERROR", line_no, "Dialogue speaker and line must not be bold"))
                if '"' not in content:
                    issues.append(Issue("ERROR", line_no, 'Each dialogue line must be wrapped in English double quotes (")'))
                if terminal_groups(content) > 1:
                    issues.append(Issue("ERROR", line_no, "One complete dialogue sentence per line; repeat the speaker name on the next line"))
                colored = blue_text(original)
                if f"{speaker}:" not in colored or '"' not in colored:
                    issues.append(Issue("ERROR", line_no, "Speaker name, colon, quotes, and dialogue must use steel blue #4682B4"))
                for token in ("(O.S.)", "(V.O.)"):
                    if token in plain and token not in colored:
                        issues.append(Issue("ERROR", line_no, f"{token} must use steel blue #4682B4"))
            elif not plain.startswith(("<", "<!--")):
                issues.append(Issue("WARN", line_no, "Unrecognised line: action starts with △, dialogue uses CHARACTER: \"line\""))

        for prop in key_props:
            if prop in plain and not prop_is_red(original, prop):
                issues.append(Issue("ERROR", line_no, f'Key prop "{prop}" must use red #FF0000 on every appearance'))

    if not found_title:
        issues.append(Issue("ERROR", 0, "Missing episode title"))
    if not found_episode_cast:
        issues.append(Issue("ERROR", 0, "Missing episode cast list"))
    if not found_scene:
        issues.append(Issue("ERROR", 0, "Missing valid scene heading"))
    if not found_scene_cast:
        issues.append(Issue("ERROR", 0, "Missing scene cast list"))
    if not found_end:
        issues.append(Issue("ERROR", 0, "Missing [END OF EPISODE]"))
    return issues


def run_self_test() -> int:
    valid = """<div align="center"><strong>Episode 01 — The Test</strong></div>
**Episode Cast: Ethan Clark, Marcus Hale**
**1-1. Abandoned Warehouse [INT] [NIGHT]**
**Scene Cast: Ethan Clark, Marcus Hale**
△Ethan pushes open the rusted iron door.
<span style="color:#4682B4">Ethan Clark:</span><span style="color:#4682B4">"You thought you could run?"</span>
<span style="color:#4682B4">[SUBTITLE: Three minutes earlier]</span>
△Marcus grips the <span style="color:#FF0000">black key</span> in his palm.
<div align="right">[END OF EPISODE]</div>"""
    invalid = """Episode 01
Scene Cast: Ethan Clark
1-1 Abandoned Warehouse [INT][NIGHT]
A Ethan is afraid.
**Ethan Clark: Don't come closer.**
[SUBTITLE] Three minutes earlier
[END OF EPISODE]"""
    valid_issues = analyze(valid, ["black key"])
    invalid_issues = analyze(invalid, [])
    valid_errors = [issue for issue in valid_issues if issue.level == "ERROR"]
    invalid_errors = [issue for issue in invalid_issues if issue.level == "ERROR"]
    if valid_errors or not invalid_errors:
        print("SELF-TEST FAILED")
        for issue in valid_issues:
            print(issue)
        return 1
    print(f"SELF-TEST PASSED: invalid sample produced {len(invalid_errors)} expected errors")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Check the 0715 English Western screenplay hard format")
    parser.add_argument("file", nargs="?", help="UTF-8 Markdown, HTML, or text screenplay")
    parser.add_argument("--key-prop", action="append", default=[], help="Key prop that must be red on every appearance; repeatable")
    parser.add_argument("--self-test", action="store_true", help="Run the built-in self-test")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()
    if not args.file:
        parser.error("Provide a screenplay file, or use --self-test")

    path = Path(args.file)
    text = path.read_text(encoding="utf-8-sig")
    issues = analyze(text, args.key_prop)
    for issue in issues:
        location = f"line {issue.line}" if issue.line else "document"
        print(f"{issue.level} {location}: {issue.message}")
    errors = sum(issue.level == "ERROR" for issue in issues)
    warnings = sum(issue.level == "WARN" for issue in issues)
    print(f"SUMMARY errors={errors} warnings={warnings}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
