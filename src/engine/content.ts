import type { Faction, StatusId, Terrain, UnitDefinition, UnitKind } from './types';

export const FACTIONS: Record<Faction, { name: string; title: string; motto: string }> = {
  orc: { name: '灰牙氏族', title: 'THE ASHFANG', motto: '王冠归于敢于伸手的人。' },
  elf: { name: '暮誓王庭', title: 'THE DUSKSWORN', motto: '长夜将至，誓言不灭。' },
  vampire: { name: '绛夜宫廷', title: 'THE CRIMSON COURT', motto: '渴意不熄，长夜不终。' },
};

export const TERRAIN: Record<Terrain, { name: string; cost: number; defense: number; description: string }> = {
  plain: { name: '灰烬荒原', cost: 1, defense: 0, description: '移动 1 AP · 无防御加成' },
  forest: { name: '枯语密林', cost: 2, defense: 2, description: '移动 2 AP · 防御 +2' },
  ridge: { name: '黑岩高地', cost: 2, defense: 1, description: '移动 2 AP · 防御 +1 · 远程伤害 +2' },
  ruins: { name: '失落王墟', cost: 1, defense: 1, description: '移动 1 AP · 防御 +1' },
  water: { name: '幽影深潭', cost: Infinity, defense: 0, description: '不可通行 · 阻挡移动，不阻挡射线' },
};

