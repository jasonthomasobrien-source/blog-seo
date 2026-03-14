#!/usr/bin/env python3
"""
tools/research.py — Gather West Michigan real estate market data and news.

Three-layer pipeline:
  1. Tavily Search API (current news + stats, past week)
  2. Zillow Research public CSVs (median price, DOM, inventory — monthly)
  3. GKAR website scrape (Greater Kalamazoo Association of REALTORS)
  4. Manual CLI fallback (--no-api flag)

Returns JSON to stdout. Exit 0 on success, 1 on failure.

Usage:
    python3 tools/research.py --area "Kalamazoo" [--topic "optional override"]
    python3 tools/research.py --no-api  # manual entry mode
"""

import argparse
import csv
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
    from dotenv import load_dotenv
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}. Run: pip3 install -r requirements.txt"}))
    sys.exit(1)

# Load .env from project root (two levels up from tools/)
PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / "config" / ".env")

ZILLOW_CSVS = {
    "median_sale_price": (
        "https://files.zillowstatic.com/research/public_csvs/zhvi/"
        "Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv"
    ),
    "days_on_market": (
        "https://files.zillowstatic.com/research/public_csvs/dom/"
        "Metro_median_dom_uc_sfrcondo_sm_month.csv"
    ),
    "inventory": (
        "https://files.zillowstatic.com/research/public_csvs/invt/"
        "Metro_invt_fs_uc_sfrcondo_sm_month.csv"
    ),
}
GKAR_URL = "https://www.gkar.com/market-statistics/"
KALAMAZOO_MSA = "Kalamazoo"  # Partial match — Zillow uses "Kalamazoo-Portage, MI"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


# ── Layer 1: Tavily Search ────────────────────────────────────────────────────

def fetch_tavily_news(area: str, topic: str | None) -> tuple[list, list]:
    """Return (news_items, sources) using the Tavily Search API."""
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key or api_key == "your_tavily_api_key_here":
        print("Warning: TAVILY_API_KEY not set — skipping news search.", file=sys.stderr)
        return [], []

    try:
        from tavily import TavilyClient
    except ImportError:
        print("Warning: tavily-python not installed. Run: pip3 install tavily-python", file=sys.stderr)
        return [], []

    client = TavilyClient(api_key=api_key)
    now = datetime.now()
    month_year = now.strftime("%B %Y")

    queries = [
        f"Kalamazoo real estate market {month_year}",
        f"Portage Michigan home prices housing market {month_year}",
        f"Plainwell Otsego Richland Michigan real estate {month_year}",
        f"West Michigan housing inventory days on market {month_year}",
        f"Kalamazoo County mortgage rates home buyers {month_year}",
    ]
    if topic:
        queries.insert(0, f"{topic} Kalamazoo Portage West Michigan real estate {month_year}")

    news_items = []
    sources = []
    seen_urls = set()

    for query in queries:
        try:
            response = client.search(
                query=query,
                search_depth="advanced",
                max_results=5,
                days=7,              # Only results from the past 7 days
                include_answer=False,
            )
            for item in response.get("results", []):
                url = item.get("url", "")
                if url in seen_urls:
                    continue
                seen_urls.add(url)

                entry = {
                    "title": item.get("title", ""),
                    "url": url,
                    "snippet": item.get("content", "")[:400],
                    "query": query,
                    "date": item.get("published_date", ""),
                    "score": item.get("score", 0),
                    "source": "tavily_search",
                }
                news_items.append(entry)
                sources.append({"type": "web", "title": entry["title"], "url": url, "query": query})

        except Exception as e:
            print(f"Warning: Tavily search failed for '{query}': {e}", file=sys.stderr)

    # Sort by relevance score (highest first)
    news_items.sort(key=lambda x: x.get("score", 0), reverse=True)

    return news_items, sources


# ── Layer 2: Zillow Research CSVs ─────────────────────────────────────────────

def fetch_zillow_stats() -> tuple[list, list]:
    """Return (stats, sources) from Zillow public research CSVs."""
    stats = []
    sources = []

    for metric, url in ZILLOW_CSVS.items():
        try:
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()

            reader = csv.DictReader(io.StringIO(resp.text))
            for row in reader:
                region = row.get("RegionName", "")
                if KALAMAZOO_MSA.lower() not in region.lower():
                    continue

                # Find the most recent date column (rightmost)
                date_cols = [k for k in row.keys() if re.match(r'\d{4}-\d{2}-\d{2}', k)]
                if not date_cols:
                    break
                date_cols.sort()
                latest_date = date_cols[-1]
                value = row.get(latest_date, "")

                if value and value not in ("", "NA", "N/A"):
                    stats.append({
                        "metric": metric,
                        "value": value,
                        "region": region,
                        "date": latest_date,
                        "freshness": "monthly",
                        "source": "zillow_research",
                    })
                    sources.append({
                        "type": "zillow_csv",
                        "metric": metric,
                        "url": url,
                        "region": region,
                        "date": latest_date,
                    })
                break  # Only need the Kalamazoo row

        except Exception as e:
            print(f"Warning: Zillow CSV fetch failed for {metric}: {e}", file=sys.stderr)

    return stats, sources


# ── Layer 3: GKAR Scrape ───────────────────────────────────────────────────────

