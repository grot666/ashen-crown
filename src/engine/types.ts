export type Faction = 'orc' | 'elf';
export type Terrain = 'plain' | 'forest' | 'ridge' | 'ruins' | 'water';
export type UnitKind = 'warlord' | 'brute' | 'raider' | 'shaman' | 'goblin' | 'goblinKnight' | 'exile' | 'warden' | 'ranger' | 'blade' | 'oracle' | 'regent' | 'totem';
export type Gender = 'female' | 'male';
export interface Hex { q: number; r: number }
export interface Tile extends Hex { terrain: Terrain }
export type SkillEffect = 'damage' | 'heal';
export interface SkillDefinition {
  name: string;
  description: string;
  effect: SkillEffect;
  range: number;
  power: number;
  cost: number;
  cooldown: number;
}
export interface UnitDefinition {
  name: string;
  role: string;
  faction: Faction;
  hp: number;
  attack: number;
  armor: number;
  range: number;
  ap: number;
  attackCost: number;
  skill: SkillDefinition;
  /** Default gender for this unit type; level data may override per unit. */
  gender?: Gender;
  /** Special rule text shown in the unit dossier. */
  trait?: string;
}
/** Temporary or permanent unit conditions, processed at the start of the owner's turn. */
export type StatusId = 'slowed' | 'regen' | 'charge';
export interface Status { id: StatusId; turns: number }
/** Flat modifiers applied on top of the unit definition (perks, morale, resistance). */
export interface StatBonus { hp?: number; attack?: number; armor?: number; range?: number; ap?: number }
export type UnitRole = 'escort' | 'boss';
export interface Unit extends Hex {
  id: string;
  kind: UnitKind;
  /** The side this unit fights for. Recruited prisoners keep their kind but change owner. */
  owner: Faction;
  hp: number;
  ap: number;
  cooldown: number;
  name?: string;
  /** Per-unit override of the unit type's default gender. */
  gender?: Gender;
  rosterId?: string;
  role?: UnitRole;
  captured?: boolean;
  bonus?: StatBonus;
  statuses?: Status[];
}
export interface BattleLog {
  round: number;
  faction: Faction;
  text: string;
  type: 'system' | 'move' | 'attack' | 'skill' | 'death' | 'capture' | 'objective';
}
export interface GameState {
  version: 2;
  scenarioId: string;
  units: Unit[];
  tiles: Tile[];
  active: Faction;
  round: number;
  turn: number;
  winner: Faction | 'draw' | null;
  mode: 'ai' | 'local';
  player: Faction;
  log: BattleLog[];
  /** Seeded RNG cursor (uint32). Only capture rolls consume it, so battles stay reproducible. */
  rng: number;
  /** Additive capture-chance modifier from perks and enemy resistance. */
  captureMod: number;
  /** Objective progress counter (defend: consecutive enemy turns ending on the altar). */
  objectiveCounter: number;
}
export type Action =
  | { type: 'move'; unitId: string; to: Hex }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'skill'; unitId: string; targetId: string }
  | { type: 'end' };
export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };
