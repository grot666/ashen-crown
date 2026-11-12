import { UNITS } from './content';
import { createScenarioBattle, makeUnit, nameOf } from './game';
import { hashSeed } from './rng';
import { CAMPAIGN, CAMPAIGN_PLAYER } from './scenarios';
import { genderOf } from './game';
import type { GameState, Gender, StatBonus, Status, Unit, UnitKind } from './types';

export type PerkId = 'oathbreak' | 'ridgewatch' | 'bladestep' | 'moonwell' | 'patrols' | 'captors';
export interface PerkDefinition { name: string; description: string; source: string }
export const PERKS: Record<PerkId, PerkDefinition> = {
  oathbreak: { name: '誓约破绽', description: '全军攻击 +1', source: '审讯守望者：暮誓誓约守卫的步法破绽' },
  ridgewatch: { name: '高地暗哨', description: '远程单位攻击与技能射程 +1', source: '审讯游侠：林间暗哨与高地射位' },
  bladestep: { name: '刃舞步法', description: '游击单位（基础 4 AP）AP +1', source: '审讯刃舞者：刃舞者的突进节奏' },
  moonwell: { name: '月泉秘方', description: '全军生命上限 +4', source: '审讯先知：月泉草药的配方' },
  patrols: { name: '巡逻路线', description: '敌军首个回合 AP −1（迟滞）', source: '审讯俘虏：王庭的巡逻与换防时间' },
  captors: { name: '俘获之术', description: '俘获率 +10%', source: '审讯俘虏：如何让精灵放下武器' },
};
export const PERK_ORDER: PerkId[] = ['oathbreak', 'ridgewatch', 'bladestep', 'moonwell', 'patrols', 'captors'];
const INTERROGATION_PREFERENCE: Partial<Record<UnitKind, PerkId>> = { warden: 'oathbreak', ranger: 'ridgewatch', blade: 'bladestep', oracle: 'moonwell', bloodKnight: 'oathbreak', nightStalker: 'bladestep', bloodMage: 'moonwell', thrall: 'captors' };

export interface RosterUnit { id: string; kind: UnitKind; name: string; origin: 'native' | 'recruit' }
/** `held` prisoners sit in the stockade (战俘营) and are decided later, at the pre-battle camp. */
export interface Prisoner { id: string; kind: UnitKind; level: number; gender?: Gender; held?: boolean }
export interface BattleResult { level: number; victory: boolean; fallen: string[]; captured: UnitKind[]; moraleDelta: number; reward: string | null; gold?: number }
export type CampaignPhase = 'map' | 'briefing' | 'battle' | 'result' | 'camp' | 'complete';
export type PrisonerChoice = 'interrogate' | 'recruit' | 'torture' | 'hold';
export interface CampaignStats { victories: number; defeats: number; captured: number; interrogated: number; recruited: number; tortured: number }
export interface CampaignState {
  version: 2;
  seed: number;
  /** Index of the next level to fight; CAMPAIGN.length = campaign complete. */
  level: number;
  attempts: number;
  phase: CampaignPhase;
  deploy: string[];
  roster: RosterUnit[];
  prisoners: Prisoner[];
  perks: PerkId[];
  morale: number;
  resistance: number;
  battle: GameState | null;
  result: BattleResult | null;
  chronicle: string[];
  stats: CampaignStats;
  /** 军饷: earned from battles, spent on hiring at camp. Saves from before v4 get a level-based default on load. */
  gold: number;
}

