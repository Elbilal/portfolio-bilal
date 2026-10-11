'use strict';

/**
 * Hero terminal
 * Commands are Markdown files in /terminal. terminal/index.md lists them
 * (`- name — description`); each <name>.md has a front-matter block whose
 * fields replace the `const` object above the prompt, and a Markdown body
 * that is printed as the command's output.
 */

const Terminal = (() => {
  const DIR = 'terminal/';
  const META_KEYS = new Set(['var', 'aliases']);
  const BUILTINS = {
    help: 'list available commands',
    clear: 'clear the terminal',
    reset: 'restore the original const',
    ls: 'list command files',
    history: 'show previous commands',
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  let els = {};
  let initial = null;           // { var, fields } shown on load
  let current = null;           // { var, fields } the const currently holds
  let constState = 'shown';     // 'shown' | 'erasing' | 'erased' | 'typing'
  let registry = null;          // [{ name, description }]
  const aliasMap = new Map();   // alias -> command name
  const cache = new Map();      // command name -> parsed doc
  const history = [];
  let historyIdx = 0;
  let typingToken = 0;

  /* ---------------- Markdown loading ---------------- */

  async function fetchText(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async function loadRegistry() {
    if (registry) return registry;
    registry = parseIndex(await fetchText(DIR + 'index.md'));
    return registry;
  }

  function parseIndex(md) {
    return md.split('\n')
      .map((l) => l.match(/^\s*[-*]\s+`?([\w-]+)`?\s*(?:—|–|-|:)\s*(.+)$/))
      .filter(Boolean)
      .map(([, name, description]) => ({ name: name.toLowerCase(), description: description.trim() }));
  }

  function parseScalar(v) {
    const s = v.trim().replace(/^(["'])(.*)\1$/, '$2');
    if (s === 'true' || s === 'false') return s === 'true';
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  }

  // Minimal front-matter parser: `key: value` and `key:` followed by `  - item` lists.
  function parseDoc(md) {
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const fields = {};
    let currentList = null;
    if (m) {
      m[1].split(/\r?\n/).forEach((line) => {
        const item = line.match(/^\s+-\s+(.*)$/);
        if (item && currentList) { fields[currentList].push(parseScalar(item[1])); return; }
        const kv = line.match(/^([\w-]+):\s*(.*)$/);
        if (!kv) return;
        const [, key, value] = kv;
        if (value === '') { fields[key] = []; currentList = key; } else { fields[key] = parseScalar(value); currentList = null; }
      });
    }
    const meta = { var: fields.var, aliases: [] };
    if (fields.aliases != null) {
      meta.aliases = (Array.isArray(fields.aliases) ? fields.aliases : String(fields.aliases).split(','))
        .map((a) => String(a).trim().toLowerCase()).filter(Boolean);
    }
    const data = Object.fromEntries(Object.entries(fields).filter(([k]) => !META_KEYS.has(k)));
    return { meta, fields: data, body: (m ? m[2] : md).trim() };
  }

  async function loadCommand(name) {
    if (cache.has(name)) return cache.get(name);
    const doc = parseDoc(await fetchText(`${DIR}${name}.md`));
    cache.set(name, doc);
    doc.meta.aliases.forEach((a) => aliasMap.set(a, name));
    return doc;
  }

  // Aliases live in each file's front matter, so preload them in the background.
  async function warmAliases() {
    const reg = await loadRegistry();
    await Promise.allSettled(reg.map((c) => loadCommand(c.name)));
  }

  /* ---------------- Markdown → terminal HTML ---------------- */

  function inline(text) {
    return esc(text)
      .replace(/`([^`]+)`/g, '<code class="term-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text">$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
        const safe = /^(https?:|mailto:|#)/.test(href) ? href : '#';
        const ext = /^https?:/.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${safe}"${ext} class="text-amber link-underline">${label}</a>`;
      });
  }

  function renderMarkdown(md) {
    const lines = md.split(/\r?\n/);
    const blocks = [];
    let para = [];
    let list = null;
    const flushPara = () => { if (para.length) blocks.push(`<p>${inline(para.join(' '))}</p>`); para = []; };
    const flushList = () => { if (list) blocks.push(`<ul class="term-list">${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`); list = null; };

    lines.forEach((line) => {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const bullet = line.match(/^\s*[-*]\s+(.*)$/);
      if (heading) { flushPara(); flushList(); blocks.push(`<p class="text-amber"># ${inline(heading[1])}</p>`); }
      else if (bullet) { flushPara(); (list ||= []).push(bullet[1]); }
      else if (!line.trim()) { flushPara(); flushList(); }
      else if (list && /^\s+/.test(line)) { list[list.length - 1] += ' ' + line.trim(); }
      else { flushList(); para.push(line.trim()); }
    });
    flushPara(); flushList();
    return blocks.join('');
  }

  /* ---------------- const block ---------------- */

  // Segments of [text, className]; typed out character by character.
  function constSegments(varName, fields) {
    const segs = [['const', 'text-muted'], [' '], [varName, 'text-teal'], [' = {\n']];
    const keys = Object.keys(fields);
    keys.forEach((key) => {
      const v = fields[key];
      segs.push([`  ${key}: `, 'text-text']);
      const inlineLen = Array.isArray(v) ? key.length + v.reduce((n, i) => n + JSON.stringify(i).length + 2, 6) : 0;
      if (Array.isArray(v) && inlineLen <= 50) {
        segs.push(['[']);
        v.forEach((item, i) => segs.push([JSON.stringify(item), typeof item === 'string' ? 'text-teal' : 'text-amber'], [i < v.length - 1 ? ', ' : '']));
        segs.push(['],\n']);
      } else if (Array.isArray(v)) {
        segs.push(['[\n']);
        v.forEach((item) => segs.push([`    ${JSON.stringify(item)}`, typeof item === 'string' ? 'text-teal' : 'text-amber'], [',\n']));
        segs.push(['  ],\n']);
      } else {
        segs.push([typeof v === 'string' ? JSON.stringify(v) : String(v), 'text-amber'], [',\n']);
      }
    });
    segs.push(['};']);
    return segs;
  }

  function segmentsToHTML(segs, limit = Infinity) {
    let out = '';
    let left = limit;
    for (const [text, cls] of segs) {
      if (left <= 0) break;
      const part = text.slice(0, left);
      left -= part.length;
      out += cls ? `<span class="${cls}">${esc(part)}</span>` : esc(part);
    }
    return out;
  }

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CARET = '<span class="caret"> </span>';
  const segLength = (segs) => segs.reduce((n, [t]) => n + t.length, 0);

  // Animate the visible character count from `from` to `to`, then call done().
  function animate(segs, from, to, frames, done) {
    const token = ++typingToken;
    if (reducedMotion()) { els.code.innerHTML = segmentsToHTML(segs, to); done?.(); return; }
    const step = Math.max(2, Math.ceil(Math.abs(to - from) / frames));
    let shown = from;
    const tick = () => {
      if (token !== typingToken) return;
      shown = to > from ? Math.min(to, shown + step) : Math.max(to, shown - step);
      els.code.innerHTML = segmentsToHTML(segs, shown) + (shown !== to || to === 0 ? CARET : '');
      if (shown !== to) requestAnimationFrame(tick); else done?.();
    };
    tick();
  }

  // Hold the window's height while the const is empty so the page doesn't jump.
  function lockHeight(on) {
    const box = els.code.parentElement;
    box.style.minHeight = on ? `${box.offsetHeight}px` : '';
  }

  function setWaiting(text) {
    els.code.innerHTML = `<span class="text-muted">${esc(text)}</span>${CARET}`;
  }

  // Backspace the const away; the window waits for the next command.
  function eraseConst() {
    if (constState === 'erased' || constState === 'erasing') return;
    lockHeight(true);
    constState = 'erasing';
    const segs = constSegments(current.var, current.fields);
    animate(segs, segLength(segs), 0, 18, () => {
      constState = 'erased';
      setWaiting('// awaiting command…');
    });
  }

  // Type a const in from empty.
  function fillConst(varName, fields) {
    current = { var: varName, fields };
    lockHeight(true);
    constState = 'typing';
    const segs = constSegments(varName, fields);
    animate(segs, 0, segLength(segs), 45, () => {
      constState = 'shown';
      lockHeight(false);
    });
  }

  // Bring back whatever the const held before the user started typing.
  function restoreConst() {
    if (constState === 'shown') return;
    fillConst(current.var, current.fields);
  }

  /* ---------------- output ---------------- */

  function print(html, cls = '') {
    const div = document.createElement('div');
    div.className = `term-out ${cls}`;
    div.innerHTML = html;
    els.log.appendChild(div);
    scrollToPrompt();
  }

  function scrollToPrompt() {
    requestAnimationFrame(() => { els.screen.scrollTop = els.screen.scrollHeight; });
  }

  function echo(cmd) {
    print(`<span class="text-teal">${esc(els.promptText)}</span> ${esc(cmd)}`, 'text-text');
  }

  async function helpText() {
    const reg = await loadRegistry();
    const row = (name, desc) => `<li><span class="term-cmd" data-cmd="${esc(name)}">${esc(name)}</span><span class="text-muted">${esc(desc)}</span></li>`;
    return `<p class="text-muted">about me:</p><ul class="term-help">${reg.map((c) => row(c.name, c.description)).join('')}</ul>`
      + `<p class="text-muted">shell:</p><ul class="term-help">${Object.entries(BUILTINS).map(([n, d]) => row(n, d)).join('')}</ul>`;
  }

  async function resolve(name) {
    if (aliasMap.has(name)) return aliasMap.get(name);
    const reg = await loadRegistry();
    return reg.some((c) => c.name === name) ? name : null;
  }

  async function run(raw) {
    const input = raw.trim();
    echo(input);
    if (!input) { restoreConst(); return; }
    history.push(input);
    historyIdx = history.length;

    const [cmdRaw, ...args] = input.split(/\s+/);
    let cmd = cmdRaw.toLowerCase();
    // `cat about.md` / `about.md` behave like `about`
    if (cmd === 'cat' && args[0]) cmd = args[0].toLowerCase();
    cmd = cmd.replace(/\.md$/, '');

    try {
      switch (cmd) {
        case 'help': case '?': restoreConst(); print(await helpText()); return;
        case 'clear': case 'cls': restoreConst(); els.log.innerHTML = ''; return;
        case 'reset': case 'engineer':
          fillConst(initial.var, initial.fields);
          print('<span class="text-muted">// const restored</span>');
          return;
        case 'ls': {
          restoreConst();
          const reg = await loadRegistry();
          print(reg.map((c) => `<span class="term-cmd" data-cmd="${esc(c.name)}">${esc(c.name)}.md</span>`).join('  '));
          return;
        }
        case 'history':
          restoreConst();
          print(history.map((h, i) => `<span class="text-muted">${String(i + 1).padStart(3)}</span>  ${esc(h)}`).join('<br>'));
          return;
        case 'sudo':
          restoreConst();
          print('<span class="text-danger">nice try.</span> <span class="text-muted">this incident will be reported.</span>');
          return;
      }

      const name = await resolve(cmd);
      if (!name) {
        restoreConst();
        print(`<span class="text-danger">command not found:</span> ${esc(cmd)} <span class="text-muted">— type</span> <span class="term-cmd" data-cmd="help">help</span>`);
        return;
      }
      eraseConst();
      const [doc] = await Promise.all([loadCommand(name), waitForErase()]);
      setWaiting(`// reading terminal/${name}.md…`);
      await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 220));
      fillConst(doc.meta.var || name, doc.fields);
      if (doc.body) print(renderMarkdown(doc.body), 'term-md');
    } catch (err) {
      console.error(err);
      restoreConst();
      print(`<span class="text-danger">error:</span> couldn't load ${esc(cmd)}.md`);
    }
  }

  function waitForErase() {
    return new Promise((resolve) => {
      const check = () => (constState === 'erasing' ? requestAnimationFrame(check) : resolve());
      check();
    });
  }

  async function complete() {
    const value = els.input.value.trim().toLowerCase();
    if (!value) return;
    const reg = await loadRegistry();
    const names = [...reg.map((c) => c.name), ...Object.keys(BUILTINS)];
    const matches = names.filter((n) => n.startsWith(value));
    if (matches.length === 1) { els.input.value = matches[0]; syncMirror(); }
    else if (matches.length > 1) { echo(els.input.value); print(matches.map(esc).join('  '), 'text-muted'); }
  }

  // The real <input> is invisible; this draws its text with a block cursor.
  function syncMirror() {
    if (!els.mirror) return;
    const v = els.input.value;
    const focused = document.activeElement === els.input;
    const pos = els.input.selectionStart ?? v.length;
    const under = v[pos] ?? ' ';
    els.mirror.classList.toggle('is-focused', focused);
    els.mirror.innerHTML = !v && !focused
      ? `<span class="term-placeholder">${esc(els.input.placeholder)}</span>`
      : `${esc(v.slice(0, pos))}<span class="term-cursor">${esc(under)}</span>${esc(v.slice(pos + 1))}`;
  }

  /* ---------------- wiring ---------------- */

  function mount(root, { varName, fields, prompt = 'guest@bilal:~$' }) {
    els = {
      code: root.querySelector('[data-term-const]'),
      screen: root.querySelector('[data-term-screen]'),
      log: root.querySelector('[data-term-log]'),
      input: root.querySelector('[data-term-input]'),
      mirror: root.querySelector('[data-term-mirror]'),
      promptText: prompt,
    };
    if (!els.code || !els.input) return;
    initial = { var: varName, fields };
    current = initial;
    els.code.innerHTML = segmentsToHTML(constSegments(varName, fields));

    const login = new Date().toString().split(' GMT')[0];
    print(`<span class="text-muted">Last login: ${esc(login)} on ttys001</span>`);
    print(`<span class="text-muted">type</span> <span class="term-cmd" data-cmd="help">help</span> <span class="text-muted">to list commands, or try</span> <span class="term-cmd" data-cmd="about">about</span>`);

    // Typing anything wipes the const; deleting back to nothing restores it.
    els.input.addEventListener('input', () => {
      if (els.input.value.trim()) eraseConst(); else restoreConst();
      syncMirror();
    });
    ['keyup', 'click', 'select', 'focus', 'blur'].forEach((ev) => els.input.addEventListener(ev, syncMirror));
    els.input.addEventListener('focus', scrollToPrompt);
    syncMirror();

    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const v = els.input.value;
        els.input.value = '';
        syncMirror();
        run(v);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIdx > 0) { els.input.value = history[--historyIdx]; eraseConst(); }
        syncMirror();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        historyIdx = Math.min(history.length, historyIdx + 1);
        els.input.value = history[historyIdx] ?? '';
        if (els.input.value) eraseConst(); else restoreConst();
        syncMirror();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        complete();
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        els.log.innerHTML = '';
      } else if (e.key === 'c' && e.ctrlKey && els.input.selectionStart === els.input.selectionEnd) {
        e.preventDefault();
        echo(`${els.input.value}^C`);
        els.input.value = '';
        syncMirror();
        restoreConst();
      }
    });

    // Clickable command names in output run that command.
    root.addEventListener('click', (e) => {
      const target = e.target.closest('[data-cmd]');
      if (target) { els.input.value = ''; syncMirror(); run(target.dataset.cmd); els.input.focus({ preventScroll: true }); return; }
      if (!e.target.closest('a') && !window.getSelection()?.toString()) els.input.focus({ preventScroll: true });
    });

    warmAliases().catch(() => {});
  }

  // parseDoc / parseIndex are exposed for tests/commands.test.mjs.
  return { mount, parseDoc, parseIndex };
})();
