import './style.css';
import { crest, genderMark, icons, portrait } from './art';
import { renderBoard } from './board';
import { chooseAction } from './engine/ai';
import {
  canRecruit, concludeBattle, deploySlots, interrogationPerk, leaveResult, MORALE, moraleTier, newCampaign, openBriefing,
  PERKS, RESISTANCE, resolvePrisoner, retreatToMap, ROSTER_CAP, setDeploy, startBattle, type CampaignState, type PrisonerChoice,
} from './engine/campaign';
import { FACTIONS, STATUS_NAMES, TERRAIN, UNITS } from './engine/content';
import {
  applyAction, armorOf, attackOf, canAttack, canSkill, captureChance, createGame, factionOf, goblinSnare, isAITurn, isCampaign, living, makeUnit,
  maxAp, maxHp, nameOf, rangeOf, scenarioFor, skillAmount, skillRangeOf, strikeDamage, tileAt, unitAt,
} from './engine/game';
import { distance } from './engine/hex';
import { CAMPAIGN } from './engine/scenarios';
import type { Action, Faction, GameState, Hex, Unit, UnitKind } from './engine/types';
import { clearCampaign, loadCampaign, loadGame, saveCampaign, saveGame } from './storage';

type View = 'campaign' | 'skirmish';
type Dialog = 'new' | 'help' | 'victory' | 'reset' | 'retreat';
const app = document.querySelector<HTMLDivElement>('#app')!;
const viewFromHash = (): View => location.hash.startsWith('#/skirmish') ? 'skirmish' : 'campaign';
let view: View = viewFromHash();

const loadedSkirmish = loadGame();
let skirmish: GameState = loadedSkirmish.status === 'loaded' ? loadedSkirmish.state : createGame();
const loadedCampaign = loadCampaign();
let campaign: CampaignState | null = loadedCampaign.status === 'loaded' ? loadedCampaign.state : null;
const currentBattle = (): GameState | null => view === 'skirmish' ? skirmish : campaign?.phase === 'battle' ? campaign.battle : null;
let state: GameState = currentBattle() ?? skirmish;

let selectedId: string | null = living(state, state.active)[0]?.id ?? null;
let skillMode = false;
let coordinates = false;
let fastAI = false;
let aiGeneration = 0;
let aiRunning = false;
let saveFailed = false;
let notice = '';
let noticeError = false;
function initialNotice(): void {
  if (view === 'skirmish') {
    if (loadedSkirmish.status === 'error') return notify(loadedSkirmish.message, true);
    if (loadedSkirmish.status === 'loaded') return notify(loadedSkirmish.migrated ? '已恢复本地战役（旧版存档已迁移）。每次行动都会自动保存。' : '已恢复本地战役。每次行动都会自动保存。');
    return notify('指挥官，选择金色单位，再点击高亮格移动。敌军进入射程后，点击红色目标攻击。');
  }
  if (loadedCampaign.status === 'error') return notify(loadedCampaign.message, true);
  if (loadedCampaign.status === 'loaded') return notify('已恢复主线进度。每次行动都会自动保存。');
  notify('四场战役，一顶王冠。击倒的敌人有机会被生擒，带回营地发落。');
}
initialNotice();
let dialog: Dialog | null = currentBattle()?.winner ? 'victory' : null;
let setupMode: GameState['mode'] = 'ai';
let setupFaction: Faction = 'orc';
let boardScroll = 0;
let lastFocus: HTMLElement | null = null;
const escapeHTML = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const selected = (): Unit | undefined => state.units.find(u => u.id === selectedId && u.hp > 0);
const interactive = (): boolean => !!currentBattle() && !state.winner && !isAITurn(state);
const pip = (unit: Unit): string => `<span class="ap-pips">${Array.from({ length: maxAp(unit) }, (_, i) => `<i class="${i < unit.ap ? 'filled' : ''}"></i>`).join('')}</span>`;
const pad = (n: number): string => String(n).padStart(2, '0');
const LOG_KIND: Record<string, string> = { system: '军令', move: '行军', attack: '交锋', skill: '技能', death: '阵亡', capture: '俘获', objective: '目标' };
const previewUnit = (kind: UnitKind, owner: Faction = UNITS[kind].faction): Unit => makeUnit(`preview-${kind}`, kind, owner, { q: 0, r: 0 });
const bonusTag = (value: number): string => value ? `<em class="bonus ${value > 0 ? 'up' : 'down'}">${value > 0 ? '+' : ''}${value}</em>` : '';

// ───────────────────────── battle screen ─────────────────────────
function roster(faction: Faction): string {
  const units = state.units.filter(u => factionOf(u) === faction);
  return `<div class="roster ${faction}">
    <div class="roster-heading"><span>${faction === 'orc' ? 'I' : 'II'} / ${FACTIONS[faction].name}</span><span>${living(state, faction).length} / ${units.length}</span></div>
    ${units.map(u => `<button class="roster-unit ${u.id === selectedId ? 'active' : ''} ${u.hp === 0 ? 'fallen' : ''}" data-unit="${u.id}" ${u.hp === 0 ? 'disabled' : ''} aria-label="查看${nameOf(u)}" aria-pressed="${u.id === selectedId}">
        <span class="roster-portrait">${portrait(u)}</span>
        <span class="roster-info"><strong>${nameOf(u)}</strong><span>${u.captured ? '已被俘获' : u.hp === 0 ? '已阵亡' : `${u.hp} / ${maxHp(u)} HP`}</span></span>
        ${u.hp > 0 ? pip(u) : `<span class="fallen-mark">${u.captured ? '⛓' : '×'}</span>`}
      </button>`).join('')}
  </div>`;
}

function targetChip(unit: Unit, target: Unit): string {
  const lethal = skillMode ? UNITS[unit.kind].skill.effect === 'damage' && skillAmount(unit, target) >= target.hp : strikeDamage(state, unit, target) >= target.hp;
  const chance = lethal ? captureChance(state, unit, target, skillMode) : 0;
  const snare = lethal && goblinSnare(unit, target) && chance >= 1;
  const label = snare ? '必杀 · 俘获 100%' : chance ? `致命 · 俘获 ${Math.round(chance * 100)}%` : '致命';
  return `<button data-target="${target.id}">${nameOf(target)}${lethal ? `<small class="${chance ? 'capture-chip' : 'kill-chip'}${snare ? ' snare-chip' : ''}">${label}</small>` : ''}${icons.chevron}</button>`;
}

