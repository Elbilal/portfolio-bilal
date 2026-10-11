'use strict';

/**
 * Portfolio app
 * Content lives entirely in /data.json. Edit that file to change the site —
 * no HTML/JS changes needed for text, links, projects, or skills.
 */

let portfolioData = null;
let activeFilter = 'all';

const badgeColorThemes = [
  'bg-amber/10 text-amber border-amber/30',
  'bg-teal/10 text-teal border-teal/30',
  'bg-surface2 text-text border-hair',
];
const getBadgeColor = (i) => badgeColorThemes[i % badgeColorThemes.length];

const $ = (id) => document.getElementById(id);
const escapeHTML = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

/* ---------------------------------------------------------------------- */
/* Data loading — external data.json, with timeout + one retry            */
/* ---------------------------------------------------------------------- */

async function fetchWithTimeout(url, { timeout = 8000, ...opts } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-cache', ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(id);
  }
}

async function loadPortfolioData(retry = true) {
  try {
    return await fetchWithTimeout('data.json');
  } catch (err) {
    if (retry) {
      await new Promise((r) => setTimeout(r, 600));
      return loadPortfolioData(false);
    }
    throw err;
  }
}

function renderSkeleton() {
  document.body.classList.add('opacity-0');
  requestAnimationFrame(() => document.body.classList.remove('opacity-0'));
}

function renderErrorState(err) {
  console.error('Error loading portfolio data:', err);
  const root = document.getElementById('main');
  if (!root) return;
  root.innerHTML = `
    <div class="max-w-lg mx-auto px-6 py-32 text-center">
      <div class="error-banner p-8">
        <p class="font-mono text-sm text-danger mb-3">// fetch(data.json) failed</p>
        <h1 class="text-xl font-display font-semibold text-text mb-3">Couldn't load this page</h1>
        <p class="text-muted text-sm mb-6 leading-relaxed">
          The content file didn't respond in time. If you're viewing this file directly
          (file://), serve it over HTTP instead — e.g. <code class="font-mono text-teal">npx serve</code>.
        </p>
        <button id="retry-btn" type="button" class="bg-amber hover:bg-amber/90 text-[#171208] font-mono text-sm font-medium py-2.5 px-6 rounded-lg transition-colors">
          Retry
        </button>
      </div>
    </div>
  `;
  document.getElementById('retry-btn')?.addEventListener('click', init);
}

/* ---------------------------------------------------------------------- */
/* Renderers                                                              */
/* ---------------------------------------------------------------------- */

function renderMeta() {
  const { name, role, seo } = portfolioData.meta;
  document.title = seo?.title || `${name} — ${role}`;

  const setMeta = (selector, attr, value) => {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', 'content', seo?.description);
  setMeta('meta[property="og:title"]', 'content', seo?.title);
  setMeta('meta[property="og:description"]', 'content', seo?.description);
  setMeta('meta[property="og:image"]', 'content', seo?.ogImage);
  setMeta('meta[name="theme-color"]', 'content', seo?.themeColor);
  setMeta('link[rel="canonical"]', 'href', seo?.canonical);

  // JSON-LD structured data, built from the loaded data (kept out of source HTML
  // so it always matches what's actually on the page).
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle: role,
    email: portfolioData.meta.email,
    url: seo?.canonical,
    sameAs: Object.values(portfolioData.meta.socials || {}),
  };
  let script = document.getElementById('ld-json');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'ld-json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(ld);
}

