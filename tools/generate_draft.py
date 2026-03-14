#!/usr/bin/env python3
"""
tools/generate_draft.py — Write a full SEO blog post using Claude AI.

Reads:
  - config/topic.txt — the blog post topic / title idea
  - config/keyword.txt — the primary SEO keyword (optional, falls back to topic)
  - logs/sources.md — research data from research.py
  - published/keywords.csv — to include context about existing posts

Writes:
  - output/draft.md — full blog post with YAML front matter

Returns JSON to stdout. Exit 0 on success, 1 on failure.
"""

import json
import os
import re
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

SYSTEM_PROMPT = """You are Jason O'Brien, a REALTOR® at PREMIERE Group at Real Broker, LLC in Kalamazoo, Michigan. You write your own real estate blog posts for jobrienhomes.com. You are a Homes for Heroes® affiliate.

SERVICE AREA: Kalamazoo, Portage, Plainwell, Otsego, Allegan, Paw Paw, Mattawan, Vicksburg, Schoolcraft, Richland, Grand Rapids, Battle Creek, South Haven, and surrounding West Michigan communities.

WRITE EXACTLY LIKE THIS:
- Casual, direct, first-person. Like a knowledgeable neighbor who happens to sell houses.
- Short sentences. Punchy. Conversational paragraph breaks.
- Use "you" and "your" — talk directly to the reader.
- Local references are gold: mention actual neighborhoods, streets, landmarks, restaurants.
- Opinions are welcome: "I think this market is going to stay competitive through summer" > "The market may remain competitive."
- Humor is fine when it's natural. Don't force it.

NEVER USE THESE WORDS/PHRASES:
- "landscape" (when not talking about actual landscaping)
- "navigate" (when not giving directions)
- "ever-changing"
- "dive in" / "let's dive in" / "deep dive"
- "in today's market" as an opener
- "whether you're a first-time buyer or seasoned investor"
- "it's important to note"
- "at the end of the day"
- "game-changer" / "game changer"
- "robust"
- "streamline" / "streamlined"
- "stay tuned"
- "exciting times"
- "without further ado"
- "buckle up"

STRUCTURAL RULES:
- Title (H1): Under 60 characters. Include primary keyword. Specific > clever.
- Opening line: Start with a specific fact, observation, or opinion. NEVER start with a greeting.
- H2 sections: 3-5 subheadings. At least one with a city/geo keyword.
- CTA: One per post, at the very end. Soft and natural. Examples:
  "If you've been thinking about making a move this spring, I'm always happy to talk it through — no pressure, no pitch."
  "Browse homes for sale in Kalamazoo or Portage."
  "Want a list of homes under $400k in Kalamazoo? Reach out anytime."
- Sign-off: "— Jason" or "Talk soon, Jason"
- Max 1 exclamation point in the entire post.
- Do not start two consecutive sentences with "I".

SEO RULES:
- Primary keyword must appear in: title, first 100 words, at least one H2
- Include city + "Michigan" or "MI" at least once
- Mention 2-3 cities from the service area naturally
- Include at least 2 internal links using relative paths like [browse homes in Kalamazoo](/search) or [contact me](/contact)
- Include at least 1 external source link for any stats (open in new format: [source name](url))
- Image alt text must be descriptive and location-aware

TARGET LENGTH BY POST TYPE:
- Community guides / pillar content: 1,200–2,500 words
- Standard posts: 800–1,200 words
- Market updates: 500–1,000 words
- Cost of living guides: 1,000–1,500 words

OUTPUT FORMAT — you must return ONLY the markdown file content, starting with front matter:

---
title: [Post title — under 60 chars]
slug: [url-slug-lowercase-hyphenated]
seo_title: [Same as title or slight variation — under 60 chars]
seo_description: [140-155 char meta description with keyword, written as a hook]
keyword: [primary SEO keyword]
dek: [1-2 sentence subheadline / deck for the post]
cluster: [community-guides | market-updates | buyer-education | homes-for-heroes]
image_prompt: [Specific image generation prompt — describe a real West Michigan scene, neighborhood, or home style that fits the post topic. Be specific about location.]
date: [today's date YYYY-MM-DD]
---

[Full blog post in Markdown, starting with # H1 title]"""