function unitPanel(): string {
  const unit = selected();
  if (!unit) return `<div class="empty-selection">${icons.flag}<h3>等待你的号令</h3><p>从战场或军团列表中选择一个单位，查看属性与可用行动。</p></div>`;
  const def = UNITS[unit.kind];
  const faction = factionOf(unit);
  const terrain = tileAt(state, unit)!;
  const own = faction === state.active && interactive();
  const skillReady = own && unit.ap >= def.skill.cost && unit.cooldown === 0;
  const targets = own ? living(state).filter(t => skillMode ? canSkill(state, unit, t) : canAttack(state, unit, t)) : [];
  const recruit = def.faction !== faction;
  return `<div class="unit-art ${faction}">
      <div class="portrait-runes">✦<span>ᛟ</span>✦</div>${portrait(unit, true)}
      <span class="unit-banner">${FACTIONS[faction].title}</span>
      <span class="unit-level">${unit.role === 'boss' ? '♛' : 'I'}</span>
    </div>
    <div class="unit-details">
      <div class="eyebrow">${faction === state.active ? '当前军团' : '敌方军团'} <span> / </span> ${def.role}</div>
      <h2>${nameOf(unit)}${genderMark(unit) ? ` <span class="gender-mark" title="${genderMark(unit) === '♀' ? '女性' : '男性'}">${genderMark(unit)}</span>` : ''}</h2>
      ${recruit ? '<p class="unit-note">归降者 · 现为灰牙氏族而战</p>' : ''}
      ${unit.statuses?.length ? `<div class="status-row">${unit.statuses.map(s => `<span title="${STATUS_NAMES[s.id].description}">${STATUS_NAMES[s.id].name}</span>`).join('')}</div>` : ''}
      <div class="health-label"><span>生命值</span><strong>${unit.hp}<small> / ${maxHp(unit)}</small></strong></div>
      <div class="health-track"><span style="width:${100 * unit.hp / maxHp(unit)}%"></span></div>
      <div class="stat-grid">
        <div>${icons.sword}<strong>${attackOf(unit)}${bonusTag(unit.bonus?.attack ?? 0)}</strong><span>攻击</span></div>
        <div>${icons.shield}<strong>${armorOf(unit)}</strong><span>护甲</span></div>
        <div>${icons.arrow}<strong>${rangeOf(unit)}${bonusTag(unit.bonus?.range ?? 0)}</strong><span>射程</span></div>
      </div>
      <div class="action-points"><span>行动点</span>${pip(unit)}<strong>${unit.ap}<small> / ${maxAp(unit)}</small></strong></div>
      <div class="skill-heading"><span>专属技能</span><small>${unit.cooldown ? `冷却 ${unit.cooldown} 个己方回合` : '已就绪'}</small></div>
      <button class="skill-button ${skillMode ? 'armed' : ''}" data-action="skill" ${!skillReady ? 'disabled' : ''} aria-pressed="${skillMode}">
        <span class="skill-icon">${icons.spark}</span><span><strong>${def.skill.name}</strong><small>${def.skill.cost} AP · 射程 ${skillRangeOf(unit)} · 冷却 ${def.skill.cooldown}</small></span>${icons.chevron}
      </button>
      <p class="skill-description">${def.skill.description}</p>
      ${def.trait ? `<p class="unit-trait"><strong>特性</strong>${def.trait}</p>` : ''}
      ${skillMode ? `<div class="target-hint">选择${def.skill.effect === 'heal' ? '绿色友方' : '红色敌方'}目标施放 · 再次点击取消</div>` : ''}
      ${own && targets.length ? `<div class="target-list"><span>可${skillMode ? '施法' : '攻击'}目标</span>${targets.map(t => targetChip(unit, t)).join('')}</div>` : ''}
      <div class="terrain-note">${icons.tree}<span><strong>${TERRAIN[terrain.terrain].name}</strong><small>${TERRAIN[terrain.terrain].description}</small></span></div>
    </div>`;
}

function objectiveStatus(): string {
  const scenario = scenarioFor(state);
  const objective = scenario.objective;
  const roundsLeft = Math.max(0, scenario.maxRounds - state.round + 1);
  switch (objective.type) {
    case 'timed': return `河水暴涨倒计时：剩余 <strong>${roundsLeft}</strong> 轮`;
    case 'escort': {
      const escort = state.units.find(u => u.role === 'escort');
      const left = escort ? Math.min(...objective.goal!.map(g => distance(escort, g))) : 0;
      return escort && escort.hp > 0 ? `图腾车 ${escort.hp}/${maxHp(escort)} 生命 · 距营地 <strong>${left}</strong> 格 · 剩余 ${roundsLeft} 轮` : '图腾车已倒下';
    }
    case 'defend': {
      const holder = unitAt(state, objective.altar!);
      const threat = holder && factionOf(holder) !== state.player;
      return `坚守至第 ${scenario.maxRounds} 轮结束 · 剩余 <strong>${roundsLeft}</strong> 轮 · 月井${threat ? '<b class="danger">正被敌军占据！</b>' : holder ? '由我军镇守' : '无人占据'}`;
    }
    case 'boss': {
      const boss = state.units.find(u => u.role === 'boss');
      return boss ? `暮誓摄政 <strong>${boss.hp}</strong> / ${maxHp(boss)} 生命 · 剩余 ${roundsLeft} 轮` : '';
    }
    default: return '消灭所有敌军';
  }
}

function battleHeading(): string {
  if (!isCampaign(state)) return `<section class="campaign-heading">
      <div><div class="eyebrow"><span class="tiny-line"></span> THE ASHEN MARCHES <span class="muted"> / 遭遇战</span></div><h1>黑棘隘口<span>Blackthorn Pass</span></h1><p>旧王已死。新的秩序，始于灰烬。</p></div>
      <div class="campaign-actions"><span class="mode-tag"><i></i>${state.mode === 'ai' ? '单人 · 战术 AI' : '本地双人 · 同屏对弈'}</span><button class="outline-button" data-action="new">${icons.flag}新战役</button></div>
    </section>`;
  const scenario = scenarioFor(state);
  const tier = moraleTier(campaign!.morale);
  return `<section class="campaign-heading">
      <div><div class="eyebrow"><span class="tiny-line"></span> 灰烬征途 <span class="muted"> / ${scenario.chapter}</span></div><h1>${scenario.name}<span>${scenario.english}</span></h1><p>${scenario.tagline}</p></div>
      <div class="campaign-actions"><span class="mode-tag morale-tag"><i></i>士气 ${campaign!.morale} · ${tier.name}</span><button class="outline-button" data-action="retreat">${icons.flag}撤退</button></div>
    </section>
    <div class="objective-strip"><span class="twist-tag">${scenario.objective.twist}</span><span class="objective-text">${scenario.objective.summary}</span><span class="objective-live">${objectiveStatus()}</span></div>`;
}