export const ROSTER_CAP = 10;
export const MORALE = { start: 50, victory: 10, defeat: -10, fallen: -4, torture: 15, interrogateFallback: 5 };
export const RESISTANCE = { hpPerPoint: 2, capturePerPoint: 0.08 };
export const GOLD = { start: 60, victory: 50, perLevel: 10, perCapture: 10, defeat: 15, max: 99999 };
export const STOCKADE_CAP = 8;
/** Orc units that can be hired with 军饷 at camp. Prisoners are still recruited for free in the 战俘营. */
export const HIRES: Partial<Record<UnitKind, { cost: number; names: string[] }>> = {
  goblin: { cost: 40, names: ['斯库格', '尼普', '格里布', '扎克斯', '皮普', '利兹'] },
  raider: { cost: 60, names: ['托格', '马尔克', '乌格', '加兹', '布拉克', '索尔'] },
  shaman: { cost: 70, names: ['萨格', '尤菈', '莫尔', '卡娜'] },
  brute: { cost: 110, names: ['格鲁姆', '达克', '霍格', '萨隆'] },
  exile: { cost: 80, names: ['莉安', '塞洛', '艾薇', '诺娅', '卡伦', '缇娜'] },
};
export const HIRE_ORDER: UnitKind[] = ['goblin', 'raider', 'shaman', 'brute', 'exile'];
/** Default 军饷 for a save written before the war chest existed. */
export const defaultGold = (level: number): number => GOLD.start + level * 40;
export const dismissRefund = (r: RosterUnit): number => r.kind === 'goblinKnight' ? 30 : Math.floor((HIRES[r.kind]?.cost ?? 30) / 2);
export const canDismiss = (campaign: CampaignState, id: string): boolean => {
  const r = campaign.roster.find(x => x.id === id);
  return !!r && r.kind !== 'warlord' && campaign.roster.length > 1;
};
export const prisonerGender = (p: Prisoner): Gender | undefined => p.gender ?? UNITS[p.kind].gender;
/** A goblin + a female elf captive (not a boss) can become a 哥布林骑士. */
export const canMount = (p: Prisoner): boolean => UNITS[p.kind].faction === 'elf' && p.kind !== 'regent' && prisonerGender(p) === 'female';
export const pending = (campaign: CampaignState): Prisoner[] => campaign.prisoners.filter(p => !p.held);
export const stockade = (campaign: CampaignState): Prisoner[] => campaign.prisoners.filter(p => p.held);

export interface MoraleTier { name: string; min: number; effect: string; bonus: StatBonus; slowed: boolean }
export const MORALE_TIERS: MoraleTier[] = [
  { name: '战意沸腾', min: 80, effect: '全军攻击 +1、生命上限 +3', bonus: { attack: 1, hp: 3 }, slowed: false },
  { name: '斗志昂扬', min: 60, effect: '全军攻击 +1', bonus: { attack: 1 }, slowed: false },
  { name: '军心平稳', min: 40, effect: '无额外效果', bonus: {}, slowed: false },
  { name: '军心动摇', min: 20, effect: '首个回合全军 AP −1', bonus: {}, slowed: true },
  { name: '濒临溃散', min: 0, effect: '全军攻击 −1，首个回合 AP −1', bonus: { attack: -1 }, slowed: true },
];
export const moraleTier = (morale: number): MoraleTier => MORALE_TIERS.find(t => morale >= t.min)!;
const clampMorale = (m: number): number => Math.max(0, Math.min(100, m));

export function newCampaign(seed: number): CampaignState {
  const roster: RosterUnit[] = [
    { id: 'r-warlord', kind: 'warlord', name: '督军·格罗什', origin: 'native' },
    { id: 'r-brute', kind: 'brute', name: '黑兽人·鲁克', origin: 'native' },
    { id: 'r-raider1', kind: 'raider', name: '兽人小子·瑟卡', origin: 'native' },
    { id: 'r-raider2', kind: 'raider', name: '兽人小子·巴兹', origin: 'native' },
    { id: 'r-goblin', kind: 'goblin', name: '哥布林·斯尼克', origin: 'native' },
    { id: 'r-shaman', kind: 'shaman', name: '萨满·乌尔娜', origin: 'native' },
  ];
  return {
    version: 2, seed: seed >>> 0, level: 0, attempts: 0, phase: 'map', deploy: roster.map(r => r.id), roster, prisoners: [], perks: [],
    morale: MORALE.start, resistance: 0, battle: null, result: null, chronicle: ['灰牙氏族举起战旗，踏上夺取灰烬王冠的征途。'],
    stats: { victories: 0, defeats: 0, captured: 0, interrogated: 0, recruited: 0, tortured: 0 },
    gold: GOLD.start,
  };
}

const sum = (a: StatBonus, b: StatBonus): StatBonus => {
  const out: StatBonus = {};
  for (const k of ['hp', 'attack', 'armor', 'range', 'ap'] as const) {
    const v = (a[k] ?? 0) + (b[k] ?? 0);
    if (v) out[k] = v;
  }
  return out;
};
/** All flat bonuses the player's units get from perks and morale. */
export function playerBonus(campaign: CampaignState, kind: UnitKind): StatBonus {
  let bonus: StatBonus = { ...moraleTier(campaign.morale).bonus };
  const def = UNITS[kind];
  if (campaign.perks.includes('oathbreak')) bonus = sum(bonus, { attack: 1 });
  if (campaign.perks.includes('moonwell')) bonus = sum(bonus, { hp: 4 });
  if (campaign.perks.includes('ridgewatch') && def.range > 1) bonus = sum(bonus, { range: 1 });
  if (campaign.perks.includes('bladestep') && def.ap >= 4) bonus = sum(bonus, { ap: 1 });
  return bonus;
}
export const captureModifier = (campaign: CampaignState): number =>
  (campaign.perks.includes('captors') ? 0.1 : 0) - campaign.resistance * RESISTANCE.capturePerPoint;

