// Checks the locale files and every terminal command file in every language.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

// terminal.js is a browser script; evaluate it and grab the Terminal global.
const ctx = vm.createContext({ window: {}, document: {} });
vm.runInContext(read('assets/js/terminal.js') + '\nthis.Terminal = Terminal;', ctx);
// Round-trip through JSON so results are plain objects from this realm.
const plain = (fn) => (...a) => JSON.parse(JSON.stringify(fn(...a)));
const parseDoc = plain(ctx.Terminal.parseDoc);
const parseIndex = plain(ctx.Terminal.parseIndex);

const LANGS = ['en', 'fr', 'ar'];
const builtins = ['help', 'clear', 'reset', 'ls', 'history', 'sudo', 'cat', 'engineer', 'exit', 'lang'];
const commandsFor = (lang) => parseIndex(read(`terminal/${lang}/index.md`));
const enCommands = commandsFor('en').map((c) => c.name);

// Without it, branch-based GitHub Pages runs Jekyll, which turns every .md with
// front matter into .html and every command fails with "couldn't load".
test('.nojekyll exists so Pages serves the .md files as-is', () => {
  assert.ok(existsSync(root + '.nojekyll'), '.nojekyll is missing from the repo root');
});

/* ---------------- locales/<lang>.json ---------------- */

// Shape of a value: objects by key, arrays by length, leaves by type.
const shape = (v) => Array.isArray(v) ? v.map(shape)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape(v[k])]))
  : typeof v;
const locale = (lang) => JSON.parse(read(`locales/${lang}.json`));

for (const lang of LANGS) {
  test(`locales/${lang}.json has the same structure as en.json`, () => {
    assert.deepEqual(shape(locale(lang)), shape(locale('en')),
      `locales/${lang}.json is missing or has extra keys/items compared with en.json`);
  });
}

test('links, images and tech tags are identical in every language', () => {
  const shared = (d) => ({
    email: d.meta.email, socials: d.meta.socials, resume: d.meta.resume, image: d.hero.image,
    projects: [...d.projects.featured, ...d.projects.other].map((p) => [p.github, p.live, p.image, p.tech]),
  });
  for (const lang of LANGS) assert.deepEqual(shared(locale(lang)), shared(locale('en')), `${lang} differs from en`);
});

/* ---------------- terminal/<lang>/*.md ---------------- */

test('en lists commands', () => {
  assert.ok(enCommands.length > 0, 'no commands found in terminal/en/index.md');
});

test('command names are unique and do not shadow built-ins', () => {
  assert.equal(new Set(enCommands).size, enCommands.length, 'duplicate command in index.md');
  enCommands.forEach((n) => assert.ok(!builtins.includes(n), `"${n}" collides with a built-in`));
});

for (const lang of LANGS) {
  test(`terminal/${lang}/index.md lists the same commands as en`, () => {
    assert.deepEqual(commandsFor(lang).map((c) => c.name), enCommands);
  });

  test(`terminal/${lang}: aliases are unique and don't shadow commands`, () => {
    const seen = new Map();
    for (const name of enCommands) {
      for (const alias of parseDoc(read(`terminal/${lang}/${name}.md`)).meta.aliases) {
        assert.ok(!seen.has(alias), `alias "${alias}" used by both ${seen.get(alias)} and ${name}`);
        assert.ok(!enCommands.includes(alias) && !builtins.includes(alias), `alias "${alias}" shadows a command`);
        seen.set(alias, name);
      }
    }
  });

  for (const name of enCommands) {
    test(`terminal/${lang}/${name}.md`, () => {
      const path = `terminal/${lang}/${name}.md`;
      assert.ok(existsSync(root + path), `${path} is listed in index.md but missing`);
      const doc = parseDoc(read(path));
      assert.ok(Object.keys(doc.fields).length > 0, `${path} has no const fields in its front matter`);
      assert.ok(doc.body.length > 0, `${path} has no body to print`);
      if (doc.meta.var) assert.match(doc.meta.var, /^[A-Za-z_$][\w$]*$/, `${path}: var must be a valid JS identifier`);
    });
  }
}

test('parseDoc reads scalars, lists and aliases', () => {
  const doc = parseDoc('---\nvar: x\naliases: a, b\nn: 3\nok: false\ns: "hi"\nlist:\n  - one\n  - 2\n---\nbody');
  assert.deepEqual(doc.meta.aliases, ['a', 'b']);
  assert.equal(doc.meta.var, 'x');
  assert.deepEqual(doc.fields, { n: 3, ok: false, s: 'hi', list: ['one', 2] });
  assert.equal(doc.body, 'body');
});
