import type { Faction, Gender, Hex, Terrain, UnitKind } from './types';

/** [kind, q, r, optional gender override] */
export type Placement = [UnitKind, number, number, Gender?];

export type ObjectiveType = 'eliminate' | 'timed' | 'escort' | 'defend' | 'boss';
export interface Scenario {
  id: string;
  /** Short chapter label shown above the title. */
  chapter: string;
  name: string;
  english: string;
  tagline: string;
  briefing: string[];
  objective: {
    type: ObjectiveType;
    twist: string;
    summary: string;
    goal?: Hex[];
    altar?: Hex;
  };
  radius: number;
  terrain: Record<string, Terrain>;
  maxRounds: number;
  /** Who wins when the round limit passes. */
  onTimeout: 'draw' | 'enemy' | 'player';
  /** Skirmish only: fixed armies for both sides. */
  fixed?: [UnitKind, number, number][];
  /** Campaign: player deployment hexes, in roster order. */
  playerSlots: Hex[];
  enemies: Placement[];
  boss?: [UnitKind, number, number];
  escort?: Hex;
  reinforcements?: { round: number; text: string; units: Placement[] }[];
  captureBase: number;
  reward?: { kind: UnitKind; name: string };
  victoryText: string;
  defeatText: string;
}

export const CAMPAIGN_PLAYER: Faction = 'orc';
export const CAMPAIGN_ENEMY: Faction = 'elf';

const SKIRMISH: Scenario = {
  id: 'skirmish', chapter: '遭遇战', name: '黑棘隘口', english: 'Blackthorn Pass', tagline: '旧王已死。新的秩序，始于灰烬。',
  briefing: [], objective: { type: 'eliminate', twist: '遭遇战', summary: '消灭所有敌军' },
  radius: 4,
  terrain: {
    '0,0': 'ruins', '0,-1': 'ruins', '0,1': 'ruins',
    '-1,-1': 'forest', '1,1': 'forest', '-2,0': 'forest', '2,0': 'forest',
    '-1,2': 'forest', '1,-2': 'forest', '-2,3': 'forest', '2,-3': 'forest',
    '0,-3': 'ridge', '0,3': 'ridge', '-2,1': 'ridge', '2,-1': 'ridge',
    '-1,-2': 'water', '1,2': 'water',
  },
  maxRounds: 40, onTimeout: 'draw',
  fixed: [
    ['warlord', -3, 1], ['brute', -3, 0], ['raider', -2, -1], ['raider', -4, 3], ['shaman', -4, 2],
    ['warden', 3, -1], ['ranger', 3, 0], ['ranger', 4, -3], ['blade', 2, 1], ['oracle', 4, -2],
  ],
  playerSlots: [], enemies: [], captureBase: 0,
  victoryText: '黑棘隘口，尘埃落定。', defeatText: '黑棘隘口，尘埃落定。',
};

