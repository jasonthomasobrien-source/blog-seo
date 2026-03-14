#!/usr/bin/env python3
"""
tools/seo_check.py — SEO pre-publish checklist for West Michigan real estate blog posts.

Verifies keyword placement, meta tags, internal/external links, heading structure,
image alt text, and no duplicate primary keywords against published/keywords.csv.

Usage:
    python3 tools/seo_check.py --keyword "Kalamazoo housing market 2026"
    python3 tools/seo_check.py --keyword "living in portage michigan" --input output/draft.md

Returns JSON to stdout:
    {"pass": bool, "checks": [...], "score": "X/Y", "summary": "..."}

Exit 0 if all required checks pass, 1 if any required check fails.
"""

import argparse
import csv
import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent

# ── Cities in the service area (used for geo-modifier check) ──────────────────
SERVICE_AREA_CITIES = [
    # Tier 1
    "kalamazoo", "portage", "grand rapids", "battle creek", "south haven",
    # Tier 2
    "plainwell", "otsego", "allegan", "paw paw", "mattawan", "vicksburg",
    "schoolcraft", "richland", "wayland", "kentwood", "wyoming",
    "grandville",
    # Tier 3
    "parchment", "comstock", "oshtemo", "texas township", "kalamazoo township",
    "lawton", "decatur", "hartford", "gobles", "bloomingdale", "bangor",
    "pullman", "saugatuck", "douglas", "bradley", "moline", "cutlerville",
    "jenison", "galesburg", "augusta", "hickory corners", "delton",
    "springfield", "marshall", "albion", "scotts", "three rivers",
    "centreville", "constantine", "white pigeon", "sturgis", "climax",
    "fulton", "cooper township", "alamo township",
]


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_front_matter(text: str) -> tuple[dict, str]:
    if not text.lstrip().startswith("---"):
        return {}, text
    parts = text.lstrip().split("---", 2)
    if len(parts) < 3:
        return {}, text
    meta = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, parts[2].lstrip("\n")


