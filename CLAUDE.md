# CLAUDE.md — West Michigan Real Estate Blog

> **Source of Truth** for this project. Claude Code reads this file to understand the objective, follow the workflow, and use the right tools.

---

## Project Overview

**Project Name:** West Michigan Real Estate Blog
**Objective:** Research and write SEO-optimized blog posts about West Michigan real estate, targeting local searches across the Kalamazoo-area service area, then publish via Notion and/or the website.
**Owner:** Jason O'Brien — REALTOR® / Buyer's Agent, PREMIERE Group at Real Broker, LLC | Homes for Heroes® Affiliate
**Website:** jobrienhomes.com
**Service Area:** Kalamazoo, Portage, Plainwell, Otsego, Allegan County, Kalamazoo County, and surrounding West Michigan communities (full city list in SEO Rules below)
**Last Updated:** [Date]

---

## Workflow

### Steps

1. **Topic & Keyword Selection** — Determine the blog post topic and primary keyword:
   - If a topic is specified in `config/topic.txt`, use that
   - Otherwise, follow the Publishing Cadence priority rotation (see SEO Rules)
   - Confirm the primary keyword hasn't already been targeted by an existing post (no cannibalization)
   - Select 2–3 secondary keywords (related terms, nearby city variants)

2. **Research** — Gather current, relevant data for the post:
   - Local market stats (median home prices, days on market, inventory levels) for the target city/area
   - Community details: schools, commute times, neighborhoods, amenities, population
   - Any notable interest rate updates or mortgage news (if writing a market update)
   - Regional stories (new developments, zoning changes, community events, seasonal tips)
   - Log all sources to `logs/sources.md`

3. **Outline** — Before writing, produce a short outline in `logs/outline.md`:
   - Post title (H1) — must include primary keyword, under 60 characters
   - URL slug — clean, lowercase, hyphenated, keyword-rich
   - Meta description — 140–155 characters, includes primary keyword, written as a hook
   - 3–5 H2 section headers (at least one with a secondary keyword or city name)
   - One-sentence summary of each section
   - Confirm outline aligns with the Voice & Tone rules and SEO Rules below before proceeding

4. **Write** — Draft the full blog post in Markdown (`output/draft.md`):
   - Follow the Voice & Tone rules exactly
   - Follow the SEO Rules exactly
   - Primary keyword in title, first 100 words, and at least one H2
   - Weave in researched data naturally — cite stats but don't dump tables
   - Include at least 2 internal links (other blog posts, home search, contact, Homes for Heroes page)
   - Include at least 1 external source link for any stats cited
   - Include a soft CTA at the end that ties back to Jason's business without being pushy
   - Target length per post type:
     - Community guides / pillar content: 1,200–2,500 words
     - Standard posts: 800–1,200 words
     - Market updates: 500–1,000 words
     - Cost of living guides: 1,000–1,500 words

5. **Review** — Run quality checks before publishing:
   - Spell check
   - Confirm no AI-sounding phrases slipped through (see banned words list)
   - Verify all stats have a source noted in `logs/sources.md`
   - Run the Pre-Publish Checklist (see SEO Rules)
   - Read the post out loud — if it sounds like a robot wrote it, rewrite

6. **Publish** — Deliver the finished blog post:
   - Save to Notion page (via MCP or API) under the Blog database
   - If website publishing is enabled in `config/delivery.txt`, push to site
   - Share as a Google Business Profile update within 48 hours
   - Log delivery status to `logs/run.log`

### Success Criteria

- [ ] Blog post reads like a local expert wrote it, not an AI
- [ ] All market data is sourced and current (within the last 7 days if citing stats)
- [ ] Primary keyword appears in: title, URL slug, meta description, H1, first 100 words
- [ ] At least 2 internal links and 1 external source link
- [ ] At least 1 image with descriptive, location-aware alt text
- [ ] No banned AI-voice words or phrases
- [ ] Post passes the Pre-Publish Checklist
- [ ] Published to at least one destination (Notion or website)

---

## Agent Rules

### General

- Follow the Workflow steps in order. Do not skip the Outline step.
- If a Tool fails, read the error, fix the script, retry up to 3 times, then stop and report.
- Do not fabricate market data. If a stat can't be verified, leave it out.
- Log every major action to `logs/run.log` with a timestamp.

