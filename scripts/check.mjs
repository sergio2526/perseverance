// npm run check: abre la escena en Chrome invisible, guarda una captura y lista errores de consola.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const DEV_URL = 'http://localhost:5173/';
const OUT = 'screenshots/check.png';

async function isUp(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

let server = null;
let url = DEV_URL;
if (!(await isUp(DEV_URL))) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const problems = [];
page.on('console', (msg) => {
  // "GL Driver Message" son avisos de rendimiento del Chrome invisible al tomar la captura, no de la app.
  if ((msg.type() === 'error' || msg.type() === 'warning') && !msg.text().includes('GL Driver Message')) {
    problems.push(`[console.${msg.type()}] ${msg.text()}`);
  }
});
const logs = [];
page.on('console', (msg) => {
  if (msg.type() === 'log' || msg.type() === 'info') logs.push(msg.text());
});
page.on('pageerror', (err) => problems.push(`[pageerror] ${err.message}`));

let ok = true;
try {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 60000 });
  // Conduce un poco para que aparezcan huellas en la captura
  // (por distancia y no por tiempo: el Chrome invisible renderiza con pocos FPS)
  const drive = async (keys, meters) => {
    for (const k of keys) await page.keyboard.down(k);
    const start = await page.evaluate(() => window.__debug.odometer());
    await page.waitForFunction((m) => window.__debug.odometer() >= m, start + meters, { timeout: 90000 });
    for (const k of keys) await page.keyboard.up(k);
  };
  await drive(['KeyW'], 6);
  await drive(['KeyW', 'KeyA'], 4);
  await drive(['KeyW'], 2);
  // Prueba de colisión: apuntar a la roca grande más cercana y acelerar contra ella
  const startGap = await page.evaluate(() => window.__debug.aimAtNearestRock());
  await page.keyboard.down('KeyW');
  let minGap = Infinity;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    minGap = Math.min(minGap, await page.evaluate(() => window.__debug.rockGap()));
  }
  await page.keyboard.up('KeyW');
  // El rover (radio 1.3 m) debe quedar fuera de la roca: hueco centro-borde >= ~1.3 m
  const blocked = minGap > 1.2;
  logs.push(`Prueba de colisión: hueco inicial ${startGap.toFixed(1)} m, mínimo ${minGap.toFixed(2)} m → ${blocked ? 'la roca lo detuvo' : 'ATRAVESÓ LA ROCA'}`);
  if (!blocked) problems.push('[check] El rover atravesó una roca');
  await page.waitForTimeout(1000);
  const stats = await page.evaluate(() => ({
    odometer: window.__debug.odometer().toFixed(1),
    tracks: window.__debug.tracks(),
    fps: window.__debug.fps().toFixed(1),
  }));
  logs.push(`Prueba de manejo: ${stats.odometer} m recorridos, ${stats.tracks} huellas, ~${stats.fps} FPS (Chrome invisible)`);
} catch (e) {
  ok = false;
  problems.push(`[check] La escena no se marcó como lista: ${e.message.split('\n')[0]}`);
}

await mkdir('screenshots', { recursive: true });
await page.screenshot({ path: OUT });
await browser.close();
if (server) await server.close();

console.log(`URL: ${url}`);
console.log(`Captura: ${OUT}`);
for (const l of logs) console.log(`[console.log] ${l}`);
const errors = problems.filter((p) => !p.startsWith('[console.warning]'));
if (problems.length === 0) {
  console.log('Consola limpia: 0 errores, 0 advertencias.');
} else {
  console.log(`Problemas (${problems.length}):`);
  for (const p of problems) console.log('  ' + p);
}
process.exit(ok && errors.length === 0 ? 0 : 1);
