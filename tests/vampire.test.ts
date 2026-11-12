import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/engine/ai';
import { concludeBattle, newCampaign, resolvePrisoner, startBattle } from '../src/engine/campaign';
import { UNITS } from '../src/engine/content';
import { applyAction, captureChance, createGame, damage, genderOf, goblinSnare, living, makeUnit, strikeDamage, terrainCost } from '../src/engine/game';
import { CAMPAIGN, SKIRMISHES } from '../src/engine/scenarios';
import type { Action, GameState, Unit, UnitKind } from '../src/engine/types';
import { upgradeBattle, upgradeCampaign, validSave } from '../src/storage';

function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

function duel(kind: UnitKind, gender: Unit['gender'], role?: Unit['role']): { state: GameState; goblin: Unit; target: Unit } {
  const state = startBattle({ ...newCampaign(11), level: 7 }).battle!;
  state.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'plain'; });
  const goblin = state.units.find(u => u.kind === 'goblin')!;
  Object.assign(goblin, { q: -2, r: 0, ap: 5 });
  state.units.filter(u => u !== goblin).forEach(u => { u.hp = 0; });
  const target = state.units.find(u => u.owner === 'vampire')!;
  Object.assign(target, { kind, gender, role, q: -1, r: 0, hp: UNITS[kind].hp });
  const spare = state.units.filter(u => u.owner === 'vampire')[1];
  Object.assign(spare, { hp: 10, q: 4, r: -4 });
  return { state, goblin, target };
}

describe('绛夜宫廷 (vampire faction)', () => {
  const kinds: UnitKind[] = ['thrall', 'bloodKnight', 'nightStalker', 'bloodMage', 'crimsonLord'];

  it('defines five gendered vampire kinds with distinct roles and vampire-flavoured rules', () => {
    expect(kinds.every(k => UNITS[k].faction === 'vampire')).toBe(true);
    expect(new Set(kinds.map(k => UNITS[k].name)).size).toBe(5);
    expect(new Set(kinds.map(k => UNITS[k].role)).size).toBe(5);
    expect(genderOf(makeUnit('a', 'thrall', 'vampire', { q: 0, r: 0 }))).toBe('male');
    expect(genderOf(makeUnit('b', 'bloodKnight', 'vampire', { q: 0, r: 0 }))).toBe('male');
    expect(genderOf(makeUnit('c', 'nightStalker', 'vampire', { q: 0, r: 0 }))).toBe('female');
    expect(genderOf(makeUnit('d', 'bloodMage', 'vampire', { q: 0, r: 0 }))).toBe('female');
    expect(genderOf(makeUnit('e', 'crimsonLord', 'vampire', { q: 0, r: 0 }))).toBe('female');
    expect(genderOf(makeUnit('f', 'thrall', 'vampire', { q: 0, r: 0 }, { gender: 'female' }))).toBe('female');
    expect(UNITS.thrall.lifesteal).toBeGreaterThan(0);
    expect(UNITS.bloodKnight.lifesteal).toBeGreaterThan(0);
    expect(UNITS.nightStalker.lifesteal).toBeGreaterThan(0);
    expect(UNITS.bloodMage.skill.drain).toBeGreaterThan(0);
    expect(UNITS.crimsonLord.skill.drain).toBeGreaterThan(0);
    expect(terrainCost(makeUnit('n', 'nightStalker', 'vampire', { q: 0, r: 0 }), 'forest')).toBe(1);
    expect(terrainCost(makeUnit('t', 'thrall', 'vampire', { q: 0, r: 0 }), 'forest')).toBe(2);
  });

  it('offers a skirmish against the Crimson Court and two act-III campaign levels', () => {
    expect(SKIRMISHES.some(s => s.id === 'crimson-moor' && s.rival === 'vampire')).toBe(true);
    const moor = createGame('ai', 'orc', 'crimson-moor');
    expect(moor.version).toBe(3);
    expect(moor.rival).toBe('vampire');
    expect(moor.lead).toBe('orc');
    expect(living(moor, 'orc')).toHaveLength(5);
    expect(living(moor, 'vampire')).toHaveLength(5);
    expect(validSave(moor)).toBe(true);
    expect(CAMPAIGN).toHaveLength(9);
    expect(CAMPAIGN[7].id).toBe('bloodroad');
    expect(CAMPAIGN[8].id).toBe('crimsonkeep');
    expect(CAMPAIGN[7].rival).toBe('vampire');
    expect(CAMPAIGN[8].rival).toBe('vampire');
    const keep = startBattle({ ...newCampaign(3), level: 8 }).battle!;
    expect(keep.rival).toBe('vampire');
    expect(keep.units.find(u => u.role === 'boss')?.name).toBe('绛夜女爵·莫瑞娜');
    expect(validSave(keep)).toBe(true);
  });

  it('lets a basic attack steal life, and blood magic drain on a skill', () => {
    const state = createGame('local', 'orc', 'crimson-moor');
    const thrall = state.units.find(u => u.kind === 'thrall')!;
    const raider = state.units.find(u => u.kind === 'raider')!;
    Object.assign(thrall, { q: 0, r: 0, ap: 3, hp: 10 });
    Object.assign(raider, { q: 1, r: 0, hp: 20 });
    state.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'plain'; });
    state.active = 'vampire';
    const after = act(state, { type: 'attack', unitId: thrall.id, targetId: raider.id });
    const attacker = after.units.find(u => u.id === thrall.id)!;
    const dealt = 20 - after.units.find(u => u.id === raider.id)!.hp;
    expect(dealt).toBeGreaterThan(0);
    expect(attacker.hp).toBe(Math.min(UNITS.thrall.hp, 10 + Math.floor(dealt * 0.5)));
    expect(after.log.some(l => l.text.includes('汲取伤口中的鲜血'))).toBe(true);

    const mage = createGame('local', 'orc', 'crimson-moor');
    const bloodMage = mage.units.find(u => u.kind === 'bloodMage')!;
    const target = mage.units.find(u => u.kind === 'raider')!;
    Object.assign(bloodMage, { q: 0, r: 0, ap: 3, hp: 8 });
    Object.assign(target, { q: 2, r: 0 });
    mage.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'plain'; });
    mage.active = 'vampire';
    const skill = act(mage, { type: 'skill', unitId: bloodMage.id, targetId: target.id });
    const caster = skill.units.find(u => u.id === bloodMage.id)!;
    expect(caster.hp).toBe(8 + Math.floor(UNITS.bloodMage.skill.power * 0.5));
  });
});