### Planning

- Enter Plan Mode first. Outline what you'll research and why before making any tool calls.
- Minimize token usage — no over-explaining. Execute the plan.

### Error Handling

- On failure: read traceback → identify root cause → patch → retry.
- 3 consecutive failures on the same step = stop and surface with full context.
- Never silently skip a failed step or publish a broken post.

---

## Voice & Tone

<!-- This is the most important section. The blog MUST sound human. -->

### Write Like This

- Casual, direct, first-person. Like a knowledgeable neighbor who happens to sell houses.
- Short sentences. Punchy. Conversational paragraph breaks.
- Use "you" and "your" — talk directly to the reader.
- Local references are gold. Mention actual neighborhoods, streets, landmarks, restaurants.
- Opinions are welcome. "I think this market is going to stay competitive through summer" > "The market may remain competitive."
- Humor is fine when it's natural. Don't force it.

### Never Do This

- Do not use any of these words/phrases (they scream AI):
  - "landscape" (when not talking about actual landscaping)
  - "navigate" (when not giving directions)
  - "ever-changing"
  - "dive in" / "let's dive in" / "deep dive"
  - "in today's market" as an opener
  - "whether you're a first-time buyer or seasoned investor"
  - "it's important to note"
  - "at the end of the day"
  - "game-changer"
  - "leverage" (as a verb, unless talking about actual financial leverage)
  - "robust"
  - "streamline"
  - "stay tuned"
  - "exciting times"
  - "without further ado"
  - "buckle up"
- Do not use more than one exclamation point per blog post.
- Do not start more than one sentence with "I" in a row.
- No clichés. No filler. Every sentence should earn its spot.
- Never explain what a blog is or why market updates matter. Just deliver the content.
- Do not use emojis in the body. One in the title is acceptable if it fits.

### Structural Rules

- **Title (H1):** Under 60 characters. Include primary keyword. Specific > clever. Good: "Kalamazoo inventory just dropped 12%" Bad: "Your Monthly Market Pulse 🏠"
- **Opening line:** Start with a specific fact, observation, or opinion. Never start with a greeting like "Hey there!" or "Happy Tuesday!"
- **Sections:** 3–5 H2 subheadings. Use short headers that tell the reader what they'll get.
- **CTA:** One per post, at the end. Soft and natural. Example: "If you've been thinking about making a move this spring, I'm always happy to talk it through — no pressure, no pitch."
- **Sign-off:** Keep it simple. "— Jason" or "Talk soon, Jason"

---

## SEO Rules

<!-- These rules govern every blog post. Follow them before publishing. -->

### 1. Target One Local Keyword Per Article

Each blog post focuses on **one primary search phrase**. No exceptions.

**Keyword Formula:** `[City] + [Real Estate Topic]`

**Weak Topic:**
- "The Housing Market"

**Strong Topics:**
- Kalamazoo Housing Market Forecast 2026
- Living in Portage Michigan: Pros and Cons
- Best Neighborhoods in Kalamazoo for Families
- Moving to Kalamazoo Michigan Guide

**Primary keyword placement (required):**
- Page title / H1
- URL slug
- First 100 words
- Meta description
- At least one image alt text

Include **2–3 secondary keywords** (related terms, nearby city variants, synonyms) in H2s and body copy. Work them in naturally — if it reads awkwardly, rewrite or drop it.

**No keyword cannibalization.** Check that the primary keyword hasn't already been targeted by another published post.

---

### 2. Service Area — City Targeting Tiers

Every post must target **at least one geo-modified keyword** from the service area.

**Tier 1 — Primary Markets** (target most frequently — highest search volume):
- Kalamazoo
- Portage
- Grand Rapids
- Battle Creek
- Kalamazoo County
- South Haven

**Tier 2 — Secondary Markets** (target regularly — lower volume, lower competition, easier wins):
- Plainwell
- Otsego
- Allegan
- Paw Paw
- Mattawan
- Vicksburg
- Schoolcraft
- Richland
- Wayland
- Kentwood
- Wyoming (MI)
- Grandville

**Tier 3 — Long-Tail / Hyperlocal** (target opportunistically — very low competition):