export const CAMPAIGN: Scenario[] = [
  {
    id: 'ford', chapter: '第一关', name: '焦土渡口', english: 'The Scorched Ford', tagline: '河水早已发黑，三处浅滩是唯一的路。',
    briefing: [
      '暮誓王庭的斥候封锁了焦土渡口，三处浅滩之外全是不可涉渡的深潭。',
      '上游的灰烬正在堆积。十轮之后河水暴涨，渡口将被彻底吞没。',
      '在水涨之前击溃守军。力竭的精灵可以生擒——后方的营地需要情报。',
    ],
    objective: { type: 'timed', twist: '限时', summary: '10 轮内全歼守军，否则河水暴涨，任务失败' },
    radius: 4,
    terrain: {
      '0,-4': 'water', '0,-3': 'water', '0,-1': 'water', '0,1': 'water', '0,3': 'water', '0,4': 'water',
      '0,0': 'ruins', '1,-2': 'forest', '1,1': 'forest', '-1,-1': 'forest', '-2,2': 'forest', '2,-3': 'forest',
      '3,-1': 'ridge', '-3,0': 'ridge',
    },
    maxRounds: 10, onTimeout: 'enemy',
    playerSlots: [{ q: -3, r: 1 }, { q: -3, r: 0 }, { q: -2, r: -1 }, { q: -4, r: 3 }, { q: -4, r: 2 }, { q: -4, r: 4 }],
    enemies: [['warden', 2, 0], ['ranger', 3, -1], ['blade', 2, 1, 'female'], ['ranger', 2, -2, 'male']],
    captureBase: 0.4,
    reward: { kind: 'goblin', name: '哥布林·吉兹' },
    victoryText: '渡口失守，暮誓的旗帜沉入黑水。', defeatText: '河水暴涨，灰牙氏族被迫撤离渡口。',
  },
  {
    id: 'convoy', chapter: '第二关', name: '余烬车队', english: 'The Ember Convoy', tagline: '图腾车载着氏族的火种，必须穿过林道。',
    briefing: [
      '灰烬图腾车承载着氏族世代的余火，它要穿过暮誓王庭的林道，抵达东侧的营地。',
      '图腾车行动缓慢，但能为身边的战士疗伤。若它倒下，余火熄灭，任务失败。',
      '斥候回报：第三轮会有一队刃舞者从北侧林间杀出。',
    ],
    objective: { type: 'escort', twist: '护送', summary: '护送灰烬图腾车抵达东侧金色营地（或全歼敌军），图腾车不得倒下', goal: [{ q: 4, r: -4 }, { q: 4, r: -3 }, { q: 4, r: -2 }, { q: 4, r: -1 }, { q: 4, r: 0 }] },
    radius: 4,
    terrain: {
      '-1,-1': 'forest', '1,-2': 'forest', '2,1': 'forest', '-1,2': 'forest', '3,0': 'forest',
      '3,-3': 'ridge', '0,3': 'ridge', '0,0': 'ruins', '1,-1': 'ruins', '2,-2': 'ruins',
      '-2,-2': 'water', '0,-3': 'water', '1,2': 'water', '-1,3': 'water',
    },
    maxRounds: 14, onTimeout: 'enemy',
    escort: { q: -4, r: 2 },
    playerSlots: [{ q: -3, r: 1 }, { q: -3, r: 2 }, { q: -2, r: 0 }, { q: -4, r: 3 }, { q: -4, r: 1 }, { q: -2, r: 1 }],
    enemies: [['warden', 2, -1, 'female'], ['blade', 1, 0], ['ranger', 3, -2], ['ranger', 2, 0, 'male'], ['oracle', 4, -3]],
    reinforcements: [{ round: 3, text: '北侧林间传来刀鸣——刃舞者伏兵杀到！', units: [['blade', 0, -4, 'female'], ['blade', 1, -4]] }],
    captureBase: 0.35,
    reward: { kind: 'brute', name: '黑兽人·戈恩' },
    victoryText: '余火抵达营地，氏族的图腾重新燃起。', defeatText: '余火熄灭，车队溃散在林道之中。',
  },
  {
    id: 'moonwell', chapter: '第三关', name: '月井死守', english: 'Siege of the Moonwell', tagline: '夺下的月井，要用整整八轮去守住。',
    briefing: [
      '灰牙氏族夺下了暮誓王庭的圣地「月井」。王庭的援军正从三个方向涌来。',
      '坚守八轮，等待主力抵达。敌军会在第三轮从北面、第五轮从西南方向增援。',
      '若敌军连续两个敌方回合结束时都站在月井（中心祭坛）上，月井即告失守。',
    ],
    objective: { type: 'defend', twist: '坚守', summary: '坚守 8 轮：不得让敌军连续两个回合占据中央月井', altar: { q: 0, r: 0 } },
    radius: 5,
    terrain: {
      '0,0': 'ruins', '2,-2': 'forest', '-2,2': 'forest', '3,0': 'forest', '-3,1': 'forest', '1,-4': 'forest', '0,4': 'forest', '-4,4': 'forest',
      '2,0': 'ridge', '-2,0': 'ridge', '0,-2': 'ridge', '0,2': 'ridge',
      '3,-4': 'water', '-3,4': 'water', '4,1': 'water', '-4,-1': 'water',
    },
    maxRounds: 8, onTimeout: 'player',
    playerSlots: [{ q: -1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: 1 }, { q: 0, r: -1 }, { q: -1, r: 1 }, { q: 1, r: 0 }],
    enemies: [['warden', 4, -3], ['ranger', 5, -3], ['blade', 4, -1, 'female'], ['oracle', 5, -2, 'male']],
    reinforcements: [
      { round: 3, text: '北面的林线中，暮誓援军出现了。', units: [['blade', 0, -5], ['ranger', 1, -5], ['warden', 2, -5, 'male']] },
      { round: 5, text: '西南方的号角响起——第二支援军压向月井！', units: [['warden', -2, 5, 'female'], ['blade', -3, 5], ['ranger', -4, 5, 'male'], ['warden', -1, 4]] },
    ],
    captureBase: 0.3,
    reward: { kind: 'raider', name: '兽人小子·克鲁格' },
    victoryText: '八轮已过，灰牙主力抵达，月井归于灰牙。', defeatText: '暮誓的誓言重新照亮月井，阵地失守。',
  },
  {
    id: 'throne', chapter: '第四关', name: '灰烬王座', english: 'The Ashen Throne', tagline: '王冠就在摄政手中。',
    briefing: [
      '暮誓摄政坐镇灰烬王座，身旁是王庭最后的精锐。',
      '摄政每个回合都会以长夜之力恢复生命，远程的「长夜审判」足以重创任何战士。',
      '击倒摄政，王冠即归灰牙——其余守军将不战而溃。摄政不会被生擒。',
    ],
    objective: { type: 'boss', twist: '首领战', summary: '在 18 轮内击倒暮誓摄政（每回合恢复 4 生命）' },
    radius: 5,
    terrain: {
      '4,-2': 'ruins', '3,-3': 'ridge', '3,0': 'ridge', '0,0': 'forest', '-1,1': 'forest', '1,-2': 'forest', '0,2': 'forest', '-2,-1': 'forest',
      '1,1': 'water', '2,1': 'water', '-1,-3': 'water', '2,-4': 'ruins', '-2,3': 'ridge',
    },
    maxRounds: 18, onTimeout: 'enemy',
    playerSlots: [{ q: -4, r: 1 }, { q: -4, r: 2 }, { q: -3, r: 0 }, { q: -3, r: 1 }, { q: -3, r: 2 }, { q: -5, r: 3 }],
    enemies: [['warden', 3, -1], ['ranger', 3, -3], ['oracle', 5, -2], ['blade', 2, 0, 'female'], ['ranger', 4, -4, 'male']],
    boss: ['regent', 4, -2],
    captureBase: 0.3,
    victoryText: '摄政倒下，灰烬王冠落入灰牙之手。', defeatText: '长夜吞没了王座前的战场，灰牙的攻势被击退。',
  },
];

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries([SKIRMISH, ...CAMPAIGN].map(s => [s.id, s]));
export const scenarioOf = (id: string): Scenario => SCENARIOS[id] ?? SKIRMISH;
