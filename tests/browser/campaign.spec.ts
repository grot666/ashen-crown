import { expect, test } from '@playwright/test';
import { concludeBattle, newCampaign, startBattle } from '../../src/engine/campaign';
import { nextRandom } from '../../src/engine/rng';

const KEY = 'ashen-crown:campaign:v2';
const seedBelow = (chance: number): number => { for (let s = 1; ; s++) if (nextRandom(s)[0] < chance) return s; };

/** Level 1 reduced to the warlord next to a 1-HP oracle, with a seed that guarantees the capture roll. */
function lastBlow() {
  const c = startBattle(newCampaign(11));
  const battle = c.battle!;
  const enemies = battle.units.filter(u => u.owner === 'elf');
  enemies.forEach(u => { u.hp = 0; });
  Object.assign(enemies[0], { kind: 'oracle', hp: 1, q: -2, r: 1 });
  battle.rng = seedBelow(0.65);
  return c;
}

test('starts the main campaign, deploys from the briefing and resumes the battle after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /灰烬征途/ })).toBeVisible();
  await page.getByRole('button', { name: '开始主线战役' }).click();
  await expect(page.locator('.level-card')).toHaveCount(9);
  await expect(page.locator('.level-card.locked')).toHaveCount(8);
  await expect(page.getByRole('meter', { name: '军队士气' }).first()).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('button', { name: '进入营地' }).click();
  await expect(page.getByRole('heading', { name: /焦土渡口/ })).toBeVisible();
  await expect(page.locator('.objective-box')).toContainText('10 轮内全歼守军');
  const raider = page.locator('[data-deploy="r-raider2"]');
  await raider.click();
  await expect(raider).toHaveAttribute('aria-pressed', 'false');
  await raider.click();
  await expect(raider).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '出征' }).click();
  await expect(page.locator('.objective-strip')).toContainText('限时');
  await expect(page.locator('.map-unit')).toHaveCount(10);
  await page.locator('.hex.reachable').first().click();
  await expect(page.getByRole('status')).toContainText('消耗');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('已恢复主线进度');
  await expect(page.locator('.objective-strip')).toContainText('剩余');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).phase, KEY)).toBe('battle');
  expect(errors).toEqual([]);
});

test('captures an enemy, reviews the result and recruits the prisoner in the camp', async ({ page }) => {
  const saved = JSON.stringify(lastBlow());
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, saved]);
  await page.goto('./');
  await expect(page.locator('.target-list')).toContainText('俘获 65%');
  await page.locator('.target-list [data-target]').first().click();
  await expect(page.getByRole('heading', { name: '焦土渡口，告捷。' })).toBeVisible();
  await page.getByRole('button', { name: '查看战果' }).click();
  await expect(page.locator('.result-card')).toContainText('哥布林·吉兹');
  await expect(page.locator('.captive-row')).toContainText('黯月先知');
  await page.getByRole('button', { name: /前往俘虏营/ }).click();
  await expect(page.locator('.prisoner-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /拔营/ })).toBeDisabled();
  await page.getByRole('button', { name: /^招募/ }).click();
  await expect(page.getByRole('status')).toContainText('归降者编入军团');
  await page.getByRole('button', { name: /拔营/ }).click();
  await expect(page.locator('.level-card.current')).toContainText('余烬车队');
  await expect(page.locator('.camp-roster')).toContainText('归降·黯月先知');
  await page.getByRole('button', { name: '进入营地' }).click();
  await expect(page.locator('[data-deploy^="r-rec-"]')).toBeVisible();
});