function battleScreen(): string {
  const own = interactive();
  const scenario = scenarioFor(state);
  const cap = scenario.maxRounds;
  return `${battleHeading()}
      <section class="war-table" aria-label="战棋对局">
        <aside class="army-panel">
          <div class="panel-label"><span>参战军团</span><small>ORDER OF BATTLE</small></div>
          <div class="faction-summary orc">${crest('orc')}<span><strong>灰牙氏族</strong><small>铁与火，铸成王座。</small></span><span class="faction-count">${living(state, 'orc').length}<small>UNITS</small></span></div>
          ${roster('orc')}
          <div class="armies-divider"><span>VS</span></div>
          <div class="faction-summary elf">${crest('elf')}<span><strong>暮誓王庭</strong><small>月下的誓言，未曾凋零。</small></span><span class="faction-count">${living(state, 'elf').length}<small>UNITS</small></span></div>
          ${roster('elf')}
          <div class="army-footnote">${icons.shield}<span>${isCampaign(state) ? '命中无随机 · 仅俘获需掷骰<br/>只有你的决策' : '无随机命中 · 无氪金<br/>只有你的决策'}</span></div>
        </aside>
        <section class="battlefield">
          <div class="battle-toolbar"><div class="turn-badge ${state.active}"><i></i>${state.winner ? '战役结束' : `${FACTIONS[state.active].name}回合`}</div><div class="round-label">ROUND <strong>${pad(Math.min(state.round, cap))}</strong><span>/ ${cap}</span></div><button class="coordinate-toggle ${coordinates ? 'on' : ''}" data-action="coordinates" aria-pressed="${coordinates}" title="显示或隐藏坐标">⌗<span>坐标</span></button></div>
          <div class="map-scroll">${renderBoard(state, { selected: selected(), skill: skillMode, coordinates, interactive: own })}</div>
          <div class="battle-atmosphere" aria-hidden="true"><span>✦</span> CROWNS FALL. ASHES REMAIN. <span>✦</span></div>
          <div class="battle-bottom"><div class="map-legend"><span><i class="legend-move"></i>可移动</span><span><i class="legend-attack"></i>可攻击</span><span><i class="legend-selected"></i>已选择</span></div><button class="speed-button" data-action="speed" aria-pressed="${fastAI}">AI ${fastAI ? '2×' : '1×'}</button></div>
          <div class="turn-controls"><div class="turn-instruction"><span class="pulse ${isAITurn(state) ? 'thinking' : ''}"></span><span><strong>${state.winner ? '尘埃落定' : isAITurn(state) ? '敌方正在部署战术…' : skillMode ? '选择技能目标' : '轮到你了，指挥官'}</strong><small>${state.winner ? '查看战报，或开启新的战役' : isAITurn(state) ? '正在分析目标、地形与战线' : skillMode ? '点击高亮单位施放，Esc 取消' : '选择单位 → 移动 / 攻击 / 技能'}</small></span></div><button class="end-turn primary" data-action="${state.winner ? 'result' : 'end'}" ${!own && !state.winner ? 'disabled' : ''}>${state.winner ? icons.crown : icons.end}<span>${state.winner ? '战役结算' : '结束回合'}</span>${!state.winner ? '<kbd>E</kbd>' : ''}</button></div>
        </section>
        <aside class="inspector"><div class="panel-label"><span>单位档案</span><small>UNIT DOSSIER</small></div>${unitPanel()}</aside>
      </section>
      ${noticeBar()}
      <section class="lower-grid">
        <section class="battle-journal"><div class="section-title"><h2><span class="tiny-line"></span>战斗纪事 <small>BATTLE CHRONICLE</small></h2><span>最近 ${Math.min(state.log.length, 6)} 条 / ${state.log.length} 条</span></div>
          <div class="journal-entries" role="log" aria-label="战斗日志">${state.log.slice(-6).reverse().map(entry => `<div class="journal-entry ${entry.type}"><span class="log-round">${pad(Math.min(entry.round, cap))}</span><span class="log-dot ${entry.faction}"></span><p>${escapeHTML(entry.text)}</p><span class="log-kind">${LOG_KIND[entry.type]}</span></div>`).join('')}</div>
          <button class="text-button export-log" data-action="export">导出完整战报 ↓</button>
        </section>
        <aside class="field-notes"><span class="eyebrow">KNOW YOUR BATTLEFIELD</span><h2>地形，即是无声的盟友。</h2><p>密林掩护锋线，高地成就远射。每一步都在改变下一次交锋的结局。</p><div class="terrain-key"><span><i class="forest"></i>密林 <small>防御 +2</small></span><span><i class="ridge"></i>高地 <small>远攻 +2</small></span><span><i class="ruins"></i>王墟 <small>防御 +1</small></span><span><i class="water"></i>深潭 <small>不可通行</small></span></div><button class="text-button" data-action="help">翻阅战地手册 ${icons.chevron}</button></aside>
      </section>`;
}
const noticeBar = (): string => `<div class="notice ${noticeError ? 'error' : ''}" role="status" aria-live="polite"><span>${noticeError ? '!' : '✧'}</span><span>${escapeHTML(notice)}</span><small>${saveFailed ? '本地保存不可用' : '本地自动存档'}</small></div>`;