def strip_markdown(text: str) -> str:
    text = re.sub(r'^---[\s\S]*?---\n', '', text)
    text = re.sub(r'```[\s\S]*?```', ' ', text)
    text = re.sub(r'`[^`]+`', ' ', text)
    text = re.sub(r'!\[.*?\]\(.*?\)', ' ', text)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    text = re.sub(r'https?://\S+', ' ', text)
    text = re.sub(r'[#*_~>|`]', ' ', text)
    text = re.sub(r'<[^>]+>', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def first_n_words(text: str, n: int = 100) -> str:
    words = text.split()
    return " ".join(words[:n])


def get_headings(text: str, level: int) -> list[str]:
    prefix = "#" * level + " "
    return [
        line[len(prefix):].strip()
        for line in text.splitlines()
        if line.startswith(prefix)
    ]


def count_internal_links(text: str) -> int:
    """Count links that point to jobrienhomes.com or relative paths."""
    internal_patterns = [
        r'\(https?://jobrienhomes\.com[^\)]*\)',
        r'\(/[^\)]+\)',        # relative link
        r'\(#[^\)]+\)',        # anchor link
    ]
    count = 0
    for pat in internal_patterns:
        count += len(re.findall(pat, text))
    return count


def count_external_links(text: str) -> int:
    """Count links to external sources (not jobrienhomes.com)."""
    all_links = re.findall(r'\(https?://[^\)]+\)', text)
    external = [l for l in all_links if "jobrienhomes.com" not in l]
    return len(external)


def get_image_alts(text: str) -> list[str]:
    """Extract alt text from Markdown images."""
    return re.findall(r'!\[([^\]]*)\]', text)


def load_published_keywords() -> list[str]:
    """Load primary keywords from published/keywords.csv."""
    csv_path = PROJECT_ROOT / "published" / "keywords.csv"
    if not csv_path.exists():
        return []
    keywords = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                kw = row.get("keyword", "").strip().lower()
                if kw:
                    keywords.append(kw)
    except Exception:
        pass
    return keywords


# ── Individual checks ─────────────────────────────────────────────────────────

def check_keyword_in_title(keyword: str, h1s: list[str]) -> dict:
    kw_lower = keyword.lower()
    for h1 in h1s:
        if kw_lower in h1.lower():
            return {"check": "keyword_in_title", "pass": True, "required": True,
                    "detail": f"Found in H1: \"{h1}\""}
    return {"check": "keyword_in_title", "pass": False, "required": True,
            "detail": f"Primary keyword \"{keyword}\" not found in any H1."}


def check_title_length(h1s: list[str]) -> dict:
    if not h1s:
        return {"check": "title_length", "pass": False, "required": True,
                "detail": "No H1 heading found."}
    h1 = h1s[0]
    if len(h1) <= 60:
        return {"check": "title_length", "pass": True, "required": True,
                "detail": f"H1 is {len(h1)} chars: \"{h1}\""}
    return {"check": "title_length", "pass": False, "required": True,
            "detail": f"H1 is {len(h1)} chars (max 60): \"{h1}\""}


def check_keyword_in_first_100(keyword: str, body_md: str) -> dict:
    opening = first_n_words(strip_markdown(body_md), 100)
    if keyword.lower() in opening.lower():
        return {"check": "keyword_in_first_100_words", "pass": True, "required": True,
                "detail": "Keyword found in first 100 words."}
    return {"check": "keyword_in_first_100_words", "pass": False, "required": True,
            "detail": f"Primary keyword \"{keyword}\" not found in first 100 words."}


def check_meta_description(meta: dict, keyword: str) -> dict:
    desc = meta.get("seo_description", "") or meta.get("meta_description", "")
    if not desc:
        return {"check": "meta_description", "pass": False, "required": True,
                "detail": "No seo_description in front matter."}
    length = len(desc)
    has_keyword = keyword.lower() in desc.lower()
    if 140 <= length <= 155 and has_keyword:
        return {"check": "meta_description", "pass": True, "required": True,
                "detail": f"{length} chars, keyword present."}
    issues = []
    if not (140 <= length <= 155):
        issues.append(f"{length} chars (need 140-155)")
    if not has_keyword:
        issues.append(f"keyword \"{keyword}\" not found")
    return {"check": "meta_description", "pass": False, "required": True,
            "detail": "; ".join(issues) + f". Value: \"{desc[:100]}\""}


def check_slug(meta: dict, keyword: str) -> dict:
    slug = meta.get("slug", "")
    if not slug:
        return {"check": "url_slug", "pass": False, "required": True,
                "detail": "No slug in front matter. Add: slug: your-keyword-slug"}
    issues = []
    if slug != slug.lower():
        issues.append("not lowercase")
    if " " in slug:
        issues.append("contains spaces (use hyphens)")
    if not re.match(r'^[a-z0-9-]+$', slug):
        issues.append("contains invalid characters (use lowercase letters, numbers, hyphens only)")
    kw_words = set(keyword.lower().split())
    slug_words = set(slug.split("-"))
    overlap = kw_words & slug_words
    if not overlap:
        issues.append(f"no keyword words found in slug (keyword: \"{keyword}\")")
    if issues:
        return {"check": "url_slug", "pass": False, "required": True,
                "detail": f"Slug \"{slug}\": " + "; ".join(issues)}
    return {"check": "url_slug", "pass": True, "required": True,
            "detail": f"Slug OK: \"{slug}\""}


def check_h2_count(body_md: str) -> dict:
    h2s = get_headings(body_md, 2)
    count = len(h2s)
    if 3 <= count <= 5:
        return {"check": "h2_count", "pass": True, "required": True,
                "detail": f"{count} H2 subheadings found."}
    return {"check": "h2_count", "pass": False, "required": True,
            "detail": f"{count} H2 subheadings (need 3-5). Found: {h2s}"}


def check_h2_has_geo(body_md: str) -> dict:
    h2s = get_headings(body_md, 2)
    for h2 in h2s:
        h2_lower = h2.lower()
        if any(city in h2_lower for city in SERVICE_AREA_CITIES):
            return {"check": "h2_geo_keyword", "pass": True, "required": False,
                    "detail": f"Geo keyword found in H2: \"{h2}\""}
    return {"check": "h2_geo_keyword", "pass": False, "required": False,
            "detail": "No H2 contains a city/geo keyword. Consider adding one."}


def check_internal_links(body_md: str) -> dict:
    count = count_internal_links(body_md)
    if count >= 2:
        return {"check": "internal_links", "pass": True, "required": True,
                "detail": f"{count} internal link(s) found."}
    return {"check": "internal_links", "pass": False, "required": True,
            "detail": f"{count} internal link(s) found (need at least 2). "
                      "Add links to other posts, home search, or contact page."}


def check_external_links(body_md: str) -> dict:
    count = count_external_links(body_md)
    if count >= 1:
        return {"check": "external_source_link", "pass": True, "required": True,
                "detail": f"{count} external source link(s) found."}
    return {"check": "external_source_link", "pass": False, "required": True,
            "detail": "No external source links found. Add at least 1 link to a stat source."}


def check_images(body_md: str) -> dict:
    alts = get_image_alts(body_md)
    if not alts:
        return {"check": "images", "pass": False, "required": True,
                "detail": "No images found. Add at least 1 image with descriptive alt text."}
    # Check alt text quality: should be descriptive (> 5 words) and geo-aware
    weak_alts = []
    for alt in alts:
        words = alt.split()
        has_geo = any(city in alt.lower() for city in SERVICE_AREA_CITIES) or \
                  "michigan" in alt.lower() or " mi" in alt.lower()
        if len(words) < 4 or not has_geo:
            weak_alts.append(alt)
    if weak_alts:
        return {"check": "images", "pass": False, "required": True,
                "detail": f"{len(alts)} image(s) found but alt text needs improvement: {weak_alts}. "
                          "Use descriptive, location-aware alt text."}
    return {"check": "images", "pass": True, "required": True,
            "detail": f"{len(alts)} image(s) with descriptive alt text."}


def check_michigan_mention(body_md: str) -> dict:
    plain = strip_markdown(body_md).lower()
    if "michigan" in plain or " mi " in plain or ", mi" in plain:
        return {"check": "michigan_mention", "pass": True, "required": True,
                "detail": "\"Michigan\" or \"MI\" found in post."}
    return {"check": "michigan_mention", "pass": False, "required": True,
            "detail": "Post doesn't mention \"Michigan\" or \"MI\". Add state context for search engines."}


def check_no_cannibalization(keyword: str) -> dict:
    published = load_published_keywords()
    kw_lower = keyword.lower()
    if kw_lower in published:
        return {"check": "no_keyword_cannibalization", "pass": False, "required": True,
                "detail": f"Keyword \"{keyword}\" already used in a published post. Choose a different primary keyword."}
    # Also warn on partial matches (>50% word overlap)
    kw_words = set(kw_lower.split())
    for existing in published:
        existing_words = set(existing.split())
        overlap = kw_words & existing_words
        if len(overlap) / max(len(kw_words), 1) > 0.6:
            return {"check": "no_keyword_cannibalization", "pass": False, "required": True,
                    "detail": f"Keyword \"{keyword}\" overlaps significantly with existing keyword \"{existing}\"."}
    return {"check": "no_keyword_cannibalization", "pass": True, "required": True,
            "detail": "No keyword cannibalization detected."}


def check_no_opening_greeting(body_md: str) -> dict:
    lines = [l.strip() for l in body_md.splitlines() if l.strip() and not l.strip().startswith("#")]
    if not lines:
        return {"check": "no_greeting_opener", "pass": True, "required": False, "detail": "No body text found."}
    first = lines[0].lower()
    greetings = ["hey there", "happy ", "hello ", "hi there", "good morning"]
    for g in greetings:
        if first.startswith(g):
            return {"check": "no_greeting_opener", "pass": False, "required": False,
                    "detail": f"Post opens with a greeting: \"{lines[0][:80]}\""}
    return {"check": "no_greeting_opener", "pass": True, "required": False,
            "detail": "Post opens without a greeting."}


def check_cta(body_md: str) -> dict:
    """Check for a soft CTA near the end of the post."""
    cta_phrases = [
        "happy to talk", "feel free", "give me a call", "shoot me a text",
        "drop me a line", "thinking about making a move", "reach out",
        "ready to talk", "text me", "let's talk", "browse homes",
        "contact", "get in touch",
    ]
    # Only check last 20% of post
    total_words = len(body_md.split())
    tail_start = max(0, int(total_words * 0.8))
    tail = " ".join(body_md.split()[tail_start:]).lower()
    for phrase in cta_phrases:
        if phrase in tail:
            return {"check": "cta_present", "pass": True, "required": False,
                    "detail": f"CTA found near end of post (contains \"{phrase}\")."}
    return {"check": "cta_present", "pass": False, "required": False,
            "detail": "No CTA found in last 20% of post. Add a soft call to action."}


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Run SEO pre-publish checklist on a blog draft.")
    parser.add_argument("--keyword", required=True, help="Primary keyword for this post (e.g. 'Kalamazoo housing market 2026')")
    parser.add_argument("--input", default="output/draft.md", help="Path to draft Markdown file")
    args = parser.parse_args()

    draft_path = Path(args.input)
    if not draft_path.exists():
        print(json.dumps({"error": f"Draft not found: {args.input}"}))
        sys.exit(1)

    raw_text = draft_path.read_text(encoding="utf-8")
    meta, body_md = parse_front_matter(raw_text)
    h1s = get_headings(body_md, 1)
    keyword = args.keyword.strip()

    checks = [
        check_keyword_in_title(keyword, h1s),
        check_title_length(h1s),
        check_keyword_in_first_100(keyword, body_md),
        check_meta_description(meta, keyword),
        check_slug(meta, keyword),
        check_h2_count(body_md),
        check_h2_has_geo(body_md),
        check_internal_links(body_md),
        check_external_links(body_md),
        check_images(body_md),
        check_michigan_mention(body_md),
        check_no_cannibalization(keyword),
        check_no_opening_greeting(body_md),
        check_cta(body_md),
    ]

    required_checks = [c for c in checks if c.get("required")]
    optional_checks = [c for c in checks if not c.get("required")]

    required_passed = sum(1 for c in required_checks if c["pass"])
    required_total = len(required_checks)
    optional_passed = sum(1 for c in optional_checks if c["pass"])
    optional_total = len(optional_checks)

    all_required_pass = required_passed == required_total
    failed_required = [c for c in required_checks if not c["pass"]]

    summary_parts = [f"Required: {required_passed}/{required_total}",
                     f"Optional: {optional_passed}/{optional_total}"]
    if failed_required:
        summary_parts.append(f"FAILED: {', '.join(c['check'] for c in failed_required)}")

    result = {
        "pass": all_required_pass,
        "keyword": keyword,
        "score": f"{required_passed + optional_passed}/{required_total + optional_total}",
        "required_score": f"{required_passed}/{required_total}",
        "checks": checks,
        "failed_required": [c["check"] for c in failed_required],
        "summary": " | ".join(summary_parts),
    }

    print(json.dumps(result, indent=2, ensure_ascii=False))
    sys.exit(0 if all_required_pass else 1)


if __name__ == "__main__":
    main()
