#!/usr/bin/env python3
"""
tools/generate_image.py — Fetch or generate a hero image for the newsletter.

Priority:
  1. Unsplash API (real photos) — if UNSPLASH_ACCESS_KEY is set in config/.env
  2. Leonardo AI (AI-generated) — if LEONARDO_API_KEY is set

Also downloads the image to output/hero_image.jpg for easy upload to GHL.

Usage:
    python3 tools/generate_image.py --prompt "Kalamazoo neighborhood, spring morning"
    python3 tools/generate_image.py --from-draft output/draft.md

Returns JSON to stdout:
    {"success": true, "image_url": "https://...", "local_path": "output/hero_image.jpg"}

Exit 0 on success, 1 on failure.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

try:
    import requests
    from dotenv import load_dotenv
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}. Run: pip3 install -r requirements.txt"}))
    sys.exit(1)

PROJECT_ROOT = Path(__file__).parent.parent
load_dotenv(PROJECT_ROOT / "config" / ".env")

LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1"

# Leonardo Phoenix — their highest-quality model as of 2025
# Override with LEONARDO_MODEL_ID in .env if you prefer a different model
DEFAULT_MODEL_ID = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3"  # Leonardo Phoenix 1.0

# Style preset optimized for real estate / architectural photography
DEFAULT_STYLE = "PHOTOGRAPHY"

# 1200×800 — 3:2 ratio matching GHL cover image format (600×400 × 2x), both divisible by 8
IMAGE_WIDTH = 1200
IMAGE_HEIGHT = 800

POLL_INTERVAL = 3   # seconds between status checks
MAX_POLL_ATTEMPTS = 40  # max ~2 minutes

LOCAL_IMAGE_PATH = PROJECT_ROOT / "output" / "hero_image.jpg"


# ── Unsplash (real photos) ─────────────────────────────────────────────────────

def build_unsplash_query(prompt: str, area: str = "Kalamazoo, Michigan") -> str:
    """Convert an image_prompt into a concise Unsplash search query."""
    # Strip style descriptors, keep location/subject keywords
    stop_words = {
        "professional", "photography", "style", "warm", "natural", "golden",
        "hour", "lighting", "sharp", "focus", "high", "resolution", "welcoming",
        "residential", "neighborhood", "atmosphere", "no", "text", "watermarks",
        "people", "aerial", "view", "quiet", "overcast", "midwest", "sky",
        "modest", "single", "family", "homes", "two", "car", "garages",
    }
    words = re.sub(r'[^a-zA-Z\s]', ' ', prompt.lower()).split()
    keywords = [w for w in words if w not in stop_words and len(w) > 3][:6]
    # Always anchor to Michigan real estate context
    keywords = ["michigan", "neighborhood", "house"] + [k for k in keywords if k not in ("michigan", "neighborhood", "house")]
    return " ".join(keywords[:6])


def fetch_unsplash(prompt: str, area: str, api_key: str) -> str:
    """Fetch a real photo from Unsplash. Returns the image URL or '' on failure."""
    query = build_unsplash_query(prompt, area)
    print(f"Unsplash search: {query!r}", file=sys.stderr)

    try:
        resp = requests.get(
            "https://api.unsplash.com/photos/random",
            params={
                "query": query,
                "orientation": "landscape",
                "content_filter": "high",
            },
            headers={"Authorization": f"Client-ID {api_key}"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        # Use the "regular" size (1080px wide) — good for GHL
        url = data.get("urls", {}).get("regular", "")
        if url:
            print(f"Unsplash photo by {data.get('user', {}).get('name', '?')}", file=sys.stderr)
        return url
    except Exception as e:
        print(f"Unsplash failed: {e}", file=sys.stderr)
        return ""


def download_image(url: str) -> str:
    """Download image URL to output/hero_image.jpg. Returns local path or ''."""
    try:
        LOCAL_IMAGE_PATH.parent.mkdir(exist_ok=True)
        resp = requests.get(url, timeout=30, stream=True)
        resp.raise_for_status()
        with open(LOCAL_IMAGE_PATH, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Image saved: {LOCAL_IMAGE_PATH}", file=sys.stderr)
        return str(LOCAL_IMAGE_PATH)
    except Exception as e:
        print(f"Image download failed: {e}", file=sys.stderr)
        return ""


def build_prompt(user_prompt: str, area: str = "Kalamazoo, Michigan") -> str:
    """
    Enhance a bare topic prompt into a full image generation prompt
    tuned for West Michigan real estate photography.
    """
    base = user_prompt.strip()

    # If the prompt is very short (< 20 chars), expand it
    if len(base) < 20:
        base = f"{base}, {area} real estate"

    enhancement = (
        "professional real estate photography style, "
        "warm natural golden-hour lighting, "
        "sharp focus, high resolution, "
        "welcoming residential neighborhood atmosphere, "
        "no text, no watermarks, no people"
    )

    return f"{base}. {enhancement}"


def parse_front_matter_prompt(draft_path: Path) -> str:
    """Extract image_prompt from draft front matter."""
    text = draft_path.read_text(encoding="utf-8")
    if not text.lstrip().startswith("---"):
        return ""
    parts = text.lstrip().split("---", 2)
    if len(parts) < 3:
        return ""
    for line in parts[1].strip().splitlines():
        if line.strip().lower().startswith("image_prompt"):
            _, _, value = line.partition(":")
            return value.strip()
    return ""


def generate(prompt: str, api_key: str) -> dict:
    """Submit a generation request to Leonardo AI. Returns the generation ID."""
    model_id = os.getenv("LEONARDO_MODEL_ID", DEFAULT_MODEL_ID)

    payload = {
        "prompt": prompt,
        "modelId": model_id,
        "width": IMAGE_WIDTH,
        "height": IMAGE_HEIGHT,
        "num_images": 1,
        "public": False,
        "presetStyle": DEFAULT_STYLE,
        "guidance_scale": 7,
    }

    resp = requests.post(
        f"{LEONARDO_API_BASE}/generations",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    generation_id = (
        data.get("sdGenerationJob", {}).get("generationId")
        or data.get("generationId")
    )
    if not generation_id:
        raise ValueError(f"No generation ID in response: {data}")

    return generation_id


def poll_for_result(generation_id: str, api_key: str) -> str:
    """Poll until the generation completes. Returns the image URL."""
    url = f"{LEONARDO_API_BASE}/generations/{generation_id}"
    headers = {"Authorization": f"Bearer {api_key}"}

    for attempt in range(MAX_POLL_ATTEMPTS):
        time.sleep(POLL_INTERVAL)

        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        generation = data.get("generations_by_pk") or data.get("generation", {})
        status = generation.get("status", "").upper()

        if status == "COMPLETE":
            images = generation.get("generated_images", [])
            if images:
                return images[0].get("url", "")
            raise ValueError("Generation complete but no images returned.")

        if status in ("FAILED", "DELETED"):
            raise ValueError(f"Generation {status.lower()}: {generation}")

        print(
            f"  [{attempt + 1}/{MAX_POLL_ATTEMPTS}] Status: {status} — waiting...",
            file=sys.stderr,
        )

    raise TimeoutError(f"Generation did not complete after {MAX_POLL_ATTEMPTS * POLL_INTERVAL}s")


def main():
    parser = argparse.ArgumentParser(description="Fetch or generate a hero image.")
    parser.add_argument("--prompt", default="", help="Image generation prompt")
    parser.add_argument("--from-draft", default="", help="Extract image_prompt from this draft file")
    parser.add_argument("--area", default="Kalamazoo, Michigan", help="Market area (used to enrich prompt)")
    parser.add_argument("--output-url-file", default="", help="Write just the URL to this file")
    args = parser.parse_args()

    # ── Resolve prompt ─────────────────────────────────────────────────────────
    prompt = args.prompt
    if not prompt and args.from_draft:
        draft_path = Path(args.from_draft)
        if draft_path.exists():
            prompt = parse_front_matter_prompt(draft_path)
    if not prompt:
        prompt = "Residential neighborhood in West Michigan, craftsman-style homes, tree-lined street, spring morning"
        print(f"No prompt provided — using default: {prompt}", file=sys.stderr)

    image_url = ""
    source = ""

    # ── Option 1: Unsplash (real photos) ──────────────────────────────────────
    unsplash_key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if unsplash_key and unsplash_key != "your_unsplash_access_key_here":
        print("Trying Unsplash for a real photo...", file=sys.stderr)
        image_url = fetch_unsplash(prompt, args.area, unsplash_key)
        if image_url:
            source = "unsplash"

    # ── Option 2: Leonardo AI (AI-generated fallback) ─────────────────────────
    if not image_url:
        leonardo_key = os.getenv("LEONARDO_API_KEY", "")
        if not leonardo_key or leonardo_key == "your_leonardo_api_key_here":
            print(json.dumps({"error": "No image source configured. Set UNSPLASH_ACCESS_KEY or LEONARDO_API_KEY in config/.env"}))
            sys.exit(1)

        full_prompt = build_prompt(prompt, args.area)
        print(f"Generating image via Leonardo...\nPrompt: {full_prompt}", file=sys.stderr)

        try:
            generation_id = generate(full_prompt, leonardo_key)
            print(f"Generation ID: {generation_id}", file=sys.stderr)
            image_url = poll_for_result(generation_id, leonardo_key)
            source = "leonardo"
        except requests.HTTPError as e:
            status_code = e.response.status_code if e.response else "?"
            body = e.response.text[:300] if e.response else ""
            if status_code == 401:
                msg = "Leonardo API authentication failed. Verify LEONARDO_API_KEY in config/.env."
            elif status_code == 402:
                msg = "Leonardo API: insufficient tokens. Add more tokens at app.leonardo.ai."
            else:
                msg = f"Leonardo API HTTP {status_code}: {body}"
            print(json.dumps({"error": msg, "success": False}))
            sys.exit(1)
        except Exception as e:
            print(json.dumps({"error": str(e), "success": False}))
            sys.exit(1)

    if not image_url:
        print(json.dumps({"error": "Image generation failed — no URL returned.", "success": False}))
        sys.exit(1)

    # ── Download image locally ─────────────────────────────────────────────────
    local_path = download_image(image_url)

    if args.output_url_file:
        Path(args.output_url_file).write_text(image_url)

    result = {
        "success": True,
        "image_url": image_url,
        "local_path": local_path,
        "source": source,
        "prompt": prompt,
    }
    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