function renderNavigation() {
  const navHTML = `
    <nav class="fixed w-full bg-ink/85 backdrop-blur-sm z-50 border-b border-hair" id="site-nav">
      <div class="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 xl:px-20">
        <div class="flex justify-between items-center h-16">
          <a href="#hero" class="font-display font-semibold text-lg tracking-tight text-text">
            <span class="text-amber font-mono">&lt;</span>${escapeHTML(portfolioData.meta.logoName)}<span class="text-amber font-mono">/&gt;</span>
          </a>

          <div class="hidden md:flex items-center gap-8">
            <a href="#about" data-nav="about" class="nav-link text-sm font-mono text-muted hover:text-text transition-colors">about</a>
            <a href="#skills" data-nav="skills" class="nav-link text-sm font-mono text-muted hover:text-text transition-colors">skills</a>
            <a href="#projects" data-nav="projects" class="nav-link text-sm font-mono text-muted hover:text-text transition-colors">projects</a>
            <a href="#contact" data-nav="contact" class="nav-link text-sm font-mono text-muted hover:text-text transition-colors">contact</a>

            <div class="relative group">
              <button class="border border-amber/50 text-amber hover:bg-amber hover:text-[#171208] px-4 py-1.5 rounded-md text-sm font-mono transition-all flex items-center gap-2" aria-haspopup="true" aria-expanded="false" id="resume-btn">
                resume <i class="fas fa-chevron-down text-[10px] transition-transform duration-300 group-hover:rotate-180" aria-hidden="true"></i>
              </button>
              <div class="absolute right-0 mt-2 w-44 bg-surface border border-hair rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50" role="menu">
                <a href="${portfolioData.meta.resume.en}" class="block px-4 py-2 text-sm text-text hover:text-amber hover:bg-surface2 rounded-t-md border-b border-hair transition-colors" role="menuitem">
                  <i class="fas fa-file-pdf text-amber/70 mr-2" aria-hidden="true"></i>English (PDF)
                </a>
                <a href="${portfolioData.meta.resume.fr}" class="block px-4 py-2 text-sm text-text hover:text-amber hover:bg-surface2 rounded-b-md transition-colors" role="menuitem">
                  <i class="fas fa-file-pdf text-amber/70 mr-2" aria-hidden="true"></i>Français (PDF)
                </a>
              </div>
            </div>

            <button id="theme-toggle" type="button" class="theme-toggle" aria-label="Switch to day mode" aria-pressed="false">
              <i class="fas fa-moon icon-moon" aria-hidden="true"></i>
              <i class="fas fa-sun icon-sun" aria-hidden="true"></i>
            </button>
          </div>

          <div class="md:hidden flex items-center gap-3">
            <button id="theme-toggle-mobile" type="button" class="theme-toggle" aria-label="Switch to day mode" aria-pressed="false">
              <i class="fas fa-moon icon-moon" aria-hidden="true"></i>
              <i class="fas fa-sun icon-sun" aria-hidden="true"></i>
            </button>
            <button id="mobile-menu-btn" class="text-text focus:outline-none" aria-expanded="false" aria-controls="mobile-menu" aria-label="Toggle menu">
              <i class="fas fa-bars text-xl" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>

      <div id="mobile-menu" class="hidden md:hidden bg-ink border-t border-hair">
        <div class="px-4 pt-2 pb-4 space-y-1 font-mono text-sm">
          <a href="#about" class="block px-2 py-2.5 text-muted hover:text-amber">about</a>
          <a href="#skills" class="block px-2 py-2.5 text-muted hover:text-amber">skills</a>
          <a href="#projects" class="block px-2 py-2.5 text-muted hover:text-amber">projects</a>
          <a href="#contact" class="block px-2 py-2.5 text-muted hover:text-amber">contact</a>
          <div class="border-t border-hair mt-2 pt-3">
            <p class="px-2 pb-2 text-xs text-muted/70 uppercase tracking-wider">Résumé</p>
            <a href="${portfolioData.meta.resume.en}" class="block px-2 py-2 text-text hover:text-amber"><i class="fas fa-file-pdf text-amber/70 mr-2" aria-hidden="true"></i>English</a>
            <a href="${portfolioData.meta.resume.fr}" class="block px-2 py-2 text-text hover:text-amber"><i class="fas fa-file-pdf text-amber/70 mr-2" aria-hidden="true"></i>Français</a>
          </div>
        </div>
      </div>
    </nav>
  `;
  $('nav-container').innerHTML = navHTML;
}