export const UNITS: Record<UnitKind, UnitDefinition> = {
  warlord: {
    name: '灰牙督军', role: '统帅 / 重装近战', faction: 'orc', hp: 34, attack: 10, armor: 3, range: 1, ap: 3, attackCost: 2,
    skill: { name: '碎冠重击', description: '对相邻敌人造成 15 点基础伤害，无视护甲与地形防御。', effect: 'damage', range: 1, power: 15, cost: 2, cooldown: 2 },
  },
  brute: {
    name: '黑兽人', role: '精锐 / 重甲碎阵', faction: 'orc', hp: 48, attack: 13, armor: 5, range: 1, ap: 3, attackCost: 2,
    skill: { name: '破阵斧', description: '对相邻敌人造成 18 点基础伤害，无视防御。', effect: 'damage', range: 1, power: 18, cost: 2, cooldown: 2 },
  },
  raider: {
    name: '兽人小子', role: '冲锋 / 高机动', faction: 'orc', hp: 32, attack: 11, armor: 2, range: 1, ap: 4, attackCost: 2,
    skill: { name: '淬火飞斧', description: '向 2 格内的敌人掷出飞斧，造成 12 点基础伤害，无视防御。', effect: 'damage', range: 2, power: 12, cost: 2, cooldown: 2 },
  },
  goblin: {
    name: '哥布林', role: '捕手 / 偷袭', faction: 'orc', hp: 22, attack: 8, armor: 1, range: 1, ap: 5, attackCost: 2,
    skill: { name: '绊索飞锤', description: '向 2 格内的敌人甩出飞锤，造成 8 点基础伤害，无视防御。', effect: 'damage', range: 2, power: 8, cost: 2, cooldown: 2 },
    trait: '擒拿：攻击或技能命中女性精灵或女性吸血鬼时一击制服并必定俘获（首领与建筑除外，不受敌军抵抗影响）。',
  },
  goblinKnight: {
    name: '哥布林骑士', role: '骑兵 / 突击捕手', faction: 'orc', hp: 34, attack: 11, armor: 2, range: 1, ap: 6, attackCost: 2,
    skill: { name: '飞驰践踏', description: '驱策坐骑冲撞 2 格内的敌人，造成 13 点基础伤害，无视防御。', effect: 'damage', range: 2, power: 13, cost: 2, cooldown: 2 },
    trait: '精灵坐骑：穿越密林只需 1 AP。冲锋：移动后的下一次普通攻击伤害 +3。骑手保留擒拿（命中女性精灵或女性吸血鬼必定俘获，首领与建筑除外）。',
  },
  // Exiled elves who were never captured: they sign a paid contract with the Ashfang of their own free will.
  // Listed under the orc faction because they fight for 灰牙 by contract (no recruit badge, no capture rules).
  exile: {
    name: '精灵雇佣兵', role: '雇佣军 / 远程游击', faction: 'orc', gender: 'female', hp: 24, attack: 9, armor: 1, range: 3, ap: 4, attackCost: 2,
    skill: { name: '流亡者之箭', description: '射击 4 格内的敌人，造成 11 点基础伤害，无视防御。仍受高地阻挡视线。', effect: 'damage', range: 4, power: 11, cost: 2, cooldown: 2 },
    trait: '雇佣契约：被王庭放逐的自由精灵，自愿领军饷为灰牙作战，并非俘虏；可随时解约离队。',
  },
  shaman: {
    name: '余烬萨满', role: '支援 / 战地治疗', faction: 'orc', hp: 23, attack: 7, armor: 1, range: 2, ap: 3, attackCost: 2,
    skill: { name: '余烬复苏', description: '为 2 格内的友军或自身恢复 12 点生命，不超过上限。', effect: 'heal', range: 2, power: 12, cost: 2, cooldown: 2 },
  },
  warden: {
    name: '暮誓守望者', role: '统帅 / 誓约守卫', faction: 'elf', gender: 'male', hp: 32, attack: 9, armor: 3, range: 1, ap: 3, attackCost: 2,
    skill: { name: '裁决之刃', description: '对相邻敌人造成 14 点基础伤害，无视防御。', effect: 'damage', range: 1, power: 14, cost: 2, cooldown: 2 },
  },
  ranger: {
    name: '夜荫游侠', role: '后排 / 远程压制', faction: 'elf', gender: 'female', hp: 22, attack: 8, armor: 1, range: 3, ap: 3, attackCost: 2,
    skill: { name: '穿星箭', description: '射击 4 格内的敌人，造成 11 点基础伤害，无视防御。仍受高地阻挡视线。', effect: 'damage', range: 4, power: 11, cost: 2, cooldown: 2 },
  },
  blade: {
    name: '薄暮刃舞者', role: '游击 / 高机动', faction: 'elf', gender: 'male', hp: 26, attack: 9, armor: 2, range: 1, ap: 4, attackCost: 2,
    skill: { name: '月蚀突刺', description: '对相邻敌人造成 13 点基础伤害，无视防御。', effect: 'damage', range: 1, power: 13, cost: 2, cooldown: 2 },
  },
  oracle: {
    name: '黯月先知', role: '支援 / 战地治疗', faction: 'elf', gender: 'female', hp: 22, attack: 6, armor: 1, range: 2, ap: 3, attackCost: 2,
    skill: { name: '月泉祷言', description: '为 3 格内的友军或自身恢复 12 点生命，不超过上限。', effect: 'heal', range: 3, power: 12, cost: 2, cooldown: 2 },
  },
  regent: {
    name: '暮誓摄政', role: '首领 / 长夜审判者', faction: 'elf', gender: 'female', hp: 56, attack: 11, armor: 3, range: 2, ap: 3, attackCost: 2,
    skill: { name: '长夜审判', description: '对 3 格内的敌人降下 15 点基础伤害，无视防御。每个己方回合开始时恢复 4 点生命。', effect: 'damage', range: 3, power: 15, cost: 2, cooldown: 2 },
  },
  thrall: {
    name: '血仆', role: '前排 / 渴血近战', faction: 'vampire', gender: 'male', hp: 26, attack: 9, armor: 1, range: 1, ap: 3, attackCost: 2,
    lifesteal: 0.5,
    skill: { name: '噬血撕咬', description: '撕咬相邻敌人，造成 10 点基础伤害，无视防御；自身按造成伤害的一半恢复生命。', effect: 'damage', range: 1, power: 10, cost: 2, cooldown: 2, drain: 0.5 },
    trait: '渴血：普通攻击按造成伤害的 50% 为自身恢复生命。',
  },
  bloodKnight: {
    name: '血骑士', role: '精锐 / 重装近战', faction: 'vampire', gender: 'male', hp: 40, attack: 12, armor: 4, range: 1, ap: 3, attackCost: 2,
    lifesteal: 0.3,
    skill: { name: '血刃斩', description: '以血刃劈向相邻敌人，造成 16 点基础伤害，无视防御；自身按造成伤害的 30% 恢复生命。', effect: 'damage', range: 1, power: 16, cost: 2, cooldown: 2, drain: 0.3 },
    trait: '血刃：普通攻击按造成伤害的 30% 为自身恢复生命。',
  },
  nightStalker: {
    name: '夜翼猎手', role: '游击 / 夜翼突袭', faction: 'vampire', gender: 'female', hp: 24, attack: 9, armor: 1, range: 1, ap: 5, attackCost: 2,
    lifesteal: 0.25,
    skill: { name: '蝠群扑袭', description: '驱使蝠群扑向 2 格内的敌人，造成 11 点基础伤害，无视防御。', effect: 'damage', range: 2, power: 11, cost: 2, cooldown: 2 },
    trait: '夜翼：穿越密林只需 1 AP。普通攻击按造成伤害的 25% 为自身恢复生命。',
  },
  bloodMage: {
    name: '血法师', role: '支援 / 血契施法', faction: 'vampire', gender: 'female', hp: 22, attack: 6, armor: 1, range: 2, ap: 3, attackCost: 2,
    skill: { name: '血契咒', description: '对 3 格内的敌人降下 12 点基础伤害，无视防御；自身按造成伤害的一半恢复生命。', effect: 'damage', range: 3, power: 12, cost: 2, cooldown: 2, drain: 0.5 },
  },
  crimsonLord: {
    name: '绛夜领主', role: '首领 / 血月审判者', faction: 'vampire', gender: 'female', hp: 50, attack: 11, armor: 3, range: 2, ap: 3, attackCost: 2,
    lifesteal: 0.2,
    skill: { name: '血月审判', description: '对 3 格内的敌人降下 14 点基础伤害，无视防御；自身按造成伤害的 20% 恢复生命。作为首领时，每个己方回合开始时恢复 4 点生命。', effect: 'damage', range: 3, power: 14, cost: 2, cooldown: 2, drain: 0.2 },
    trait: '血脉：普通攻击按造成伤害的 20% 为自身恢复生命。',
  },
  totem: {
    name: '灰烬图腾车', role: '护送目标 / 移动祭坛', faction: 'orc', hp: 38, attack: 4, armor: 3, range: 1, ap: 3, attackCost: 2,
    skill: { name: '余烬庇护', description: '为 1 格内的友军或自身恢复 8 点生命。图腾车倒下即任务失败。', effect: 'heal', range: 1, power: 8, cost: 2, cooldown: 3 },
  },
};

export const STATUS_NAMES: Record<StatusId, { name: string; description: string }> = {
  slowed: { name: '迟滞', description: '下个己方回合 AP −1' },
  regen: { name: '长夜复苏', description: '己方回合开始时恢复 4 生命' },
  charge: { name: '冲锋', description: '下一次普通攻击伤害 +3' },
};
