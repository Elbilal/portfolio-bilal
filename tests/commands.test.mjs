// Checks every command listed in terminal/index.md has a valid Markdown file.
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

const commands = parseIndex(read('terminal/index.md'));
const builtins = ['help', 'clear', 'reset', 'ls', 'history', 'sudo', 'cat', 'engineer'];

test('index.md lists commands', () => {
  assert.ok(commands.length > 0, 'no commands found in terminal/index.md');
});

test('command names are unique and do not shadow built-ins', () => {
  const names = commands.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, 'duplicate command in index.md');
  names.forEach((n) => assert.ok(!builtins.includes(n), `"${n}" collides with a built-in`));
});

test('aliases are unique across commands', () => {
  const seen = new Map();
  for (const { name } of commands) {
    for (const alias of parseDoc(read(`terminal/${name}.md`)).meta.aliases) {
      assert.ok(!seen.has(alias), `alias "${alias}" used by both ${seen.get(alias)} and ${name}`);
      assert.ok(!commands.some((c) => c.name === alias), `alias "${alias}" shadows a command`);
      seen.set(alias, name);
    }
  }
});

for (const { name } of commands) {
  test(`terminal/${name}.md`, () => {
    const path = `terminal/${name}.md`;
    assert.ok(existsSync(root + path), `${path} is listed in index.md but missing`);
    const doc = parseDoc(read(path));
    assert.ok(Object.keys(doc.fields).length > 0, `${path} has no const fields in its front matter`);
    assert.ok(doc.body.length > 0, `${path} has no body to print`);
    if (doc.meta.var) assert.match(doc.meta.var, /^[A-Za-z_$][\w$]*$/, `${path}: var must be a valid JS identifier`);
  });
}

test('parseDoc reads scalars, lists and aliases', () => {
  const doc = parseDoc('---\nvar: x\naliases: a, b\nn: 3\nok: false\ns: "hi"\nlist:\n  - one\n  - 2\n---\nbody');
  assert.deepEqual(doc.meta.aliases, ['a', 'b']);
  assert.equal(doc.meta.var, 'x');
  assert.deepEqual(doc.fields, { n: 3, ok: false, s: 'hi', list: ['one', 2] });
  assert.equal(doc.body, 'body');
});