Core Kalamazoo Area:
- Parchment, Comstock, Oshtemo, Texas Township, Kalamazoo Township

West / Toward Lake Michigan:
- Lawton, Decatur, Hartford, Gobles, Bloomingdale, Bangor, Pullman, Saugatuck, Douglas

North Toward Grand Rapids:
- Bradley, Moline, Cutlerville, Jenison

East Toward Battle Creek:
- Galesburg, Augusta, Hickory Corners, Delton, Springfield, Marshall, Albion

South Toward Indiana:
- Scotts, Three Rivers, Centreville, Constantine, White Pigeon, Sturgis

Smaller Villages / Communities:
- Climax, Fulton, Wakeshma, Cooper Township, Alamo Township, Prairie Ronde Township

**State disambiguation rule:** When targeting "Wyoming MI," "Springfield," or any city name shared with other states — always include "MI" or "Michigan" in the keyword.

---

### 3. Keyword Patterns by Intent

Use these templates to generate target keywords. Replace `[City]` with any city from the tiers above.

**Buyer-Intent:**
- homes for sale in [City]
- buying a home in [City]
- [City] MI real estate
- best neighborhoods in [City]
- cost of living in [City]
- moving to [City] Michigan
- first-time homebuyer [City]
- [City] housing market [year]
- homes under 400k [City] MI
- [City] homes with acreage
- condos downtown [City]
- [City] lake homes

**Seller-Intent:**
- selling a home in [City]
- [City] home values
- how much is my home worth in [City]
- [City] real estate market update

**Informational / Community:**
- things to do in [City] MI
- best schools in [City]
- [City] Michigan community guide
- living in [City] pros and cons
- [City] vs [City] — which is better for families?
- new construction in [City]

**Relocation Searches** (high traffic — prioritize these):
- moving to [City] Michigan
- living in [City] Michigan
- cost of living [City]
- best neighborhoods in [City] MI
- [City] housing market

**Hero-Sector Keywords** (use sparingly — 1 in 5 posts max):
- homebuyer programs for teachers in [City]
- homes for heroes [City] Michigan
- VA loan homes [City]
- first responder homebuyer assistance Michigan

---

### 4. Blog Post On-Page Structure

#### Title (H1)

- Include primary keyword
- Under 60 characters
- Write titles people actually search

**Good:**
- "Moving to Kalamazoo Michigan: 12 Things to Know"
- "Cost of Living in Kalamazoo MI (2026 Guide)"
- "Best Neighborhoods in Kalamazoo for Families"
- "Kalamazoo Housing Market Forecast"

**Weak:**
- "Our Beautiful Community"
- "Thoughts on Real Estate"
- "Your Monthly Market Pulse"

#### URL Slug

All blog posts live under `/blog/`. Clean, lowercase, hyphenated, keyword-rich.

```
✅ jobrienhomes.com/blog/plainwell-michigan-community-guide
✅ jobrienhomes.com/blog/kalamazoo-housing-market-march-2026
✅ jobrienhomes.com/blog/best-neighborhoods-portage-mi

❌ jobrienhomes.com/blog/post-47
❌ jobrienhomes.com/blog/great-tips-for-buyers-in-the-kalamazoo-area-michigan-real-estate
❌ jobrienhomes.com/blog/2026/03/14/market-update
```

#### Meta Title & Description

- **Meta title:** Under 60 characters. Must include primary keyword + city/state.
- **Meta description:** 140–155 characters. Include primary keyword naturally. Write it like a hook that makes someone want to click — not a summary.

#### Headings (H2s)

Use 3–5 H2 subheadings per post. At least one should contain a secondary keyword or city name. Break up content so there are no wall-of-text sections.

**Example structure for a community guide:**

```
H1: Living in Kalamazoo Michigan
  H2: Cost of Living in Kalamazoo
  H2: Best Neighborhoods in Kalamazoo
  H2: Kalamazoo Schools & Family Life
  H2: Pros and Cons of Living in Kalamazoo
  H2: Kalamazoo Real Estate Market
```

---

### 5. Post Length

