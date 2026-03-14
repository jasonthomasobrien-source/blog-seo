#!/usr/bin/env python3
"""
tools/spellcheck.py — Spell check for newsletter drafts.

Strips Markdown syntax, then runs pyspellchecker. Whitelists real estate
jargon and local proper nouns. Returns JSON. Exit 1 if misspellings found.

Usage:
    python3 tools/spellcheck.py [--input output/draft.md]
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from spellchecker import SpellChecker
except ImportError:
    print(json.dumps({"error": "pyspellchecker not installed. Run: pip3 install pyspellchecker"}))
    sys.exit(1)

# ── Whitelist: real estate terms, local proper nouns, abbreviations ───────────
WHITELIST = [
    # Local geography
    "Kalamazoo", "kalamazoo",
    "Portage", "portage",
    "Plainwell", "plainwell",
    "Otsego", "otsego",
    "Allegan", "allegan",
    "Galesburg", "galesburg",
    "Comstock", "comstock",
    "Schoolcraft", "schoolcraft",
    "Mattawan", "mattawan",
    "Vicksburg", "vicksburg",
    "Parchment", "parchment",
    "Richland", "richland",
    "Climax", "climax",
    "Pavilion", "pavilion",
    # Brand / company
    "jobrienhomes", "PREMIERE", "Realtor", "REALTOR",
    "Broker", "LLC", "Corp",
    # Real estate terms
    "MLS", "HOA", "HOAs", "ARMs", "DTI", "PITI", "LTV",
    "escrow", "earnest", "amortization", "appraisal", "appraiser",
    "foreclosure", "forbearance", "refinance", "refinancing",
    "leaseback", "leaseholders", "townhome", "townhomes",
    "condo", "condos", "condominium", "condominiums",
    "duplex", "triplex", "fourplex",
    "preapproval", "pre-approval", "preapproved",
    "homebuyer", "homebuyers", "homeseller", "homesellers",
    "move-up", "moveup",
    "FSBO", "fixer-upper", "fixer",
    "walkability", "walkable",
    # Finance / mortgage
    "FHA", "VA", "USDA", "PMI", "HELOC",
    "jumbo", "conforming", "nonconforming",
    "buydown", "buydowns", "buy-down",
    # Program names
    "Heroes", "jobrienhomes",
    # Common abbreviations safe to skip
    "sq", "ft", "bd", "ba", "br",
    # Contractions / possessives that spellchecker might flag
    "it's", "that's", "there's", "you're", "they're",
    "I've", "we've", "you've",
    "I'd", "we'd", "you'd", "they'd",
    "I'll", "we'll", "you'll", "they'll",
    "isn't", "aren't", "wasn't", "weren't",
    "don't", "doesn't", "didn't",
    "won't", "wouldn't", "can't", "couldn't", "shouldn't",
    "Jason", "O'Brien",
]


def strip_markdown(text: str) -> str:
    """Remove Markdown syntax so spellchecker only sees prose words."""
    # Remove YAML front matter
    text = re.sub(r'^---[\s\S]*?---\n', '', text)
    # Remove code blocks
    text = re.sub(r'```[\s\S]*?```', ' ', text)
    text = re.sub(r'`[^`]+`', ' ', text)
    # Remove images
    text = re.sub(r'!\[.*?\]\(.*?\)', ' ', text)
    # Remove links — keep the display text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Remove bare URLs
    text = re.sub(r'https?://\S+', ' ', text)
    # Remove Markdown formatting characters
    text = re.sub(r'[#*_~>|`]', ' ', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', ' ', text)
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def main():
    parser = argparse.ArgumentParser(description="Spell check a newsletter draft.")
    parser.add_argument("--input", default="output/draft.md", help="Path to draft Markdown file")
    args = parser.parse_args()

    p = Path(args.input)
    if not p.exists():
        print(json.dumps({"error": f"File not found: {args.input}"}))
        sys.exit(1)

    raw_text = p.read_text(encoding="utf-8")
    clean_text = strip_markdown(raw_text)

    spell = SpellChecker()
    spell.word_frequency.load_words([w.lower() for w in WHITELIST])

    # Extract words (letters and apostrophes only)
    words = re.findall(r"\b[a-zA-Z][a-zA-Z']*[a-zA-Z]\b|\b[a-zA-Z]\b", clean_text)

    # Skip words that start with a capital letter (likely proper nouns)
    lowercase_words = [w for w in words if w[0].islower()]

    misspelled = spell.unknown(lowercase_words)

    suggestions = []
    for word in sorted(misspelled):
        candidates = spell.candidates(word) or set()
        suggestions.append({
            "word": word,
            "suggestions": sorted(candidates)[:4],
        })

    passed = len(suggestions) == 0
    result = {
        "pass": passed,
        "suggestions": suggestions,
        "summary": f"{len(suggestions)} potential misspelling(s) found." if suggestions else "No misspellings found.",
    }

    print(json.dumps(result, indent=2))
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
