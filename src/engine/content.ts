import type { Faction, Terrain, UnitDefinition, UnitKind } from './types';

export const FACTIONS: Record<Faction, { name: string; title: string; motto: string }> = {
  orc: { name: '灰牙氏族', title: 'THE ASHFANG', motto: '王冠归于敢于伸手的人。' },
  elf: { name: '暮誓王庭', title: 'THE DUSKSWORN', motto: '长夜将至，誓言不灭。' },
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
    name: '铁颚卫士', role: '前锋 / 重甲壁垒', faction: 'orc', hp: 40, attack: 11, armor: 4, range: 1, ap: 3, attackCost: 2,
    skill: { name: '破阵斧', description: '对相邻敌人造成 14 点基础伤害，无视防御。', effect: 'damage', range: 1, power: 14, cost: 2, cooldown: 2 },
  },
  raider: {
    name: '荒原掠袭者', role: '游击 / 高机动', faction: 'orc', hp: 25, attack: 8, armor: 1, range: 1, ap: 4, attackCost: 2,
    skill: { name: '淬火飞斧', description: '向 2 格内的敌人掷出飞斧，造成 9 点基础伤害，无视防御。', effect: 'damage', range: 2, power: 9, cost: 2, cooldown: 2 },
  },
  shaman: {
    name: '余烬萨满', role: '支援 / 战地治疗', faction: 'orc', hp: 23, attack: 7, armor: 1, range: 2, ap: 3, attackCost: 2,
    skill: { name: '余烬复苏', description: '为 2 格内的友军或自身恢复 12 点生命，不超过上限。', effect: 'heal', range: 2, power: 12, cost: 2, cooldown: 2 },
  },
  warden: {
    name: '暮誓守望者', role: '统帅 / 誓约守卫', faction: 'elf', hp: 32, attack: 9, armor: 3, range: 1, ap: 3, attackCost: 2,
    skill: { name: '裁决之刃', description: '对相邻敌人造成 14 点基础伤害，无视防御。', effect: 'damage', range: 1, power: 14, cost: 2, cooldown: 2 },
  },
  ranger: {
    name: '夜荫游侠', role: '后排 / 远程压制', faction: 'elf', hp: 22, attack: 8, armor: 1, range: 3, ap: 3, attackCost: 2,
    skill: { name: '穿星箭', description: '射击 4 格内的敌人，造成 11 点基础伤害，无视防御。仍受高地阻挡视线。', effect: 'damage', range: 4, power: 11, cost: 2, cooldown: 2 },
  },
  blade: {
    name: '薄暮刃舞者', role: '游击 / 高机动', faction: 'elf', hp: 26, attack: 9, armor: 2, range: 1, ap: 4, attackCost: 2,
    skill: { name: '月蚀突刺', description: '对相邻敌人造成 13 点基础伤害，无视防御。', effect: 'damage', range: 1, power: 13, cost: 2, cooldown: 2 },
  },
  oracle: {
    name: '黯月先知', role: '支援 / 战地治疗', faction: 'elf', hp: 22, attack: 6, armor: 1, range: 2, ap: 3, attackCost: 2,
    skill: { name: '月泉祷言', description: '为 3 格内的友军或自身恢复 12 点生命，不超过上限。', effect: 'heal', range: 3, power: 12, cost: 2, cooldown: 2 },
  },
  regent: {
    name: '暮誓摄政', role: '首领 / 长夜审判者', faction: 'elf', hp: 46, attack: 10, armor: 3, range: 2, ap: 3, attackCost: 2,
    skill: { name: '长夜审判', description: '对 3 格内的敌人降下 15 点基础伤害，无视防御。每个己方回合开始时恢复 4 点生命。', effect: 'damage', range: 3, power: 15, cost: 2, cooldown: 2 },
  },
  totem: {
    name: '灰烬图腾车', role: '护送目标 / 移动祭坛', faction: 'orc', hp: 32, attack: 4, armor: 3, range: 1, ap: 3, attackCost: 2,
    skill: { name: '余烬庇护', description: '为 1 格内的友军或自身恢复 8 点生命。图腾车倒下即任务失败。', effect: 'heal', range: 1, power: 8, cost: 2, cooldown: 3 },
  },
};

export const STATUS_NAMES: Record<'slowed' | 'regen', { name: string; description: string }> = {
  slowed: { name: '迟滞', description: '下个己方回合 AP −1' },
  regen: { name: '长夜复苏', description: '己方回合开始时恢复 4 生命' },
};