- **Community guides / pillar content:** 1,200–2,500 words (heavy hitters for SEO)
- **Standard posts:** 800–1,200 words
- **Market updates:** 500–1,000 words
- **Cost of living guides:** 1,000–1,500 words

No fluff to hit word count. If the topic only needs 600 words, write 600 words.

---

### 6. Internal Links

Every blog post must include **at least 2 internal links** to:
- Other blog posts (especially within the same topic cluster)
- Home search / IDX page
- Neighborhood or community pages
- Contact page
- Homes for Heroes page (when relevant)

Use **descriptive anchor text.** Not "click here" — write something like "check out the full guide to Portage neighborhoods."

---

### 7. External Links & Sources

- Link to sources when citing stats (Realtor.com, Redfin, local news, county records). Opens in new tab.
- Adds credibility and signals to Google that you're referencing real data.
- **Do not fabricate market data.** If a stat can't be verified, leave it out.

---

### 8. Images & Local Photos

Include **at least 1 image per post** (3–6 for community guides).

**Alt text:** Descriptive, location-aware. Example: `alt="Homes in Portage Michigan neighborhood near Kalamazoo"`

**Use local photos when possible:**
- Kalamazoo Mall / downtown streetscape
- Bell's Brewery
- Western Michigan University campus
- Portage neighborhoods
- Lake Michigan beaches (South Haven, Saugatuck)
- Plainwell downtown, Dean's Park
- Local parks, schools, landmarks

**Compress all images to under 200KB.**

---

### 9. Use Local Data

Include real details that show you know the area:
- Median home prices
- Commute times between cities
- School district info
- Population / growth stats
- Local amenities, restaurants, parks

**Example:**
"The median home price in Kalamazoo is about $260,000 — significantly lower than Ann Arbor or Grand Rapids, which makes it a strong option for buyers who want more house for their money."

---

### 10. Write Like a Local

Mention actual streets, restaurants, schools, parks, and commute patterns. This is what separates your content from generic AI-generated real estate blogs.

**Example:**
"Stadium Drive traffic gets busy near Western Michigan University during the school year, but most Portage neighborhoods avoid that congestion entirely."

**Nearby city cross-references:** When writing about one city, mention 1–2 nearby cities naturally. Example: In a Plainwell post, say "just 15 minutes north of Kalamazoo" or "between Otsego and Kalamazoo on US-131." This helps you rank for adjacent searches too.

---

### 11. Content Clustering Strategy

Organize posts into **topic clusters** to build topical authority. Each cluster has one **pillar page** (long-form, comprehensive) and multiple **supporting posts** that link back to it.

#### Cluster 1: City & Community Guides (Highest SEO Priority)

**Pillar:** "Living in West Michigan: A Complete Guide to Kalamazoo-Area Communities"

**Supporting posts** (one per city/town — this is the long game):
- "Moving to Plainwell, MI — What You Need to Know"
- "Living in Portage: Schools, Neighborhoods & What Homes Cost"
- "Why Families Are Moving to Mattawan"
- "Otsego, MI: Small-Town Living 30 Minutes from Kalamazoo"
- "South Haven: Beach Town Living in West Michigan"
- "Paw Paw, MI — Wine Country Meets Small-Town Real Estate"
- _(One post per city across the full service area — 30+ post series)_

**Why this is priority #1:** Community guide searches have strong buyer intent, low competition in small towns, and position you as the local expert. Each one targets a city name you want to own.

#### Cluster 2: Market Updates

**Pillar:** "West Michigan Real Estate Market" (updated monthly/quarterly)

**Supporting posts:**
- Monthly or bi-weekly market snapshots by area
- Interest rate impact posts
- Seasonal trend pieces ("What Spring 2026 Looks Like for Kalamazoo Buyers")

#### Cluster 3: Buyer Education

**Pillar:** "How to Buy a Home in West Michigan — A Step-by-Step Guide"

**Supporting posts:**
- "What's a Buyer's Agent and Why You Want One"
- "First-Time Homebuyer Programs in Michigan"
- "Closing Costs in Michigan — What to Expect"
- "How to Win a Multiple-Offer Situation in Kalamazoo"

#### Cluster 4: Homes for Heroes (Low Frequency)

**Pillar:** "Homes for Heroes in Michigan — How It Works"