export function deploySlots(level: number): number { return CAMPAIGN[level]?.playerSlots.length ?? 0; }
export function setDeploy(campaign: CampaignState, ids: string[]): CampaignState {
  const valid = ids.filter((id, i) => campaign.roster.some(r => r.id === id) && ids.indexOf(id) === i);
  return { ...campaign, deploy: valid.slice(0, deploySlots(campaign.level)) };
}
export function defaultDeploy(campaign: CampaignState): string[] {
  const kept = campaign.deploy.filter(id => campaign.roster.some(r => r.id === id));
  const rest = campaign.roster.map(r => r.id).filter(id => !kept.includes(id));
  return [...kept, ...rest].slice(0, deploySlots(campaign.level));
}

export function openBriefing(campaign: CampaignState): CampaignState {
  if (campaign.level >= CAMPAIGN.length) return campaign;
  return { ...campaign, phase: 'briefing', deploy: defaultDeploy(campaign) };
}

export function startBattle(campaign: CampaignState): CampaignState {
  const scenario = CAMPAIGN[campaign.level];
  if (!scenario) throw new Error('No level left to fight');
  const deploy = campaign.deploy.filter(id => campaign.roster.some(r => r.id === id)).slice(0, scenario.playerSlots.length);
  if (!deploy.length) throw new Error('Deploy at least one unit');
  const tier = moraleTier(campaign.morale);
  const statuses: Status[] | undefined = tier.slowed ? [{ id: 'slowed', turns: 1 }] : undefined;
  const units: Unit[] = deploy.map(id => {
    const r = campaign.roster.find(x => x.id === id)!;
    const bonus = playerBonus(campaign, r.kind);
    return makeUnit(`p-${r.id}`, r.kind, CAMPAIGN_PLAYER, { q: 0, r: 0 }, {
      name: r.name, rosterId: r.id, bonus: Object.keys(bonus).length ? bonus : undefined, statuses: statuses?.map(s => ({ ...s })),
    });
  });
  const enemyBonus = campaign.resistance ? { hp: campaign.resistance * RESISTANCE.hpPerPoint } : undefined;
  const enemyStatuses: Status[] | undefined = campaign.perks.includes('patrols') ? [{ id: 'slowed', turns: 1 }] : undefined;
  const seed = hashSeed(campaign.seed, campaign.level, campaign.attempts);
  const battle = createScenarioBattle(scenario, units, enemyBonus, enemyStatuses, seed, captureModifier(campaign));
  if (tier.slowed) battle.log.push({ round: 1, faction: CAMPAIGN_PLAYER, text: `军心${tier.name}：全军首个回合 AP −1。`, type: 'system' });
  return { ...campaign, deploy, phase: 'battle', battle, attempts: campaign.attempts + 1 };
}

