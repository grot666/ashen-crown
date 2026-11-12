import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canRecruit, concludeBattle, interrogationPerk, leaveResult, moraleTier, MORALE, newCampaign, openBriefing, PERKS, playerBonus,
  resolvePrisoner, RESISTANCE, ROSTER_CAP, startBattle, type CampaignState,
} from '../src/engine/campaign';
import { UNITS } from '../src/engine/content';
import { applyAction, attackOf, canAttack, captureChance, createGame, damage, factionOf, living, maxAp, maxHp, rangeOf } from '../src/engine/game';
import { disk, key } from '../src/engine/hex';
import { nextRandom } from '../src/engine/rng';
import { CAMPAIGN } from '../src/engine/scenarios';
import type { Action, GameState, Unit } from '../src/engine/types';
import { CAMPAIGN_KEY, LEGACY_KEY, loadCampaign, loadGame, SKIRMISH_KEY, saveCampaign, validCampaign, validSave } from '../src/storage';

function act(state: GameState, action: Action): GameState {
  const result = applyAction(state, action);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}
const enemyUnits = (s: GameState): Unit[] => s.units.filter(u => u.owner !== 'orc');
/** Level-1 battle reduced to one orc and one weakened enemy standing next to each other on open ground. */
function finisher(seed: number, kind: Unit['kind'] = 'oracle'): GameState {
  const state = startBattle(newCampaign(seed)).battle!;
  state.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'plain'; });
  const [attacker] = state.units;
  Object.assign(attacker, { q: -2, r: 0 });
  state.units.slice(1).forEach(u => { u.hp = 0; });
  const target = enemyUnits(state)[0];
  Object.assign(target, { kind, q: -1, r: 0, hp: 1 });
  return state;
}
/** Finds a seed whose first capture roll succeeds or fails. */
function seedFor(chance: number, success: boolean): number {
  for (let s = 1; s < 5000; s++) if ((nextRandom(s)[0] < chance) === success) return s;
  throw new Error('no seed');
}

describe('scenario data', () => {
  it('defines nine campaign levels (three acts) with valid deployments, Chinese briefings and story scenes', () => {
    expect(CAMPAIGN).toHaveLength(9);
    expect(CAMPAIGN.map(s => s.objective.type)).toEqual(['timed', 'escort', 'defend', 'boss', 'eliminate', 'escort', 'boss', 'eliminate', 'boss']);
    expect(new Set(CAMPAIGN.map(s => s.id)).size).toBe(9);
    for (const s of CAMPAIGN) {
      expect(s.story?.length).toBeGreaterThanOrEqual(3);
      expect(s.epilogue?.length).toBeGreaterThanOrEqual(3);
    }
    for (const s of CAMPAIGN) {
      const cells = new Set(disk(s.radius).map(key));
      const spots = [...s.playerSlots, ...s.enemies.map(([, q, r]) => ({ q, r })), ...(s.boss ? [{ q: s.boss[1], r: s.boss[2] }] : []), ...(s.escort ? [s.escort] : [])];
      spots.forEach(h => {
        expect(cells.has(key(h))).toBe(true);
        expect(s.terrain[key(h)]).not.toBe('water');
      });
      expect(new Set(spots.map(key)).size).toBe(spots.length);
      Object.keys(s.terrain).forEach(k => expect(cells.has(k)).toBe(true));
      for (const wave of s.reinforcements ?? []) wave.units.forEach(([, q, r]) => expect(cells.has(key({ q, r }))).toBe(true));
      expect(s.briefing.length).toBeGreaterThanOrEqual(3);
      expect(s.briefing.join('')).toMatch(/[\u4e00-\u9fa5]/);
    }
  });
  it('builds each battle with owner-tagged player, enemy, escort and boss units', () => {
    let c = newCampaign(1);
    for (let level = 0; level < CAMPAIGN.length; level++) {
      c = { ...c, level };
      const battle = startBattle(openBriefing(c)).battle!;
      expect(validSave(battle)).toBe(true);
      expect(battle.scenarioId).toBe(CAMPAIGN[level].id);
      expect(battle.units.filter(u => u.rosterId).every(u => u.owner === 'orc')).toBe(true);
      expect(enemyUnits(battle).length).toBeGreaterThan(0);
      if (level === 1) expect(battle.units.find(u => u.role === 'escort')?.owner).toBe('orc');
      if (level === 3) expect(battle.units.find(u => u.role === 'boss')?.statuses).toEqual([{ id: 'regen', turns: 99 }]);
    }
  });
  it('keeps the original skirmish identical apart from the owner field', () => {
    const state = createGame();
    expect(state.scenarioId).toBe('skirmish');
    expect(state.units.map(factionOf)).toEqual(state.units.map(u => UNITS[u.kind].faction));
  });
});

