import { UNITS } from './engine/content';
import { createGame, factionOf, living } from './engine/game';
import { key } from './engine/hex';
import type { BattleLog, Faction, GameState, Tile, Unit } from './engine/types';

const SAVE_KEY = 'ashen-crown:campaign:v1';
export type LoadResult = { status: 'empty' } | { status: 'loaded'; state: GameState } | { status: 'error'; message: string };
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && typeof v === 'number' && v >= min && v <= max;
const faction = (v: unknown): v is Faction => v === 'orc' || v === 'elf';
export function validSave(value: unknown): value is GameState {
  if (!record(value) || value.version !== 1 || !faction(value.active) ||
    !faction(value.player) || (value.mode !== 'ai' && value.mode !== 'local') ||
    (value.winner !== null && value.winner !== 'orc' && value.winner !== 'elf' && value.winner !== 'draw') ||
    !integer(value.round, 1, 41) || !integer(value.turn, 1, 81) ||
    !Array.isArray(value.units) || !Array.isArray(value.tiles) || !Array.isArray(value.log)) return false;
  const canonical = createGame();
  const { units, tiles, log } = value;
  if (units.length !== canonical.units.length || tiles.length !== canonical.tiles.length || log.length > 2000) return false;
  if (!tiles.every((t, i): t is Tile => record(t) && t.q === canonical.tiles[i].q && t.r === canonical.tiles[i].r && t.terrain === canonical.tiles[i].terrain)) return false;
  if (!units.every((u, i): u is Unit => {
    if (!record(u)) return false;
    const original = canonical.units[i];
    const def = UNITS[original.kind];
    return u.id === original.id && u.kind === original.kind && integer(u.hp, 0, def.hp) &&
      integer(u.ap, 0, def.ap) && integer(u.cooldown, 0, def.skill.cooldown) &&
      integer(u.q, -4, 4) && integer(u.r, -4, 4) &&
      canonical.tiles.some(t => t.q === u.q && t.r === u.r && t.terrain !== 'water');
  })) return false;
  if (!log.every((l): l is BattleLog => record(l) && integer(l.round, 1, 41) && faction(l.faction) &&
    ['system', 'move', 'attack', 'skill', 'death'].includes(String(l.type)) && typeof l.text === 'string' && l.text.length <= 250)) return false;
  const state: GameState = {
    version: 1, units, tiles, log, active: value.active, player: value.player,
    mode: value.mode, winner: value.winner, round: value.round, turn: value.turn,
  };
  const alive = living(state);
  if (new Set(alive.map(key)).size !== alive.length) return false;
  const expectedActive = state.turn % 2 ? 'orc' : 'elf';
  if (state.active !== expectedActive || state.round !== Math.floor((state.turn + 1) / 2)) return false;
  if (state.winner === null && (!living(state, 'orc').length || !living(state, 'elf').length)) return false;
  if (state.winner && state.winner !== 'draw' && alive.some(u => factionOf(u) !== state.winner)) return false;
  return state.winner !== 'draw' || state.round === 41;
}
export function loadGame(): LoadResult {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { status: 'empty' };
    const parsed: unknown = JSON.parse(raw);
    if (!validSave(parsed)) return { status: 'error', message: '本地存档不兼容或已损坏，已开启新战役。' };
    return { status: 'loaded', state: parsed };
  } catch (error) {
    console.warn('Campaign could not be loaded', error);
    return { status: 'error', message: '无法读取本地存档。当前战役仍可正常游玩。' };
  }
}
export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('Campaign could not be saved', error);
    return false;
  }
}
