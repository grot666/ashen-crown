import { describe, expect, it } from 'vitest';
import { newCampaign, startBattle } from '../src/engine/campaign';
import { UNITS } from '../src/engine/content';
import { applyAction, captureChance, createGame, damage, genderOf, goblinSnare, makeUnit, strikeDamage } from '../src/engine/game';
import { CAMPAIGN } from '../src/engine/scenarios';
import type { Action, GameState, Unit, UnitKind } from '../src/engine/types';
import { validSave } from '../src/storage';

function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
/** Level-1 battle reduced to a goblin next to one full-health elf on open ground. */
function duel(kind: UnitKind, gender: Unit['gender'], role?: Unit['role']): { state: GameState; goblin: Unit; elf: Unit } {
  const state = startBattle(newCampaign(11)).battle!;
  state.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'plain'; });
  const goblin = state.units.find(u => u.kind === 'goblin')!;
  Object.assign(goblin, { q: -2, r: 0, ap: 5 });
  state.units.filter(u => u !== goblin).forEach(u => { u.hp = 0; });
  const elf = state.units.find(u => u.owner === 'elf')!;
  Object.assign(elf, { kind, gender, role, q: -1, r: 0, hp: UNITS[kind].hp });
  // keep a second living elf far away so the battle does not end on the capture
  const spare = state.units.filter(u => u.owner === 'elf')[1];
  Object.assign(spare, { hp: 10, q: 4, r: -4 });
  return { state, goblin, elf };
}

describe('goblin snare (哥布林擒拿)', () => {
  it('elf units have a gender, with both female and male elves in every campaign level', () => {
    expect(genderOf(makeUnit('a', 'ranger', 'elf', { q: 0, r: 0 }))).toBe('female');
    expect(genderOf(makeUnit('b', 'warden', 'elf', { q: 0, r: 0 }))).toBe('male');
    expect(genderOf(makeUnit('c', 'warden', 'elf', { q: 0, r: 0 }, { gender: 'female' }))).toBe('female');
    expect(genderOf(makeUnit('d', 'goblin', 'orc', { q: 0, r: 0 }))).toBeUndefined();
    for (const level of CAMPAIGN.keys()) {
      const enemies = startBattle({ ...newCampaign(1), level }).battle!.units.filter(u => u.owner !== 'orc');
      const genders = new Set(enemies.map(genderOf));
      expect(genders.has('female') && genders.has('male')).toBe(true);
    }
  });

  it('a goblin attack on a female elf is an instant kill and a guaranteed capture that does not consume RNG', () => {
    const { state, goblin, elf } = duel('warden', 'female');
    expect(goblinSnare(goblin, elf)).toBe(true);
    expect(strikeDamage(state, goblin, elf)).toBe(elf.hp);
    expect(captureChance(state, goblin, elf, false)).toBe(1);
    const after = act(state, { type: 'attack', unitId: goblin.id, targetId: elf.id });
    const fallen = after.units.find(u => u.id === elf.id)!;
    expect(fallen.hp).toBe(0);
    expect(fallen.captured).toBe(true);
    expect(after.rng).toBe(state.rng);
    expect(after.log.some(l => l.type === 'capture' && l.text.includes('必定俘获'))).toBe(true);
  });

  it('works with the 绊索飞锤 skill too and ignores enemy resistance', () => {
    const { state, goblin, elf } = duel('oracle', undefined);
    state.captureMod = -0.5;
    Object.assign(elf, { q: 0, r: 0 });
    expect(captureChance(state, goblin, elf, true)).toBe(1);
    const after = act(state, { type: 'skill', unitId: goblin.id, targetId: elf.id });
    expect(after.units.find(u => u.id === elf.id)!.captured).toBe(true);
  });

  it('does not apply to male elves, other orcs, the skirmish, or the boss', () => {
    const male = duel('ranger', 'male');
    expect(goblinSnare(male.goblin, male.elf)).toBe(false);
    expect(strikeDamage(male.state, male.goblin, male.elf)).toBe(damage(male.state, male.goblin, male.elf));
    expect(captureChance(male.state, male.goblin, male.elf, false)).toBeLessThan(1);

    const female = duel('ranger', 'female');
    const brute = makeUnit('x', 'brute', 'orc', { q: -2, r: 1 });
    expect(goblinSnare(brute, female.elf)).toBe(false);

    const boss = duel('regent', undefined, 'boss');
    expect(genderOf(boss.elf)).toBe('female');
    expect(goblinSnare(boss.goblin, boss.elf)).toBe(false);
    expect(strikeDamage(boss.state, boss.goblin, boss.elf)).toBeLessThan(boss.elf.hp);
    expect(captureChance(boss.state, boss.goblin, boss.elf, false)).toBe(0);

    const skirmish = createGame();
    const g = makeUnit('g', 'goblin', 'orc', { q: 0, r: 0 });
    const ranger = skirmish.units.find(u => u.kind === 'ranger')!;
    expect(captureChance(skirmish, g, ranger, false)).toBe(0); // no captures outside the campaign
  });

  it('saves keep gender and reject invalid values', () => {
    const state = startBattle(newCampaign(3)).battle!;
    expect(state.units.some(u => u.gender)).toBe(true);
    expect(validSave(JSON.parse(JSON.stringify(state)))).toBe(true);
    const bad = structuredClone(state);
    (bad.units[0] as unknown as { gender: string }).gender = 'other';
    expect(validSave(bad)).toBe(false);
  });
});
