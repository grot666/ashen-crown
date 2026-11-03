import { PERK_ORDER, ROSTER_CAP, type CampaignState } from './engine/campaign';
import { UNITS } from './engine/content';
import { buildTiles, factionOf, living, maxAp, maxHp } from './engine/game';
import { key } from './engine/hex';
import { CAMPAIGN, SCENARIOS } from './engine/scenarios';
import type { BattleLog, Faction, GameState, Tile, Unit, UnitKind } from './engine/types';

export const SKIRMISH_KEY = 'ashen-crown:skirmish:v2';
export const CAMPAIGN_KEY = 'ashen-crown:campaign:v2';
/** v1 stored a single skirmish battle under this key. It is migrated once, then removed. */
export const LEGACY_KEY = 'ashen-crown:campaign:v1';

export type LoadResult<T = GameState> = { status: 'empty' } | { status: 'loaded'; state: T; migrated?: boolean } | { status: 'error'; message: string };
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && typeof v === 'number' && v >= min && v <= max;
const faction = (v: unknown): v is Faction => v === 'orc' || v === 'elf';
const kind = (v: unknown): v is UnitKind => typeof v === 'string' && Object.hasOwn(UNITS, v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const LOG_TYPES = ['system', 'move', 'attack', 'skill', 'death', 'capture', 'objective'];
const BONUS_KEYS = ['hp', 'attack', 'armor', 'range', 'ap'];

function validUnit(u: unknown, tiles: Tile[], radius: number): u is Unit {
  if (!record(u) || !text(u.id, 24) || !kind(u.kind) || !faction(u.owner)) return false;
  if (u.bonus !== undefined && !(record(u.bonus) && Object.entries(u.bonus).every(([k, v]) => BONUS_KEYS.includes(k) && integer(v, -5, 40)))) return false;
  if (u.statuses !== undefined && !(Array.isArray(u.statuses) && u.statuses.length <= 4 &&
    u.statuses.every(s => record(s) && (s.id === 'slowed' || s.id === 'regen') && integer(s.turns, 1, 99)))) return false;
  if (u.name !== undefined && !text(u.name, 30)) return false;
  if (u.gender !== undefined && u.gender !== 'female' && u.gender !== 'male') return false;
  if (u.rosterId !== undefined && !text(u.rosterId, 40)) return false;
  if (u.role !== undefined && u.role !== 'escort' && u.role !== 'boss') return false;
  if (u.captured !== undefined && !(u.captured === true && u.hp === 0)) return false;
  const unit = u as unknown as Unit;
  return integer(u.hp, 0, maxHp(unit)) && integer(u.ap, 0, maxAp(unit)) && integer(u.cooldown, 0, UNITS[unit.kind].skill.cooldown) &&
    integer(u.q, -radius, radius) && integer(u.r, -radius, radius) && tiles.some(t => t.q === u.q && t.r === u.r && t.terrain !== 'water');
}

/** Structural validation of a v2 battle against its scenario map. */
export function validSave(value: unknown): value is GameState {
  if (!record(value) || value.version !== 2 || typeof value.scenarioId !== 'string' || !Object.hasOwn(SCENARIOS, value.scenarioId)) return false;
  const scenario = SCENARIOS[value.scenarioId];
  const limit = scenario.maxRounds + 1;
  if (!faction(value.active) || !faction(value.player) || (value.mode !== 'ai' && value.mode !== 'local') ||
    (value.winner !== null && value.winner !== 'orc' && value.winner !== 'elf' && value.winner !== 'draw') ||
    !integer(value.round, 1, limit) || !integer(value.turn, 1, limit * 2 - 1) || !integer(value.rng, 0, 4294967295) ||
    typeof value.captureMod !== 'number' || Math.abs(value.captureMod) > 2 || !integer(value.objectiveCounter, 0, 2) ||
    !Array.isArray(value.units) || !Array.isArray(value.tiles) || !Array.isArray(value.log)) return false;
  const canonical = buildTiles(scenario);
  const { units, tiles, log } = value;
  if (tiles.length !== canonical.length || log.length > 2000 || units.length < 2 || units.length > 40) return false;
  if (!tiles.every((t, i): t is Tile => record(t) && t.q === canonical[i].q && t.r === canonical[i].r && t.terrain === canonical[i].terrain)) return false;
  if (!units.every(u => validUnit(u, canonical, scenario.radius))) return false;
  if (new Set(units.map(u => (u as Unit).id)).size !== units.length) return false;
  if (!log.every((l): l is BattleLog => record(l) && integer(l.round, 1, limit) && faction(l.faction) &&
    LOG_TYPES.includes(String(l.type)) && text(l.text, 250))) return false;
  const state = value as unknown as GameState;
  const alive = living(state);
  if (new Set(alive.map(key)).size !== alive.length) return false;
  const expectedActive = state.turn % 2 ? 'orc' : 'elf';
  if (state.active !== expectedActive || state.round !== Math.floor((state.turn + 1) / 2)) return false;
  if (state.scenarioId === 'skirmish') {
    if (units.length !== scenario.fixed!.length || !units.every((u, i) => (u as Unit).kind === scenario.fixed![i][0] && (u as Unit).id === `u${i}`)) return false;
    if (state.winner === null && (!living(state, 'orc').length || !living(state, 'elf').length)) return false;
    if (state.winner && state.winner !== 'draw' && alive.some(u => factionOf(u) !== state.winner)) return false;
    return state.winner !== 'draw' || state.round === limit;
  }
  if (state.winner === 'draw' || state.mode !== 'ai') return false;
  return state.winner !== null || living(state, state.player).length > 0;
}

/** Legacy (v1) skirmish validation, used only to decide whether a v1 save can be migrated. */
export function validLegacySave(value: unknown): boolean {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.units)) return false;
  const migrated = migrateLegacy(value);
  return migrated !== null && validSave(migrated);
}
export function migrateLegacy(value: Record<string, unknown>): GameState | null {
  if (!Array.isArray(value.units) || !value.units.every(u => record(u) && kind(u.kind))) return null;
  return {
    ...(value as unknown as GameState), version: 2, scenarioId: 'skirmish', rng: 0, captureMod: 0, objectiveCounter: 0,
    units: (value.units as Unit[]).map(u => ({ ...u, owner: UNITS[u.kind].faction })),
  };
}