describe('capture', () => {
  it('captures instead of killing when the seeded roll succeeds, and logs it', () => {
    const probe = finisher(1);
    const chance = captureChance(probe, probe.units[0], enemyUnits(probe)[0], false);
    expect(chance).toBeGreaterThan(0);
    const state = finisher(1);
    state.rng = seedFor(chance, true);
    const after = act(state, { type: 'attack', unitId: state.units[0].id, targetId: enemyUnits(state)[0].id });
    const target = enemyUnits(after)[0];
    expect(target.hp).toBe(0);
    expect(target.captured).toBe(true);
    expect(after.log.some(l => l.type === 'capture')).toBe(true);
    expect(after.rng).not.toBe(state.rng);
  });
  it('kills when the roll fails, and is reproducible for the same seed', () => {
    const state = finisher(1);
    const chance = captureChance(state, state.units[0], enemyUnits(state)[0], false);
    state.rng = seedFor(chance, false);
    const a = act(state, { type: 'attack', unitId: state.units[0].id, targetId: enemyUnits(state)[0].id });
    const b = act(state, { type: 'attack', unitId: state.units[0].id, targetId: enemyUnits(state)[0].id });
    expect(enemyUnits(a)[0].captured).toBeUndefined();
    expect(a.log.at(-2)?.type === 'death' || a.log.some(l => l.type === 'death')).toBe(true);
    expect(a).toEqual(b);
  });
  it('modifies chance by unit type, skills, perks, resistance and enemy collapse', () => {
    const state = finisher(1);
    const attacker = state.units[0];
    const target = enemyUnits(state)[0];
    const support = captureChance(state, attacker, target, false);
    target.kind = 'warden';
    const commander = captureChance(state, attacker, target, false);
    expect(support).toBeGreaterThan(commander);
    expect(captureChance(state, attacker, target, true)).toBeLessThan(commander);
    state.captureMod = -RESISTANCE.capturePerPoint * 2;
    expect(captureChance(state, attacker, target, false)).toBeLessThan(commander);
    target.role = 'boss';
    expect(captureChance(state, attacker, target, false)).toBe(0);
    expect(captureChance(createGame(), createGame().units[0], createGame().units[5], false)).toBe(0);
  });
  it('never lets enemies capture the player units', () => {
    const state = finisher(1);
    expect(captureChance(state, enemyUnits(state)[0], state.units[0], false)).toBe(0);
  });
});

