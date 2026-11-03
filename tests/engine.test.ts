import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/engine/ai';
import { TERRAIN, UNITS } from '../src/engine/content';
import { applyAction, canAttack, canSkill, createGame, damage, factionOf, hasSight, isAITurn, living, reachable, tileAt } from '../src/engine/game';
import { disk, distance, key, line, neighbors } from '../src/engine/hex';
import type { Action, GameState } from '../src/engine/types';

function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
function duel(): GameState {
  const state = createGame('local');
  state.tiles.forEach(t => { t.terrain = 'plain'; });
  state.units.forEach(u => { u.hp = 0; });
  Object.assign(state.units[0], { q: 0, r: 0, hp: 34 });
  Object.assign(state.units[5], { q: 1, r: 0, hp: 32 });
  return state;
}

describe('hex geometry', () => {
  it('creates a radius-four 61-cell hexagon with unique cells and reciprocal neighbors', () => {
    const cells = disk(4);
    expect(cells).toHaveLength(61);
    expect(new Set(cells.map(key)).size).toBe(61);
    cells.forEach(h => expect(distance(h, { q: 0, r: 0 })).toBeLessThanOrEqual(4));
    neighbors({ q: 0, r: 0 }).forEach(h => {
      expect(distance(h, { q: 0, r: 0 })).toBe(1);
      expect(neighbors(h).some(n => n.q === 0 && n.r === 0)).toBe(true);
    });
  });
  it('draws contiguous lines with exact endpoints in every direction', () => {
    for (const a of disk(2)) for (const b of disk(2)) {
      const points = line(a, b);
      expect(points[0]).toEqual(a);
      expect(points.at(-1)).toEqual(b);
      expect(points).toHaveLength(distance(a, b) + 1);
      points.slice(1).forEach((p, i) => expect(distance(p, points[i])).toBe(1));
    }
  });
});

describe('campaign and movement', () => {
  it('starts with distinct playable positions, five units per faction and orcs first', () => {
    const state = createGame();
    expect(living(state, 'orc')).toHaveLength(5);
    expect(living(state, 'elf')).toHaveLength(5);
    expect(state.active).toBe('orc');
    expect(new Set(state.units.map(key)).size).toBe(10);
    state.units.forEach(u => expect(TERRAIN[tileAt(state, u)!.terrain].cost).toBeLessThan(Infinity));
  });
  it('charges weighted movement cost without mutating its input', () => {
    const before = duel();
    before.tiles.find(t => t.q === -1 && t.r === 0)!.terrain = 'forest';
    const snapshot = structuredClone(before);
    expect(reachable(before, before.units[0]).get('-1,0')).toBe(2);
    const after = act(before, { type: 'move', unitId: 'u0', to: { q: -1, r: 0 } });
    expect(after.units[0].ap).toBe(1);
    expect(before).toEqual(snapshot);
  });
  it('never allows water, occupied destinations, or travel beyond AP', () => {
    const state = duel();
    state.units[0].ap = 1;
    state.tiles.find(t => t.q === -1 && t.r === 0)!.terrain = 'water';
    const reachableCells = reachable(state, state.units[0]);
    expect(reachableCells.has('-1,0')).toBe(false);
    expect(reachableCells.has('1,0')).toBe(false);
    expect(reachableCells.has('-2,0')).toBe(false);
    expect(applyAction(state, { type: 'move', unitId: 'u0', to: { q: 20, r: 20 } }).ok).toBe(false);
  });
  it('does not walk through a wall of units even when the destination is empty', () => {
    const state = createGame();
    const unit = state.units[0];
    Object.assign(unit, { q: 0, r: 0, ap: 3 });
    state.tiles.forEach(t => { t.terrain = 'plain'; });
    neighbors(unit).forEach((h, i) => Object.assign(state.units[i + 1], h));
    expect(reachable(state, unit).size).toBe(0);
  });
  it('rejects wrong-side, dead, and exhausted unit actions', () => {
    const state = duel();
    expect(applyAction(state, { type: 'move', unitId: 'u5', to: { q: 2, r: 0 } }).ok).toBe(false);
    expect(applyAction(state, { type: 'move', unitId: 'u1', to: { q: 2, r: 0 } }).ok).toBe(false);
    state.units[0].ap = 0;
    expect(applyAction(state, { type: 'attack', unitId: 'u0', targetId: 'u5' }).ok).toBe(false);
  });
});

describe('combat and skills', () => {
  it('uses armor and cover deterministically, with a two-point minimum', () => {
    const state = duel();
    const [attacker, target] = [state.units[0], state.units[5]];
    expect(damage(state, attacker, target)).toBe(7);
    state.tiles.find(t => t.q === 1 && t.r === 0)!.terrain = 'forest';
    expect(damage(state, attacker, target)).toBe(5);
    attacker.kind = 'oracle';
    target.kind = 'brute';
    expect(damage(state, attacker, target)).toBe(2);
  });
  it('gives ranged units +2 damage from high ground, but not melee units', () => {
    const state = duel();
    const attacker = state.units[0];
    state.tiles.find(t => t.q === 0 && t.r === 0)!.terrain = 'ridge';
    expect(damage(state, attacker, state.units[5])).toBe(7);
    attacker.kind = 'shaman';
    expect(damage(state, attacker, state.units[5])).toBe(6);
  });
  it('obeys distance, affiliation, AP and blocked line of sight', () => {
    const state = duel();
    const attacker = state.units[0];
    attacker.kind = 'shaman';
    Object.assign(state.units[5], { q: 2, r: 0 });
    expect(canAttack(state, attacker, state.units[5])).toBe(true);
    state.tiles.find(t => t.q === 1 && t.r === 0)!.terrain = 'ridge';
    expect(hasSight(state, attacker, state.units[5])).toBe(false);
    expect(canAttack(state, attacker, state.units[5])).toBe(false);
    state.tiles.find(t => t.q === 1 && t.r === 0)!.terrain = 'water';
    expect(canAttack(state, attacker, state.units[5])).toBe(true);
    Object.assign(state.units[5], { q: 3, r: 0 });
    expect(canAttack(state, attacker, state.units[5])).toBe(false);
    expect(canAttack(state, attacker, attacker)).toBe(false);
  });
  it('spends AP on attack and logs damage', () => {
    const state = act(duel(), { type: 'attack', unitId: 'u0', targetId: 'u5' });
    expect(state.units[5].hp).toBe(25);
    expect(state.units[0].ap).toBe(1);
    expect(state.log.at(-1)?.type).toBe('attack');
  });
  it('ignores armor and cover for offensive skills', () => {
    const state = duel();
    state.tiles.find(t => t.q === 1 && t.r === 0)!.terrain = 'forest';
    const after = act(state, { type: 'skill', unitId: 'u0', targetId: 'u5' });
    expect(after.units[5].hp).toBe(17);
    expect(after.units[0].cooldown).toBe(2);
    expect(after.units[0].ap).toBe(1);
    expect(canSkill(after, after.units[0], after.units[5])).toBe(false);
  });
  it('heals allies and self, never over-heals or revives, and rejects enemy healing', () => {
    const state = duel();
    const caster = state.units[0];
    caster.kind = 'shaman';
    caster.hp = 20;
    expect(canSkill(state, caster, caster)).toBe(true);
    const healed = act(state, { type: 'skill', unitId: caster.id, targetId: caster.id });
    expect(healed.units[0].hp).toBe(23);
    expect(canSkill(state, caster, state.units[5])).toBe(false);
    expect(canSkill(state, caster, state.units[1])).toBe(false);
  });
  it('restores AP and decrements cooldown only at the unit faction turn start', () => {
    let state = act(duel(), { type: 'skill', unitId: 'u0', targetId: 'u5' });
    state = act(state, { type: 'end' });
    expect(state.active).toBe('elf');
    expect(state.round).toBe(1);
    expect(state.units[0].cooldown).toBe(2);
    expect(state.units[0].ap).toBe(1);
    state = act(state, { type: 'end' });
    expect(state.active).toBe('orc');
    expect(state.round).toBe(2);
    expect(state.units[0].ap).toBe(3);
    expect(state.units[0].cooldown).toBe(1);
    state = act(act(state, { type: 'end' }), { type: 'end' });
    expect(state.units[0].cooldown).toBe(0);
  });
  it('ends on annihilation, logs a death, and freezes all later actions', () => {
    const state = duel();
    state.units[5].hp = 3;
    const after = act(state, { type: 'attack', unitId: 'u0', targetId: 'u5' });
    expect(after.units[5].hp).toBe(0);
    expect(after.winner).toBe('orc');
    expect(after.log.some(l => l.type === 'death')).toBe(true);
    expect(applyAction(after, { type: 'end' }).ok).toBe(false);
    expect(reachable(after, after.units[0]).has('1,0')).toBe(true);
  });
  it('does not end just because a commander falls', () => {
    const state = createGame();
    state.tiles.forEach(t => { t.terrain = 'plain'; });
    Object.assign(state.units[0], { q: 0, r: 0 });
    Object.assign(state.units[5], { q: 1, r: 0, hp: 1 });
    const after = act(state, { type: 'attack', unitId: 'u0', targetId: 'u5' });
    expect(after.winner).toBeNull();
  });
  it('draws exactly after forty complete rounds', () => {
    let state = createGame();
    for (let i = 0; i < 79; i++) state = act(state, { type: 'end' });
    expect(state.winner).toBeNull();
    expect(state.round).toBe(40);
    state = act(state, { type: 'end' });
    expect(state.winner).toBe('draw');
    expect(state.turn).toBe(81);
  });
});