/** Converts a finished battle into persistent consequences. */
export function concludeBattle(campaign: CampaignState): CampaignState {
  const battle = campaign.battle;
  if (!battle || !battle.winner || campaign.phase !== 'battle') return campaign;
  const level = campaign.level;
  const scenario = CAMPAIGN[level];
  const victory = battle.winner === battle.player;
  const own = battle.units.filter(u => u.owner === battle.player && u.rosterId);
  const fallen = victory ? own.filter(u => u.hp === 0 && u.kind !== 'warlord') : [];
  const captured = victory ? battle.units.filter(u => u.captured) : [];
  let moraleDelta = victory ? MORALE.victory + fallen.length * MORALE.fallen : MORALE.defeat;
  let roster = campaign.roster.filter(r => !fallen.some(f => f.rosterId === r.id));
  let reward: string | null = null;
  if (victory && scenario.reward && roster.length < ROSTER_CAP) {
    roster = [...roster, { id: `r-reward${level}`, kind: scenario.reward.kind, name: scenario.reward.name, origin: 'native' }];
    reward = `${scenario.reward.name}（${UNITS[scenario.reward.kind].name}）加入军团`;
  }
  const morale = clampMorale(campaign.morale + moraleDelta);
  moraleDelta = morale - campaign.morale;
  const prisoners: Prisoner[] = captured.map((u, i) => {
    const gender = genderOf(u);
    return { id: `pr${level}-${campaign.attempts}-${i}`, kind: u.kind, level, ...(gender ? { gender } : {}) };
  });
  const goldGain = victory ? GOLD.victory + level * GOLD.perLevel + captured.length * GOLD.perCapture : GOLD.defeat;
  const chronicle = [...campaign.chronicle, victory
    ? `${scenario.chapter}「${scenario.name}」告捷，俘获 ${captured.length} 人，阵亡 ${fallen.length} 人。`
    : `${scenario.chapter}「${scenario.name}」失利，军团撤回营地重整。`];
  return {
    ...campaign, roster, morale, chronicle, battle: null, phase: 'result',
    level: victory ? level + 1 : level,
    prisoners: [...campaign.prisoners, ...prisoners],
    deploy: campaign.deploy.filter(id => roster.some(r => r.id === id)),
    result: { level, victory, fallen: fallen.map(nameOf), captured: captured.map(u => u.kind), moraleDelta, reward, gold: goldGain },
    gold: Math.min(GOLD.max, (campaign.gold ?? 0) + goldGain),
    stats: {
      ...campaign.stats, victories: campaign.stats.victories + (victory ? 1 : 0), defeats: campaign.stats.defeats + (victory ? 0 : 1),
      captured: campaign.stats.captured + captured.length,
    },
  };
}

/** Leaves the results screen: prisoners first, then the map (or the ending). */
export function leaveResult(campaign: CampaignState): CampaignState {
  if (pending(campaign).length) return { ...campaign, phase: 'camp' };
  return { ...campaign, phase: campaign.level >= CAMPAIGN.length ? 'complete' : 'map', result: null };
}
export function retreatToMap(campaign: CampaignState): CampaignState {
  return { ...campaign, phase: 'map', battle: null };
}

export function interrogationPerk(campaign: CampaignState, kind: UnitKind): PerkId | null {
  const preferred = INTERROGATION_PREFERENCE[kind];
  if (preferred && !campaign.perks.includes(preferred)) return preferred;
  return PERK_ORDER.find(p => !campaign.perks.includes(p)) ?? null;
}
export function canRecruit(campaign: CampaignState): boolean { return campaign.roster.length < ROSTER_CAP; }

export function resolvePrisoner(campaign: CampaignState, prisonerId: string, choice: PrisonerChoice): CampaignState {
  const prisoner = campaign.prisoners.find(p => p.id === prisonerId);
  if (!prisoner) throw new Error('Unknown prisoner');
  const prisoners = campaign.prisoners.filter(p => p.id !== prisonerId);
  const kindName = UNITS[prisoner.kind].name;
  const next = { ...campaign, prisoners, stats: { ...campaign.stats } };
  if (choice === 'interrogate') {
    const perk = interrogationPerk(campaign, prisoner.kind);
    next.stats.interrogated++;
    if (perk) {
      next.perks = [...campaign.perks, perk];
      next.chronicle = [...campaign.chronicle, `审讯${kindName}，获得军团能力「${PERKS[perk].name}」：${PERKS[perk].description}。`];
    } else {
      next.morale = clampMorale(campaign.morale + MORALE.interrogateFallback);
      next.chronicle = [...campaign.chronicle, `审讯${kindName}，情报已无新意，但军中对战局更有信心（士气 +${MORALE.interrogateFallback}）。`];
    }
  } else if (choice === 'recruit') {
    if (!canRecruit(campaign)) throw new Error('Roster is full');
    const id = `r-rec-${prisoner.id}`;
    next.roster = [...campaign.roster, { id, kind: prisoner.kind, name: `归降·${kindName}`, origin: 'recruit' }];
    next.stats.recruited++;
    next.chronicle = [...campaign.chronicle, `${kindName}立誓效忠灰牙，作为归降者编入军团。`];
  } else if (choice === 'hold') {
    if (prisoner.held) return campaign;
    if (stockade(campaign).length >= STOCKADE_CAP) throw new Error('Stockade is full');
    next.prisoners = campaign.prisoners.map(p => p.id === prisonerId ? { ...p, held: true } : p);
    next.chronicle = [...campaign.chronicle, `${kindName}被押入战俘营，留待日后发落。`];
  } else {
    next.morale = clampMorale(campaign.morale + MORALE.torture);
    next.resistance = campaign.resistance + 1;
    next.stats.tortured++;
    next.chronicle = [...campaign.chronicle, `${kindName}被押入灰烬地牢，消息传遍营地：士气高涨，敌军的抵抗也愈发决绝。`];
  }
  return next;
}