test('a goblin previews and lands a guaranteed capture on a female elf, but not on a male elf', async ({ page }) => {
  const c = startBattle(newCampaign(11));
  const battle = c.battle!;
  const goblin = battle.units.find(u => u.kind === 'goblin')!;
  Object.assign(goblin, { q: -2, r: 0 });
  const enemies = battle.units.filter(u => u.owner === 'elf');
  enemies.slice(2).forEach(u => { u.hp = 0; });
  Object.assign(enemies[0], { kind: 'blade', gender: 'female', hp: 20, q: -1, r: 0 });
  Object.assign(enemies[1], { kind: 'ranger', gender: 'male', hp: 20, q: -2, r: 1 });
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(c)]);
  await page.goto('./');
  await page.locator(`[data-unit-id="${goblin.id}"]`).click({ force: true });
  await expect(page.locator('.unit-trait')).toContainText('擒拿');
  const female = page.locator(`.target-list [data-target="${enemies[0].id}"]`);
  const male = page.locator(`.target-list [data-target="${enemies[1].id}"]`);
  await expect(female).toContainText('必杀 · 俘获 100%');
  await expect(male).not.toContainText('俘获');
  await expect(page.locator('.snare-badge')).toHaveCount(1);
  await female.click();
  await expect(page.locator('.battle-log, [role="log"]').first()).toContainText('必定俘获');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).battle.units.find((u: { gender?: string; captured?: boolean }) => u.gender === 'female' && u.captured) !== undefined, KEY)).toBe(true);
});

test('interrogation unlocks a perk and torture raises morale with a resistance trade-off', async ({ page }) => {
  const c = lastBlow();
  c.battle!.winner = 'orc';
  c.battle!.units.filter(u => u.owner === 'elf').slice(0, 2).forEach((u, i) => Object.assign(u, { kind: i ? 'ranger' : 'warden', hp: 0, captured: true }));
  const camp = { ...concludeBattle(c), phase: 'camp' as const };
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(camp)]);
  await page.goto('./');
  await expect(page.locator('.prisoner-card')).toHaveCount(2);
  await page.locator('.prisoner-card').first().getByRole('button', { name: /^审讯/ }).click();
  await expect(page.locator('.perk-list')).toContainText('誓约破绽');
  const before = Number(await page.getByRole('meter', { name: '军队士气' }).first().getAttribute('aria-valuenow'));
  await page.getByRole('button', { name: /^酷刑/ }).click();
  await expect(page.getByRole('meter', { name: '军队士气' }).first()).toHaveAttribute('aria-valuenow', String(before + 15));
  await expect(page.locator('.perk-list')).toContainText('敌军抵抗 ×1');
  await page.getByRole('button', { name: /拔营/ }).click();
  await expect(page.locator('.level-card.current')).toContainText('余烬车队');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('switches between campaign and skirmish without mixing saves', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '开始主线战役' }).click();
  await page.getByRole('link', { name: '遭遇战' }).click();
  await expect(page.getByRole('heading', { name: /黑棘隘口/ })).toBeVisible();
  await expect(page.locator('.map-unit')).toHaveCount(10);
  await page.getByRole('link', { name: '主线战役' }).click();
  await expect(page.locator('.level-card.current')).toContainText('焦土渡口');
});

