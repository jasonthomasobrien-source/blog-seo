#!/usr/bin/env python3
"""
dashboard.py — Local web dashboard for the West Michigan Blog workflow.

Run with: python3 dashboard.py
Opens at: http://localhost:5051

No Terminal commands needed once this is running.
"""

import csv
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from pathlib import Path

try:
    from flask import Flask, Response, jsonify, render_template, request, send_file, stream_with_context
except ImportError:
    print("Flask not installed. Run: pip3 install flask")
    sys.exit(1)

import logging as _logging
_logging.getLogger("werkzeug").setLevel(_logging.ERROR)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / "config" / ".env")
except ImportError:
    pass

PROJECT_ROOT = Path(__file__).parent
PYTHON = sys.executable

app = Flask(__name__, template_folder="templates")

_tasks: dict = {}
_task_lock = threading.Lock()


def _new_task_id() -> str:
    return f"task_{int(time.time() * 1000)}"


def _run_in_background(task_id: str, cmd: list) -> None:
    q = _tasks[task_id]
    try:
        proc = subprocess.Popen(
            [str(c) for c in cmd],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=str(PROJECT_ROOT),
            bufsize=1,
        )
        for line in proc.stdout:
            q.put(line.rstrip())
        proc.wait()
        q.put(f"__EXIT__{proc.returncode}")
    except Exception as e:
        q.put(f"ERROR: {e}")
        q.put("__EXIT__1")


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


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("dashboard.html")


@app.route("/status")
def status():
    def mtime(path: Path) -> str:
        if path.exists():
            t = path.stat().st_mtime
            return datetime.fromtimestamp(t).strftime("%b %d, %I:%M %p")
        return ""

    sources_path = PROJECT_ROOT / "logs" / "sources.md"
    draft_path   = PROJECT_ROOT / "output" / "draft.md"
    image_path   = PROJECT_ROOT / "output" / "hero_image.jpg"

    return jsonify({
        "sources":      sources_path.exists(),
        "draft":        draft_path.exists(),
        "image":        image_path.exists(),
        "sources_mtime": mtime(sources_path),
        "draft_mtime":   mtime(draft_path),
        "image_mtime":   mtime(image_path),
    })


@app.route("/run/<phase>", methods=["POST"])
def run_phase(phase):
    commands = {
        "research":      [PYTHON, "tools/research.py", "--output-file", "logs/research.json"],
        "write_draft":   [PYTHON, "tools/generate_draft.py"],
        "image":         [PYTHON, "tools/generate_image.py", "--from-draft", "output/draft.md",
                          "--area", "Kalamazoo, Michigan"],
        "seo_check":     [],  # handled specially — needs keyword arg
        "publish":       [PYTHON, "tools/send_notion.py", "--input", "output/draft.md"],
        "spellcheck":    [PYTHON, "tools/spellcheck.py", "--input", "output/draft.md"],
        "voice_check":   [PYTHON, "tools/voice_check.py", "--input", "output/draft.md"],
    }

    if phase == "seo_check":
        # Read current keyword from draft front matter
        draft_path = PROJECT_ROOT / "output" / "draft.md"
        keyword = ""
        if draft_path.exists():
            meta, _ = parse_front_matter(draft_path.read_text(encoding="utf-8"))
            keyword = meta.get("keyword", "")
        if not keyword:
            # Read from keyword.txt
            kw_path = PROJECT_ROOT / "config" / "keyword.txt"
            if kw_path.exists():
                lines = kw_path.read_text(encoding="utf-8").splitlines()
                keyword = next((l.strip() for l in lines if l.strip() and not l.startswith("#")), "")
        if not keyword:
            return jsonify({"error": "No keyword found. Set keyword in draft front matter or config/keyword.txt."}), 400
        cmd = [PYTHON, "tools/seo_check.py", "--keyword", keyword, "--input", "output/draft.md"]
    elif phase not in commands:
        return jsonify({"error": f"Unknown phase: {phase}"}), 400
    else:
        cmd = commands[phase]

    task_id = _new_task_id()
    with _task_lock:
        _tasks[task_id] = queue.Queue()

    thread = threading.Thread(target=_run_in_background, args=(task_id, cmd), daemon=True)
    thread.start()
    return jsonify({"task_id": task_id})