**Supporting posts:**
- "Teacher Homebuyer Savings in Kalamazoo"
- "Firefighter & EMS Home Buying Benefits in Michigan"
- "VA Loans in West Michigan — What You Need to Know"

**Cluster linking rule:** Every supporting post links back to its pillar page. Pillar pages link out to all supporting posts.

---

### 12. Call to Action

One CTA per post, at the end. Soft and natural.

**Good:**
- "If you've been thinking about making a move this spring, I'm always happy to talk it through — no pressure, no pitch."
- "Browse homes for sale in Kalamazoo or Portage."
- "Want a list of homes under $400k in Kalamazoo? Reach out anytime."

**Bad:**
- "CALL NOW FOR A FREE CONSULTATION!"
- "Don't miss out — contact me today!"

---

### 13. SEO Voice Rules

These override generic SEO advice. The blog follows the same voice rules as the Voice & Tone section above:

- **Sound human, not optimized.** If a sentence only exists because of a keyword, cut it.
- **No keyword-stuffed intros.** Don't open with: "If you're looking for homes for sale in Kalamazoo Michigan, the Kalamazoo MI real estate market has..." Write like a person.
- **First person is encouraged.** "I've been watching the Portage market closely" > "The Portage market has seen notable activity."
- **Opinions earn engagement.** "I think Plainwell is one of the most underrated towns in this part of Michigan" keeps people on the page longer than safe, generic filler.
- **No keyword stuffing.** If a keyword reads awkwardly in a sentence, rewrite the sentence or drop the keyword. The post must sound human first, optimized second.

---

### 14. Schema Markup

Add structured data if the blog platform supports it:
- `BlogPosting` schema on each post
- `LocalBusiness` schema
- `RealEstateAgent` schema
- `Article` schema

---

### 15. Local SEO Beyond the Blog

- **Google Business Profile:** Share every blog post as a GBP update within 48 hours of publishing.
- **NAP Consistency:** Name, Address, Phone must be identical everywhere. Use: `Jason O'Brien, REALTOR® | PREMIERE Group at Real Broker, LLC`
- **Location + state:** Mention the city AND "Michigan" or "MI" at least once per post. Smaller towns need state context for search engines.

---

### 16. Publishing Cadence

| Pace | Result |
|------|--------|
| 1 per month | Slow growth |
| 2–4 per month | Solid traffic |
| 1 per week | Strong authority |

**Priority rotation:**
1. Community guide (city/town post) — highest long-term SEO value
2. Market update — timely, keeps site fresh
3. Buyer/seller education — evergreen, supports clusters
4. Homes for Heroes content — 1x per month max

---

### 17. High-Performing Blog Topics

These topic formats consistently rank well for local real estate:

1. Moving to [City] Michigan
2. Living in [City] Michigan
3. Cost of Living [City] MI
4. Best Neighborhoods in [City]
5. [City] Housing Market Update
6. [City] MI Homes for Sale Guide
7. [City] vs [City] — Which Is Better for Families?
8. Things to Know Before Buying in [City]

---

### 18. Titles That Rank vs. Titles That Don't

**Good — people actually search these:**
- "Moving to Kalamazoo Michigan: 12 Things to Know"
- "Cost of Living in Kalamazoo MI (2026 Guide)"
- "Kalamazoo Housing Market Forecast"
- "Best Neighborhoods in Portage MI for Families"

**Weak — nobody searches these:**
- "Our Beautiful Community"
- "Thoughts on Real Estate"
- "A Guide to Homeownership"
- "Exciting News in West Michigan"

---

### 19. Target Long-Tail Keywords

In addition to primary keywords, work long-tail phrases into posts where natural:

- homes under 400k Kalamazoo MI
- Kalamazoo homes with acreage
- Portage MI lake homes
- condos downtown Kalamazoo
- fixer-uppers in [City] MI
- new construction homes [City] Michigan

---

### 20. Pre-Publish Checklist

Run before every post goes live:

