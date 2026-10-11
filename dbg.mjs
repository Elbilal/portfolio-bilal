import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
p.on('response', r=>r.status()>=400&&console.log(r.status(), r.url()));
p.on('pageerror', e=>console.log('err', e.message));
await p.goto(process.argv[2]); await p.waitForTimeout(2500);
console.log(await p.evaluate(()=>document.querySelector('main').innerText.slice(0,200)));
await b.close();
