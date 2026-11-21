# Navigation for mistral.provider.sovereignweb.site

Concept first, before building (mistral.design@SovereignWebsite.dinis, 21 November 2026). The site grew overnight to about 40 pages; until now the only navigation was the site name, a "Choose a design" menu and a few footer links. This is one navigation, shared by every page, so a visitor (and the owner) can find anything in two moves.

## The sections

Six sections, in this order. Every page belongs to exactly one.

| Section | Label in the header | Lands on | Pages |
|---|---|---|---|
| Overview | Designs | /designs/ | Home (/), the five designs (/designs/1.html to 5.html), "Choose a design" (/designs/) |
| Try it | Try it | /sitemap/#try | Demos (/demos/, side-by-side, your-key, on-device); In your browser (/browser/, build, ask, voice, ocr, inject, local, keys) |
| Agentic | Agentic | /sitemap/#agentic | The team (/team/), the Swarm (/swarm/, evals.html, run.html), Evals (/evals/, /evals/run/), PrompTugal (/promptugal/), Agents running (page to be named by the conductor) |
| Articles | Articles | /articles/ | The articles index and each article |
| Sources | Sources | /sources/ | Every source and the date it was read |
| About | About | /sitemap/#about | Start here (/start/), Use with your AI (/agents/), How this site was made (/admin/), Open questions (/questions/), Site map (/sitemap/) |

"Try it", "Agentic" and "About" have more than one landing page, so their header link goes to their part of the site map, which lists each page with one line. Pages that do not exist yet (PrompTugal, the local model and keys pages, Agents running) appear in the navigation only once their file is in site/.

## The parts

1. **Header, every page.** The site name on the left (home). On the right, one button, "Menu", a `<details>`/`<summary>` disclosure: it works without JavaScript, which the strict CSP rules out anyway. Open, it shows every page, grouped by the six sections, with the current page marked.
2. **Section row, desktop and tablet (from 48rem).** Under the name, the six section labels as plain links. The section of the current page is marked (`aria-current="page"` on its own landing page, `aria-current="true"` and an underline bar on any page inside it). On phones the row is hidden: the Menu holds the same links.
3. **"You are here".** The same mark in three places: the section row, the Menu (the current page in bold with a bar, its section open at the top on phones) and the breadcrumbs.
4. **Breadcrumbs, every page except home.** A `<nav aria-label="Breadcrumb">` with an ordered list: Home › Section › Hub › Page, for example Home › Agentic › The Swarm › Swarm evals. The last item is the page itself, with `aria-current="page"`, not a link.
5. **Notice, every page.** Kept as now, right under the header: `<section class="notice" aria-label="Notice">`, short form on phones, full on wider screens; full again in the footer.
6. **Footer, every page.** The full notice, then the six sections with their pages as a compact list (a footer site map), then the page's own credit lines, unchanged.
7. **The site map, /sitemap/.** Every page, grouped by section, each with one line saying what it is. It is also the landing page for "Try it", "Agentic" and "About" (anchors #try, #agentic, #about). A plain /sitemap.xml lists the same pages for search engines.

The "Sovereign Website" family credit stays where it is, top right, unchanged.

## Phone (320 to 47.9rem)

- One header row: the site name (it may wrap to two lines) and "Menu". No section row.
- The Menu opens as a full-width panel under the header, over the page, and scrolls with it. The current section comes first; the others stack below as short headed lists; links are about 44px tall.
- No sideways scroll at 320px: no fixed widths, long labels wrap, the breadcrumb wraps onto a second line.
- Breadcrumbs show in full, small, above the page title.

## Desktop (48rem and wider)

- Row 1: site name, and "Menu" on the right (under the family credit).
- Row 2: the six section labels, the current one marked.
- The Menu opens as a panel under the header, the six sections in columns (three per row on a laptop), every page listed. It closes when the button is pressed again (no script: there is no click-outside or Escape handling).

## How it is built, once

- **One source of truth:** `tools/nav.mjs`, the list of every page (path, section, label, one line). It renders the header, the Menu, the breadcrumbs, the footer site map, /sitemap/ and /sitemap.xml.
- **Generated pages** (home, designs, sources, questions, start, agents, admin, articles, sitemap): `tools/gen.mjs` calls `tools/nav.mjs` for the header, breadcrumbs and footer.
- **Hand-written pages** (demos, team, evals, swarm, browser, promptugal): each carries two marked blocks, `<!-- nav:head -->` to `<!-- /nav:head -->` right after `<body>` (skip link, family credit, header, breadcrumbs, notice) and `<!-- nav:foot -->` to `<!-- /nav:foot -->` at the start of the footer. `node tools/nav.mjs` rewrites only what is between the markers, from the same list; nothing else in those pages changes (scripts, data, CSP and key handling are left as they are). `node tools/gen.mjs` runs it too.
- **Styles:** `/assets/css/nav.css`, linked by every page, after its own stylesheets, so it holds on pages with their own tokens (the demos). It uses the page's own colour tokens, with fallbacks.
- **A new page:** add one line to the list in `tools/nav.mjs`, put the two marker pairs in the page (empty is fine) and run `node tools/nav.mjs`. `node tools/nav.mjs --check` fails if a page in site/ is missing from the list, or its blocks are out of date; `tools/check.sh` runs it.

## What is left out, on purpose

- No search box: it would need script on every page; the site map and the Menu are the search.
- No sticky header: on a phone it takes a fifth of the screen.
- The "Choose a design" menu goes: its five designs are the Overview section of the Menu, and /designs/ is one tap away.
- The in-page navigation of the demos, the Swarm and the evals stays as it is, inside each page: it is that section's own table of contents.