function renderRail() {
  const items = [
    { id: 'about', tag: 'ABT' },
    { id: 'skills', tag: 'SKL' },
    { id: 'projects', tag: 'PRJ' },
    { id: 'contact', tag: 'CTC' },
  ];
  const nodes = items.map((it) => `
    <a href="#${it.id}" class="rail-node" data-rail="${it.id}" aria-label="Jump to ${it.id}">
      <span class="rail-tag">${it.tag}</span>
    </a>
  `).join('');
  $('rail').innerHTML = `<div class="rail-fill" id="rail-fill"></div>${nodes}`;
}

function renderHero() {
  const { greeting, headline, description, ctaText, image, focusAreas, status } = portfolioData.hero;

  $('hero').innerHTML = `
    <div class="order-2 md:order-1 reveal">
      <p class="text-amber font-mono mb-4 text-sm">${escapeHTML(greeting)}</p>
      <h1 class="text-4xl md:text-6xl font-display font-bold text-text mb-3 tracking-tight leading-[1.05]">${escapeHTML(portfolioData.meta.name)}</h1>
      <h2 class="text-xl md:text-2xl font-mono text-muted mb-6">${escapeHTML(headline)}</h2>
      <p class="text-muted text-base md:text-lg mb-8 max-w-md leading-relaxed">${escapeHTML(description)}</p>
      <div class="flex flex-wrap gap-4">
        <a href="#projects" class="bg-amber hover:bg-amber/90 text-[#171208] font-mono font-medium py-3 px-6 rounded-lg transition-colors text-center text-sm">
          ${escapeHTML(ctaText)} →
        </a>
        <a href="${portfolioData.meta.socials.github}" target="_blank" rel="noopener noreferrer" class="border border-hair hover:border-amber/50 text-text font-mono py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm">
          <i class="fab fa-github" aria-hidden="true"></i> github
        </a>
      </div>
    </div>

    <div class="order-1 md:order-2 reveal">
      <div class="code-window schematic overflow-hidden max-w-md mx-auto" id="hero-terminal">
        <div class="flex items-center gap-2 px-4 py-3 border-b border-hair">
          <span class="code-dot bg-[#5a4230]"></span>
          <span class="code-dot bg-[#5a5230]"></span>
          <span class="code-dot bg-[#2f5a3d]"></span>
          <span class="ml-3 font-mono text-xs text-muted">profile.js</span>
        </div>
        <div class="term-const-wrap">
          <div class="p-5 font-mono text-sm leading-relaxed overflow-x-auto">
<pre class="whitespace-pre-wrap" data-term-const></pre>
          </div>
        </div>
        <div class="term-screen" data-term-screen>
          <div data-term-log aria-live="polite"></div>
          <label class="term-line">
            <span class="text-teal shrink-0">guest@bilal:~$</span>
            <span class="term-field">
              <span class="term-mirror" data-term-mirror aria-hidden="true"></span>
              <input type="text" data-term-input class="term-input" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" enterkeyhint="send" aria-label="Terminal command" placeholder="type a command…">
            </span>
          </label>
        </div>
        <div class="px-5 py-4 flex items-center gap-3 border-t border-hair">
          <img src="${portfolioData.hero.image}" alt="${escapeHTML(portfolioData.meta.name)}" width="44" height="44" loading="eager" fetchpriority="high" class="rounded-md border border-hair">
          <span class="font-mono text-xs text-muted">// avatar.png loaded</span>
        </div>
      </div>
    </div>
  `;

  Terminal.mount($('hero-terminal'), {
    varName: 'engineer',
    fields: {
      name: portfolioData.meta.name,
      role: portfolioData.meta.role,
      focus: focusAreas || [],
      status: status || '',
    },
  });
}