// ───────────────────────── campaign screens ─────────────────────────
function moraleMeter(morale: number): string {
  const tier = moraleTier(morale);
  return `<div class="morale-meter" role="meter" aria-label="军队士气" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${morale}">
    <div class="morale-head"><span>军队士气</span><strong>${morale}<small> / 100</small></strong></div>
    <div class="morale-track"><i style="width:${morale}%"></i>${[20, 40, 60, 80].map(m => `<b style="left:${m}%"></b>`).join('')}</div>
    <div class="morale-tier"><strong>${tier.name}</strong><span>${tier.effect}</span></div>
  </div>`;
}
function perkList(c: CampaignState): string {
  return `<div class="perk-list">${c.perks.length ? c.perks.map(p => `<div class="perk"><span>${icons.spark}</span><p><strong>${PERKS[p].name}</strong><small>${PERKS[p].description}</small></p></div>`).join('') : '<p class="empty-note">尚无军团能力。审讯俘虏可以解锁。</p>'}
    ${c.resistance ? `<div class="perk resistance"><span>${icons.shield}</span><p><strong>敌军抵抗 ×${c.resistance}</strong><small>敌军生命 +${c.resistance * RESISTANCE.hpPerPoint} · 俘获率 −${c.resistance * RESISTANCE.capturePerPoint * 100}%</small></p></div>` : ''}</div>`;
}
function rosterCards(c: CampaignState, selectable: boolean): string {
  return `<div class="camp-roster">${c.roster.map(r => {
    const unit = previewUnit(r.kind, 'orc');
    const on = c.deploy.includes(r.id);
    const inner = `<span class="roster-portrait">${portrait(unit)}</span><span class="roster-info"><strong>${r.name}</strong><span>${UNITS[r.kind].name}${r.origin === 'recruit' ? ' · 归降者' : ''}</span></span>`;
    return selectable
      ? `<button class="roster-card ${on ? 'on' : ''}" data-deploy="${r.id}" aria-pressed="${on}">${inner}<span class="deploy-mark">${on ? '出战' : '待命'}</span></button>`
      : `<div class="roster-card">${inner}</div>`;
  }).join('')}</div>`;
}
function campaignHeading(eyebrow: string, title: string, english: string, tagline: string, actions = ''): string {
  return `<section class="campaign-heading"><div><div class="eyebrow"><span class="tiny-line"></span> 灰烬征途 <span class="muted"> / ${eyebrow}</span></div><h1>${title}<span>${english}</span></h1><p>${tagline}</p></div><div class="campaign-actions">${actions}</div></section>`;
}
function routeMap(c: CampaignState | null): string {
  const nodes = [[120, 210], [300, 120], [480, 200], [660, 100]];
  const level = c?.level ?? -1;
  return `<svg class="route-map" viewBox="0 0 780 290" role="img" aria-label="征途地图">
    <path d="M40 250 C120 230 90 215 120 210 S240 140 300 120 420 210 480 200 600 110 660 100 740 60 760 40" fill="none" stroke="#c9ad7655" stroke-width="2" stroke-dasharray="6 7"/>
    ${nodes.map(([x, y], i) => {
      const done = i < level; const current = i === level;
      return `<g transform="translate(${x} ${y})" class="route-node ${done ? 'done' : current ? 'current' : 'locked'}">
        <circle r="${current ? 24 : 18}" fill="${done ? '#4a422a' : current ? '#6d5934' : '#1b241e'}" stroke="${done || current ? '#e2c590' : '#55604f'}" stroke-width="1.5"/>
        <text y="6" text-anchor="middle" class="route-num">${['I', 'II', 'III', 'IV'][i]}</text>
        <text y="${current ? 46 : 40}" text-anchor="middle" class="route-label">${CAMPAIGN[i].name}</text>
      </g>`;
    }).join('')}
    <g transform="translate(740 40)" class="route-crown"><path d="m-14 6 4-14 6 7 4-10 4 10 6-7 4 14Z" fill="${level >= 4 ? '#e2c590' : '#55604f'}"/></g>
  </svg>`;
}
function levelCards(c: CampaignState | null): string {
  const level = c?.level ?? -1;
  return `<div class="level-list">${CAMPAIGN.map((s, i) => {
    const status = i < level ? 'done' : i === level ? 'current' : 'locked';
    return `<article class="level-card ${status}"><span class="level-num">${s.chapter}</span><div><h3>${s.name} <small>${s.english}</small></h3><p><span class="twist-tag">${s.objective.twist}</span>${s.objective.summary}</p></div>
      ${status === 'current' ? `<button class="primary" data-action="briefing">${icons.sword}查看简报</button>` : `<span class="level-state">${status === 'done' ? '已攻克' : '未解锁'}</span>`}</article>`;
  }).join('')}</div>`;
}
function intro(): string {
  return `${campaignHeading('主线战役', '灰烬征途', 'The Ashen Road', '四场战役，一顶王冠。俘获、审讯、招募——每个选择都会跟着你走到王座前。')}
    <section class="campaign-grid">
      <div class="campaign-panel">${routeMap(null)}${levelCards(null)}
        <button class="primary wide" data-action="campaign-new">${icons.crown}开始主线战役</button></div>
      <aside class="campaign-panel how-it-works"><span class="eyebrow">HOW THE ROAD WORKS</span><h2>倒下的敌人，未必死去。</h2>
        <p>主线中，击倒敌军有一定概率将其生擒（辅助单位更容易，统帅更难；用技能致命一击、或敌军已近崩溃时也会影响概率）。战后在俘虏营中为每名俘虏做出选择：</p>
        <div class="choice-explain"><div><strong>审讯</strong><small>解锁一项军团能力</small></div><div><strong>招募</strong><small>俘虏加入你的军团作战</small></div><div><strong>酷刑</strong><small>士气大涨，但敌军抵抗更顽强</small></div></div>
        <p>军队士气会影响下一场战斗：高昂时攻击提升，低落时首回合行动迟滞。阵亡的战士不会归来——督军除外。</p></aside>
    </section>${noticeBar()}`;
}
function mapScreen(c: CampaignState): string {
  return `${campaignHeading('征途地图', '灰烬征途', 'The Ashen Road', `第 ${Math.min(c.level + 1, 4)} / 4 场战役 · 胜 ${c.stats.victories} · 俘获 ${c.stats.captured}`, `<button class="outline-button" data-action="reset">${icons.flag}重新开始主线</button>`)}
    <section class="campaign-grid">
      <div class="campaign-panel">${routeMap(c)}${levelCards(c)}</div>
      <aside class="campaign-panel">${moraleMeter(c.morale)}
        <div class="panel-sub"><span>军团能力</span><small>${c.perks.length} / 6</small></div>${perkList(c)}
        <div class="panel-sub"><span>军团名册</span><small>${c.roster.length} / ${ROSTER_CAP}</small></div>${rosterCards(c, false)}
        <div class="panel-sub"><span>征途纪事</span></div><ul class="chronicle">${c.chronicle.slice(-5).reverse().map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
      </aside>
    </section>${noticeBar()}`;
}
function briefingScreen(c: CampaignState): string {
  const scenario = CAMPAIGN[c.level];
  const slots = deploySlots(c.level);
  const preview = startBattle({ ...c, deploy: c.deploy.length ? c.deploy : c.roster.slice(0, 1).map(r => r.id) }).battle!;
  const enemyCount = new Map<string, number>();
  [...scenario.enemies.map(e => e[0]), ...(scenario.boss ? [scenario.boss[0]] : [])].forEach(k => enemyCount.set(UNITS[k].name, (enemyCount.get(UNITS[k].name) ?? 0) + 1));
  const tier = moraleTier(c.morale);
  return `${campaignHeading(scenario.chapter, scenario.name, scenario.english, scenario.tagline, `<button class="outline-button" data-action="campaign-map">${icons.chevron}返回地图</button>`)}
    <section class="campaign-grid briefing">
      <div class="campaign-panel">
        <span class="eyebrow">BRIEFING · 战前简报</span>
        <div class="briefing-text">${scenario.briefing.map(p => `<p>${p}</p>`).join('')}</div>
        <div class="objective-box"><span class="twist-tag">${scenario.objective.twist}</span><strong>${scenario.objective.summary}</strong></div>
        <div class="intel"><span>敌情</span>${[...enemyCount].map(([n, k]) => `<em>${n} ×${k}</em>`).join('')}${(scenario.reinforcements ?? []).map(w => `<em class="wave">第 ${w.round} 轮增援 ×${w.units.length}</em>`).join('')}</div>
        <div class="briefing-map">${renderBoard(preview, { selected: undefined, skill: false, coordinates: false, interactive: false })}</div>
      </div>
      <aside class="campaign-panel">
        <div class="panel-sub"><span>选择出战单位</span><small>${c.deploy.length} / ${slots}</small></div>
        ${rosterCards(c, true)}
        ${moraleMeter(c.morale)}
        <p class="fine-print">本战士气效果：${tier.effect}。${c.perks.length ? `军团能力：${c.perks.map(p => PERKS[p].name).join('、')}。` : ''}${c.resistance ? `敌军抵抗 ×${c.resistance}。` : ''}</p>
        <button class="primary wide" data-action="campaign-start" ${c.deploy.length ? '' : 'disabled'}>${icons.sword}出征</button>
      </aside>
    </section>${noticeBar()}`;
}
function resultScreen(c: CampaignState): string {
  const r = c.result!;
  const scenario = CAMPAIGN[r.level];
  const next = c.prisoners.length ? `前往俘虏营（${c.prisoners.length}）` : c.level >= CAMPAIGN.length ? '迎接王冠' : '返回征途地图';
  return `${campaignHeading('战果', `${scenario.name} · ${r.victory ? '告捷' : '失利'}`, scenario.english, r.victory ? scenario.victoryText : scenario.defeatText)}
    <section class="result-card ${r.victory ? 'win' : 'loss'}">
      ${r.victory ? crest('orc') : icons.flag}
      <div class="result-stats">
        <div><strong>${r.moraleDelta > 0 ? '+' : ''}${r.moraleDelta}</strong><span>士气变化</span></div>
        <div><strong>${r.captured.length}</strong><span>俘获</span></div>
        <div><strong>${r.fallen.length}</strong><span>永久阵亡</span></div>
      </div>
      ${r.captured.length ? `<div class="captive-row">${r.captured.map(k => `<span>${portrait(previewUnit(k))}<small>${UNITS[k].name}</small></span>`).join('')}</div>` : ''}
      ${r.fallen.length ? `<p class="fallen-line">阵亡：${r.fallen.join('、')}</p>` : ''}
      ${r.reward ? `<p class="reward-line">${icons.spark}${r.reward}</p>` : ''}
      ${!r.victory ? '<p class="fallen-line">军团撤回营地重整。阵亡者已被救回，可以再次出征。</p>' : ''}
      ${moraleMeter(c.morale)}
      <button class="primary wide" data-action="campaign-continue">${icons.chevron}${next}</button>
    </section>${noticeBar()}`;
}
function campScreen(c: CampaignState): string {
  return `${campaignHeading('俘虏营地', '俘虏营地', 'The Prisoner Camp', '每名俘虏只能做出一个选择。结果会跟随你直到征途结束。')}
    <section class="campaign-grid camp">
      <div class="prisoner-list">${c.prisoners.map(p => {
        const perk = interrogationPerk(c, p.kind);
        const recruitable = canRecruit(c);
        const unit = previewUnit(p.kind);
        return `<article class="prisoner-card"><div class="prisoner-portrait">${portrait(unit)}</div>
          <div class="prisoner-info"><h3>${UNITS[p.kind].name}</h3><small>${UNITS[p.kind].role} · 生命 ${UNITS[p.kind].hp} · 攻击 ${UNITS[p.kind].attack} · 射程 ${UNITS[p.kind].range}</small></div>
          <div class="choice-buttons">
            <button data-prisoner="${p.id}" data-choice="interrogate"><strong>审讯</strong><small>${perk ? `获得「${PERKS[perk].name}」：${PERKS[perk].description}` : `情报已无新意：士气 +${MORALE.interrogateFallback}`}</small></button>
            <button data-prisoner="${p.id}" data-choice="recruit" ${recruitable ? '' : 'disabled'}><strong>招募</strong><small>${recruitable ? `编入军团（${c.roster.length} → ${c.roster.length + 1} / ${ROSTER_CAP}），为灰牙作战` : '军团名册已满'}</small></button>
            <button data-prisoner="${p.id}" data-choice="torture" class="dark"><strong>酷刑</strong><small>士气 +${MORALE.torture}；敌军抵抗 +1（敌军生命 +${RESISTANCE.hpPerPoint}，俘获率 −${RESISTANCE.capturePerPoint * 100}%）</small></button>
          </div></article>`;
      }).join('') || '<p class="empty-note">营地里已经没有俘虏了。</p>'}</div>
      <aside class="campaign-panel">${moraleMeter(c.morale)}
        <div class="panel-sub"><span>军团能力</span><small>${c.perks.length} / 6</small></div>${perkList(c)}
        <button class="primary wide" data-action="campaign-continue" ${c.prisoners.length ? 'disabled' : ''}>${icons.chevron}拔营，${c.level >= CAMPAIGN.length ? '迎接王冠' : '返回征途'}</button>
        ${c.prisoners.length ? `<p class="fine-print">还有 ${c.prisoners.length} 名俘虏等待发落。</p>` : ''}
      </aside>
    </section>${noticeBar()}`;
}
function completeScreen(c: CampaignState): string {
  return `${campaignHeading('终章', '灰烬王冠，归于灰牙', 'The Crown Is Ours', '旧王已死，摄政已倒。新的秩序，始于灰烬。', `<button class="outline-button" data-action="reset">${icons.flag}再次踏上征途</button>`)}
    <section class="result-card win">${crest('orc')}
      <div class="result-stats"><div><strong>${c.stats.victories}</strong><span>胜利</span></div><div><strong>${c.stats.captured}</strong><span>俘获</span></div><div><strong>${c.stats.recruited}</strong><span>招募</span></div><div><strong>${c.stats.interrogated}</strong><span>审讯</span></div><div><strong>${c.stats.tortured}</strong><span>酷刑</span></div></div>
      ${moraleMeter(c.morale)}${perkList(c)}
      <ul class="chronicle">${c.chronicle.map(t => `<li>${escapeHTML(t)}</li>`).join('')}</ul>
    </section>${noticeBar()}`;
}
function campaignScreen(): string {
  if (!campaign) return intro();
  switch (campaign.phase) {
    case 'briefing': return briefingScreen(campaign);
    case 'battle': return battleScreen();
    case 'result': return resultScreen(campaign);
    case 'camp': return campScreen(campaign);
    case 'complete': return completeScreen(campaign);
    default: return mapScreen(campaign);
  }
}