@app.route("/stream/<task_id>")
def stream(task_id):
    def generate():
        if task_id not in _tasks:
            yield "data: Task not found\n\n"
            return
        q = _tasks[task_id]
        while True:
            try:
                line = q.get(timeout=180)
                if line.startswith("__EXIT__"):
                    yield f"data: {line}\n\n"
                    break
                safe = line.replace("\n", " ")
                yield f"data: {safe}\n\n"
            except queue.Empty:
                yield "data: (timed out)\n\n"
                break

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@app.route("/suggest_topics", methods=["POST"])
def suggest_topics():
    """Run suggest_topics.py synchronously and return JSON results."""
    try:
        result = subprocess.run(
            [PYTHON, "tools/suggest_topics.py", "--count", "6"],
            capture_output=True, text=True, cwd=str(PROJECT_ROOT), timeout=60,
        )
        if result.returncode == 0:
            return jsonify(json.loads(result.stdout))
        else:
            err = result.stdout or result.stderr
            try:
                return jsonify(json.loads(err)), 500
            except Exception:
                return jsonify({"error": err or "suggest_topics failed"}), 500
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Timed out generating topic ideas. Try again."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/draft", methods=["GET"])
def get_draft():
    path = PROJECT_ROOT / "output" / "draft.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


@app.route("/draft", methods=["POST"])
def save_draft():
    content = request.get_data(as_text=True)
    path = PROJECT_ROOT / "output" / "draft.md"
    path.parent.mkdir(exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return jsonify({"success": True})


@app.route("/sources")
def get_sources():
    path = PROJECT_ROOT / "logs" / "sources.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    # Fall back to JSON research output
    json_path = PROJECT_ROOT / "logs" / "research.json"
    if json_path.exists():
        try:
            data = json.loads(json_path.read_text(encoding="utf-8"))
            lines = [f"Research: {data.get('area','')}, {data.get('timestamp','')}"]
            for item in data.get("news", [])[:10]:
                lines.append(f"\n• {item.get('title','')}\n  {item.get('snippet','')[:200]}")
            for stat in data.get("stats", []):
                lines.append(f"\n📊 {stat.get('metric','')}: {stat.get('value','')} ({stat.get('region','')})")
            return "\n".join(lines)
        except Exception:
            pass
    return "No research data yet. Run Step 1 first."


@app.route("/topic", methods=["GET"])
def get_topic():
    path = PROJECT_ROOT / "config" / "topic.txt"
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()
        return next((l.strip() for l in lines if l.strip() and not l.startswith("#")), "")
    return ""


@app.route("/topic", methods=["POST"])
def save_topic():
    data = request.get_json(silent=True) or {}
    topic = data.get("topic", request.get_data(as_text=True)).strip()
    keyword = data.get("keyword", "").strip()

    topic_path = PROJECT_ROOT / "config" / "topic.txt"
    topic_path.write_text(
        "# Blog post topic — set from dashboard\n#\n" + (topic + "\n" if topic else "\n"),
        encoding="utf-8"
    )

    if keyword:
        kw_path = PROJECT_ROOT / "config" / "keyword.txt"
        kw_path.write_text(
            "# Primary SEO keyword — set from dashboard\n#\n" + keyword + "\n",
            encoding="utf-8"
        )

    return jsonify({"success": True})


@app.route("/seo_fields")
def seo_fields():
    draft_path = PROJECT_ROOT / "output" / "draft.md"
    if not draft_path.exists():
        return jsonify({})
    text = draft_path.read_text(encoding="utf-8")
    meta, _ = parse_front_matter(text)

    seo_title = meta.get("seo_title") or meta.get("title", "")
    slug = meta.get("slug", "")
    if not slug and seo_title:
        slug = re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '-', seo_title.lower())).strip('-')
    keyword = meta.get("keyword", "")
    description = meta.get("seo_description", "")
    alt_text = meta.get("alt_text", "") or f"{seo_title} — West Michigan real estate"

    return jsonify({
        "title":       seo_title,
        "slug":        slug,
        "keyword":     keyword,
        "description": description,
        "alt_text":    alt_text,
        "cluster":     meta.get("cluster", ""),
        "dek":         meta.get("dek", ""),
    })


