#!/usr/bin/env python3
"""
tools/suggest_topics.py — Generate SEO topic ideas for the West Michigan real estate blog.

Uses the Anthropic API to suggest 6 blog post topics based on:
  - Content clustering strategy from CLAUDE.md
  - Published keywords (to avoid cannibalization)
  - Current date / seasonal context

Usage:
    python3 tools/suggest_topics.py
    python3 tools/suggest_topics.py --count 8

Returns JSON to stdout:
    {"success": true, "topics": [...]}

Exit 0 on success, 1 on failure.
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print(json.dumps({"error": "python-dotenv not installed. Run: pip3 install python-dotenv"}))
    sys.exit(1)

try:
    import anthropic
except ImportError:
    print(json.dumps({"error": "anthropic not installed. Run: pip3 install anthropic"}))
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / "config" / ".env")


def load_published_keywords() -> list[str]:
    csv_path = PROJECT_ROOT / "published" / "keywords.csv"
    if not csv_path.exists():
        return []
    keywords = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                kw = row.get("keyword", "").strip()
                if kw:
                    keywords.append(kw)
    except Exception:
        pass
    return keywords


SYSTEM_PROMPT = """You are an SEO content strategist for Jason O'Brien, a REALTOR® at PREMIERE Group at Real Broker, LLC, serving the Kalamazoo/West Michigan area. Jason's website is jobrienhomes.com.

Your job is to suggest SEO blog post topics that will rank on Google for local real estate searches.

SERVICE AREA:
- Tier 1 (highest priority): Kalamazoo, Portage, Grand Rapids, Battle Creek, South Haven, Kalamazoo County
- Tier 2: Plainwell, Otsego, Allegan, Paw Paw, Mattawan, Vicksburg, Schoolcraft, Richland, Wayland
- Tier 3 (long-tail): Parchment, Comstock, Oshtemo, Texas Township, Saugatuck, Three Rivers, Sturgis, and others

CONTENT CLUSTERS (priority order):
1. Community Guides — "Moving to [City] Michigan", "Living in [City]", "Best Neighborhoods in [City]" — HIGHEST PRIORITY
2. Market Updates — Monthly/seasonal market snapshots, inventory reports
3. Buyer Education — Buyer's agent guides, first-time buyer programs, closing costs
4. Homes for Heroes — Teacher/firefighter/military homebuyer programs (max 1 per 5 posts)

SEO KEYWORD FORMULA: [City] + [Real Estate Topic]

HIGH-PERFORMING FORMATS:
- "Moving to [City] Michigan: X Things to Know"
- "Cost of Living in [City] MI (2026 Guide)"
- "Best Neighborhoods in [City] for Families"
- "[City] Housing Market Forecast"
- "Living in [City] Michigan: Pros and Cons"
- "[City] vs [City]: Which Is Better for Families?"

RULES:
- Each topic must target ONE primary search keyword
- Primary keyword must include a city name + real estate topic
- Titles must be under 60 characters
- No keyword that already exists in the published list
- Mix clusters: don't suggest all community guides or all market updates
- Today's date matters — seasonal context helps (spring market, summer, etc.)"""


def suggest_topics(count: int, published_keywords: list[str]) -> list[dict]:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key.startswith("sk-ant-YOUR"):
        raise ValueError("ANTHROPIC_API_KEY not set in config/.env")

    client = anthropic.Anthropic(api_key=api_key)
    now = datetime.now()
    month_year = now.strftime("%B %Y")

    already_published = ""
    if published_keywords:
        already_published = (
            "\n\nALREADY PUBLISHED (DO NOT REPEAT THESE KEYWORDS):\n"
            + "\n".join(f"- {kw}" for kw in published_keywords)
        )

    user_prompt = f"""Today is {month_year}. Suggest {count} SEO blog post topics for Jason O'Brien's West Michigan real estate blog.{already_published}

Return ONLY valid JSON — no markdown, no explanation. Format:
{{
  "topics": [
    {{
      "title": "Moving to Kalamazoo Michigan: 12 Things to Know",
      "keyword": "moving to kalamazoo michigan",
      "slug": "moving-to-kalamazoo-michigan",
      "cluster": "community-guides",
      "tier": "tier-1",
      "target_length": "1200-2500 words",
      "rationale": "High-volume relocation query, strong buyer intent, no competing post yet"
    }}
  ]
}}

Make exactly {count} topics. Mix clusters and cities. Prioritize community guides for Tier 1 and Tier 2 cities first."""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[
            {"role": "user", "content": user_prompt}
        ],
        system=SYSTEM_PROMPT,
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    data = json.loads(raw)
    return data.get("topics", [])


def main():
    parser = argparse.ArgumentParser(description="Generate SEO topic ideas for the blog.")
    parser.add_argument("--count", type=int, default=6, help="Number of topic ideas to generate")
    args = parser.parse_args()

    published = load_published_keywords()

    try:
        topics = suggest_topics(args.count, published)
        result = {
            "success": True,
            "topics": topics,
            "count": len(topics),
        }
        print(json.dumps(result, indent=2, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}))
        sys.exit(1)


if __name__ == "__main__":
    main()
