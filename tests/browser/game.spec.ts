import { expect, test } from '@playwright/test';
import { createGame } from '../../src/engine/game';

test('renders a playable battlefield, moves a unit and persists after reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '黑棘隘口' })).toBeVisible();
  await expect(page.locator('.map-unit')).toHaveCount(10);
  await expect(page.locator('.hex')).toHaveCount(61);
  const portraitSize = await page.locator('.map-unit .portrait').first().boundingBox();
  expect(portraitSize).not.toBeNull();
  expect(portraitSize!.width).toBeLessThan(80);
  await page.locator('.hex.reachable').first().click();
  await expect(page.getByRole('status')).toContainText('消耗');
  const saved = await page.evaluate(() => localStorage.getItem('ashen-crown:campaign:v1'));
  expect(saved).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('status')).toContainText('已恢复本地战役');
  expect(await page.evaluate(() => localStorage.getItem('ashen-crown:campaign:v1'))).toBe(saved);
  expect(errors).toEqual([]);
});

test('configures local two-player and switches turns', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: '新战役', exact: true }).click();
  await page.getByRole('button', { name: '本地双人 同屏轮流指挥双方' }).click();
  await page.getByRole('button', { name: '部署军团，进入战场' }).click();
  await expect(page.locator('.mode-tag')).toContainText('本地双人');
  await page.getByRole('button', { name: '结束回合' }).click();
  await expect(page.locator('.turn-badge')).toHaveText('暮誓王庭回合');
  await page.getByRole('button', { name: '结束回合' }).click();
  await expect(page.locator('.round-label strong')).toHaveText('02');
});

test('AI performs legal actions and returns control to the player', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('./');
  await page.getByRole('button', { name: 'AI 1×' }).click();
  await page.getByRole('button', { name: '结束回合' }).click();
  await expect(page.getByRole('button', { name: '结束回合' })).toBeDisabled();
  await expect(page.locator('.turn-badge')).toHaveText('灰牙氏族回合', { timeout: 45000 });
  await expect(page.locator('.round-label strong')).toHaveText('02');
  await expect(page.getByRole('button', { name: '结束回合' })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ashen-crown:campaign:v1')!).log.some((l: { type: string }) => l.type === 'move'))).toBe(true);
});

test('manual opens accessibly and page fits the viewport without body overflow', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /战地手册/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: '在灰烬中，学会取胜。' })).toBeVisible();
  await page.getByRole('button', { name: '我已准备就绪' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('shows storage failures and gracefully rejects corrupted saves', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ashen-crown:campaign:v1', '{"version":99}'));
  await page.goto('./');
  await expect(page.getByRole('status')).toContainText('存档不兼容或已损坏');
  await expect(page.locator('.map-unit')).toHaveCount(10);
});

test('casts a skill, attacks, wins the battle, exports and resumes the final state', async ({ page }) => {
  const campaign = createGame('local');
  campaign.units.forEach(u => { u.hp = 0; });
  Object.assign(campaign.units[0], { q: 0, r: 0, hp: 34 });
  Object.assign(campaign.units[5], { q: 1, r: 0, hp: 20 });
  await page.addInitScript(saved => {
    if (!localStorage.getItem('ashen-crown:campaign:v1')) localStorage.setItem('ashen-crown:campaign:v1', saved);
  }, JSON.stringify(campaign));
  await page.goto('./');
  await page.getByRole('button', { name: /碎冠重击/ }).click();
  await page.locator('[data-target="u5"]').click();
  await expect(page.getByRole('status')).toContainText('受到 15 点伤害');
  await expect(page.locator('.skill-heading')).toContainText('冷却 2');
  await page.getByRole('button', { name: '结束回合' }).click();
  await page.getByRole('button', { name: '结束回合' }).click();
  await page.locator('[data-target="u5"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: '灰牙氏族，胜利。' })).toBeVisible();
  await page.getByRole('button', { name: '检视战场' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出完整战报 ↓' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('ashen-crown-battle-report.txt');
  await page.reload();
  await expect(page.getByRole('heading', { name: '灰牙氏族，胜利。' })).toBeVisible();
});

test('supports the elf faction and AI-first opening', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('./');
  await page.getByRole('button', { name: 'AI 1×' }).click();
  await page.getByRole('button', { name: '新战役', exact: true }).click();
  await page.getByRole('button', { name: '暮誓王庭 远射 · 机动 · 精准' }).click();
  await page.getByRole('button', { name: '部署军团，进入战场' }).click();
  await expect(page.getByRole('button', { name: '结束回合' })).toBeDisabled();
  await expect(page.locator('.turn-badge')).toHaveText('暮誓王庭回合', { timeout: 45000 });
  await expect(page.getByRole('button', { name: '结束回合' })).toBeEnabled();
});

test('warns when browser persistence is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'QuotaExceededError'); };
  });
  await page.goto('./');
  await page.locator('.hex.reachable').first().click();
  await expect(page.getByRole('status')).toContainText('浏览器拒绝保存进度');
});