describe('campaign progression and prisoner camp', () => {
  function wonLevel(seed = 3): CampaignState {
    const c = startBattle(newCampaign(seed));
    const battle = c.battle!;
    const prisoners = enemyUnits(battle).slice(0, 3);
    const kinds: Unit['kind'][] = ['warden', 'ranger', 'blade'];
    prisoners.forEach((u, i) => Object.assign(u, { kind: kinds[i], hp: 0, captured: true }));
    enemyUnits(battle).slice(3).forEach(u => { u.hp = 0; });
    battle.units.find(u => u.rosterId === 'r-raider2')!.hp = 0;
    battle.winner = 'orc';
    return c;
  }
  it('turns a victory into prisoners, a reward unit, permanent losses and a morale change', () => {
    const before = wonLevel();
    const after = concludeBattle(before);
    expect(after.phase).toBe('result');
    expect(after.level).toBe(1);
    expect(after.prisoners.map(p => p.kind)).toEqual(['warden', 'ranger', 'blade']);
    expect(after.roster.some(r => r.id === 'r-raider2')).toBe(false);
    expect(after.roster.some(r => r.name === CAMPAIGN[0].reward!.name)).toBe(true);
    expect(after.morale).toBe(MORALE.start + MORALE.victory + MORALE.fallen);
    expect(after.result?.fallen).toEqual(['兽人小子·巴兹']);
    expect(leaveResult(after).phase).toBe('camp');
    expect(validCampaign(after)).toBe(true);
  });
  it('retreats after a defeat without losing units or prisoners, and can retry', () => {
    const c = startBattle(newCampaign(4));
    c.battle!.winner = 'elf';
    c.battle!.units[1].hp = 0;
    const after = concludeBattle(c);
    expect(after.level).toBe(0);
    expect(after.roster).toHaveLength(6);
    expect(after.morale).toBe(MORALE.start + MORALE.defeat);
    expect(leaveResult(after).phase).toBe('map');
    expect(startBattle(openBriefing(leaveResult(after))).attempts).toBe(2);
  });
  it('interrogation unlocks the perk matching the prisoner, then falls back', () => {
    let c = concludeBattle(wonLevel());
    const [warden, ranger] = c.prisoners;
    c = resolvePrisoner(c, warden.id, 'interrogate');
    expect(c.perks).toEqual(['oathbreak']);
    expect(c.prisoners).toHaveLength(2);
    expect(interrogationPerk(c, 'warden')).toBe('ridgewatch');
    c = resolvePrisoner(c, ranger.id, 'interrogate');
    expect(c.perks).toEqual(['oathbreak', 'ridgewatch']);
    expect(c.chronicle.at(-1)).toContain(PERKS.ridgewatch.name);
    const battle = startBattle(openBriefing(leaveResult(c))).battle!;
    const warlord = battle.units.find(u => u.rosterId === 'r-warlord')!;
    const shaman = battle.units.find(u => u.rosterId === 'r-shaman')!;
    expect(attackOf(warlord)).toBe(UNITS.warlord.attack + 1 + 0);
    expect(rangeOf(shaman)).toBe(UNITS.shaman.range + 1);
  });
  it('recruitment adds the prisoner to the roster, fighting for the orcs', () => {
    let c = concludeBattle(wonLevel());
    const blade = c.prisoners.find(p => p.kind === 'blade')!;
    c = resolvePrisoner(c, blade.id, 'recruit');
    const recruit = c.roster.find(r => r.origin === 'recruit')!;
    expect(recruit.kind).toBe('blade');
    c = { ...c, prisoners: [], phase: 'map', result: null };
    const battle = startBattle({ ...openBriefing(c), deploy: [recruit.id, 'r-warlord'] }).battle!;
    const unit = battle.units.find(u => u.rosterId === recruit.id)!;
    expect(unit.owner).toBe('orc');
    expect(factionOf(unit)).toBe('orc');
    const enemy = enemyUnits(battle)[0];
    Object.assign(unit, { q: enemy.q - 1, r: enemy.r });
    expect(canAttack(battle, unit, enemy)).toBe(true);
    expect(damage(battle, unit, enemy)).toBeGreaterThan(0);
  });
  it('recruitment is refused when the roster is full', () => {
    const c = concludeBattle(wonLevel());
    const full: CampaignState = { ...c, roster: Array.from({ length: ROSTER_CAP }, (_, i) => ({ id: `x${i}`, kind: 'brute', name: `x${i}`, origin: 'native' })) };
    expect(canRecruit(full)).toBe(false);
    expect(() => resolvePrisoner(full, c.prisoners[0].id, 'recruit')).toThrow();
  });
  it('torture raises morale now but hardens future enemies (more HP, lower capture chance)', () => {
    let c = concludeBattle(wonLevel());
    const moraleBefore = c.morale;
    c = resolvePrisoner(c, c.prisoners[0].id, 'torture');
    expect(c.morale).toBe(moraleBefore + MORALE.torture);
    expect(c.resistance).toBe(1);
    expect(c.chronicle.at(-1)!.length).toBeLessThanOrEqual(80);
    c = { ...c, prisoners: [], phase: 'map', result: null };
    const battle = startBattle(openBriefing(c)).battle!;
    const enemy = enemyUnits(battle)[0];
    expect(maxHp(enemy)).toBe(UNITS[enemy.kind].hp + RESISTANCE.hpPerPoint);
    expect(battle.captureMod).toBeCloseTo(-RESISTANCE.capturePerPoint);
  });
  it('morale tiers change the next battle', () => {
    const high = startBattle({ ...newCampaign(1), morale: 85 }).battle!;
    const low = startBattle({ ...newCampaign(1), morale: 10 }).battle!;
    const hw = high.units.find(u => u.rosterId === 'r-warlord')!;
    const lw = low.units.find(u => u.rosterId === 'r-warlord')!;
    expect(moraleTier(85).name).toBe('战意沸腾');
    expect(attackOf(hw)).toBe(UNITS.warlord.attack + 1);
    expect(maxHp(hw)).toBe(UNITS.warlord.hp + 3);
    expect(attackOf(lw)).toBe(UNITS.warlord.attack - 1);
    expect(lw.ap).toBe(maxAp(lw) - 1);
    expect(playerBonus({ ...newCampaign(1), morale: 50 }, 'brute')).toEqual({});
  });
});

