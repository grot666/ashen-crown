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
  await expect(page.locator('.level-card')).toHaveCount(4);
  await expect(page.locator('.level-card.locked')).toHaveCount(3);
  await expect(page.getByRole('meter', { name: '军队士气' }).first()).toHaveAttribute('aria-valuenow', '50');
  await page.getByRole('button', { name: '查看简报' }).click();
  await expect(page.getByRole('heading', { name: /焦土渡口/ })).toBeVisible();
  await expect(page.locator('.objective-box')).toContainText('10 轮内全歼守军');
  const raider = page.locator('[data-deploy="r-raider2"]');
  await raider.click();
  await expect(raider).toHaveAttribute('aria-pressed', 'false');
  await raider.click();
  await expect(raider).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '出征' }).click();
  await expect(page.locator('.objective-strip')).toContainText('限时');
  await expect(page.locator('.map-unit')).toHaveCount(9);
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
  await expect(page.locator('.result-card')).toContainText('铁颚·戈恩');
  await expect(page.locator('.captive-row')).toContainText('黯月先知');
  await page.getByRole('button', { name: /前往俘虏营/ }).click();
  await expect(page.locator('.prisoner-card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /拔营/ })).toBeDisabled();
  await page.getByRole('button', { name: /^招募/ }).click();
  await expect(page.getByRole('status')).toContainText('归降者编入军团');
  await page.getByRole('button', { name: /拔营/ }).click();
  await expect(page.locator('.level-card.current')).toContainText('余烬车队');
  await expect(page.locator('.camp-roster')).toContainText('归降·黯月先知');
  await page.getByRole('button', { name: '查看简报' }).click();
  await expect(page.locator('[data-deploy^="r-rec-"]')).toBeVisible();
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
