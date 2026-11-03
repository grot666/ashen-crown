import { FACTIONS, TERRAIN, UNITS } from './content';
import { disk, distance, equal, key, line, neighbors } from './hex';
import { nextRandom } from './rng';
import { CAMPAIGN_PLAYER, scenarioOf, type Scenario } from './scenarios';
import type { Action, ActionResult, BattleLog, Faction, GameState, Hex, Tile, Unit, UnitKind } from './types';

export const opponent = (f: Faction): Faction => f === 'orc' ? 'elf' : 'orc';
export const factionOf = (unit: Unit): Faction => unit.owner;
export const nameOf = (unit: Unit): string => unit.name ?? UNITS[unit.kind].name;
export const maxHp = (unit: Unit): number => UNITS[unit.kind].hp + (unit.bonus?.hp ?? 0);
export const maxAp = (unit: Unit): number => Math.max(1, UNITS[unit.kind].ap + (unit.bonus?.ap ?? 0));
export const attackOf = (unit: Unit): number => Math.max(0, UNITS[unit.kind].attack + (unit.bonus?.attack ?? 0));
export const armorOf = (unit: Unit): number => Math.max(0, UNITS[unit.kind].armor + (unit.bonus?.armor ?? 0));
export const rangeOf = (unit: Unit): number => Math.max(1, UNITS[unit.kind].range + (unit.bonus?.range ?? 0));
export const skillRangeOf = (unit: Unit): number => UNITS[unit.kind].skill.range + (UNITS[unit.kind].range > 1 ? unit.bonus?.range ?? 0 : 0);
export const hasStatus = (unit: Unit, id: string): boolean => !!unit.statuses?.some(s => s.id === id);
export const living = (state: GameState, faction?: Faction): Unit[] =>
  state.units.filter(u => u.hp > 0 && (!faction || factionOf(u) === faction));
export const tileAt = (state: GameState, hex: Hex): Tile | undefined => state.tiles.find(t => equal(t, hex));
export const unitAt = (state: GameState, hex: Hex): Unit | undefined => living(state).find(u => equal(u, hex));
export const isAITurn = (state: GameState): boolean => state.mode === 'ai' && state.active !== state.player && !state.winner;
export const isCampaign = (state: GameState): boolean => state.scenarioId !== 'skirmish';
export const scenarioFor = (state: GameState): Scenario => scenarioOf(state.scenarioId);

export function buildTiles(scenario: Scenario): Tile[] {
  return disk(scenario.radius).map(h => ({ ...h, terrain: scenario.terrain[key(h)] ?? 'plain' }));
}
export function makeUnit(id: string, kind: UnitKind, owner: Faction, at: Hex, extra: Partial<Unit> = {}): Unit {
  const unit: Unit = { id, kind, owner, q: at.q, r: at.r, hp: 0, ap: 0, cooldown: 0, ...extra };
  unit.hp = maxHp(unit);
  unit.ap = maxAp(unit);
  return unit;
}

export function createGame(mode: GameState['mode'] = 'ai', player: Faction = 'orc'): GameState {
  const scenario = scenarioOf('skirmish');
  return {
    version: 2, scenarioId: 'skirmish', mode, player, active: 'orc', round: 1, turn: 1, winner: null, rng: 0, captureMod: 0, objectiveCounter: 0,
    tiles: buildTiles(scenario),
    units: scenario.fixed!.map(([kind, q, r], i) => makeUnit(`u${i}`, kind, UNITS[kind].faction, { q, r })),
    log: [{ round: 1, faction: 'orc', text: '黑棘隘口 · 灰牙氏族先行。王冠的废墟，容不下两面旗帜。', type: 'system' }],
  };
}