def fetch_gkar_stats() -> tuple[list, list]:
    """Scrape GKAR market statistics page. Graceful fallback on failure."""
    try:
        resp = requests.get(GKAR_URL, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        stats = []
        sources = []

        # Look for numeric stat blocks — structure varies by site build.
        # Strategy: find elements containing common stat labels.
        stat_labels = {
            "median": "median_sale_price_gkar",
            "average": "average_sale_price_gkar",
            "sold": "units_sold_gkar",
            "listed": "new_listings_gkar",
            "days": "days_on_market_gkar",
            "inventory": "months_supply_gkar",
        }

        for label, metric_key in stat_labels.items():
            # Search for elements whose text contains the label
            candidates = soup.find_all(string=lambda t: t and label.lower() in t.lower())
            for cand in candidates[:2]:
                parent = cand.parent
                # Look for a sibling or nearby element with a numeric value
                value_el = parent.find_next(string=lambda t: t and re.search(r'\$[\d,]+|\d+[\.,]\d+|\d{2,}', t))
                if value_el:
                    stats.append({
                        "metric": metric_key,
                        "value": value_el.strip(),
                        "region": "Greater Kalamazoo (GKAR)",
                        "date": datetime.now().strftime("%Y-%m-%d"),
                        "freshness": "monthly",
                        "source": "gkar_scrape",
                    })
                    break

        sources.append({"type": "gkar_website", "url": GKAR_URL, "scraped_at": datetime.now().isoformat()})
        return stats, sources

    except Exception as e:
        print(f"Warning: GKAR scrape failed: {e}. Continuing without GKAR data.", file=sys.stderr)
        return [], []


# ── Layer 4: Manual Fallback ───────────────────────────────────────────────────

def prompt_manual_entry() -> tuple[list, list]:
    """Interactive CLI prompt for manual stat entry."""
    print("\nManual data entry mode (--no-api). Press Enter to skip a field.\n", file=sys.stderr)
    fields = [
        ("median_sale_price", "Median sale price (e.g. 285000)"),
        ("days_on_market", "Median days on market (e.g. 14)"),
        ("inventory", "Months of inventory (e.g. 1.8)"),
        ("list_to_sale_ratio", "List-to-sale price ratio (e.g. 101.2%)"),
        ("new_listings", "New listings this month (e.g. 312)"),
    ]
    stats = []
    for key, label in fields:
        try:
            val = input(f"  {label}: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if val:
            stats.append({
                "metric": key,
                "value": val,
                "region": "Kalamazoo (manual entry)",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "freshness": "manual",
                "source": "manual",
            })
    sources = [{"type": "manual", "note": "Stats entered by user via CLI", "date": datetime.now().isoformat()}]
    return stats, sources


# ── Freshness validation ───────────────────────────────────────────────────────

def validate_freshness(results: dict) -> None:
    """Warn (non-fatal) if no data within the last 7 days."""
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=7)
    fresh_news = [n for n in results["news"] if n.get("date")]
    # Brave items are already filtered to "past week" via freshness=pw param.
    if not fresh_news and not results["stats"]:
        print(
            "Warning: No recent market data found. All stats may be outdated. "
            "Consider running with --no-api to enter stats manually, "
            "or verify your TAVILY_API_KEY in config/.env.",
            file=sys.stderr,
        )


# ── Main ───────────────────────────────────────────────────────────────────────

import re  # noqa: E402  (re imported here to satisfy forward reference in fetch_zillow_stats)


def main():
    parser = argparse.ArgumentParser(description="Gather West Michigan real estate market data.")
    parser.add_argument("--area", default="Kalamazoo", help="Primary market area name")
    parser.add_argument("--topic", default="", help="Optional topic override for search queries")
    parser.add_argument("--no-api", action="store_true", help="Skip API calls; use manual entry")
    parser.add_argument("--output-file", default="", help="Write JSON output to a file instead of stdout")
    args = parser.parse_args()

    results = {
        "area": args.area,
        "topic": args.topic or None,
        "timestamp": datetime.now().isoformat(),
        "stats": [],
        "news": [],
        "sources": [],
    }

    if args.no_api:
        stats, sources = prompt_manual_entry()
        results["stats"] = stats
        results["sources"] = sources
    else:
        # Layer 1: Tavily Search
        news, news_sources = fetch_tavily_news(args.area, args.topic or None)
        results["news"].extend(news)
        results["sources"].extend(news_sources)

        # Layer 2: Zillow CSVs
        zillow_stats, zillow_sources = fetch_zillow_stats()
        results["stats"].extend(zillow_stats)
        results["sources"].extend(zillow_sources)

        # Layer 3: GKAR scrape
        gkar_stats, gkar_sources = fetch_gkar_stats()
        results["stats"].extend(gkar_stats)
        results["sources"].extend(gkar_sources)

    validate_freshness(results)

    output_json = json.dumps(results, indent=2, ensure_ascii=False)

    if args.output_file:
        Path(args.output_file).write_text(output_json, encoding="utf-8")
        print(json.dumps({"success": True, "output_file": args.output_file, "stats_count": len(results["stats"]), "news_count": len(results["news"])}))
    else:
        print(output_json)

    sys.exit(0)


if __name__ == "__main__":
    main()
