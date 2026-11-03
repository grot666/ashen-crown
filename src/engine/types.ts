export type Faction = 'orc' | 'elf';
export type Terrain = 'plain' | 'forest' | 'ridge' | 'ruins' | 'water';
export type UnitKind = 'warlord' | 'brute' | 'raider' | 'shaman' | 'warden' | 'ranger' | 'blade' | 'oracle';
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
}
export interface Unit extends Hex {
  id: string;
  kind: UnitKind;
  hp: number;
  ap: number;
  cooldown: number;
}
export interface BattleLog {
  round: number;
  faction: Faction;
  text: string;
  type: 'system' | 'move' | 'attack' | 'skill' | 'death';
}
export interface GameState {
  version: 1;
  units: Unit[];
  tiles: Tile[];
  active: Faction;
  round: number;
  turn: number;
  winner: Faction | 'draw' | null;
  mode: 'ai' | 'local';
  player: Faction;
  log: BattleLog[];
}
export type Action =
  | { type: 'move'; unitId: string; to: Hex }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'skill'; unitId: string; targetId: string }
  | { type: 'end' };
export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };
