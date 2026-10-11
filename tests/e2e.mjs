// Drives the hero terminal in Chromium. Run with: npm run test:e2e
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'text/plain' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const constText = () => page.locator('[data-term-const]').innerText();
const log = () => page.locator('[data-term-log]').innerText();
const input = page.locator('[data-term-input]');
let failed = 0;
async function step(name, fn) {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}

try {
  await page.goto(url);
  await input.waitFor();

  await step('shows the engineer const on load', async () => {
    assert.match(await constText(), /const engineer = \{/);
  });

  await step('typing erases the const', async () => {
    await input.focus();
    await input.pressSequentially('ski');
    await page.waitForFunction(() => document.querySelector('[data-term-const]').innerText.includes('awaiting'));
  });

  await step('deleting the input brings the const back', async () => {
    await input.fill('');
    await input.dispatchEvent('input');
    await page.waitForFunction(() => /const engineer = \{[\s\S]*\};/.test(document.querySelector('[data-term-const]').innerText));
  });

  await step('a command refills the const from its .md file', async () => {
    await input.pressSequentially('skills');
    await input.press('Enter');
    await page.waitForFunction(() => /const stack = \{[\s\S]*\};/.test(document.querySelector('[data-term-const]').innerText));
    assert.match(await log(), /AI & automation/);
  });

  await step('aliases work (whoami → about)', async () => {
    await input.pressSequentially('whoami');
    await input.press('Enter');
    await page.waitForFunction(() => /const me = \{[\s\S]*\};/.test(document.querySelector('[data-term-const]').innerText));
  });

  await step('unknown commands report an error and keep the const', async () => {
    await input.pressSequentially('rm -rf /');
    await input.press('Enter');
    await page.waitForFunction(() => /const me = \{[\s\S]*\};/.test(document.querySelector('[data-term-const]').innerText));
    assert.match(await log(), /command not found: rm/);
  });

  await step('Tab completes a command', async () => {
    await input.pressSequentially('educ');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'education');
    await input.press('Enter');
    await page.waitForFunction(() => /const education = \{/.test(document.querySelector('[data-term-const]').innerText));
  });

  await step('ArrowUp recalls history', async () => {
    await input.press('ArrowUp');
    assert.equal(await input.inputValue(), 'education');
    await input.press('Control+c');
    assert.equal(await input.inputValue(), '');
  });

  await step('reset restores the original const', async () => {
    await input.pressSequentially('reset');
    await input.press('Enter');
    await page.waitForFunction(() => /const engineer = \{[\s\S]*\};/.test(document.querySelector('[data-term-const]').innerText));
  });

  await step('clear empties the screen', async () => {
    await input.pressSequentially('clear');
    await input.press('Enter');
    assert.equal((await log()).trim(), '');
  });

  await step('no page errors', async () => assert.deepEqual(errors, []));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
