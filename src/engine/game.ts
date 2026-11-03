import { FACTIONS, TERRAIN, UNITS } from './content';
import { disk, distance, equal, key, line, neighbors } from './hex';
import type { Action, ActionResult, BattleLog, Faction, GameState, Hex, Terrain, Tile, Unit, UnitKind } from './types';

export const opponent = (f: Faction): Faction => f === 'orc' ? 'elf' : 'orc';
export const factionOf = (unit: Unit): Faction => UNITS[unit.kind].faction;
export const living = (state: GameState, faction?: Faction): Unit[] =>
  state.units.filter(u => u.hp > 0 && (!faction || factionOf(u) === faction));
export const tileAt = (state: GameState, hex: Hex): Tile | undefined => state.tiles.find(t => equal(t, hex));
export const unitAt = (state: GameState, hex: Hex): Unit | undefined => living(state).find(u => equal(u, hex));
export const isAITurn = (state: GameState): boolean => state.mode === 'ai' && state.active !== state.player && !state.winner;

export function createGame(mode: GameState['mode'] = 'ai', player: Faction = 'orc'): GameState {
  const terrain: Record<string, Terrain> = {
    '0,0': 'ruins', '0,-1': 'ruins', '0,1': 'ruins',
    '-1,-1': 'forest', '1,1': 'forest', '-2,0': 'forest', '2,0': 'forest',
    '-1,2': 'forest', '1,-2': 'forest', '-2,3': 'forest', '2,-3': 'forest',
    '0,-3': 'ridge', '0,3': 'ridge', '-2,1': 'ridge', '2,-1': 'ridge',
    '-1,-2': 'water', '1,2': 'water',
  };
  const placements: [UnitKind, number, number][] = [
    ['warlord', -3, 1], ['brute', -3, 0], ['raider', -2, -1], ['raider', -4, 3], ['shaman', -4, 2],
    ['warden', 3, -1], ['ranger', 3, 0], ['ranger', 4, -3], ['blade', 2, 1], ['oracle', 4, -2],
  ];
  return {
    version: 1, mode, player, active: 'orc', round: 1, turn: 1, winner: null,
    tiles: disk(4).map(h => ({ ...h, terrain: terrain[key(h)] ?? 'plain' })),
    units: placements.map(([kind, q, r], i) => ({ id: `u${i}`, kind, q, r, hp: UNITS[kind].hp, ap: UNITS[kind].ap, cooldown: 0 })),
    log: [{ round: 1, faction: 'orc', text: '黑棘隘口 · 灰牙氏族先行。王冠的废墟，容不下两面旗帜。', type: 'system' }],
  };
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
    distance(unit, target) <= def.range && hasSight(state, unit, target);
}
export function canSkill(state: GameState, unit: Unit, target: Unit): boolean {
  const skill = UNITS[unit.kind].skill;
  return !state.winner && unit.hp > 0 && target.hp > 0 && factionOf(unit) === state.active &&
    unit.cooldown === 0 && unit.ap >= skill.cost && distance(unit, target) <= skill.range &&
    hasSight(state, unit, target) && (skill.effect === 'heal'
      ? factionOf(unit) === factionOf(target) && target.hp < UNITS[target.kind].hp
      : factionOf(unit) !== factionOf(target));
}
export function damage(state: GameState, unit: Unit, target: Unit): number {
  const def = UNITS[unit.kind];
  const elevation = def.range > 1 && tileAt(state, unit)?.terrain === 'ridge' ? 2 : 0;
  const cover = TERRAIN[tileAt(state, target)?.terrain ?? 'plain'].defense;
  return Math.max(2, def.attack + elevation - UNITS[target.kind].armor - cover);
}
function log(state: GameState, text: string, type: BattleLog['type']): void {
  state.log.push({ round: state.round, faction: state.active, text, type });
}
function checkVictory(state: GameState): void {
  if (!living(state, 'orc').length) state.winner = 'elf';
  else if (!living(state, 'elf').length) state.winner = 'orc';
  if (state.winner && state.winner !== 'draw') log(state, `${FACTIONS[state.winner].name}赢得战役。黑棘隘口，尘埃落定。`, 'system');
}
export function applyAction(source: GameState, action: Action): ActionResult {
  if (source.winner) return { ok: false, error: '战役已结束，请开启新的战役。' };
  const state = structuredClone(source);
  if (action.type === 'end') {
    state.active = opponent(state.active);
    state.turn++;
    if (state.active === 'orc') state.round++;
    for (const unit of living(state, state.active)) {
      unit.ap = UNITS[unit.kind].ap;
      unit.cooldown = Math.max(0, unit.cooldown - 1);
    }
    if (state.round > 40) {
      state.winner = 'draw';
      log(state, '四十轮交锋后，黑雾吞没隘口。双方撤军，战役平局。', 'system');
    } else log(state, `${FACTIONS[state.active].name}开始行动。`, 'system');
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
    log(state, `${def.name}进入${TERRAIN[tileAt(state, unit)!.terrain].name}，消耗 ${cost} AP。`, 'move');
  } else {
    const target = state.units.find(u => u.id === action.targetId && u.hp > 0);
    if (!target) return { ok: false, error: '目标已离开战场。' };
    if (action.type === 'attack') {
      if (!canAttack(state, unit, target)) return { ok: false, error: '无法攻击：目标不在射程／视线内，或 AP 不足。' };
      const amount = damage(state, unit, target);
      target.hp = Math.max(0, target.hp - amount);
      unit.ap -= def.attackCost;
      log(state, `${def.name}攻击${UNITS[target.kind].name}，造成 ${amount} 点伤害。`, 'attack');
    } else {
      if (!canSkill(state, unit, target)) return { ok: false, error: '无法施放：请检查目标、射程、视线、AP 与技能冷却。' };
      const skill = def.skill;
      const amount = skill.effect === 'heal' ? Math.min(skill.power, UNITS[target.kind].hp - target.hp) : Math.min(skill.power, target.hp);
      target.hp = skill.effect === 'heal' ? target.hp + amount : target.hp - amount;
      unit.ap -= skill.cost;
      unit.cooldown = skill.cooldown;
      log(state, `${def.name}施放「${skill.name}」，${UNITS[target.kind].name}${skill.effect === 'heal' ? '恢复' : '受到'} ${amount} 点${skill.effect === 'heal' ? '生命' : '伤害'}。`, 'skill');
    }
    if (target.hp === 0) log(state, `${UNITS[target.kind].name}倒下，旗帜归于灰烬。`, 'death');
  }
  checkVictory(state);
  return { ok: true, state };
}
