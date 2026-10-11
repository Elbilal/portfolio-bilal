# Portfolio — Elbadaouy Bilal

Dark, terminal/code-editor themed portfolio in English, French and Arabic.
Content lives entirely in `locales/<lang>.json` and `terminal/<lang>/` — the
HTML and JS are a template that renders whatever is in those files, so
updating the site never means touching code.

## Structure

```
index.html            entry point (semantic HTML, no inline content or data)
locales/en.json        ← all editable content + interface labels, one file per language
locales/fr.json           (same structure as en.json, translated)
locales/ar.json           (same structure as en.json, translated; page renders right-to-left)
terminal/<lang>/*.md    ← hero terminal commands, one folder per language
assets/js/app.js        fetches locales/<lang>.json, renders every section, handles UX
assets/js/terminal.js   the hero terminal
assets/css/style.css    compiled, minified Tailwind CSS (generated — don't hand-edit)
src/input.css           Tailwind source (edit THIS, then rebuild)
tailwind.config.js       design tokens: colors, fonts, shadows, animations
robots.txt, sitemap.xml, site.webmanifest   basic SEO / PWA metadata
```

## Editing content

Everything on the page — name, bio, skills, projects, links, SEO tags and
interface labels (the `ui` block) — comes from `locales/<lang>.json`. Edit the
file for each language and refresh; no rebuild step needed. `npm test` fails
if a language file is missing a key, has an extra one, or has links, images or
tech tags that differ from `en.json`, so the three can't drift apart.

Notes:
- `meta.seo.canonical` / `ogImage` should point at your real domain before
  you publish (they're used for link previews and structured data).
- Each project's `tech` array automatically becomes a filter chip on the
  Projects section — no extra config required.
- Set `hero.available: false` if you want to signal you're not open to work
  (wire this up to conditionally hide/alter the status line if desired).

## Languages

The site is available in English (`en`), French (`fr`) and Arabic (`ar`).

- **Which language a visitor sees:** `?lang=fr` in the URL, otherwise the
  last language they picked, otherwise their browser's language, otherwise
  English. This is decided in a small script in `<head>` before the page
  paints, so Arabic never flashes left-to-right first.
- **Switching:** the EN / FR / ع switcher in the nav (also in the mobile
  menu), or `lang fr` in the hero terminal. The choice is remembered.
- **Arabic** sets `dir="rtl"` on the page. Layout uses logical utilities
  (`ms-*`, `me-*`, `start-*`, `end-*`, `text-start`), so it mirrors on its
  own; code-style text (the logo, `hello_world();`, the terminal) stays
  left-to-right. Arabic text uses IBM Plex Sans Arabic, which Google Fonts
  only downloads on pages that contain Arabic.
- **SEO:** each language has its own title, description and canonical URL
  (in `meta.seo`), `index.html` declares `hreflang` alternates, and
  `sitemap.xml` lists all three.

To add a language, copy `locales/en.json` and `terminal/en/`, translate them,
then add the code to the list in the `<head>` script of `index.html`, to
`LANGUAGES` in `assets/js/app.js`, and to `LANGS` in `tests/commands.test.mjs`.

## Hero terminal

The `profile.js` window in the hero is an interactive shell. Each command is a
Markdown file in `terminal/<lang>/` (command names are the same in every
language; descriptions and output are translated):

- `terminal/<lang>/index.md` lists the commands (`- name — description`); `help`
  prints this list.
- `terminal/<lang>/<name>.md` starts with a front-matter block that is printed as a
  `const` object (`var:` sets the variable name, `aliases:` adds other names
  for the command); `key:` followed by `  - item` lines becomes an array. The
  Markdown body below it is printed after it (headings, bullet lists,
  `**bold**`, `` `code` `` and `[links](url)` are supported).

As soon as a visitor starts typing, the `const engineer` panel erases itself
and folds away, and the whole window becomes the shell. It stays that way until
they run `reset` (or `exit`), which brings the panel back.

Built-in commands: `help`, `ls`, `clear`, `reset`/`exit`, `history`, `lang`. Tab completes,
↑/↓ walk the history, Ctrl+C cancels, Ctrl+L clears, and command names in the
output are clickable.

`terminal/<lang>/demo.md` shows every supported format, and `terminal/_template.md`
is a starting point for new commands.

`.nojekyll` must stay in the repo root: without it, GitHub Pages runs Jekyll,
which converts the command files to `.html` and every command fails with
"couldn't load".

### Tests

```bash
npm test            # every command in index.md has a valid .md file (runs in CI before deploy)
npm run test:e2e    # drives the terminal in Chromium, running every command (needs a Playwright browser)
SITE_DIR=dist npm run test:e2e   # same, against the folder the deploy workflow publishes
```

## Local development

Because the page loads content via `fetch('locales/<lang>.json')`, it must be served
over HTTP — opening `index.html` directly (`file://`) will fail due to
browser CORS rules on local files.

```bash
npm install
npm run dev        # serves the site at http://localhost:5173
```

## Changing styles

Custom CSS lives in `src/input.css` as Tailwind `@layer` rules (design
tokens are in `tailwind.config.js`). After editing, rebuild the compiled
stylesheet:

```bash
npm run build:css          # one-off minified build
npm run watch:css          # rebuild on save, while developing
```

`assets/css/style.css` is a build artifact — it's checked in so the site
works with zero build step on any static host, but always regenerate it
after touching `src/input.css` or `tailwind.config.js`.

## Deployment — GitHub Pages (recommended, and already wired up)

This repo includes `.github/workflows/deploy.yml`: on every push to `main`
it installs dependencies, rebuilds `assets/css/style.css` from Tailwind,
assembles just the site files (no `node_modules`, no source configs) into
a `dist/` folder, and publishes that to GitHub Pages. You never run
`npm run build` by hand before deploying — CI does it for you.

**One-time setup:**

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source →
GitHub Actions**. That's it — the workflow in this repo already handles
the rest. Push again any time and the live site updates automatically.

Your site will be live at:
```
https://<your-username>.github.io/<your-repo>/
```

**Before (or right after) your first deploy**, update these to match that
real URL:
- `locales/*.json` → `meta.seo.canonical` and `meta.seo.ogImage`
- `robots.txt` → the `Sitemap:` line
- `sitemap.xml` → the `<loc>` value

(All asset references in `index.html` are relative — `./assets/...`,
`locales/*.json` — so the site works correctly whether it's served from a
domain root or a GitHub Pages subpath like `/your-repo/`.)

## Deploying elsewhere (Netlify, Vercel, Cloudflare Pages)

All three auto-detect this as a static site. Point them at this repo with:
- **Build command:** `npm run build:css`
- **Publish directory:** `.` (repo root)

They'll rebuild the CSS on every push the same way the GitHub Actions
workflow does. No server/runtime is needed either way — it's static files.

## Accessibility & resilience

- Skip link, visible focus rings, `prefers-reduced-motion` support.
- The locale file fetch has an 8s timeout and one automatic retry; on failure
  the page shows an error state with a Retry button instead of a blank
  screen.
- All dynamic images use `width`/`height` to avoid layout shift, and
  below-the-fold images are lazy-loaded.