describe('goblin snare vs vampires', () => {
  it('one-hit kills and always captures a female vampire, leaving RNG untouched', () => {
    const { state, goblin, target } = duel('nightStalker', 'female');
    expect(goblinSnare(goblin, target)).toBe(true);
    expect(strikeDamage(state, goblin, target)).toBe(target.hp);
    expect(captureChance(state, goblin, target, false)).toBe(1);
    const after = act(state, { type: 'attack', unitId: goblin.id, targetId: target.id });
    const fallen = after.units.find(u => u.id === target.id)!;
    expect(fallen.hp).toBe(0);
    expect(fallen.captured).toBe(true);
    expect(after.rng).toBe(state.rng);
  });

  it('does not apply to male vampires or to the countess', () => {
    const male = duel('thrall', 'male');
    expect(goblinSnare(male.goblin, male.target)).toBe(false);
    expect(strikeDamage(male.state, male.goblin, male.target)).toBe(damage(male.state, male.goblin, male.target));
    expect(captureChance(male.state, male.goblin, male.target, false)).toBeLessThan(1);

    const boss = duel('crimsonLord', 'female', 'boss');
    expect(genderOf(boss.target)).toBe('female');
    expect(goblinSnare(boss.goblin, boss.target)).toBe(false);
    expect(captureChance(boss.state, boss.goblin, boss.target, false)).toBe(0);
  });

  it('sends a captured vampire through the prisoner camp like an elf', () => {
    const battle = startBattle({ ...newCampaign(5), level: 7 }).battle!;
    const prey = battle.units.find(u => u.kind === 'nightStalker' && genderOf(u) === 'female')!;
    prey.hp = 0;
    prey.captured = true;
    battle.winner = 'orc';
    const camp = concludeBattle({ ...newCampaign(5), level: 7, phase: 'battle', battle });
    const prisoner = camp.prisoners.find(p => p.kind === 'nightStalker' && p.gender === 'female');
    expect(prisoner).toBeTruthy();
    const recruited = resolvePrisoner(camp, prisoner!.id, 'recruit');
    expect(recruited.roster.some(r => r.kind === 'nightStalker' && r.origin === 'recruit')).toBe(true);
  });
});

describe('save migration and AI vs the Crimson Court', () => {
  it('upgrades a completed seven-level campaign so act III appears on the map', () => {
    const old = { ...newCampaign(4), level: 7, phase: 'complete' } as Record<string, unknown>;
    const up = upgradeCampaign(old) as { phase: string; chronicle: string[] };
    expect(up.phase).toBe('map');
    expect(up.chronicle.some(line => line.includes('绛夜宫廷'))).toBe(true);
  });

  it('upgrades a v2 battle by filling lead and rival', () => {
    const v2 = { ...createGame(), version: 2 } as Record<string, unknown>;
    delete v2.lead;
    delete v2.rival;
    const v3 = upgradeBattle(v2) as GameState;
    expect(v3.version).toBe(3);
    expect(v3.lead).toBe('orc');
    expect(v3.rival).toBe('elf');
    expect(validSave(v3)).toBe(true);
  });

  it('lets the AI finish an orc-vs-vampire skirmish with a winner', () => {
    let state = createGame('local', 'orc', 'crimson-moor');
    let steps = 0;
    while (!state.winner && steps++ < 4000) {
      const result = applyAction(state, chooseAction(state));
      if (!result.ok) throw new Error(result.error);
      state = result.state;
    }
    expect(state.winner === 'orc' || state.winner === 'vampire' || state.winner === 'draw').toBe(true);
    expect(steps).toBeGreaterThan(6);
  });
});
