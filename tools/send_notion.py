#!/usr/bin/env python3
"""
tools/send_notion.py — Push finished blog post draft to a Notion database.

Creates a new page in the specified Notion database with the blog post
metadata as page properties and the Markdown content stored as a code block.

Usage:
    python3 tools/send_notion.py [--input output/draft.md] [--title "..."] [--slug "..."]

Returns JSON to stdout. Exit 0 on success, 1 on failure.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from notion_client import Client
    from notion_client.errors import APIResponseError
except ImportError:
    print(json.dumps({"error": "notion-client not installed. Run: pip3 install notion-client"}))
    sys.exit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    print(json.dumps({"error": "python-dotenv not installed. Run: pip3 install python-dotenv"}))
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / "config" / ".env")

NOTION_CHUNK_SIZE = 1900  # Stay under the 2000-char limit


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Extract YAML-style front matter. Returns (meta_dict, body_text)."""
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


def md_to_notion_blocks(md_text: str) -> list:
    """
    Convert Markdown to basic Notion blocks (headings, paragraphs, bullets).
    Falls back to a single code block for anything complex.
    """
    blocks = []
    lines = md_text.splitlines()
    i = 0

    while i < len(lines):
        line = lines[i]

        # H1
        if line.startswith("# "):
            blocks.append({
                "object": "block", "type": "heading_1",
                "heading_1": {"rich_text": [{"type": "text", "text": {"content": line[2:].strip()}}]},
            })
        # H2
        elif line.startswith("## "):
            blocks.append({
                "object": "block", "type": "heading_2",
                "heading_2": {"rich_text": [{"type": "text", "text": {"content": line[3:].strip()}}]},
            })
        # H3
        elif line.startswith("### "):
            blocks.append({
                "object": "block", "type": "heading_3",
                "heading_3": {"rich_text": [{"type": "text", "text": {"content": line[4:].strip()}}]},
            })
        # Bullet list
        elif line.startswith("- ") or line.startswith("* "):
            blocks.append({
                "object": "block", "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": line[2:].strip()}}]},
            })
        # Horizontal rule → divider
        elif line.strip() in ("---", "***", "___"):
            blocks.append({"object": "block", "type": "divider", "divider": {}})
        # Non-empty line → paragraph
        elif line.strip():
            # Strip basic markdown formatting for display
            clean = re.sub(r'\*\*(.+?)\*\*', r'\1', line)
            clean = re.sub(r'\*(.+?)\*', r'\1', clean)
            clean = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', clean)
            # Truncate to Notion's 2000-char limit per rich_text
            if len(clean) > 1990:
                clean = clean[:1990] + "…"
            blocks.append({
                "object": "block", "type": "paragraph",
                "paragraph": {"rich_text": [{"type": "text", "text": {"content": clean}}]},
            })
        # Empty line → skip (Notion handles spacing)

        i += 1

    return blocks


def main():
    parser = argparse.ArgumentParser(description="Push blog post draft to Notion database.")
    parser.add_argument("--input", default="output/draft.md", help="Path to draft Markdown file")
    parser.add_argument("--title", default="", help="Page title override")
    parser.add_argument("--slug", default="", help="URL slug override")
    parser.add_argument("--keyword", default="", help="Primary keyword override")
    parser.add_argument("--date", default="", help="ISO date override (default: today)")
    args = parser.parse_args()

    # ── Validate credentials ───────────────────────────────────────────────────
    api_key = os.getenv("NOTION_API_KEY", "")
    db_id = os.getenv("NOTION_DATABASE_ID", "")

    if not api_key or api_key == "your_notion_api_key_here":
        print(json.dumps({"error": "NOTION_API_KEY not set in config/.env"}))
        sys.exit(1)
    if not db_id or db_id == "your_notion_database_id_here":
        print(json.dumps({"error": "NOTION_DATABASE_ID not set in config/.env"}))
        sys.exit(1)

    # ── Read draft ─────────────────────────────────────────────────────────────
    draft_path = Path(args.input)
    if not draft_path.exists():
        print(json.dumps({"error": f"Draft not found: {args.input}"}))
        sys.exit(1)

    raw_text = draft_path.read_text(encoding="utf-8")
    meta, body_md = parse_front_matter(raw_text)

    # ── Resolve metadata ───────────────────────────────────────────────────────
    today = args.date or datetime.now().strftime("%Y-%m-%d")
    title = args.title or meta.get("seo_title") or meta.get("title") or f"Blog Post — {today}"
    slug = args.slug or meta.get("slug") or ""
    keyword = args.keyword or meta.get("keyword") or meta.get("primary_keyword") or ""

    # ── Convert markdown to Notion blocks ─────────────────────────────────────
    content_blocks = md_to_notion_blocks(body_md)

    # Also store raw markdown in a toggle for easy copying
    raw_chunks = [body_md[i:i + NOTION_CHUNK_SIZE] for i in range(0, len(body_md), NOTION_CHUNK_SIZE)]
    raw_code_blocks = [
        {
            "object": "block", "type": "code",
            "code": {
                "rich_text": [{"type": "text", "text": {"content": chunk}}],
                "language": "markdown",
            },
        }
        for chunk in raw_chunks
    ]

    divider = {"object": "block", "type": "divider", "divider": {}}
    source_heading = {
        "object": "block", "type": "heading_3",
        "heading_3": {"rich_text": [{"type": "text", "text": {"content": "Raw Markdown (for copy/paste)"}}]},
    }

    children = content_blocks + [divider, source_heading] + raw_code_blocks

    # Notion API limit: 100 blocks per request
    children = children[:100]

    # ── Create Notion page ────────────────────────────────────────────────────
    try:
        notion = Client(auth=api_key)

        db_info = notion.databases.retrieve(db_id)
        db_props = db_info.get("properties", {})

        properties = {}

        # Title property (required)
        title_prop_name = "title"
        for prop_name, prop_info in db_props.items():
            if prop_info.get("type") == "title":
                title_prop_name = prop_name
                break
        properties[title_prop_name] = {
            "title": [{"type": "text", "text": {"content": title}}]
        }

        # Date
        if "Date" in db_props and db_props["Date"].get("type") == "date":
            properties["Date"] = {"date": {"start": today}}

        # Status
        if "Status" in db_props and db_props["Status"].get("type") == "select":
            properties["Status"] = {"select": {"name": "Draft"}}

        # Slug (rich_text)
        if slug and "Slug" in db_props and db_props["Slug"].get("type") == "rich_text":
            properties["Slug"] = {"rich_text": [{"type": "text", "text": {"content": slug}}]}

        # Keyword (rich_text)
        if keyword and "Keyword" in db_props and db_props["Keyword"].get("type") == "rich_text":
            properties["Keyword"] = {"rich_text": [{"type": "text", "text": {"content": keyword}}]}

        response = notion.pages.create(
            parent={"database_id": db_id},
            properties=properties,
            children=children,
        )

        page_url = response.get("url", "")
        page_id = response.get("id", "")

        result = {
            "success": True,
            "page_url": page_url,
            "page_id": page_id,
            "title": title,
            "date": today,
            "slug": slug,
        }
        print(json.dumps(result))
        sys.exit(0)

    except APIResponseError as e:
        error_body = str(e)
        hint = ""
        if "Could not find database" in error_body or "object_not_found" in error_body:
            hint = " Verify NOTION_DATABASE_ID and that the integration has access to the database."
        print(json.dumps({"error": f"Notion API error: {error_body}{hint}", "success": False}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}))
        sys.exit(1)


if __name__ == "__main__":
    main()
