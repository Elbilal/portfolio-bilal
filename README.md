# Portfolio — Elbadaouy Bilal

Dark, terminal/code-editor themed portfolio. Content lives entirely in
`data.json` — the HTML and JS are a template that renders whatever is in
that file, so updating the site never means touching code.

## Structure

```
index.html            entry point (semantic HTML, no inline content or data)
data.json              ← all editable content: bio, skills, projects, links
assets/js/app.js        fetches data.json, renders every section, handles UX
assets/css/style.css    compiled, minified Tailwind CSS (generated — don't hand-edit)
src/input.css           Tailwind source (edit THIS, then rebuild)
tailwind.config.js       design tokens: colors, fonts, shadows, animations
robots.txt, sitemap.xml, site.webmanifest   basic SEO / PWA metadata
```

## Editing content

Everything on the page — name, bio, skills, projects, links, SEO tags —
comes from `data.json`. Edit that file and refresh; no rebuild step needed.

Notes:
- `meta.seo.canonical` / `ogImage` should point at your real domain before
  you publish (they're used for link previews and structured data).
- Each project's `tech` array automatically becomes a filter chip on the
  Projects section — no extra config required.
- Set `hero.available: false` if you want to signal you're not open to work
  (wire this up to conditionally hide/alter the status line if desired).

## Local development

Because the page loads content via `fetch('data.json')`, it must be served
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
- `data.json` → `meta.seo.canonical` and `meta.seo.ogImage`
- `robots.txt` → the `Sitemap:` line
- `sitemap.xml` → the `<loc>` value

(All asset references in `index.html` are relative — `./assets/...`,
`data.json` — so the site works correctly whether it's served from a
domain root or a GitHub Pages subpath like `/your-repo/`.)

## Deploying elsewhere (Netlify, Vercel, Cloudflare Pages)

All three auto-detect this as a static site. Point them at this repo with:
- **Build command:** `npm run build:css`
- **Publish directory:** `.` (repo root)

They'll rebuild the CSS on every push the same way the GitHub Actions
workflow does. No server/runtime is needed either way — it's static files.

## Accessibility & resilience

- Skip link, visible focus rings, `prefers-reduced-motion` support.
- `data.json` fetch has an 8s timeout and one automatic retry; on failure
  the page shows an error state with a Retry button instead of a blank
  screen.
- All dynamic images use `width`/`height` to avoid layout shift, and
  below-the-fold images are lazy-loaded.