@app.route("/image_info")
def image_info():
    draft_path = PROJECT_ROOT / "output" / "draft.md"
    image_url = ""
    local_exists = (PROJECT_ROOT / "output" / "hero_image.jpg").exists()
    if draft_path.exists():
        meta, _ = parse_front_matter(draft_path.read_text(encoding="utf-8"))
        image_url = meta.get("image_url", "")
    return jsonify({"image_url": image_url, "local_exists": local_exists})


@app.route("/hero_image")
def hero_image():
    path = PROJECT_ROOT / "output" / "hero_image.jpg"
    if path.exists():
        return send_file(str(path), mimetype="image/jpeg",
                         as_attachment=True, download_name="hero_image.jpg")
    return "No image yet — run Step 3 first.", 404


@app.route("/check_anthropic_key")
def check_anthropic_key():
    key = os.getenv("ANTHROPIC_API_KEY", "")
    return jsonify({"set": bool(key and not key.startswith("sk-ant-YOUR"))})


@app.route("/published_keywords")
def published_keywords():
    csv_path = PROJECT_ROOT / "published" / "keywords.csv"
    keywords = []
    if csv_path.exists():
        try:
            with open(csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if row.get("keyword"):
                        keywords.append({
                            "keyword": row.get("keyword", ""),
                            "url": row.get("url", ""),
                            "date": row.get("date", ""),
                            "title": row.get("title", ""),
                        })
        except Exception:
            pass
    return jsonify({"keywords": keywords})


@app.route("/mark_published", methods=["POST"])
def mark_published():
    """Add current draft's keyword to published/keywords.csv."""
    draft_path = PROJECT_ROOT / "output" / "draft.md"
    if not draft_path.exists():
        return jsonify({"error": "No draft found"}), 400

    text = draft_path.read_text(encoding="utf-8")
    meta, _ = parse_front_matter(text)

    keyword = meta.get("keyword", "")
    title   = meta.get("title") or meta.get("seo_title", "")
    slug    = meta.get("slug", "")
    cluster = meta.get("cluster", "")
    url     = f"/blog/{slug}" if slug else ""
    date    = datetime.now().strftime("%Y-%m-%d")

    if not keyword:
        return jsonify({"error": "No keyword in draft front matter"}), 400

    csv_path = PROJECT_ROOT / "published" / "keywords.csv"
    file_exists = csv_path.exists()

    # Check for duplicate
    if file_exists:
        with open(csv_path, newline="", encoding="utf-8") as f:
            existing = [row.get("keyword", "").lower() for row in csv.DictReader(f)]
        if keyword.lower() in existing:
            return jsonify({"success": True, "note": "Keyword already in published list"})

    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["keyword", "url", "date", "title", "cluster"])
        if not file_exists:
            writer.writeheader()
        writer.writerow({"keyword": keyword, "url": url, "date": date,
                         "title": title, "cluster": cluster})

    return jsonify({"success": True, "keyword": keyword})


@app.route("/open_output")
def open_output():
    try:
        subprocess.Popen(["open", str(PROJECT_ROOT / "output")])
    except Exception:
        pass
    return jsonify({"success": True})


# ── Launch ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 55)
    print("  West Michigan Blog Dashboard")
    print("  Opening at http://localhost:5051")
    print("  Press Ctrl+C to stop")
    print("=" * 55)
    threading.Timer(1.5, lambda: webbrowser.open("http://localhost:5051")).start()
    app.run(host="127.0.0.1", port=5051, debug=False, use_reloader=False, threaded=True)