function renderAbout() {
  const { about } = portfolioData;
  const paragraphs = about.paragraphs.map((p) => `<p>${escapeHTML(p)}</p>`).join('');
  const stats = (about.stats || []).map((s) => `
    <div class="text-center">
      <p class="font-display text-2xl md:text-3xl font-bold text-amber">${escapeHTML(s.value)}</p>
      <p class="font-mono text-[11px] text-muted uppercase tracking-wide mt-1">${escapeHTML(s.label)}</p>
    </div>
  `).join('');

  $('about-container').innerHTML = `
    <h2 class="text-2xl md:text-3xl font-display font-semibold text-text mb-10 flex items-center reveal">
      <span class="text-amber font-mono text-base mr-3">// ${escapeHTML(about.title.toLowerCase())}</span>
      <div class="ml-4 h-px bg-hair flex-grow"></div>
    </h2>
    <div class="flex flex-col md:flex-row gap-10">
      <div class="md:w-2/3 text-muted space-y-4 leading-relaxed text-base md:text-lg reveal">
        ${paragraphs}
        ${stats ? `<div class="grid grid-cols-3 gap-4 pt-6 mt-2 border-t border-hair">${stats}</div>` : ''}
      </div>
      <div class="md:w-1/3 reveal">
        <div class="schematic rounded-lg bg-surface p-6 border border-hair h-full flex flex-col items-center justify-center text-center gap-3">
          <i class="${about.icon} text-4xl text-amber" aria-hidden="true"></i>
          <p class="font-mono text-xs text-muted">// profile.notes<br>status: curious, caffeinated</p>
        </div>
      </div>
    </div>
  `;
}

function renderSkills() {
  const categories = portfolioData.skills.categories.map((cat, catIndex) => {
    const items = cat.items.map((item, itemIndex) =>
      `<span class="badge ${getBadgeColor(catIndex * 10 + itemIndex)}">${escapeHTML(item)}</span>`
    ).join('');

    return `
      <div class="reveal bg-surface p-6 rounded-xl border border-hair">
        <h3 class="text-lg font-display font-semibold text-text mb-4 border-b border-hair pb-3 flex items-center gap-2">
          <i class="${cat.icon} text-amber" aria-hidden="true"></i> ${escapeHTML(cat.title)}
        </h3>
        <div class="flex flex-wrap gap-2">${items}</div>
      </div>
    `;
  }).join('');

  $('skills-container').innerHTML = `
    <h2 class="text-2xl md:text-3xl font-display font-semibold text-text mb-12 flex items-center reveal">
      <span class="text-amber font-mono text-base mr-3">// stack</span>
      <div class="ml-4 h-px bg-hair flex-grow"></div>
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${categories}</div>
  `;
}