describe('objectives', () => {
  const run = (state: GameState, ends: number): GameState => { for (let i = 0; i < ends && !state.winner; i++) state = act(state, { type: 'end' }); return state; };
  it('timed level is lost when the river rises', () => {
    const after = run(startBattle(newCampaign(1)).battle!, 40);
    expect(after.winner).toBe('elf');
    expect(after.round).toBe(11);
  });
  it('escort wins on reaching the goal and loses if the totem falls', () => {
    const battle = startBattle({ ...newCampaign(1), level: 1 }).battle!;
    const escort = battle.units.find(u => u.role === 'escort')!;
    Object.assign(escort, { q: 3, r: 0 });
    battle.units.filter(u => u.owner === 'elf').forEach(u => { if (Math.abs(u.q - 4) + Math.abs(u.r) < 3) Object.assign(u, { q: -1, r: 1 - battle.units.indexOf(u) % 3 }); });
    battle.units.filter(u => u.owner === 'elf').forEach(u => { u.hp = u.q === 4 ? 0 : u.hp; });
    const won = act(battle, { type: 'move', unitId: 'escort', to: { q: 4, r: 0 } });
    expect(won.winner).toBe('orc');
    const lost = startBattle({ ...newCampaign(1), level: 1 }).battle!;
    lost.units.find(u => u.role === 'escort')!.hp = 0;
    expect(act(lost, { type: 'end' }).winner).toBe('elf');
  });
  it('defend level warns on the first altar turn, loses on the second and wins after eight rounds', () => {
    const battle = startBattle({ ...newCampaign(1), level: 2 }).battle!;
    battle.units.filter(u => u.owner === 'orc').forEach((u, i) => Object.assign(u, { q: -5 + i, r: 5 }));
    battle.units.filter(u => u.owner === 'orc').forEach(u => { if (u.q + u.r > 5 || u.q + u.r < -5) Object.assign(u, { q: u.q, r: 0 }); });
    const holder = battle.units.find(u => u.owner === 'elf')!;
    Object.assign(holder, { q: 0, r: 0 });
    let s = act(battle, { type: 'end' });
    s = act(s, { type: 'end' });
    expect(s.winner).toBeNull();
    expect(s.objectiveCounter).toBe(1);
    expect(s.log.some(l => l.type === 'objective' && l.text.includes('月井'))).toBe(true);
    s = act(act(s, { type: 'end' }), { type: 'end' });
    expect(s.winner).toBe('elf');
    const safe = startBattle({ ...newCampaign(1), level: 2 }).battle!;
    const survived = run(safe, 16);
    expect(survived.winner).toBe('orc');
  });
  it('boss level ends when the regent falls, even with guards alive; the regent regenerates', () => {
    const battle = startBattle({ ...newCampaign(1), level: 3 }).battle!;
    const boss = battle.units.find(u => u.role === 'boss')!;
    boss.hp = 30;
    const s = act(act(battle, { type: 'end' }), { type: 'end' });
    expect(s.units.find(u => u.role === 'boss')!.hp).toBe(34);
    const kill = startBattle({ ...newCampaign(1), level: 3 }).battle!;
    const b = kill.units.find(u => u.role === 'boss')!;
    const attacker = kill.units[0];
    kill.tiles.forEach(t => { if (t.terrain !== 'water') t.terrain = 'plain'; });
    Object.assign(b, { hp: 1, q: 0, r: -4 });
    Object.assign(attacker, { q: -1, r: -4 });
    const after = act(kill, { type: 'attack', unitId: attacker.id, targetId: 'boss' });
    expect(after.winner).toBe('orc');
    expect(after.units.find(u => u.role === 'boss')!.captured).toBeUndefined();
    expect(living(after, 'elf').length).toBeGreaterThan(0);
  });
  it('spawns reinforcements on schedule and does not award an early win before they arrive', () => {
    const battle = startBattle({ ...newCampaign(1), level: 1 }).battle!;
    const early = run(battle, 4);
    expect(early.units.some(u => u.id.startsWith('w3-'))).toBe(false);
    const s = act(early, { type: 'end' });
    expect(s.units.some(u => u.id.startsWith('w3-'))).toBe(true);
    expect(validSave(s)).toBe(true);
  });
});