// ───────────────────────── dialogs ─────────────────────────
function dialogContent(): string {
  if (dialog === 'new') return `
    <span class="eyebrow">A NEW SKIRMISH</span><h2>战火，再度燃起。</h2><p class="dialog-lead">黑棘隘口没有永恒的王。选择你的旗帜，写下这一夜的结局。</p>
    <h3 class="field-label">对局模式</h3><div class="segmented">
      <button data-mode="ai" class="${setupMode === 'ai' ? 'active' : ''}" aria-pressed="${setupMode === 'ai'}">对抗战术 AI<small>独自指挥一支军团</small></button>
      <button data-mode="local" class="${setupMode === 'local' ? 'active' : ''}" aria-pressed="${setupMode === 'local'}">本地双人<small>同屏轮流指挥双方</small></button>
    </div>
    <h3 class="field-label">${setupMode === 'ai' ? '你的阵营' : '首位指挥官 · 兽人固定先行'}</h3>
    <div class="faction-options">${(['orc', 'elf'] as const).map(f => `<button data-faction="${f}" class="${f} ${setupFaction === f ? 'active' : ''}" aria-pressed="${setupFaction === f}">${crest(f)}<strong>${FACTIONS[f].name}</strong><small>${f === 'orc' ? '坚甲 · 近战 · 压迫' : '远射 · 机动 · 精准'}</small></button>`).join('')}</div>
    <p class="fine-print">当前遭遇战进度将被替换（主线进度不受影响）。兽人先行；每阵营 5 个单位。所有战斗均在本地运行。</p>
    <button class="primary start-battle" data-action="start">${icons.sword}部署军团，进入战场</button>`;
  if (dialog === 'help') return `
    <span class="eyebrow">THE COMMANDER'S FIELD GUIDE</span><h2>在灰烬中，学会取胜。</h2>
    <div class="rules-grid">
      <section><span class="rule-number">01</span><h3>每一点行动，皆有代价</h3><p>点击己方单位，再点金色格移动。AP 是移动、攻击、技能共用的资源。普通单位每回合 3 AP，游击单位 4 AP；攻击与技能均消耗 2 AP。可多次行动，AP 耗尽后点击「结束回合」。</p></section>
      <section><span class="rule-number">02</span><h3>占据地利，而非只求先手</h3><p>荒原 / 王墟移动 1 AP，密林 / 高地移动 2 AP。密林防御 +2；王墟、高地防御 +1。高地上的远程单位普通攻击伤害 +2。深潭不可通行；单位阻挡移动，高地阻挡中间射线。</p></section>
      <section><span class="rule-number">03</span><h3>预判你的下一击</h3><p>红色角标为可攻击目标。普通伤害 = 攻击 + 高地加成 − 护甲 − 地形防御，最低 2。技能无视防御；治疗不能复活。技能冷却在己方回合开始时减 1，因此冷却 2 会跳过下一己方回合。</p></section>
      <section><span class="rule-number">04</span><h3>主线：俘获与士气</h3><p>主线中击倒敌人有概率生擒（目标列表会显示「致命 · 俘获 %」）。战后在俘虏营审讯、招募或施以酷刑。士气高于 60 时攻击 +1，低于 40 时首回合 AP −1。<strong>哥布林擒拿：</strong>哥布林的攻击或技能命中女性精灵（♀）时一击制服并必定俘获（目标列表显示「必杀 · 俘获 100%」）；暮誓摄政等首领不受影响。遭遇战没有俘获，规则完全确定。</p></section>
    </div>
    <div class="key-guide"><span><kbd>E</kbd> 结束回合</span><span><kbd>Esc</kbd> 取消技能 / 选择</span><span><kbd>H</kbd> 战地手册</span><span><kbd>Tab</kbd> + <kbd>Enter</kbd> 键盘操作</span></div>
    <p class="fine-print">21+ 主题定位 · 原创暗黑奇幻世界，包含战争与死亡的非写实描述，无露骨画面；并非官方年龄分级。自动存档仅保存在当前浏览器，无账号、无追踪、无网络对战。</p>
    <button class="primary" data-action="close">我已准备就绪</button>`;
  if (dialog === 'reset') return `<span class="eyebrow">RESTART THE ROAD</span><h2>重新开始主线？</h2><p class="dialog-lead">当前主线的名册、俘虏、军团能力与士气都会被清除。遭遇战进度不受影响。</p>
    <button class="primary" data-action="reset-confirm">${icons.flag}清除并重新开始</button><button class="text-button" data-action="close">取消</button>`;
  if (dialog === 'retreat') return `<span class="eyebrow">SOUND THE RETREAT</span><h2>撤出战场？</h2><p class="dialog-lead">撤退视为本关失利：士气 ${MORALE.defeat}，本场俘虏不会带回。阵亡者会被救回，可以重新出征。</p>
    <button class="primary" data-action="retreat-confirm">${icons.flag}确认撤退</button><button class="text-button" data-action="close">继续战斗</button>`;
  const winner = state.winner;
  if (isCampaign(state)) {
    const scenario = scenarioFor(state);
    const won = winner === state.player;
    return `<div class="victory-content">${won ? crest('orc') : icons.crown}<span class="eyebrow">THE BATTLE IS OVER</span>
      <h2>${scenario.name}，${won ? '告捷。' : '失利。'}</h2>
      <p class="dialog-lead">${won ? scenario.victoryText : scenario.defeatText}</p>
      <div class="victory-stats"><div><strong>${Math.min(state.round, scenario.maxRounds)}</strong><span>战斗轮数</span></div><div><strong>${won ? state.units.filter(u => u.captured).length : 0}</strong><span>俘获</span></div></div>
      <button class="primary" data-action="conclude">${icons.chevron}查看战果</button><button class="text-button" data-action="close">检视战场</button></div>`;
  }
  return `<div class="victory-content">${winner && winner !== 'draw' ? crest(winner) : icons.crown}<span class="eyebrow">THE BATTLE IS OVER</span>
    <h2>${winner === 'draw' ? '黑雾之下，无人称王。' : `${winner ? FACTIONS[winner].name : ''}，胜利。`}</h2>
    <p class="dialog-lead">${winner === 'draw' ? '四十轮交锋后，双方撤出隘口。下一次相遇，誓言仍在。' : '最后一面旗帜在风中屹立。王冠已归你，代价留给长夜。'}</p>
    <div class="victory-stats"><div><strong>${Math.min(state.round, 40)}</strong><span>战斗轮数</span></div><div><strong>${living(state).length}</strong><span>幸存单位</span></div></div>
    <button class="primary" data-action="new">再启一场战役</button><button class="text-button" data-action="close">检视战场</button></div>`;
}