function allTechTags() {
  const tags = new Set();
  [...portfolioData.projects.featured, ...portfolioData.projects.other]
    .forEach((p) => p.tech.forEach((t) => tags.add(t)));
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function renderProjects() {
  const featuredHTML = portfolioData.projects.featured.map((project) => {
    const layoutDirection = project.reverse ? 'lg:flex-row-reverse' : 'lg:flex-row';
    const textAlignment = project.reverse ? 'lg:items-start text-left' : 'lg:items-end text-left lg:text-right';
    const techListAlignment = project.reverse ? 'justify-start' : 'lg:justify-end';
    const techList = project.tech.map((t) => `<li class="text-teal">${escapeHTML(t)}</li>`).join('');

    const links = [];
    if (project.github) links.push(`<a href="${project.github}" class="text-muted hover:text-amber transition-colors" aria-label="${escapeHTML(project.title)} GitHub repo"><i class="fab fa-github text-xl" aria-hidden="true"></i></a>`);
    if (project.live) links.push(`<a href="${project.live}" class="text-muted hover:text-amber transition-colors" aria-label="${escapeHTML(project.title)} live demo"><i class="fas fa-external-link-alt text-xl" aria-hidden="true"></i></a>`);

    return `
      <div class="reveal flex flex-col ${layoutDirection} items-center gap-8" data-tech="${project.tech.map(escapeHTML).join('|')}">
        <div class="lg:w-7/12 schematic w-full rounded-xl overflow-hidden border border-hair">
          <img src="${project.image}" alt="${escapeHTML(project.title)} screenshot" loading="lazy" decoding="async" width="800" height="500" class="w-full h-auto object-cover">
        </div>
        <div class="lg:w-5/12 z-10 flex flex-col ${textAlignment}">
          <p class="text-amber font-mono text-xs mb-2 tracking-wide uppercase">${escapeHTML(project.type)}</p>
          <h3 class="text-xl md:text-2xl font-display font-semibold text-text mb-4">${escapeHTML(project.title)}</h3>
          <div class="bg-surface p-6 rounded-xl border border-hair mb-4 text-muted leading-relaxed text-sm md:text-base">
            ${escapeHTML(project.description)}
          </div>
          <ul class="flex flex-wrap ${techListAlignment} gap-3 text-xs font-mono mb-6">${techList}</ul>
          <div class="flex gap-4">${links.join('')}</div>
        </div>
      </div>
    `;
  }).join('');

  const otherHTML = portfolioData.projects.other.map((project) => {
    const techList = project.tech.map((t) => `<li>${escapeHTML(t)}</li>`).join('');
    const links = [];
    if (project.github) links.push(`<a href="${project.github}" class="text-muted hover:text-amber" aria-label="${escapeHTML(project.title)} GitHub repo"><i class="fab fa-github text-lg" aria-hidden="true"></i></a>`);
    if (project.live) links.push(`<a href="${project.live}" class="text-muted hover:text-amber" aria-label="${escapeHTML(project.title)} live demo"><i class="fas fa-external-link-alt text-lg" aria-hidden="true"></i></a>`);

    return `
      <div class="reveal project-card bg-surface p-6 rounded-xl border border-hair hover:border-amber/40 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full" data-tech="${project.tech.map(escapeHTML).join('|')}">
        <div class="flex justify-between items-start mb-6">
          <i class="far fa-folder text-3xl text-amber" aria-hidden="true"></i>
          <div class="flex gap-3">${links.join('')}</div>
        </div>
        <h4 class="text-lg font-display font-semibold text-text mb-3">${escapeHTML(project.title)}</h4>
        <p class="text-muted text-sm mb-6 flex-grow leading-relaxed">${escapeHTML(project.description)}</p>
        <ul class="flex flex-wrap gap-3 text-xs font-mono text-muted mt-auto">${techList}</ul>
      </div>
    `;
  }).join('');

  const tags = allTechTags();
  const filterHTML = tags.length ? `
    <div class="flex flex-wrap gap-2 mb-10 reveal" role="group" aria-label="Filter projects by technology" id="project-filters">
      <button type="button" class="filter-chip" data-filter="all" aria-pressed="true">all</button>
      ${tags.map((t) => `<button type="button" class="filter-chip" data-filter="${escapeHTML(t)}" aria-pressed="false">${escapeHTML(t)}</button>`).join('')}
    </div>
  ` : '';

  $('projects-container').innerHTML = `
    <h2 class="text-2xl md:text-3xl font-display font-semibold text-text mb-8 flex items-center reveal">
      <span class="text-amber font-mono text-base mr-3">// ${escapeHTML(portfolioData.projects.title.toLowerCase())}</span>
      <div class="ml-4 h-px bg-hair flex-grow"></div>
    </h2>
    ${filterHTML}
    <div class="space-y-24" id="featured-projects">${featuredHTML}</div>
    <div class="mt-24">
      <h3 class="text-xl font-display font-semibold text-text mb-8 text-center reveal">${escapeHTML(portfolioData.projects.otherTitle)}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="other-projects">${otherHTML}</div>
    </div>
    <p id="no-results" class="hidden text-center text-muted font-mono text-sm mt-10">// no projects match this filter</p>
  `;

  initProjectFilters();
}

function initProjectFilters() {
  const chips = document.querySelectorAll('#project-filters .filter-chip');
  const cards = document.querySelectorAll('#featured-projects > [data-tech], #other-projects > [data-tech]');
  const noResults = $('no-results');
  if (!chips.length) return;

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));

      let visibleCount = 0;
      cards.forEach((card) => {
        const techs = card.dataset.tech.split('|');
        const show = activeFilter === 'all' || techs.includes(activeFilter);
        card.classList.toggle('hidden', !show);
        if (show) visibleCount++;
      });
      noResults?.classList.toggle('hidden', visibleCount !== 0);
    });
  });
}

