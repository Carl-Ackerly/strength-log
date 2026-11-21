import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const startServer = () => spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit' });
let server = startServer();
const base = 'http://127.0.0.1:4173/strength-log/';
let browser;
await mkdir('test-results', { recursive: true });
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await (process.env.BROWSER === 'webkit' ? webkit : chromium).launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/New_York', serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(base);
  await page.getByRole('heading', { name: /Your training/ }).waitFor();
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)');
  assert.equal(await page.getByText('Rest timer', { exact: true }).count(), 0);
  const nav = name => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
  await nav('Workouts').click();
  await page.getByRole('button', { name: 'Open for today', exact: true }).first().click();
  await page.getByRole('button', { name: /Machine Chest Press/ }).click();
  await page.getByLabel('Resistance type', { exact: true }).selectOption('level');
  await page.getByLabel('Set 1 level', { exact: true }).fill('7');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Set 1 Moderate', exact: true }).click();
  await page.getByLabel('Complete set 1', { exact: true }).check();
  await page.getByRole('button', { name: 'Next Exercise', exact: true }).click();
  await page.getByRole('heading', { name: 'Incline Chest Press', exact: true }).waitFor();
  await page.getByLabel('Set 1 weight', { exact: true }).fill('50');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('10');
  await page.getByLabel('Complete set 1', { exact: true }).check();
  await page.getByRole('button', { name: 'Next Exercise', exact: true }).click();
  await page.getByRole('heading', { name: 'Machine Shoulder Press', exact: true }).waitFor();
  await page.getByLabel('Resistance type', { exact: true }).selectOption('bodyweight');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('8');
  await page.getByLabel('Complete set 1', { exact: true }).check();
  await page.getByRole('button', { name: 'Next Exercise', exact: true }).click();
  await page.getByRole('heading', { name: 'Lateral Raise Machine', exact: true }).waitFor();
  await page.getByLabel('Resistance type', { exact: true }).selectOption('reps');
  await page.getByLabel('Set 1 reps', { exact: true }).fill('15');
  await page.getByLabel('Complete set 1', { exact: true }).check();
  await page.getByRole('button', { name: 'Back to Exercise List', exact: true }).first().click();
  await page.getByRole('button', { name: /Machine Chest Press/ }).click();
  assert.equal(await page.getByLabel('Set 1 level', { exact: true }).inputValue(), '7');
  await page.reload();
  assert.equal(await page.getByLabel('Set 1 reps', { exact: true }).inputValue(), '12');
  assert.equal(await page.getByLabel('Complete set 1', { exact: true }).isChecked(), true);
  assert.equal(await page.getByRole('button', { name: 'Set 1 Moderate', exact: true }).getAttribute('aria-pressed'), 'true');
  // All optional effort controls can be cleared and selected again.
  await page.getByRole('button', { name: 'Set 1 Moderate', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Set 1 Moderate', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.getByRole('button', { name: 'Set 1 Moderate', exact: true }).click();
  await page.getByRole('button', { name: 'Open Feedback Notebook', exact: true }).click();
  await page.getByLabel('Category', { exact: true }).selectOption('Bug');
  await page.getByLabel('Note', { exact: true }).fill('Synthetic browser check feedback');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('strength-log:v1:/strength-log/')).noteDraft);
  assert.ok(Number.isFinite(Date.parse(draft.createdAt)));
  await page.getByRole('button', { name: 'Close Feedback Notebook', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open Feedback Notebook', exact: true }).click();
  assert.equal(await page.getByLabel('Note', { exact: true }).inputValue(), 'Synthetic browser check feedback');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('button', { name: 'Export notes', exact: true }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Close Feedback Notebook', exact: true }).click();
  await page.getByRole('button', { name: 'Settings and backup', exact: true }).click();
  await page.getByRole('checkbox').uncheck();
  await page.goBack();
  assert.equal(await page.getByRole('button', { name: 'Set 1 Moderate', exact: true }).count(), 0);
  const beforeFinish = await page.evaluate(() => JSON.parse(localStorage.getItem('strength-log:v1:/strength-log/')));
  const today = Object.keys(beforeFinish.days)[0];
  assert.equal(beforeFinish.notes[0].category, 'Bug');
  assert.match(beforeFinish.notes[0].context, /Machine Chest Press/);
  await page.getByRole('button', { name: 'Back to Exercise List', exact: true }).first().click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await nav('Progress').click();
  await page.getByLabel('Resistance type', { exact: true }).selectOption('level');
  await page.getByText('Level 7 × 12 · Moderate', { exact: true }).first().waitFor();
  assert.match(await page.locator('.stats-grid').innerText(), /500 lb/);
  // Backups contain all new data and restore through the public UI.
  await page.getByRole('button', { name: 'Settings and backup', exact: true }).click();
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup', exact: true }).click()]);
  const backupPath = await backup.path();
  const exported = JSON.parse(await readFile(backupPath, 'utf8'));
  assert.equal(exported.days[today].sets['Chest press:0'].difficulty, 'moderate');
  await page.getByLabel('Restore backup file', { exact: true }).setInputFiles(backupPath);
  await page.getByRole('heading', { name: /Your training/ }).waitFor();
  // Completed comparison on a future date shows original machine units and effort.
  const next = new Date(today + 'T12:00:00'); next.setDate(next.getDate() + 1);
  const tomorrow = [next.getFullYear(), next.getMonth() + 1, next.getDate()].map(n => String(n).padStart(2, '0')).join('-');
  await page.goto(base + '#/calendar');
  await page.getByRole('button', { name: 'Next month', exact: true }).waitFor();
  // Plan directly via calendar day button, switching month if needed.
  if (next.getMonth() !== Number(today.slice(5, 7)) - 1) await page.getByRole('button', { name: 'Next month', exact: true }).click();
  const dateName = next.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  await page.getByRole('button', { name: dateName + ', No workout planned', exact: true }).click();
  await page.getByRole('button', { name: 'Push', exact: true }).click();
  await page.getByRole('button', { name: 'Open workout', exact: true }).click();
  await page.getByRole('button', { name: /Machine Chest Press/ }).click();
  await page.getByText('Last: Level 7 × 12 · Moderate', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Set 1 level', { exact: true }).inputValue(), '');
  await page.screenshot({ path: 'test-results/exercise-mobile.png', fullPage: true });
  for (const width of [320, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(base + '#/exercise/' + tomorrow + '/0');
    await page.getByRole('heading', { name: 'Machine Chest Press', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'exercise overflow at ' + width);
    await nav('Home').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'home overflow at ' + width);
    await nav('Calendar').click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'calendar overflow at ' + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await nav('Workouts').click();
  await page.getByRole('button', { name: 'Customize', exact: true }).first().click();
  await page.getByLabel('Exercise 1 name', { exact: true }).fill('Custom Chest Press');
  await page.getByRole('button', { name: 'Save routine', exact: true }).click();
  const customized = await page.evaluate(() => JSON.parse(localStorage.getItem('strength-log:v1:/strength-log/')));
  assert.equal(customized.templates.Push[0].name, 'Custom Chest Press');
  assert.equal(customized.days[today].exercises[0].name, 'Machine Chest Press');
  await nav('Home').click();
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  // After service worker activation the entire shell survives an offline reload.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  // Stop the actual origin, verifying cached navigation without relying on
  // WebKit's protocol-level offline emulation (which can reject navigation internally).
  await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  await page.reload();
  await page.getByRole('heading', { name: /Your training/ }).waitFor();
  await nav('Workouts').click();
  await page.getByRole('button', { name: 'Open for today', exact: true }).first().waitFor();
  server = startServer();
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.deepEqual(errors, []);
  await context.close();

  // Legacy import and malformed-storage recovery use separate browser profiles.
  const recovery = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await recovery.newPage();
  p.on('dialog', d => d.accept());
  await p.goto(base);
  await p.evaluate(() => localStorage.setItem('strength-log:v1:/strength-log/', '{broken'));
  await p.reload();
  await p.getByRole('button', { name: 'Settings and backup', exact: true }).click();
  const legacy = { version: 1, mode: 'log', seconds: 90, days: { '2026-01-02': { type: 'Push', completed: true, sets: {
    'Pec deck:2': { weight: '50', reps: '10', done: true }
  } } } };
  await writeFile('test-results/legacy-fixture.json', JSON.stringify(legacy));
  await p.getByLabel('Restore backup file', { exact: true }).setInputFiles('test-results/legacy-fixture.json');
  await p.getByRole('heading', { name: /Your training/ }).waitFor();
  const recovered = await p.evaluate(() => JSON.parse(localStorage.getItem('strength-log:v1:/strength-log/')));
  assert.equal(recovered.days['2026-01-02'].sets['Pec deck:2'].weight, '50');
  assert.equal(await p.evaluate(() => localStorage.getItem('strength-log:v1:/strength-log/:before-restore')), '{broken');
  await p.goto(base + '#/workout/2026-01-02');
  await p.getByRole('button', { name: /Pec Deck/ }).click();
  assert.equal(await p.getByLabel('Set 3 weight', { exact: true }).inputValue(), '50');
  await recovery.close();
  console.log('PASS: mobile navigation, all-set persistence, machine units, ratings, feedback, backup restore, legacy recovery, routine customization, responsive layouts and offline shell.');
} catch (error) {
  console.error(error);
  if (browser) {
    for (const context of browser.contexts()) for (const page of context.pages()) {
      console.error('Failure page:', page.url(), await page.locator('body').innerText());
      await page.screenshot({ path: 'test-results/failure.png', fullPage: true }).catch(() => {});
      await writeFile('test-results/failure.html', await page.content()).catch(() => {});
    }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}
