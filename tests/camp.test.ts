import { describe, expect, it } from 'vitest';
import {
  canDismiss, concludeBattle, defaultGold, dismissUnit, forgeKnight, GOLD, hireUnit, leaveResult, newCampaign, pending, resolvePrisoner, startBattle, stockade,
} from '../src/engine/campaign';
import { applyAction, damage, makeUnit, reachable } from '../src/engine/game';
import { CAMPAIGN } from '../src/engine/scenarios';
import { upgradeCampaign, validCampaign } from '../src/storage';

describe('war camp (营地)', () => {
  it('hires with 军饷, dismisses with a refund, never dismisses the warlord', () => {
    let c = newCampaign(1);
    expect(c.gold).toBe(GOLD.start);
    c = hireUnit(c, 'goblin');
    expect(c.gold).toBe(GOLD.start - 40);
    expect(c.roster.at(-1)!.name).toMatch(/^哥布林·/);
    c = { ...c, gold: 200 };
    c = hireUnit(c, 'exile');
    expect(c.roster.at(-1)).toMatchObject({ kind: 'exile', origin: 'native' });
    expect(c.roster.at(-1)!.name).toMatch(/^雇佣兵·/);
    expect(() => hireUnit({ ...c, gold: 0 }, 'brute')).toThrow();
    expect(canDismiss(c, 'r-warlord')).toBe(false);
    const d = dismissUnit(c, 'r-raider1');
    expect(d.roster.some(r => r.id === 'r-raider1')).toBe(false);
    expect(d.deploy).not.toContain('r-raider1');
    expect(d.gold).toBe(c.gold + 30);
    expect(validCampaign(d)).toBe(true);
  });
  it('holds a captured female elf in the stockade and forges a 哥布林骑士 that takes the goblin slot', () => {
    let c = startBattle(newCampaign(2));
    const elf = c.battle!.units.find(u => u.owner === 'elf' && u.gender === 'female')!;
    c.battle!.units.filter(u => u.owner === 'elf').forEach(u => { u.hp = 0; });
    elf.captured = true;
    c.battle!.winner = 'orc';
    c = concludeBattle(c);
    expect(c.prisoners[0].gender).toBe('female');
    expect(c.result!.gold).toBe(GOLD.victory + GOLD.perCapture);
    c = leaveResult(c);
    expect(c.phase).toBe('camp');
    c = resolvePrisoner(c, c.prisoners[0].id, 'hold');
    expect(pending(c)).toHaveLength(0);
    expect(stockade(c)).toHaveLength(1);
    expect(validCampaign(c)).toBe(true);
    expect(leaveResult({ ...c, phase: 'result' }).phase).toBe('map');
    const knight = forgeKnight(c, 'r-goblin', c.prisoners[0].id);
    expect(knight.prisoners).toHaveLength(0);
    expect(knight.roster.find(r => r.id === 'r-goblin')).toBeUndefined();
    expect(knight.roster.find(r => r.kind === 'goblinKnight')!.name).toBe('哥布林骑士·斯尼克');
    expect(validCampaign(knight)).toBe(true);
    const male = { ...c, prisoners: [{ ...c.prisoners[0], gender: 'male' as const }] };
    expect(() => forgeKnight(male, 'r-goblin', male.prisoners[0].id)).toThrow();
  });
  it('the knight crosses forest for 1 AP and its charge adds +3 to the next attack only', () => {
    const c = { ...newCampaign(3), roster: newCampaign(3).roster.map(r => r.kind === 'goblin' ? { ...r, kind: 'goblinKnight' as const } : r) };
    let state = startBattle(c).battle!;
    const k = state.units.find(u => u.kind === 'goblinKnight')!;
    state.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'forest'; });
    const moves = reachable(state, k);
    expect(Math.max(...moves.values())).toBeLessThanOrEqual(6);
    expect([...moves.values()].filter(v => v === 1).length).toBeGreaterThan(0);
    const target = state.units.find(u => u.owner === 'elf')!;
    const base = damage(state, k, target);
    const [to] = [...moves.keys()];
    const [q, r] = to.split(',').map(Number);
    const moved = applyAction(state, { type: 'move', unitId: k.id, to: { q, r } });
    if (!moved.ok) throw new Error(moved.error);
    state = moved.state;
    const k2 = state.units.find(u => u.id === k.id)!;
    expect(k2.statuses?.some(s => s.id === 'charge')).toBe(true);
    expect(damage(state, k2, target)).toBe(base + 3);
    const ended = applyAction(state, { type: 'end' });
    expect(ended.ok && ended.state.units.find(u => u.id === k.id)!.statuses?.some(s => s.id === 'charge')).toBeFalsy();
    expect(makeUnit('x', 'goblinKnight', 'orc', { q: 0, r: 0 }).ap).toBe(6);
  });
  it('act two: the finale boss is 星誓祭司·艾瑟琳 and old completed saves reopen the road with a war chest', () => {
    const finale = startBattle({ ...newCampaign(4), level: 6 }).battle!;
    expect(finale.units.find(u => u.role === 'boss')!.name).toBe('星誓祭司·艾瑟琳');
    const old = { ...newCampaign(4), level: 4, phase: 'complete' } as Record<string, unknown>;
    delete old.gold;
    const up = upgradeCampaign(old) as Record<string, unknown>;
    expect(up.phase).toBe('map');
    expect(up.gold).toBe(defaultGold(4));
    expect(validCampaign(up)).toBe(true);
    expect(CAMPAIGN.slice(4).map(s => s.reward?.kind)).toEqual(['exile', 'brute', undefined, 'nightStalker', undefined]);
  });
});