describe('save v2', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const memoryStorage = (): Map<string, string> => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
    });
    return memory;
  };
  it('round-trips campaigns in every phase', () => {
    memoryStorage();
    let c = newCampaign(9);
    expect(validCampaign(c)).toBe(true);
    c = startBattle(openBriefing(c));
    expect(saveCampaign(c)).toBe(true);
    const loaded = loadCampaign();
    expect(loaded.status === 'loaded' && loaded.state).toEqual(c);
    c.battle!.winner = 'orc';
    enemyUnits(c.battle!).forEach(u => { u.hp = 0; u.captured = true; });
    c = concludeBattle(c);
    expect(validCampaign(c)).toBe(true);
    expect(validCampaign(leaveResult(c))).toBe(true);
  });
  it('rejects forged campaigns', () => {
    const c = newCampaign(1);
    const forged = [
      { ...c, version: 1 }, { ...c, morale: 101 }, { ...c, level: 11 }, { ...c, perks: ['godmode'] }, { ...c, perks: ['oathbreak', 'oathbreak'] },
      { ...c, roster: [...c.roster, ...c.roster] }, { ...c, phase: 'battle' }, { ...c, deploy: ['nobody'] }, { ...c, phase: 'camp' },
    ];
    forged.forEach(f => expect(validCampaign(f)).toBe(false));
    const battle = startBattle(c);
    battle.battle!.units[0].hp = 999;
    expect(validCampaign(battle)).toBe(false);
  });
  it('migrates a valid v1 skirmish save once and removes the legacy key', () => {
    const memory = memoryStorage();
    const legacy = createGame('local') as unknown as Record<string, unknown>;
    const v1 = { ...legacy, version: 1, units: createGame('local').units.map(({ owner: _owner, ...u }) => u) };
    delete (v1 as Record<string, unknown>).scenarioId;
    delete (v1 as Record<string, unknown>).rng;
    memory.set(LEGACY_KEY, JSON.stringify(v1));
    const result = loadGame();
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.migrated).toBe(true);
      expect(result.state.units.map(u => u.owner)).toEqual(createGame().units.map(u => u.owner));
    }
    expect(memory.has(LEGACY_KEY)).toBe(false);
    expect(memory.has(SKIRMISH_KEY)).toBe(true);
    expect(loadGame().status).toBe('loaded');
  });
  it('resets an unreadable v1 save with a clear message', () => {
    const memory = memoryStorage();
    memory.set(LEGACY_KEY, '{"version":1,"units":"nope"}');
    const result = loadGame();
    expect(result.status).toBe('error');
    expect(result.status === 'error' && result.message).toContain('存档不兼容或已损坏');
    expect(memory.has(LEGACY_KEY)).toBe(false);
    expect(memory.has(CAMPAIGN_KEY)).toBe(false);
  });
});