function renderContact() {
  const c = portfolioData.contact;
  $('contact-container').innerHTML = `
    <p class="text-amber font-mono mb-4 text-sm reveal">${escapeHTML(c.step)} <span class="text-muted">// ${escapeHTML(c.preTitle.toLowerCase())}</span></p>
    <h2 class="text-3xl md:text-4xl font-display font-bold text-text mb-6 reveal">${escapeHTML(c.title)}</h2>
    <p class="text-muted text-base md:text-lg mb-10 leading-relaxed reveal">${escapeHTML(c.description)}</p>
    <div class="flex flex-wrap justify-center gap-4 reveal">
      <a href="mailto:${portfolioData.meta.email}" class="inline-flex items-center gap-2 bg-amber hover:bg-amber/90 text-[#171208] font-mono font-medium py-3.5 px-8 rounded-lg transition-colors">
        ${escapeHTML(c.buttonText)}
      </a>
      <button id="copy-email-btn" type="button" class="inline-flex items-center gap-2 border border-hair hover:border-amber/50 text-text font-mono text-sm py-3.5 px-6 rounded-lg transition-colors">
        <i class="far fa-copy" aria-hidden="true"></i> <span id="copy-email-label">copy email</span>
      </button>
    </div>
  `;

  $('copy-email-btn')?.addEventListener('click', async () => {
    const label = $('copy-email-label');
    try {
      await navigator.clipboard.writeText(portfolioData.meta.email);
      showToast('Email copied to clipboard');
      label.textContent = 'copied!';
    } catch {
      label.textContent = portfolioData.meta.email;
    }
    setTimeout(() => { label.textContent = 'copy email'; }, 1800);
  });
}

function renderFooterAndLinks() {
  const year = new Date().getFullYear();
  const s = portfolioData.meta.socials;
  $('footer-container').innerHTML = `
    <footer class="py-8 border-t border-hair text-center">
      <div class="flex justify-center gap-6 mb-4 md:hidden">
        <a href="${s.github}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-amber transition-colors" aria-label="GitHub"><i class="fab fa-github text-xl" aria-hidden="true"></i></a>
        <a href="${s.linkedin}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-amber transition-colors" aria-label="LinkedIn"><i class="fab fa-linkedin text-xl" aria-hidden="true"></i></a>
        <a href="${s.twitter}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-amber transition-colors" aria-label="Twitter"><i class="fab fa-twitter text-xl" aria-hidden="true"></i></a>
      </div>
      <p class="text-muted font-mono text-xs">
        <a href="${s.github}" target="_blank" rel="noopener noreferrer" class="link-underline hover:text-text transition-colors">
          designed &amp; built by ${escapeHTML(portfolioData.meta.name)} · ${year}
        </a>
      </p>
    </footer>

    <div class="hidden md:flex fixed left-10 bottom-0 flex-col items-center gap-6 z-40 after:content-[''] after:block after:w-px after:h-24 after:bg-hair">
      <a href="${s.github}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-amber hover:-translate-y-1 transition-all duration-200" aria-label="GitHub"><i class="fab fa-github text-lg" aria-hidden="true"></i></a>
      <a href="${s.linkedin}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-amber hover:-translate-y-1 transition-all duration-200" aria-label="LinkedIn"><i class="fab fa-linkedin text-lg" aria-hidden="true"></i></a>
      <a href="${s.twitter}" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-amber hover:-translate-y-1 transition-all duration-200" aria-label="Twitter"><i class="fab fa-twitter text-lg" aria-hidden="true"></i></a>
    </div>

    <div class="hidden md:flex fixed right-10 bottom-0 flex-col items-center gap-6 z-40 after:content-[''] after:block after:w-px after:h-24 after:bg-hair">
      <a href="mailto:${portfolioData.meta.email}" class="text-muted hover:text-amber hover:-translate-y-1 transition-all duration-200 font-mono text-xs" style="writing-mode: vertical-rl;">
        ${portfolioData.meta.email}
      </a>
    </div>

    <button id="back-to-top" type="button" aria-label="Back to top">
      <i class="fas fa-arrow-up" aria-hidden="true"></i>
    </button>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
  `;
}