// ───────── camp: roster management ─────────
function freshName(campaign: CampaignState, kind: UnitKind, pool: string[]): string {
  const used = new Set(campaign.roster.map(r => r.name));
  const base = kind === 'exile' ? '雇佣兵' : UNITS[kind].name;
  for (const n of pool) if (!used.has(`${base}·${n}`)) return `${base}·${n}`;
  for (let i = 2; ; i++) if (!used.has(`${base}·${i}号`)) return `${base}·${i}号`;
}
let idCounter = 0;
const newId = (campaign: CampaignState, prefix: string): string => {
  for (;;) {
    const id = `r-${prefix}-${campaign.attempts}-${campaign.roster.length}-${idCounter++ % 1000}`;
    if (!campaign.roster.some(r => r.id === id)) return id;
  }
};
export function canHire(campaign: CampaignState, kind: UnitKind): boolean {
  const hire = HIRES[kind];
  return !!hire && campaign.roster.length < ROSTER_CAP && campaign.gold >= hire.cost;
}
export function hireUnit(campaign: CampaignState, kind: UnitKind): CampaignState {
  const hire = HIRES[kind];
  if (!hire) throw new Error('Unit cannot be hired');
  if (campaign.roster.length >= ROSTER_CAP) throw new Error('Roster is full');
  if (campaign.gold < hire.cost) throw new Error('Not enough gold');
  const name = freshName(campaign, kind, hire.names);
  return {
    ...campaign, gold: campaign.gold - hire.cost,
    roster: [...campaign.roster, { id: newId(campaign, 'hire'), kind, name, origin: 'native' }],
    chronicle: [...campaign.chronicle, kind === 'exile' ? `${name}在契约上按下手印：拿 ${hire.cost} 军饷，为灰牙射箭，想走随时可以走。` : `花费 ${hire.cost} 军饷，${name}应募加入军团。`],
  };
}
export function dismissUnit(campaign: CampaignState, id: string): CampaignState {
  if (!canDismiss(campaign, id)) throw new Error('Unit cannot be dismissed');
  const r = campaign.roster.find(x => x.id === id)!;
  const refund = dismissRefund(r);
  const line = r.kind === 'exile' ? `${r.name}解除雇佣契约，带着 ${refund} 军饷的遣散费离开了营地。` : `${r.name}被遣散离队，退还 ${refund} 军饷。`;
  return {
    ...campaign, gold: Math.min(GOLD.max, campaign.gold + refund),
    roster: campaign.roster.filter(x => x.id !== id), deploy: campaign.deploy.filter(d => d !== id),
    chronicle: [...campaign.chronicle, line],
  };
}
/** Goblin + female elf captive → 哥布林骑士. Consumes both; the knight takes the goblin's roster slot (and deploy slot). */
export function forgeKnight(campaign: CampaignState, goblinId: string, prisonerId: string): CampaignState {
  const goblin = campaign.roster.find(r => r.id === goblinId && r.kind === 'goblin');
  const prisoner = campaign.prisoners.find(p => p.id === prisonerId);
  if (!goblin) throw new Error('Pick a goblin');
  if (!prisoner || !canMount(prisoner)) throw new Error('Needs a female elf captive');
  const rider = goblin.name.split('·')[1] ?? goblin.name;
  const knight: RosterUnit = { id: newId(campaign, 'knight'), kind: 'goblinKnight', name: `哥布林骑士·${rider}`.slice(0, 30), origin: 'native' };
  return {
    ...campaign,
    roster: campaign.roster.map(r => r.id === goblinId ? knight : r),
    deploy: campaign.deploy.map(d => d === goblinId ? knight.id : d),
    prisoners: campaign.prisoners.filter(p => p.id !== prisonerId),
    chronicle: [...campaign.chronicle, `${goblin.name}骑上了被俘的${UNITS[prisoner.kind].name}，组成${knight.name}。`],
  };
}