/** Builds a campaign battle. Player units must already carry their perk/morale bonuses and statuses. */
export function createScenarioBattle(scenario: Scenario, playerUnits: Unit[], enemyBonus: Unit['bonus'], enemyStatuses: Unit['statuses'], seed: number, captureMod: number): GameState {
  const enemy = opponent(CAMPAIGN_PLAYER);
  const units: Unit[] = playerUnits.map((u, i) => ({ ...u, ...scenario.playerSlots[i] }));
  if (scenario.escort) units.push(makeUnit('escort', 'totem', CAMPAIGN_PLAYER, scenario.escort, { role: 'escort' }));
  scenario.enemies.forEach(([kind, q, r], i) => units.push(makeUnit(`e${i}`, kind, enemy, { q, r }, { bonus: enemyBonus ? { ...enemyBonus } : undefined, statuses: enemyStatuses?.map(s => ({ ...s })) })));
  if (scenario.boss) {
    const [kind, q, r] = scenario.boss;
    units.push(makeUnit('boss', kind, enemy, { q, r }, { role: 'boss', bonus: enemyBonus ? { ...enemyBonus } : undefined, statuses: [{ id: 'regen', turns: 99 }, ...(enemyStatuses ?? []).map(s => ({ ...s }))] }));
  }
  const state: GameState = {
    version: 2, scenarioId: scenario.id, mode: 'ai', player: CAMPAIGN_PLAYER, active: CAMPAIGN_PLAYER, round: 1, turn: 1, winner: null,
    rng: seed >>> 0, captureMod, objectiveCounter: 0, tiles: buildTiles(scenario), units,
    log: [{ round: 1, faction: CAMPAIGN_PLAYER, text: `${scenario.chapter}「${scenario.name}」· ${scenario.objective.summary}。`, type: 'objective' }],
  };
  applyTurnStatuses(state, CAMPAIGN_PLAYER);
  return state;
}

// Weighted flood-fill keeps movement, highlights, and AI on the same rules.
export function reachable(state: GameState, unit: Unit): Map<string, number> {
  const costs = new Map<string, number>([[key(unit), 0]]);
  const open: Hex[] = [{ q: unit.q, r: unit.r }];
  while (open.length) {
    open.sort((a, b) => costs.get(key(a))! - costs.get(key(b))!);
    const current = open.shift()!;
    const currentCost = costs.get(key(current))!;
    for (const next of neighbors(current)) {
      const tile = tileAt(state, next);
      if (!tile || unitAt(state, next)) continue;
      const cost = currentCost + TERRAIN[tile.terrain].cost;
      if (cost <= unit.ap && cost < (costs.get(key(next)) ?? Infinity)) {
        costs.set(key(next), cost);
        open.push(next);
      }
    }
  }
  costs.delete(key(unit));
  return costs;
}

export function hasSight(state: GameState, from: Hex, to: Hex): boolean {
  return line(from, to).slice(1, -1).every(hex => tileAt(state, hex)?.terrain !== 'ridge');
}
export function canAttack(state: GameState, unit: Unit, target: Unit): boolean {
  const def = UNITS[unit.kind];
  return !state.winner && unit.hp > 0 && target.hp > 0 && factionOf(unit) === state.active &&
    factionOf(unit) !== factionOf(target) && unit.ap >= def.attackCost &&
    distance(unit, target) <= rangeOf(unit) && hasSight(state, unit, target);
}
export function canSkill(state: GameState, unit: Unit, target: Unit): boolean {
  const skill = UNITS[unit.kind].skill;
  return !state.winner && unit.hp > 0 && target.hp > 0 && factionOf(unit) === state.active &&
    unit.cooldown === 0 && unit.ap >= skill.cost && distance(unit, target) <= skillRangeOf(unit) &&
    hasSight(state, unit, target) && (skill.effect === 'heal'
      ? factionOf(unit) === factionOf(target) && target.hp < maxHp(target)
      : factionOf(unit) !== factionOf(target));
}
export function damage(state: GameState, unit: Unit, target: Unit): number {
  const elevation = UNITS[unit.kind].range > 1 && tileAt(state, unit)?.terrain === 'ridge' ? 2 : 0;
  const cover = TERRAIN[tileAt(state, target)?.terrain ?? 'plain'].defense;
  return Math.max(2, attackOf(unit) + elevation - armorOf(target) - cover);
}
export function skillAmount(unit: Unit, target: Unit): number {
  const skill = UNITS[unit.kind].skill;
  return skill.effect === 'heal' ? Math.min(skill.power, maxHp(target) - target.hp) : Math.min(skill.power, target.hp);
}

const CAPTURE_KIND: Partial<Record<UnitKind, number>> = { oracle: 0.15, shaman: 0.15, ranger: 0.05, blade: 0.05, raider: 0.05, warden: -0.1, warlord: -0.1 };
/** Chance that a lethal blow from `attacker` takes `target` prisoner instead of killing it. 0 = impossible. */
export function captureChance(state: GameState, attacker: Unit, target: Unit, viaSkill: boolean): number {
  const scenario = scenarioFor(state);
  if (!scenario.captureBase || factionOf(attacker) !== state.player || factionOf(target) === state.player || target.role) return 0;
  const remaining = living(state, factionOf(target)).filter(u => u.id !== target.id).length;
  const chance = scenario.captureBase + (CAPTURE_KIND[target.kind] ?? 0) + state.captureMod +
    (remaining <= 2 ? 0.1 : 0) - (viaSkill ? 0.1 : 0);
  return Math.round(Math.min(0.85, Math.max(0.05, chance)) * 100) / 100;
}

function log(state: GameState, text: string, type: BattleLog['type']): void {
  state.log.push({ round: state.round, faction: state.active, text, type });
}

function pendingReinforcements(state: GameState): boolean {
  return (scenarioFor(state).reinforcements ?? []).some(w => state.round < w.round || (state.round === w.round && state.active === state.player));
}
function finish(state: GameState, winner: Faction | 'draw', text: string): void {
  state.winner = winner;
  log(state, text, 'system');
}
function campaignVerdict(state: GameState, winner: Faction): void {
  const scenario = scenarioFor(state);
  finish(state, winner, winner === state.player ? `胜利！${scenario.victoryText}` : `败北。${scenario.defeatText}`);
}
function checkVictory(state: GameState): void {
  if (state.winner) return;
  if (!isCampaign(state)) {
    if (!living(state, 'orc').length) state.winner = 'elf';
    else if (!living(state, 'elf').length) state.winner = 'orc';
    if (state.winner) log(state, `${FACTIONS[state.winner].name}赢得战役。黑棘隘口，尘埃落定。`, 'system');
    return;
  }
  const scenario = scenarioFor(state);
  const player = state.player;
  const enemy = opponent(player);
  const objective = scenario.objective;
  const escort = state.units.find(u => u.role === 'escort');
  const boss = state.units.find(u => u.role === 'boss');
  if (escort && escort.hp === 0) return campaignVerdict(state, enemy);
  if (!living(state, player).length) return campaignVerdict(state, enemy);
  if (objective.type === 'escort' && escort && objective.goal?.some(g => equal(g, escort))) return campaignVerdict(state, player);
  if (boss && boss.hp === 0) return campaignVerdict(state, player);
  if (!living(state, enemy).length && !pendingReinforcements(state)) campaignVerdict(state, player);
}

function freeHexNear(state: GameState, hex: Hex): Hex | undefined {
  const tiles = state.tiles.filter(t => t.terrain !== 'water' && !unitAt(state, t));
  return tiles.sort((a, b) => distance(a, hex) - distance(b, hex))[0];
}
function spawnReinforcements(state: GameState): void {
  const scenario = scenarioFor(state);
  const enemy = opponent(state.player);
  for (const wave of scenario.reinforcements ?? []) {
    if (wave.round !== state.round) continue;
    const template = state.units.find(u => factionOf(u) === enemy && u.role !== 'boss');
    wave.units.forEach(([kind, q, r], i) => {
      const at = freeHexNear(state, { q, r });
      if (at) state.units.push(makeUnit(`w${wave.round}-${i}`, kind, enemy, at, { bonus: template?.bonus ? { ...template.bonus } : undefined }));
    });
    log(state, wave.text, 'objective');
  }
}

/** Status effects tick at the start of the owner's turn (after AP refresh). */
export function applyTurnStatuses(state: GameState, faction: Faction): void {
  for (const unit of living(state, faction)) {
    if (!unit.statuses?.length) continue;
    for (const status of unit.statuses) {
      if (status.id === 'slowed') unit.ap = Math.max(0, unit.ap - 1);
      if (status.id === 'regen' && unit.hp < maxHp(unit)) {
        const amount = Math.min(4, maxHp(unit) - unit.hp);
        unit.hp += amount;
        log(state, `${nameOf(unit)}汲取长夜之力，恢复 ${amount} 点生命。`, 'skill');
      }
      if (status.turns < 99) status.turns--;
    }
    unit.statuses = unit.statuses.filter(s => s.turns > 0);
    if (!unit.statuses.length) delete unit.statuses;
  }
}