function render(): void {
  boardScroll = app.querySelector('.map-scroll')?.scrollLeft ?? boardScroll;
  const focused = document.activeElement;
  const focusUnit = focused instanceof HTMLElement ? focused.dataset.unit : undefined;
  const focusHex = focused instanceof SVGElement ? focused.getAttribute('data-hex') : undefined;
  app.innerHTML = `
    <header class="masthead">
      <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="灰烬王冠首页"><span class="brand-mark">${icons.crown}</span><span>ASHEN CROWN<small>灰 烬 王 冠</small></span></a>
      <nav aria-label="主导航"><a href="#/campaign" class="nav-tab ${view === 'campaign' ? 'on' : ''}" ${view === 'campaign' ? 'aria-current="page"' : ''}>主线战役</a><a href="#/skirmish" class="nav-tab ${view === 'skirmish' ? 'on' : ''}" ${view === 'skirmish' ? 'aria-current="page"' : ''}>遭遇战</a><button data-action="help">战地手册 <kbd>H</kbd></button><a class="source-link" href="https://github.com/grot666/ashen-crown" target="_blank" rel="noopener noreferrer">源代码 ↗</a></nav>
      <span class="edition">CHAPTER I <i></i> ORCS & ELVES</span>
    </header>
    <main>${view === 'skirmish' ? battleScreen() : campaignScreen()}</main>
    <footer><span>${icons.crown} ASHEN CROWN <small>灰烬王冠</small></span><p>原创奇幻战棋 · 主线「灰烬征途」与遭遇战 <span> / </span> 21+ 主题 · 非官方评级</p><a href="https://grot666.github.io/">GROT666 的项目集 ↗</a></footer>
    <dialog class="game-dialog ${dialog === 'help' ? 'help-dialog' : ''}" aria-label="${dialog === 'new' ? '配置新战役' : dialog === 'help' ? '战地手册' : dialog === 'reset' ? '重新开始主线' : dialog === 'retreat' ? '撤退' : '战役结算'}"><button class="dialog-close" data-action="close" aria-label="关闭弹窗">${icons.cross}</button>${dialog ? dialogContent() : ''}</dialog>
  `;
  const scroll = app.querySelector('.map-scroll');
  if (scroll) scroll.scrollLeft = boardScroll;
  if (dialog) {
    const modal = app.querySelector<HTMLDialogElement>('dialog')!;
    modal.showModal();
    modal.addEventListener('cancel', event => { event.preventDefault(); closeDialog(); });
  } else if (focusUnit) app.querySelector<HTMLButtonElement>(`[data-unit="${focusUnit}"]`)?.focus({ preventScroll: true });
  else if (focusHex) app.querySelector<SVGElement>(`[data-hex="${focusHex}"]`)?.focus({ preventScroll: true });
}