export function validCampaign(value: unknown): value is CampaignState {
  if (!record(value) || value.version !== 2 || !integer(value.seed, 0, 4294967295) || !integer(value.level, 0, CAMPAIGN.length) ||
    !integer(value.attempts, 0, 100000) || !['map', 'briefing', 'battle', 'result', 'camp', 'complete'].includes(String(value.phase)) ||
    !integer(value.morale, 0, 100) || !integer(value.resistance, 0, 50) ||
    !Array.isArray(value.roster) || !Array.isArray(value.prisoners) || !Array.isArray(value.perks) || !Array.isArray(value.deploy) || !Array.isArray(value.chronicle)) return false;
  const { roster, prisoners, perks, deploy, chronicle } = value;
  if (roster.length > ROSTER_CAP || !roster.every(r => record(r) && text(r.id, 40) && kind(r.kind) && text(r.name, 30) && (r.origin === 'native' || r.origin === 'recruit'))) return false;
  const ids = roster.map(r => (r as { id: string }).id);
  if (new Set(ids).size !== ids.length) return false;
  if (prisoners.length > 40 || !prisoners.every(p => record(p) && text(p.id, 40) && kind(p.kind) && integer(p.level, 0, CAMPAIGN.length))) return false;
  if (new Set(perks).size !== perks.length || !perks.every(p => PERK_ORDER.includes(p as never))) return false;
  if (!deploy.every(d => ids.includes(d as string))) return false;
  if (chronicle.length > 300 || !chronicle.every(c => text(c, 250))) return false;
  if (!record(value.stats) || !['victories', 'defeats', 'captured', 'interrogated', 'recruited', 'tortured'].every(k => integer((value.stats as Record<string, unknown>)[k], 0, 100000))) return false;
  if (value.result !== null && !(record(value.result) && typeof value.result.victory === 'boolean' && integer(value.result.level, 0, CAMPAIGN.length) &&
    Array.isArray(value.result.fallen) && Array.isArray(value.result.captured) && typeof value.result.moraleDelta === 'number')) return false;
  if (value.phase === 'battle') {
    if (!validSave(value.battle) || value.battle.scenarioId !== CAMPAIGN[value.level as number]?.id) return false;
  } else if (value.battle !== null) return false;
  if ((value.phase === 'result') !== (value.result !== null) && value.phase !== 'camp') return false;
  if (value.phase === 'camp' && !prisoners.length) return false;
  return true;
}

function read<T>(storageKey: string, check: (v: unknown) => v is T): LoadResult<T> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { status: 'empty' };
    const parsed: unknown = JSON.parse(raw);
    if (!check(parsed)) return { status: 'error', message: '本地存档不兼容或已损坏，已开启新战役。' };
    return { status: 'loaded', state: parsed };
  } catch (error) {
    console.warn('Save could not be loaded', error);
    return { status: 'error', message: '无法读取本地存档。当前战役仍可正常游玩。' };
  }
}
function write(storageKey: string, value: unknown): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Save could not be written', error);
    return false;
  }
}

/** Loads the skirmish battle; migrates a v1 save once (or discards it with a message). */
export function loadGame(): LoadResult {
  const current = read(SKIRMISH_KEY, validSave);
  if (current.status !== 'empty') return current;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return { status: 'empty' };
    localStorage.removeItem?.(LEGACY_KEY);
    const parsed: unknown = JSON.parse(raw);
    const migrated = record(parsed) && parsed.version === 1 ? migrateLegacy(parsed) : null;
    if (!migrated || !validSave(migrated)) return { status: 'error', message: '旧版本地存档不兼容或已损坏，已开启新战役。' };
    write(SKIRMISH_KEY, migrated);
    return { status: 'loaded', state: migrated, migrated: true };
  } catch (error) {
    console.warn('Legacy save could not be migrated', error);
    return { status: 'error', message: '旧版本地存档不兼容或已损坏，已开启新战役。' };
  }
}
export const saveGame = (state: GameState): boolean => write(SKIRMISH_KEY, state);
export const loadCampaign = (): LoadResult<CampaignState> => read(CAMPAIGN_KEY, validCampaign);
export const saveCampaign = (campaign: CampaignState): boolean => write(CAMPAIGN_KEY, campaign);
export function clearCampaign(): void {
  try { localStorage.removeItem(CAMPAIGN_KEY); } catch { /* storage unavailable */ }
}