/* ---------------------------------------------------------------------- */
/* Toast helper                                                           */
/* ---------------------------------------------------------------------- */

let toastTimer;
function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

/* ---------------------------------------------------------------------- */
/* Theme toggle (night / day)                                             */
/* ---------------------------------------------------------------------- */

const THEME_COLORS = { dark: '#0B1215', light: '#F5F3EE' };

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch (e) { /* storage unavailable — theme just won't persist */ }

  const metaThemeColor = $('theme-color-meta');
  if (metaThemeColor) metaThemeColor.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark);

  const isLight = theme === 'light';
  document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(isLight));
    btn.setAttribute('aria-label', isLight ? 'Switch to night mode' : 'Switch to day mode');
  });
}

function initThemeToggle() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current);

  document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next);
      showToast(next === 'light' ? 'Day mode' : 'Night mode');
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Interaction wiring (nav, scroll progress, reveal, active-section)      */
/* ---------------------------------------------------------------------- */

function initializeEvents() {
  initThemeToggle();

  const btn = $('mobile-menu-btn');
  const menu = $('mobile-menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const isOpen = !menu.classList.contains('hidden');
      menu.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.classList.contains('hidden')) {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  }

  const nav = $('site-nav');
  const topbar = $('topbar');
  const railFill = $('rail-fill');
  const backToTop = $('back-to-top');

  let ticking = false;
  function onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 0;
    if (topbar) topbar.style.width = progress + '%';
    if (railFill) railFill.style.height = progress + '%';
    if (nav) nav.classList.toggle('shadow-lg', scrollTop > 10);
    if (backToTop) backToTop.classList.toggle('visible', scrollTop > 480);
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  backToTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  const sections = ['about', 'skills', 'projects', 'contact']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const navLinks = document.querySelectorAll('.nav-link');
    const railNodes = document.querySelectorAll('.rail-node');

    const setActive = (id) => {
      navLinks.forEach((l) => {
        const isActive = l.dataset.nav === id;
        l.classList.toggle('text-amber', isActive);
        l.classList.toggle('text-muted', !isActive);
        if (isActive) l.setAttribute('aria-current', 'true'); else l.removeAttribute('aria-current');
      });
      railNodes.forEach((n) => n.classList.toggle('active', n.dataset.rail === id));
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-45% 0px -45% 0px' });

    sections.forEach((sec) => sectionObserver.observe(sec));
  }
}

/* ---------------------------------------------------------------------- */
/* Boot                                                                    */
/* ---------------------------------------------------------------------- */

async function init() {
  try {
    portfolioData = await loadPortfolioData();
    renderMeta();
    renderNavigation();
    renderRail();
    renderHero();
    renderAbout();
    renderSkills();
    renderProjects();
    renderContact();
    renderFooterAndLinks();
    initializeEvents();
  } catch (err) {
    renderErrorState(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