// ───────────────────────── state transitions ─────────────────────────
function notify(text: string, error = false): void {
  notice = text;
  noticeError = error;
}
function persist(): void {
  const ok = view === 'skirmish' ? saveGame(skirmish) : campaign ? saveCampaign(campaign) : true;
  saveFailed = !ok;
  if (!ok) notify('浏览器拒绝保存进度；请勿关闭本页，以免丢失当前战役。', true);
}
function setBattle(next: GameState): void {
  state = next;
  if (view === 'skirmish') skirmish = next;
  else if (campaign) campaign = { ...campaign, battle: next };
}
function setCampaign(next: CampaignState | null, message?: string): void {
  campaign = next;
  aiGeneration++;
  aiRunning = false;
  if (next?.phase === 'battle' && next.battle) {
    state = next.battle;
    selectedId = living(state, state.active)[0]?.id ?? null;
  }
  skillMode = false;
  if (message) notify(message);
  persist();
  render();
  window.scrollTo?.({ top: 0 });
  void runAI();
}
function commit(action: Action): boolean {
  const result = applyAction(state, action);
  if (!result.ok) {
    notify(result.error, true);
    render();
    return false;
  }
  setBattle(result.state);
  skillMode = false;
  if (action.type === 'end') {
    selectedId = living(state, state.active)[0]?.id ?? null;
    const objective = [...state.log].reverse().find(l => l.type === 'objective' && l.round === state.round);
    notify(`${FACTIONS[state.active].name}开始行动。${isAITurn(state) ? 'AI 正在思考。' : '行动点已恢复。'}${objective ? ` ${objective.text}` : ''}`);
  } else {
    // A lethal blow logs damage then death/capture; surface the outcome.
    notify(state.log.at(-1)!.text);
  }
  if (state.winner) dialog = 'victory';
  persist();
  render();
  return true;
}

async function runAI(): Promise<void> {
  if (aiRunning || !currentBattle() || !isAITurn(state)) return;
  aiRunning = true;
  const generation = aiGeneration;
  let steps = 0;
  while (currentBattle() && isAITurn(state) && generation === aiGeneration) {
    await new Promise(resolve => setTimeout(resolve, fastAI ? 220 : 560));
    if (generation !== aiGeneration) return;
    // Let a rules dialog pause AI, rather than move the board behind the reader.
    if (dialog) continue;
    const action = steps++ > 60 ? { type: 'end' as const } : chooseAction(state);
    if (action.type !== 'end') selectedId = action.unitId;
    if (!commit(action)) {
      console.error('AI generated an invalid action', action);
      notify('AI 行动被规则拒绝，已结束敌方回合。', true);
      commit({ type: 'end' });
      break;
    }
  }
  if (generation === aiGeneration) aiRunning = false;
}

function handleHex(hex: Hex): void {
  const target = unitAt(state, hex);
  const unit = selected();
  if (!interactive()) {
    if (target) { selectedId = target.id; skillMode = false; render(); }
    return;
  }
  if (unit && factionOf(unit) === state.active && skillMode && target) {
    commit({ type: 'skill', unitId: unit.id, targetId: target.id });
  } else if (target && factionOf(target) === state.active) {
    selectedId = target.id;
    skillMode = false;
    notify(`已选择${nameOf(target)}。金色格可移动；红色目标可攻击。`);
    render();
  } else if (target && unit && factionOf(unit) === state.active && canAttack(state, unit, target)) {
    commit({ type: 'attack', unitId: unit.id, targetId: target.id });
  } else if (target) {
    selectedId = target.id;
    skillMode = false;
    notify(`正在检视${nameOf(target)}。选择己方单位后，靠近敌军再发起攻击。`);
    render();
  } else if (unit && factionOf(unit) === state.active) {
    if (skillMode) {
      notify('技能需要单位目标，请选择高亮友军或敌军。', true);
      render();
    } else commit({ type: 'move', unitId: unit.id, to: hex });
  } else {
    notify('请先从战场或左侧列表选择己方单位。', true);
    render();
  }
}

