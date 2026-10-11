// Drives the hero terminal in Chromium. Run with: npm run test:e2e
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// SITE_DIR=dist serves the folder the deploy workflow publishes instead of the repo.
const root = process.env.SITE_DIR
  ? join(fileURLToPath(new URL('..', import.meta.url)), process.env.SITE_DIR, '/')
  : fileURLToPath(new URL('..', import.meta.url));
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

  const isShell = () => page.locator('#hero-terminal').evaluate((el) => el.classList.contains('is-shell'));
  const waitShell = (on) => page.waitForFunction((on) => document.querySelector('#hero-terminal').classList.contains('is-shell') === on, on);

  await step('typing hides the const and opens the shell', async () => {
    await input.focus();
    await input.pressSequentially('ski');
    await waitShell(true);
    assert.equal((await constText()).trim(), '');
  });

  await step('deleting the input keeps the shell open', async () => {
    await input.fill('');
    await input.dispatchEvent('input');
    await page.waitForTimeout(300);
    assert.equal(await isShell(), true);
  });

  await step('a command prints its .md file in the terminal', async () => {
    await input.pressSequentially('skills');
    await input.press('Enter');
    await page.waitForFunction(() => /const stack = \{/.test(document.querySelector('[data-term-log]').innerText));
    assert.match(await log(), /AI & automation/);
    assert.equal(await isShell(), true);
  });

  await step('aliases work (whoami → about)', async () => {
    await input.pressSequentially('whoami');
    await input.press('Enter');
    await page.waitForFunction(() => /const me = \{/.test(document.querySelector('[data-term-log]').innerText));
  });

  await step('unknown commands report an error', async () => {
    await input.pressSequentially('rm -rf /');
    await input.press('Enter');
    await page.waitForFunction(() => /command not found: rm/.test(document.querySelector('[data-term-log]').innerText));
  });

  await step('Tab completes a command', async () => {
    await input.pressSequentially('educ');
    await input.press('Tab');
    assert.equal(await input.inputValue(), 'education');
    await input.press('Enter');
    await page.waitForFunction(() => /const education = \{/.test(document.querySelector('[data-term-log]').innerText));
  });

  await step('ArrowUp recalls history, Ctrl+C cancels', async () => {
    await input.press('ArrowUp');
    assert.equal(await input.inputValue(), 'education');
    await input.press('Control+c');
    assert.equal(await input.inputValue(), '');
  });

  // Run every command help lists, like a visitor clicking through them all.
  const listed = await page.evaluate(async () => {
    const md = await (await fetch(`terminal/${document.documentElement.lang}/index.md`)).text();
    return [...md.matchAll(/^\s*[-*]\s+`?([\w-]+)`?\s*(?:—|–|-|:)/gm)].map((m) => m[1]);
  });
  for (const name of listed) {
    await step(`command "${name}" loads its file`, async () => {
      await input.pressSequentially('clear');
      await input.press('Enter');
      await input.pressSequentially(name);
      await input.press('Enter');
      await page.waitForFunction(() => /\S/.test(document.querySelector('[data-term-log]').innerText.split('\n').slice(1).join('')));
      await page.waitForTimeout(150);
      const out = await log();
      assert.doesNotMatch(out, /error:|command not found/, out);
      assert.match(out, /const \w+ = \{/, 'front matter was not printed');
    });
  }

  await step('clear empties the screen', async () => {
    await input.pressSequentially('clear');
    await input.press('Enter');
    assert.equal((await log()).trim(), '');
  });

  await step('reset closes the shell and brings the const back', async () => {
    await input.pressSequentially('reset');
    await input.press('Enter');
    await waitShell(false);
    await page.waitForFunction(() => /const engineer = \{[\s\S]*\};/.test(document.querySelector('[data-term-const]').innerText));
  });

  /* ---------------- languages ---------------- */

  const locales = Object.fromEntries(await Promise.all(['en', 'fr', 'ar'].map(async (l) =>
    [l, JSON.parse(await readFile(join(root, `locales/${l}.json`), 'utf8'))])));

  for (const lang of ['en', 'fr', 'ar']) {
    const ui = locales[lang];
    await step(`[${lang}] page renders in ${lang}`, async () => {
      await page.goto(`${url}?lang=${lang}`);
      await input.waitFor();
      assert.equal(await page.getAttribute('html', 'lang'), lang);
      assert.equal(await page.getAttribute('html', 'dir'), lang === 'ar' ? 'rtl' : 'ltr');
      assert.equal(await page.title(), ui.meta.seo.title);
      assert.equal((await page.locator('[data-nav="about"]').innerText()).trim(), ui.ui.nav.about);
      assert.equal((await page.locator('#hero h2').first().innerText()).trim(), ui.hero.headline);
      assert.match(await page.locator('#about-container').innerText(), new RegExp(ui.about.paragraphs[0].slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.match(await page.locator('#contact-container').innerText(), new RegExp(ui.contact.title));
      assert.match(await log(), new RegExp(ui.ui.terminal.lastLogin.split('{date}')[0].trim()));
    });

    await step(`[${lang}] every command loads its ${lang} file`, async () => {
      const names = await page.evaluate(async (l) => {
        const md = await (await fetch(`terminal/${l}/index.md`)).text();
        return [...md.matchAll(/^\s*[-*]\s+`?([\w-]+)`?\s*(?:—|–|-|:)/gm)].map((m) => m[1]);
      }, lang);
      assert.ok(names.length > 0);
      for (const name of names) {
        await input.pressSequentially('clear'); await input.press('Enter');
        await input.pressSequentially(name); await input.press('Enter');
        await page.waitForFunction(() => /const \w+ = \{/.test(document.querySelector('[data-term-log]').innerText));
        await page.waitForTimeout(100);
        assert.doesNotMatch(await log(), /error:|command not found|commande introuvable|أمر غير موجود/, `${lang}/${name}`);
      }
    });

    await step(`[${lang}] no horizontal scroll on desktop`, async () => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `page is ${over}px wider than the viewport`);
    });
  }

  await step('the language a visitor picks is remembered', async () => {
    await page.goto(`${url}?lang=fr`);
    await input.waitFor();
    await page.goto(url);
    await input.waitFor();
    assert.equal(await page.getAttribute('html', 'lang'), 'fr');
  });

  await step('nav switcher changes language', async () => {
    await page.locator('nav .lang-option[hreflang="ar"]').first().click();
    await page.waitForFunction(() => document.documentElement.lang === 'ar');
    await input.waitFor();
    assert.equal(await page.getAttribute('html', 'dir'), 'rtl');
  });

  await step('`lang en` in the terminal switches back to English', async () => {
    await input.pressSequentially('lang en');
    await input.press('Enter');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await input.waitFor();
    assert.equal(await page.getAttribute('html', 'dir'), 'ltr');
  });

  await step('no page errors', async () => assert.deepEqual(errors, []));
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
