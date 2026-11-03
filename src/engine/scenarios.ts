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
  /** Campaign: display name for the boss unit (defaults to the unit type name). */
  bossName?: string;
  /** Campaign: pre-battle scene shown in the camp, and the scene after a victory. */
  story?: StoryLine[];
  epilogue?: StoryLine[];
  /** Campaign: act label shown on the map (第一幕 / 第二幕). */
  act?: string;
}
export interface StoryLine { speaker: string; line: string }
const say = (speaker: string, line: string): StoryLine => ({ speaker, line });
const N = '旁白';

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
    act: '第一幕 · 夺冠',
    story: [
      say(N, '旧王死后的第七个冬天，灰牙氏族在黑水河西岸点起了战火。河对岸，是暮誓王庭封锁了四百年的土地。'),
      say('督军·格罗什', '王庭说灰烬王冠只配戴在誓言之下。那我们就去看看，他们的誓言挡不挡得住斧头。'),
      say('萨满·乌尔娜', '上游的灰在积。河神只给我们十轮的时间，督军。'),
      say('哥布林·斯尼克', '活的精灵比死的值钱！我的绊索已经饿了好几天了。'),
      say('督军·格罗什', '那就带活的回来。营地需要知道王庭在想什么。'),
    ],
    epilogue: [
      say('黑兽人·鲁克', '浅滩是我们的了。他们的游侠跑得比兔子还快。'),
      say('督军·格罗什', '让他们跑。跑回去告诉摄政：灰牙渡河了。'),
      say(N, '当夜，一个自称吉兹的哥布林带着一袋偷来的精灵箭头找上营地，说想跟着赢家混饭吃。'),
    ],
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
    story: [
      say(N, '渡河之后，氏族的灰烬图腾车必须穿过王庭的林道，把世代相传的余火送到东侧新营地。'),
      say('萨满·乌尔娜', '余火一灭，氏族就再没有家可言。车子慢，但它会护着站在它身边的人。'),
      say('兽人小子·瑟卡', '林子里有动静。不是鸟。'),
      say('督军·格罗什', '刃舞者。他们总喜欢从背后来。围住车，别让任何人掉队。'),
    ],
    epilogue: [
      say('萨满·乌尔娜', '火还在。祖先看着我们。'),
      say('黑兽人·戈恩', '我在东营等了你们三天。听说有仗打，就不走了。'),
      say('督军·格罗什', '王庭在退。下一步，是他们的圣地——月井。'),
    ],
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
    story: [
      say(N, '月井是暮誓王庭立誓的地方，传说每一道誓言都沉在井底。灰牙只用一个黎明就夺下了它。'),
      say('督军·格罗什', '夺下来容易。王庭的三路援军已经在路上，主力还要八轮才到。'),
      say('哥布林·斯尼克', '我可以在井边多埋几根绊索……就当是迎客。'),
      say('黑兽人·鲁克', '谁敢踏上那口井，我就把他扔进去。'),
    ],
    epilogue: [
      say(N, '第八轮的号角响起时，灰牙主力的火把铺满了山谷。月井的水第一次映出兽人的脸。'),
      say('兽人小子·克鲁格', '我从北边一路追着援军过来的，听说这儿能砍到最多的精灵。'),
      say('督军·格罗什', '王座就在前面。摄政在等我们。'),
    ],
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
    story: [
      say(N, '灰烬王座矗立在旧王城的废墟中央。暮誓摄政握着王冠，身边是王庭最后的精锐。'),
      say('暮誓摄政', '野兽也想戴上王冠？长夜会替王庭审判你们每一个人。'),
      say('督军·格罗什', '你守了四百年的东西，今天换个主人。'),
      say('萨满·乌尔娜', '她每一回合都在汲取长夜之力。别给她喘息的机会。'),
    ],
    epilogue: [
      say(N, '摄政倒下的那一刻，王冠从她手中滚落，停在格罗什脚边。'),
      say('督军·格罗什', '……它是冷的。'),
      say('萨满·乌尔娜', '火被封住了。王冠里还锁着一道誓言，有人在远方守着它。'),
      say(N, '灰牙氏族赢得了王座，却没有赢得王冠。征途还没有结束。'),
    ],
    victoryText: '摄政倒下，灰烬王冠落入灰牙之手。', defeatText: '长夜吞没了王座前的战场，灰牙的攻势被击退。',
    reward: { kind: 'goblin', name: '哥布林·瑞克' },
  },
  {
    id: 'silverleaf', chapter: '第五关', name: '银叶伏击', english: 'The Silverleaf Ambush', tagline: '凯旋的队伍走进了银叶林。',
    act: '第二幕 · 冷冠',
    briefing: [
      '灰牙护送冰冷的王冠返回营地，途经银叶林时，林间同时响起了弓弦声。',
      '暮誓残部从东西两侧包夹，第四轮还有一支援军从林缘杀出。',
      '在 16 轮内击溃所有伏兵。被围的阵型要靠前排顶住，再逐个击破。',
    ],
    objective: { type: 'eliminate', twist: '包围', summary: '16 轮内击溃四面伏兵（含第 4 轮援军）' },
    radius: 5,
    terrain: {
      '0,0': 'ruins', '-1,0': 'ruins', '1,0': 'ruins',
      '3,-3': 'forest', '-3,3': 'forest', '3,0': 'forest', '-3,0': 'forest', '0,-3': 'forest', '0,3': 'forest', '4,-1': 'forest', '-4,1': 'forest',
      '2,-3': 'ridge', '-2,3': 'ridge', '4,-4': 'ridge', '-4,4': 'ridge',
      '2,1': 'water', '-2,-1': 'water', '1,-4': 'water', '-1,4': 'water',
    },
    maxRounds: 16, onTimeout: 'enemy',
    playerSlots: [{ q: 0, r: 0 }, { q: -1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: 1, r: 0 }, { q: 0, r: -1 }],
    enemies: [['ranger', 4, -2, 'female'], ['ranger', -4, 2], ['blade', 3, -1], ['blade', -3, 1, 'female'], ['warden', 0, -4], ['oracle', 0, 4], ['warden', 2, 2, 'female'], ['blade', -2, -2]],
    reinforcements: [{ round: 4, text: '林缘的银叶齐齐翻起——又一队暮誓战士杀到！', units: [['warden', 5, -1, 'male'], ['blade', -5, 4, 'female'], ['ranger', 5, -5], ['oracle', -5, 1, 'female']] }],
    captureBase: 0.3,
    reward: { kind: 'exile', name: '雇佣兵·菲尔温' },
    story: [
      say(N, '王冠被装进图腾车，裹在三层兽皮里。可无论萨满们怎样祷告，它始终冷得像一块冰。'),
      say('萨满·乌尔娜', '王冠的火被一道誓言封住。立誓的人不是摄政，是她的妹妹——星誓祭司艾瑟琳。'),
      say('督军·格罗什', '那她一定会来抢。'),
      say('哥布林·斯尼克', '督军……树叶是银色的，可风明明没在吹。'),
      say('星誓祭司·艾瑟琳', '（林间传来的声音）你们拿走的不是王冠，是一具棺木。放下它，我许你们活着离开。'),
      say('督军·格罗什', '列阵！背靠背，谁也别乱跑！'),
    ],
    epilogue: [
      say('黑兽人·鲁克', '这帮精灵不像之前那么怕死了。'),
      say('萨满·乌尔娜', '因为他们是为誓言来的。艾瑟琳没有现身，她在拖延时间。'),
      say(N, '战斗结束时，一个背着短弓的精灵从树上跳下来，双手举过头顶。她的衣服上缝着被撕掉的王庭纹章。'),
      say('菲尔温', '别紧张。我不是王庭的人——十年前就被她们放逐了，因为我不肯立誓。'),
      say('菲尔温', '刚才东边那两个游侠是我射倒的。我想跟你们谈一笔生意：你们付军饷，我替你们射箭。不想干了，我就走。'),
      say('督军·格罗什', '一个不肯立誓的精灵，倒是比誓卫更像灰牙。契约拿来。'),
      say('哥布林·斯尼克', '……她的箭比我的飞锤还准。我不服。'),
      say('菲尔温', '那就下一仗比比看，小个子。'),
      say(N, '从此，营地里会出现其他流亡精灵，愿意按同样的契约为灰牙作战（营地「招募」中可雇佣精灵雇佣兵）。'),
    ],
    victoryText: '伏兵溃散，银叶林重归寂静。', defeatText: '包围圈越收越紧，灰牙被迫丢下辎重突围。',
  },
  {
    id: 'startear', chapter: '第六关', name: '星泪桥', english: 'The Bridge of Star-Tears', tagline: '过了这座桥，就是灰牙的故土。',
    briefing: [
      '星泪河把王庭与灰牙故土隔开。河上只剩一座古桥（两格王墟）和南面一处浅滩。',
      '图腾车载着王冠，必须抵达东岸的金色营地。图腾车倒下，王冠就会落回王庭手中。',
      '斥候回报：第 3 轮南岸芦苇中有刃舞者埋伏，第 6 轮东岸还有援军。',
    ],
    objective: { type: 'escort', twist: '护送', summary: '护送载着王冠的图腾车过桥抵达东岸金色营地（或全歼敌军）', goal: [{ q: 5, r: -5 }, { q: 5, r: -4 }, { q: 5, r: -3 }, { q: 5, r: -2 }, { q: 5, r: -1 }, { q: 5, r: 0 }] },
    radius: 5,
    terrain: {
      '0,-5': 'water', '0,-4': 'water', '0,-3': 'water', '0,-2': 'water', '0,1': 'water', '0,2': 'water', '0,3': 'water', '0,5': 'water',
      '0,-1': 'ruins', '0,0': 'ruins',
      '-2,1': 'forest', '-3,4': 'forest', '2,-3': 'forest', '3,-1': 'forest', '2,1': 'forest', '4,-4': 'forest',
      '-2,-1': 'ridge', '3,1': 'ridge', '1,-4': 'ridge',
    },
    maxRounds: 16, onTimeout: 'enemy',
    escort: { q: -5, r: 3 },
    playerSlots: [{ q: -4, r: 2 }, { q: -4, r: 3 }, { q: -3, r: 1 }, { q: -3, r: 2 }, { q: -5, r: 4 }, { q: -4, r: 4 }, { q: -3, r: 3 }],
    enemies: [['warden', 1, -1, 'male'], ['blade', 1, 0, 'female'], ['ranger', 3, -2], ['ranger', 2, 0, 'male'], ['oracle', 4, -3], ['warden', 3, 0]],
    reinforcements: [
      { round: 3, text: '南岸的芦苇里刀光一闪——刃舞者伏兵！', units: [['blade', -2, 5, 'female'], ['blade', -1, 5]] },
      { round: 6, text: '东岸的号角响起，暮誓援军赶来封桥！', units: [['ranger', 3, -5, 'female'], ['warden', 2, -5, 'male']] },
    ],
    captureBase: 0.3,
    reward: { kind: 'brute', name: '黑兽人·萨隆' },
    story: [
      say(N, '星泪桥是旧王时代修的，桥栏上刻满了两族共饮一河的盟约。如今桥的那头站满了精灵。'),
      say('萨满·莫格', '把王冠带回故土的灰烬里，誓言就会松动。这是先知的梦。'),
      say('兽人小子·巴兹', '桥就两格宽？那我们排队冲？'),
      say('督军·格罗什', '车走桥，快的人走浅滩。谁拦路，就把谁推下河。'),
      say('哥布林·斯尼克', '我负责把掉下河的精灵捞上来……活的。'),
    ],
    epilogue: [
      say(N, '图腾车碾过最后一块桥石。东岸的灰土刚碰到车轮，王冠里就亮起了一点火星。'),
      say(N, '桥头的石塔里关着十几个灰牙战士——几年前被王庭巡逻队抓走的兽人和哥布林。斯尼克撬开了锁。'),
      say('黑兽人·萨隆', '……我在这座塔里数了四年的日出。我以为氏族早就忘了我们。'),
      say('督军·格罗什', '灰牙从不忘记自己人。'),
      say('哥布林·老皮普', '谢谢你们，谢谢……我这把老骨头打不动仗了，但我会回故土告诉每一个人：督军来接我们回家了。'),
      say('黑兽人·萨隆', '我还拿得动斧头。这条命是你们救回来的——从今天起，它跟着督军的战旗走。'),
      say(N, '几名被救出的战士选择随军出征，其余的人带着王冠重燃的消息返回故土。'),
      say('萨满·乌尔娜', '火回来了一点。可封印还在——源头在长夜圣所。'),
      say('菲尔温', '（在营火边擦弓）斯尼克，你刚才在桥上替我挡了一箭。为什么？'),
      say('哥布林·斯尼克', '……契约里写着，雇佣兵死了要赔军饷。我是替督军省钱。'),
      say('菲尔温', '（笑）撒谎的时候，你的耳朵会抖。'),
      say('督军·格罗什', '去圣所。这一次，把誓言连根拔掉。'),
    ],
    victoryText: '王冠渡过星泪河，回到了灰牙故土。', defeatText: '图腾车被逼退到西岸，桥头再次落入王庭之手。',
  },
  {
    id: 'sanctum', chapter: '第七关', name: '长夜圣所', english: 'The Sanctum of Long Night', tagline: '最后一道誓言，由最后一位祭司守着。',
    briefing: [
      '长夜圣所藏在王庭最深的峡谷里。星誓祭司艾瑟琳以自身为锁，封住了王冠的火。',
      '艾瑟琳与她姐姐一样，每回合以长夜之力恢复生命；身边是暮誓最忠诚的誓卫，第 4 轮还会有增援。',
      '在 20 轮内击倒艾瑟琳，王冠的火就会重新燃起。首领不会被生擒。',
    ],
    objective: { type: 'boss', twist: '终局', summary: '在 20 轮内击倒星誓祭司艾瑟琳（每回合恢复 4 生命）' },
    radius: 5,
    terrain: {
      '4,-1': 'ruins', '3,-2': 'ridge', '2,1': 'ridge', '-1,-2': 'ridge',
      '0,0': 'forest', '1,-1': 'forest', '-1,2': 'forest', '2,-4': 'forest', '1,3': 'forest', '-2,0': 'forest',
      '0,-3': 'water', '1,-3': 'water', '0,3': 'water', '-1,3': 'water', '3,2': 'water',
    },
    maxRounds: 20, onTimeout: 'enemy',
    playerSlots: [{ q: -4, r: 1 }, { q: -4, r: 2 }, { q: -3, r: 0 }, { q: -3, r: 1 }, { q: -3, r: 2 }, { q: -5, r: 3 }, { q: -5, r: 2 }],
    enemies: [['warden', 3, -1, 'female'], ['warden', 3, 0], ['oracle', 5, -2], ['ranger', 4, -4, 'female'], ['ranger', 2, 2, 'male'], ['blade', 2, -2], ['warden', 5, -3, 'male'], ['ranger', 5, -4]],
    boss: ['regent', 4, -1],
    bossName: '星誓祭司·艾瑟琳',
    reinforcements: [{ round: 4, text: '圣所的石门开启，最后的誓卫走了出来。', units: [['blade', 0, -5, 'female'], ['blade', 1, 4], ['oracle', 5, 0], ['warden', 4, 1, 'female']] }],
    captureBase: 0.25,
    story: [
      say(N, '圣所里没有火把，只有悬在穹顶的星光。艾瑟琳站在祭坛前，手里没有武器。'),
      say('星誓祭司·艾瑟琳', '我的姐姐守着王座，我守着王冠的火。四百年来，没有人能两样都拿走。'),
      say('督军·格罗什', '四百年来，也没有人像我们这样走到这里。'),
      say('星誓祭司·艾瑟琳', '那就让长夜来见证。誓卫们——这是最后一战。'),
      say('萨满·乌尔娜', '她就是那把锁。打碎她，火就会回来。'),
    ],
    epilogue: [
      say(N, '艾瑟琳倒在祭坛前，穹顶的星光一颗颗熄灭。格罗什怀里的王冠忽然变得滚烫。'),
      say('星誓祭司·艾瑟琳', '……记住，戴上它的人，也要立下自己的誓言。'),
      say('督军·格罗什', '那我的誓言是：灰牙不会再被任何人锁住。'),
      say(N, '那天夜里，营地烧起了最大的篝火。菲尔温的契约到期了，督军把一袋军饷放在她面前。'),
      say('督军·格罗什', '契约结束了。你可以走，没人拦你。'),
      say('菲尔温', '我知道。（她把钱袋推回去，看向篝火另一边的斯尼克）我不是为了军饷留下的。'),
      say('哥布林·斯尼克', '你……你想清楚了？我可是个哥布林。'),
      say('菲尔温', '我想了一整条路。我是自由的，所以这是我自己选的。'),
      say(N, '斯尼克的耳朵抖得厉害。篝火边的兽人们哄笑起来，鲁克把酒囊塞到了他手里。'),
      say(N, '灰烬王冠重新燃起火焰。暮誓王庭的长夜，到此为止。'),
    ],
    victoryText: '艾瑟琳倒下，王冠的火焰重新燃起。', defeatText: '星光吞没了圣所，灰牙的最后一击功亏一篑。',
  },
];

export const SCENARIOS: Record<string, Scenario> = Object.fromEntries([SKIRMISH, ...CAMPAIGN].map(s => [s.id, s]));
export const scenarioOf = (id: string): Scenario => SCENARIOS[id] ?? SKIRMISH;