def read_file_safe(path: Path, default: str = "") -> str:
    if path.exists():
        return path.read_text(encoding="utf-8").strip()
    return default


def main():
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key.startswith("sk-ant-YOUR"):
        print(json.dumps({"error": "ANTHROPIC_API_KEY not set in config/.env"}))
        sys.exit(1)

    # ── Read inputs ────────────────────────────────────────────────────────────
    topic = ""
    topic_path = PROJECT_ROOT / "config" / "topic.txt"
    if topic_path.exists():
        lines = topic_path.read_text(encoding="utf-8").splitlines()
        topic = next((l.strip() for l in lines if l.strip() and not l.startswith("#")), "")

    keyword = ""
    keyword_path = PROJECT_ROOT / "config" / "keyword.txt"
    if keyword_path.exists():
        lines = keyword_path.read_text(encoding="utf-8").splitlines()
        keyword = next((l.strip() for l in lines if l.strip() and not l.startswith("#")), "")

    sources_md = read_file_safe(PROJECT_ROOT / "logs" / "sources.md")

    if not topic:
        print(json.dumps({"error": "No topic set. Save a topic in config/topic.txt first."}))
        sys.exit(1)

    print(f"▶ generate_draft / Topic: {topic}", file=sys.stderr)
    print(f"  Keyword: {keyword or '(from topic)'}", file=sys.stderr)
    print(f"  Sources: {len(sources_md)} chars", file=sys.stderr)

    # ── Build prompt ───────────────────────────────────────────────────────────
    now = datetime.now()
    kw_line = f"\nPRIMARY SEO KEYWORD: {keyword}" if keyword else ""

    user_prompt = f"""Today is {now.strftime('%B %d, %Y')}.

TOPIC / TITLE IDEA: {topic}{kw_line}

RESEARCH DATA:
{sources_md[:8000] if sources_md else "(No research data found — write the post using your general knowledge of the West Michigan market. Do not fabricate specific stats.)"}

Write the complete blog post now. Return ONLY the markdown content starting with the --- front matter block. No explanation before or after."""

    # ── Call Claude API ────────────────────────────────────────────────────────
    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[{"role": "user", "content": user_prompt}],
            system=SYSTEM_PROMPT,
        )
        draft_content = message.content[0].text.strip()
    except anthropic.APIError as e:
        print(json.dumps({"error": f"Claude API error: {e}", "success": False}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}))
        sys.exit(1)

    # ── Ensure front matter has today's date ──────────────────────────────────
    today_str = now.strftime("%Y-%m-%d")
    if "date:" not in draft_content[:500]:
        if draft_content.startswith("---"):
            draft_content = draft_content.replace("---\n", f"---\ndate: {today_str}\n", 1)

    # ── Write output ───────────────────────────────────────────────────────────
    output_path = PROJECT_ROOT / "output" / "draft.md"
    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text(draft_content, encoding="utf-8")

    # ── Parse result metadata ─────────────────────────────────────────────────
    meta = {}
    if draft_content.lstrip().startswith("---"):
        parts = draft_content.lstrip().split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].strip().splitlines():
                if ":" in line:
                    k, _, v = line.partition(":")
                    meta[k.strip()] = v.strip()

    body_md = draft_content
    if "---" in draft_content:
        parts = draft_content.split("---", 2)
        if len(parts) >= 3:
            body_md = parts[2]

    word_count = len(re.findall(r'\w+', body_md))
    title = meta.get("title", meta.get("seo_title", topic))
    kw_out = meta.get("keyword", keyword or topic)

    result = {
        "success": True,
        "output": str(output_path),
        "title": title,
        "keyword": kw_out,
        "slug": meta.get("slug", ""),
        "word_count": word_count,
    }
    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