- [ ] Primary keyword in: title, URL slug, meta description, H1, first 100 words
- [ ] Meta title under 60 characters
- [ ] Meta description 140–155 characters
- [ ] 3–5 H2 subheadings (at least one with secondary keyword or city name)
- [ ] At least 2 internal links
- [ ] At least 1 external source link for any stats cited
- [ ] At least 1 image with descriptive, location-aware alt text
- [ ] Images compressed (under 200KB)
- [ ] URL slug is clean, lowercase, hyphenated, keyword-rich
- [ ] No duplicate primary keyword (check against existing posts)
- [ ] No banned AI-voice words or phrases
- [ ] Post reads naturally out loud
- [ ] Mobile-friendly formatting (short paragraphs, subheadings every 200–300 words)
- [ ] CTA at end — soft and natural
- [ ] City + "Michigan" or "MI" appears at least once

---

## Tools

### Available Tools

| Tool | File | Purpose | Input | Output |
|------|------|---------|-------|--------|
| Market Research | `tools/research.py` | Scrape/fetch local market data and news | Search queries, area name | JSON with stats and sources |
| Spell Check | `tools/spellcheck.py` | Run spell/grammar check on draft | `output/draft.md` | Pass/fail + suggestions |
| AI Voice Check | `tools/voice_check.py` | Scan for banned AI phrases | `output/draft.md`, banned words list | Pass/fail + flagged phrases |
| SEO Check | `tools/seo_check.py` | Verify keyword placement, meta, links, checklist | `output/draft.md`, primary keyword | Pass/fail + missing items |
| Notion Delivery | `tools/send_notion.py` | Push post to Notion database | `output/draft.md`, Notion DB ID | Delivery confirmation |

### Tool Development Rules

- All tools live in `tools/`.
- Standalone Python scripts, callable via CLI with `argparse`.
- Return JSON to stdout. Exit 0 on success, 1 on failure.
- Handle errors gracefully — print a useful error message, don't just crash.

### MCP Servers

| Server | URL | Purpose |
|--------|-----|---------|
| Notion | `https://mcp.notion.com/mcp` | Push finished blog posts to Notion database |
| Gmail | `https://gmail.mcp.claude.com/mcp` | Send blog post notification emails (if enabled) |

---

## Project Context

### Key Constraints

- Market data must be from the last 7 days. Stale stats = no stats.
- Blog post should be publishable as-is — no manual editing required (goal, not hard rule).
- No fluff to hit word count. Quality over quantity.

### Audience

- Homebuyers and sellers in the Kalamazoo/West Michigan area
- Hero-sector workers (healthcare, law enforcement, firefighters, EMS, military, educators) — but the blog is for everyone, not just heroes
- Mix of first-time buyers, move-up buyers, and people casually thinking about real estate
- People researching relocation to West Michigan
- They don't want jargon. They want to know what's happening and what it means for them.

### Brand Context

- Jason O'Brien, REALTOR® — PREMIERE Group at Real Broker, LLC
- Homes for Heroes® affiliate (mention occasionally, not every post)
- Website: jobrienhomes.com
- Service area: Kalamazoo, Portage, Plainwell, Otsego, and surrounding West Michigan

---

## File Structure

```
project-root/
├── CLAUDE.md                  # This file — source of truth
├── tools/                     # Python scripts (Tools)
│   ├── research.py
│   ├── spellcheck.py
│   ├── voice_check.py
│   ├── seo_check.py
│   └── send_notion.py
├── output/                    # Generated content
│   └── draft.md
├── config/                    # Runtime config
│   ├── topic.txt              # Optional: override topic for this run
│   ├── delivery.txt           # "notion", "website", or "both"
│   └── .env                   # API keys (gitignored)
├── logs/                      # Run history
│   ├── run.log
│   ├── outline.md
│   └── sources.md
├── published/                 # Keyword tracking
│   └── keywords.csv           # Primary keyword, URL, date for every published post
└── archive/                   # Past blog posts (date-stamped)
    └── YYYY-MM-DD/
```

---

## Measurement

Track monthly:

- Organic search impressions and clicks (Google Search Console)
- Top-performing pages by organic traffic (Google Analytics)
- Keyword rankings for primary city targets (track top 10–15 city keywords)
- Posts published vs. target cadence
- Leads / contact form submissions from blog pages

---

## Iteration Log

| Run | Date | Topic / Keyword | What Happened | What Changed |
|-----|------|-----------------|---------------|--------------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