function endTurn(state: GameState): void {
  const scenario = scenarioFor(state);
  const ending = state.active;
  if (isCampaign(state) && scenario.objective.type === 'defend' && ending !== state.player) {
    const altar = scenario.objective.altar!;
    const holder = living(state, ending).find(u => equal(u, altar));
    if (holder) {
      state.objectiveCounter++;
      if (state.objectiveCounter >= 2) return campaignVerdict(state, ending);
      log(state, `${nameOf(holder)}踏上了月井！必须在下个敌方回合结束前将其击倒或逼退。`, 'objective');
    } else state.objectiveCounter = 0;
  }
  state.active = opponent(state.active);
  state.turn++;
  if (state.active === 'orc') state.round++;
  if (state.round > scenario.maxRounds) {
    if (!isCampaign(state)) return finish(state, 'draw', '四十轮交锋后，黑雾吞没隘口。双方撤军，战役平局。');
    return campaignVerdict(state, scenario.onTimeout === 'player' ? state.player : opponent(state.player));
  }
  if (isCampaign(state) && state.active !== state.player) spawnReinforcements(state);
  for (const unit of living(state, state.active)) {
    unit.ap = maxAp(unit);
    unit.cooldown = Math.max(0, unit.cooldown - 1);
  }
  applyTurnStatuses(state, state.active);
  log(state, `${FACTIONS[state.active].name}开始行动。`, 'system');
  checkVictory(state);
}

function resolveFall(state: GameState, unit: Unit, target: Unit, viaSkill: boolean): void {
  const chance = captureChance(state, unit, target, viaSkill);
  if (chance > 0) {
    const [roll, next] = nextRandom(state.rng);
    state.rng = next;
    if (roll < chance) {
      target.captured = true;
      log(state, `${nameOf(target)}力竭倒地，被灰牙战士生擒，押往后方营地（俘获率 ${Math.round(chance * 100)}%）。`, 'capture');
      return;
    }
  }
  log(state, `${nameOf(target)}倒下，旗帜归于灰烬。`, 'death');
}

export function applyAction(source: GameState, action: Action): ActionResult {
  if (source.winner) return { ok: false, error: '战役已结束，请开启新的战役。' };
  const state = structuredClone(source);
  if (action.type === 'end') {
    endTurn(state);
    return { ok: true, state };
  }
  const unit = state.units.find(u => u.id === action.unitId && u.hp > 0);
  if (!unit || factionOf(unit) !== state.active) return { ok: false, error: '请先选择当前阵营的存活单位。' };
  const def = UNITS[unit.kind];
  if (action.type === 'move') {
    const cost = reachable(state, unit).get(key(action.to));
    if (cost === undefined) return { ok: false, error: '该位置无法到达：请检查 AP、地形与路径阻挡。' };
    unit.q = action.to.q;
    unit.r = action.to.r;
    unit.ap -= cost;
    log(state, `${nameOf(unit)}进入${TERRAIN[tileAt(state, unit)!.terrain].name}，消耗 ${cost} AP。`, 'move');
  } else {
    const target = state.units.find(u => u.id === action.targetId && u.hp > 0);
    if (!target) return { ok: false, error: '目标已离开战场。' };
    if (action.type === 'attack') {
      if (!canAttack(state, unit, target)) return { ok: false, error: '无法攻击：目标不在射程／视线内，或 AP 不足。' };
      const amount = damage(state, unit, target);
      target.hp = Math.max(0, target.hp - amount);
      unit.ap -= def.attackCost;
      log(state, `${nameOf(unit)}攻击${nameOf(target)}，造成 ${amount} 点伤害。`, 'attack');
    } else {
      if (!canSkill(state, unit, target)) return { ok: false, error: '无法施放：请检查目标、射程、视线、AP 与技能冷却。' };
      const skill = def.skill;
      const amount = skillAmount(unit, target);
      target.hp = skill.effect === 'heal' ? target.hp + amount : target.hp - amount;
      unit.ap -= skill.cost;
      unit.cooldown = skill.cooldown;
      log(state, `${nameOf(unit)}施放「${skill.name}」，${nameOf(target)}${skill.effect === 'heal' ? '恢复' : '受到'} ${amount} 点${skill.effect === 'heal' ? '生命' : '伤害'}。`, 'skill');
    }
    if (target.hp === 0) resolveFall(state, unit, target, action.type === 'skill');
  }
  checkVictory(state);
  return { ok: true, state };
}
