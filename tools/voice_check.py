#!/usr/bin/env python3
"""
tools/voice_check.py — AI phrase detector for newsletter drafts.

Scans output/draft.md for banned phrases, structural violations, and
AI-sounding patterns. Returns JSON. Exit 1 if any flags are raised.

Usage:
    python3 tools/voice_check.py [--input output/draft.md]
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ── Banned phrases (case-insensitive exact match) ─────────────────────────────
BANNED_PHRASES = [
    "ever-changing",
    "dive in",
    "let's dive in",
    "deep dive",
    "in today's market",
    "whether you're a first-time buyer",
    "whether you are a first-time buyer",
    "it's important to note",
    "it is important to note",
    "at the end of the day",
    "game-changer",
    "game changer",
    "robust",
    "streamline",
    "streamlined",
    "stay tuned",
    "exciting times",
    "without further ado",
    "buckle up",
]

# "landscape" and "navigate" only banned in non-literal contexts —
# flagged with a note so author can judge.
CONTEXT_SENSITIVE = [
    ("landscape", "Only banned when not referring to actual landscaping or geography."),
    ("navigate", "Only banned when not giving literal directions."),
    ("leverage", "Only banned when used as a verb (e.g. 'leverage your equity')."),
]


def load_text(path: str) -> str:
    p = Path(path)
    if not p.exists():
        print(json.dumps({"error": f"File not found: {path}"}))
        sys.exit(1)
    return p.read_text(encoding="utf-8")


def check_banned_phrases(text: str) -> list:
    flagged = []
    text_lower = text.lower()
    for phrase in BANNED_PHRASES:
        idx = text_lower.find(phrase.lower())
        if idx != -1:
            start = max(0, idx - 60)
            end = min(len(text), idx + len(phrase) + 60)
            context = "…" + text[start:end].strip() + "…"
            flagged.append({
                "type": "banned_phrase",
                "phrase": phrase,
                "context": context,
            })
    return flagged


def check_context_sensitive(text: str) -> list:
    flagged = []
    text_lower = text.lower()
    for phrase, note in CONTEXT_SENSITIVE:
        idx = text_lower.find(phrase.lower())
        if idx != -1:
            # For "leverage", only flag when followed by a direct object (verb usage)
            if phrase == "leverage":
                pattern = r'\bleverag(?:e|es|ed|ing)\b\s+(?:your|the|a|an|our|this|that|their|its|my)\b'
                if not re.search(pattern, text, re.IGNORECASE):
                    continue  # skip — probably used as a noun
            start = max(0, idx - 60)
            end = min(len(text), idx + len(phrase) + 60)
            context = "…" + text[start:end].strip() + "…"
            flagged.append({
                "type": "context_sensitive",
                "phrase": phrase,
                "context": context,
                "note": note,
            })
    return flagged


def check_exclamation_points(text: str) -> list:
    count = text.count("!")
    if count > 1:
        return [{
            "type": "too_many_exclamations",
            "count": count,
            "message": f"Found {count} exclamation points. Max allowed: 1.",
        }]
    return []


def check_consecutive_i_sentences(text: str) -> list:
    # Split on sentence-ending punctuation followed by whitespace
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    flagged = []
    for i in range(len(sentences) - 1):
        a = sentences[i].strip()
        b = sentences[i + 1].strip()
        if re.match(r"^I\b", a) and re.match(r"^I\b", b):
            flagged.append({
                "type": "consecutive_i_sentences",
                "sentences": [a[:120], b[:120]],
                "message": "Two consecutive sentences starting with 'I'.",
            })
    return flagged


def check_greeting_opener(text: str) -> list:
    # Strip Markdown headers and check the first non-empty, non-header line
    lines = [l.strip() for l in text.splitlines() if l.strip() and not l.strip().startswith("#")]
    if not lines:
        return []
    first = lines[0].lower()
    greetings = ["hey there", "happy ", "hello ", "hi there", "good morning", "good afternoon"]
    for g in greetings:
        if first.startswith(g):
            return [{
                "type": "greeting_opener",
                "line": lines[0][:120],
                "message": "Newsletter opens with a greeting. Start with a fact, observation, or opinion instead.",
            }]
    return []


def check_emoji_in_body(text: str) -> list:
    # Strip subject line (first # heading) before checking
    body = re.sub(r'^#[^\n]*\n', '', text, count=1, flags=re.MULTILINE)
    emoji_pattern = re.compile(
        "[\U00002600-\U000027BF"
        "\U0001F300-\U0001F9FF"
        "\U0001FA00-\U0001FA6F"
        "\U0001FA70-\U0001FAFF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251]+",
        flags=re.UNICODE
    )
    matches = emoji_pattern.findall(body)
    if matches:
        return [{
            "type": "emoji_in_body",
            "emojis": matches,
            "message": "Emojis found in newsletter body. Remove them (one in subject line is OK).",
        }]
    return []


def main():
    parser = argparse.ArgumentParser(description="Check newsletter draft for AI-sounding phrases.")
    parser.add_argument("--input", default="output/draft.md", help="Path to draft Markdown file")
    args = parser.parse_args()

    text = load_text(args.input)

    all_flags = (
        check_banned_phrases(text)
        + check_context_sensitive(text)
        + check_exclamation_points(text)
        + check_consecutive_i_sentences(text)
        + check_greeting_opener(text)
        + check_emoji_in_body(text)
    )

    passed = len(all_flags) == 0
    result = {
        "pass": passed,
        "flagged": all_flags,
        "summary": f"{len(all_flags)} issue(s) found." if all_flags else "All checks passed.",
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