test('war camp: hire, dismiss, forge a 哥布林骑士 from a held female elf, and fight with the chosen roster', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const c = newCampaign(5);
  const camp = { ...c, level: 4, gold: 300, phase: 'map' as const, prisoners: [{ id: 'pr-x', kind: 'ranger' as const, level: 3, gender: 'female' as const, held: true as const }] };
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(camp)]);
  await page.goto('./');
  await expect(page.locator('.level-card')).toHaveCount(9);
  await page.getByRole('button', { name: '进入营地' }).click();
  await expect(page.getByRole('heading', { name: /营地 · 银叶伏击/ })).toBeVisible();
  await expect(page.locator('.story-scene')).toContainText('星誓祭司');
  await expect(page.locator('.manage-card')).toHaveCount(6);
  // hire an elf mercenary (free contract) and a raider
  await page.locator('[data-hire="exile"]').click();
  await expect(page.getByRole('status')).toContainText('契约');
  await page.locator('[data-hire="raider"]').click();
  await expect(page.locator('.manage-card')).toHaveCount(8);
  await expect(page.locator('.gold-tag')).toContainText('160');
  // dismiss needs a confirming second click
  const dismiss = page.locator('[data-dismiss="r-raider2"]');
  await dismiss.click();
  await expect(dismiss).toContainText('确认');
  await dismiss.click();
  await expect(page.locator('.manage-card')).toHaveCount(7);
  await expect(page.getByRole('status')).toContainText('遣散');
  await expect(page.locator('[data-dismiss="r-warlord"]')).toHaveCount(0);
  // forge
  await page.locator('[data-forge-goblin="r-goblin"]').click();
  await expect(page.getByRole('status')).toContainText('哥布林骑士·斯尼克');
  await expect(page.locator('.manage-card').filter({ hasText: '哥布林骑士·斯尼克' })).toBeVisible();
  await expect(page.locator('.prisoner-card.held')).toHaveCount(0);
  await page.screenshot({ path: `test-results/camp-${test.info().project.name}.png`, fullPage: true });
  // choose roster: bench the shaman, deploy the mercenary
  const shaman = page.locator('[data-deploy="r-shaman"]');
  if (await shaman.getAttribute('aria-pressed') === 'true') await shaman.click();
  const merc = page.locator('.manage-card').filter({ hasText: '雇佣兵' }).locator('[data-deploy]');
  if (await merc.getAttribute('aria-pressed') !== 'true') await merc.click();
  await page.getByRole('button', { name: '出征' }).click();
  await expect(page.locator('.objective-strip')).toContainText('包围');
  const saved = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);
  const kinds = saved.battle.units.filter((u: { rosterId?: string }) => u.rosterId).map((u: { kind: string }) => u.kind);
  expect(kinds).toContain('goblinKnight');
  expect(kinds).toContain('exile');
  expect(kinds).not.toContain('shaman');
  await page.locator('[data-unit-id^="p-r-knight"]').click({ force: true });
  await expect(page.locator('.unit-trait')).toContainText('精灵坐骑');
  await page.screenshot({ path: `test-results/knight-${test.info().project.name}.png` });
  await page.reload();
  await expect(page.locator('[data-unit-id^="p-r-knight"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('an old save that had finished the original four levels reopens the road to act two', async ({ page }) => {
  const c = { ...newCampaign(3), level: 4, phase: 'complete' } as Record<string, unknown>;
  delete c.gold;
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(c)]);
  await page.goto('./');
  await expect(page.locator('.level-card.current')).toContainText('银叶伏击');
  await expect(page.locator('.campaign-heading')).toContainText('军饷 220');
});

test('a goblin previews and lands a guaranteed capture on a female vampire, but not on a male vampire', async ({ page }) => {
  const c = startBattle({ ...newCampaign(11), level: 7 });
  const battle = c.battle!;
  const goblin = battle.units.find(u => u.kind === 'goblin')!;
  Object.assign(goblin, { q: -2, r: 0, ap: 5 });
  const enemies = battle.units.filter(u => u.owner === 'vampire');
  Object.assign(enemies[0], { kind: 'nightStalker', gender: 'female', hp: 20, q: -1, r: 0 });
  Object.assign(enemies[1], { kind: 'thrall', gender: 'male', hp: 20, q: -2, r: 1 });
  c.phase = 'battle';
  await page.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, [KEY, JSON.stringify(c)]);
  await page.goto('./');
  await page.locator(`[data-unit-id="${goblin.id}"]`).click({ force: true });
  await expect(page.locator('.unit-trait')).toContainText('擒拿');
  const female = page.locator(`.target-list [data-target="${enemies[0].id}"]`);
  const male = page.locator(`.target-list [data-target="${enemies[1].id}"]`);
  await expect(female).toContainText('必杀 · 俘获 100%');
  await expect(male).not.toContainText('必杀');
  await female.click();
  await expect(page.locator('.battle-log, [role="log"]').first()).toContainText('必定俘获');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)!).battle.units.find((u: { gender?: string; captured?: boolean }) => u.gender === 'female' && u.captured) !== undefined, KEY)).toBe(true);
});