function openDialog(kind: Dialog): void {
  lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog = kind;
  render();
}
function closeDialog(): void {
  dialog = null;
  render();
  if (lastFocus?.dataset.action) app.querySelector<HTMLButtonElement>(`[data-action="${lastFocus.dataset.action}"]`)?.focus({ preventScroll: true });
  void runAI();
}
function exportLog(): void {
  const scenario = scenarioFor(state);
  const text = `灰烬王冠 · ${scenario.name}\n${isCampaign(state) ? `主线 · ${scenario.chapter}` : state.mode === 'ai' ? '战术 AI' : '本地双人'} · 第 ${Math.min(state.round, scenario.maxRounds)} 轮\n${state.winner ? state.winner === 'draw' ? '平局' : `${FACTIONS[state.winner].name}胜利` : '战役进行中'}\n\n` +
    state.log.map(l => `[${l.round}] ${FACTIONS[l.faction].name} · ${l.text}`).join('\n') +
    '\n\n灰烬王冠 · ASHEN CROWN\n';
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ashen-crown-battle-report.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function switchView(next: View): void {
  if (next === view) return;
  view = next;
  aiGeneration++;
  aiRunning = false;
  state = currentBattle() ?? skirmish;
  selectedId = living(state, state.active)[0]?.id ?? null;
  skillMode = false;
  dialog = currentBattle()?.winner ? 'victory' : null;
  notify(view === 'skirmish' ? '遭遇战：黑棘隘口。进度独立于主线保存。' : campaign ? '回到灰烬征途。' : '四场战役，一顶王冠。击倒的敌人有机会被生擒，带回营地发落。');
  render();
  window.scrollTo?.({ top: 0 });
  void runAI();
}

function campaignAction(action: string): boolean {
  switch (action) {
    case 'campaign-new': setCampaign(newCampaign((Date.now() ^ (Math.random() * 2 ** 32)) >>> 0), '征途开始。先查看第一关的战前简报。'); return true;
    case 'briefing': if (campaign) setCampaign(openBriefing(campaign), '选择出战单位，然后出征。'); return true;
    case 'campaign-map': if (campaign) setCampaign(retreatToMap(campaign)); return true;
    case 'campaign-start': if (campaign?.deploy.length) setCampaign(startBattle(campaign), `${CAMPAIGN[campaign.level].chapter}「${CAMPAIGN[campaign.level].name}」开战：${CAMPAIGN[campaign.level].objective.summary}。`); return true;
    case 'conclude':
      if (campaign?.battle?.winner) { dialog = null; setCampaign(concludeBattle(campaign)); }
      return true;
    case 'campaign-continue': if (campaign) setCampaign(campaign.phase === 'result' ? leaveResult(campaign) : { ...campaign, phase: campaign.level >= CAMPAIGN.length ? 'complete' : 'map', result: null }); return true;
    case 'retreat': openDialog('retreat'); return true;
    case 'retreat-confirm':
      if (campaign?.battle && !campaign.battle.winner) {
        dialog = null;
        const lost = { ...campaign.battle, winner: 'elf' as const, log: [...campaign.battle.log, { round: campaign.battle.round, faction: campaign.battle.active, text: '灰牙氏族吹响撤退号角。', type: 'system' as const }] };
        setCampaign(concludeBattle({ ...campaign, battle: lost }));
      }
      return true;
    case 'reset': openDialog('reset'); return true;
    case 'reset-confirm': dialog = null; clearCampaign(); setCampaign(null, '主线已重置。'); return true;
  }
  return false;
}

app.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const element = event.target.closest<HTMLElement | SVGElement>('[data-action], [data-hex], [data-unit], [data-target], [data-mode], [data-faction], [data-deploy], [data-prisoner]');
  if (!element) return;
  if (element.dataset.hex) {
    if (!currentBattle()) return;
    const [q, r] = element.dataset.hex.split(',').map(Number);
    handleHex({ q, r });
  } else if (element.dataset.unit) {
    selectedId = element.dataset.unit;
    skillMode = false;
    render();
  } else if (element.dataset.target) {
    const unit = selected();
    if (unit && interactive()) commit({ type: skillMode ? 'skill' : 'attack', unitId: unit.id, targetId: element.dataset.target });
  } else if (element.dataset.deploy && campaign) {
    const id = element.dataset.deploy;
    const slots = deploySlots(campaign.level);
    if (!campaign.deploy.includes(id) && campaign.deploy.length >= slots) {
      notify(`本关最多出战 ${slots} 名单位，请先让一名单位待命。`, true);
      render();
    } else setCampaign(setDeploy(campaign, campaign.deploy.includes(id) ? campaign.deploy.filter(d => d !== id) : [...campaign.deploy, id]));
  } else if (element.dataset.prisoner && campaign) {
    const choice = element.dataset.choice as PrisonerChoice;
    const next = resolvePrisoner(campaign, element.dataset.prisoner, choice);
    setCampaign(next, next.chronicle.at(-1));
  } else if (element.dataset.mode) {
    setupMode = element.dataset.mode === 'local' ? 'local' : 'ai';
    render();
  } else if (element.dataset.faction) {
    setupFaction = element.dataset.faction === 'elf' ? 'elf' : 'orc';
    render();
  } else {
    const action = element.dataset.action ?? '';
    if (campaignAction(action)) return;
    switch (action) {
      case 'help': openDialog('help'); break;
      case 'new': setupMode = state.mode; setupFaction = state.player; openDialog('new'); break;
      case 'close': closeDialog(); break;
      case 'result': openDialog('victory'); break;
      case 'start':
        aiGeneration++;
        aiRunning = false;
        skirmish = createGame(setupMode, setupFaction);
        state = skirmish;
        selectedId = living(state, state.active)[0].id;
        skillMode = false;
        dialog = null;
        notify(`${FACTIONS[state.active].name}率先进入战场。${setupMode === 'local' ? '请双方轮流操作同一设备。' : `你将指挥${FACTIONS[setupFaction].name}。`}`);
        persist();
        render();
        void runAI();
        break;
      case 'end': if (interactive()) { commit({ type: 'end' }); void runAI(); } break;
      case 'skill': skillMode = !skillMode; render(); break;
      case 'coordinates': coordinates = !coordinates; render(); break;
      case 'speed': fastAI = !fastAI; render(); break;
      case 'export': exportLog(); break;
    }
  }
});

document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  if ((event.key === 'Enter' || event.key === ' ') && target instanceof SVGElement && target.dataset.hex && currentBattle()) {
    event.preventDefault();
    const [q, r] = target.dataset.hex.split(',').map(Number);
    handleHex({ q, r });
    return;
  }
  if (dialog) return;
  if (event.key.toLowerCase() === 'e' && interactive()) {
    event.preventDefault();
    commit({ type: 'end' });
    void runAI();
  } else if (event.key.toLowerCase() === 'h') openDialog('help');
  else if (event.key === 'Escape') {
    if (skillMode) skillMode = false;
    else selectedId = null;
    render();
  }
});
window.addEventListener('hashchange', () => switchView(viewFromHash()));

render();
void runAI();