describe('tactical AI', () => {
  it('identifies AI-controlled turns for either chosen player faction', () => {
    expect(isAITurn(createGame('ai', 'orc'))).toBe(false);
    expect(isAITurn(createGame('ai', 'elf'))).toBe(true);
    expect(isAITurn(createGame('local', 'elf'))).toBe(false);
  });
  it('finishes a kill rather than moving away', () => {
    const state = duel();
    state.units[5].hp = 2;
    const decision = chooseAction(state);
    expect(['attack', 'skill']).toContain(decision.type);
    const after = act(state, decision);
    expect(after.winner).toBe('orc');
  });
  it('heals critically injured allies', () => {
    const state = createGame();
    state.units.forEach(u => { u.ap = 0; });
    const caster = state.units[4];
    caster.ap = 3;
    state.units[0].hp = 1;
    const decision = chooseAction(state);
    expect(decision).toEqual({ type: 'skill', unitId: caster.id, targetId: 'u0' });
  });
  it('plays a whole legal battle to a decisive conclusion with state invariants intact', () => {
    let state = createGame('local');
    let actions = 0;
    let deaths = 0;
    while (!state.winner && actions++ < 2500) {
      const action = chooseAction(state);
      state = act(state, action);
      expect(new Set(living(state).map(key)).size).toBe(living(state).length);
      for (const u of state.units) {
        expect(u.hp).toBeGreaterThanOrEqual(0);
        expect(u.hp).toBeLessThanOrEqual(UNITS[u.kind].hp);
        expect(u.ap).toBeGreaterThanOrEqual(0);
        expect(u.ap).toBeLessThanOrEqual(UNITS[u.kind].ap);
        expect(tileAt(state, u)?.terrain).not.toBe('water');
      }
      deaths = state.units.filter(u => u.hp === 0).length;
    }
    expect(actions).toBeLessThan(2500);
    expect(['orc', 'elf']).toContain(state.winner);
    expect(deaths).toBeGreaterThanOrEqual(5);
    expect(living(state).every(u => factionOf(u) === state.winner)).toBe(true);
    expect(state.round).toBeLessThanOrEqual(40);
  });
});
