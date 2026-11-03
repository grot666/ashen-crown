import './style.css';
import { crest, icons, portrait } from './art';
import { renderBoard } from './board';
import { chooseAction } from './engine/ai';
import { FACTIONS, TERRAIN, UNITS } from './engine/content';
import { applyAction, canAttack, canSkill, factionOf, isAITurn, living, tileAt, unitAt } from './engine/game';
import { createGame } from './engine/game';
import type { Action, Faction, GameState, Hex, Unit } from './engine/types';
import { loadGame, saveGame } from './storage';

const app = document.querySelector<HTMLDivElement>('#app')!;
const loaded = loadGame();
let state = loaded.status === 'loaded' ? loaded.state : createGame();
let selectedId: string | null = living(state, state.active)[0]?.id ?? null;
let skillMode = false;
let coordinates = false;
let fastAI = false;
let aiGeneration = 0;
let aiRunning = false;
let saveFailed = false;
let notice = loaded.status === 'error' ? loaded.message : loaded.status === 'loaded' ? '已恢复本地战役。每次行动都会自动保存。' : '指挥官，选择金色单位，再点击高亮格移动。敌军进入射程后，点击红色目标攻击。';
let noticeError = loaded.status === 'error';
let dialog: 'new' | 'help' | 'victory' | null = state.winner ? 'victory' : null;
let setupMode: GameState['mode'] = 'ai';
let setupFaction: Faction = 'orc';
let boardScroll = 0;
let lastFocus: HTMLElement | null = null;
const escapeHTML = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const selected = (): Unit | undefined => state.units.find(u => u.id === selectedId && u.hp > 0);
const interactive = (): boolean => !state.winner && !isAITurn(state);
const pip = (unit: Unit): string => `<span class="ap-pips">${Array.from({ length: UNITS[unit.kind].ap }, (_, i) => `<i class="${i < unit.ap ? 'filled' : ''}"></i>`).join('')}</span>`;

function roster(faction: Faction): string {
  return `<div class="roster ${faction}">
    <div class="roster-heading"><span>${faction === 'orc' ? 'I' : 'II'} / ${FACTIONS[faction].name}</span><span>${living(state, faction).length} / 5</span></div>
    ${state.units.filter(u => factionOf(u) === faction).map(u => {
      const def = UNITS[u.kind];
      return `<button class="roster-unit ${u.id === selectedId ? 'active' : ''} ${u.hp === 0 ? 'fallen' : ''}" data-unit="${u.id}" ${u.hp === 0 ? 'disabled' : ''} aria-label="查看${def.name}" aria-pressed="${u.id === selectedId}">
        <span class="roster-portrait">${portrait(u)}</span>
        <span class="roster-info"><strong>${def.name}</strong><span>${u.hp === 0 ? '已阵亡' : `${u.hp} / ${def.hp} HP`}</span></span>
        ${u.hp > 0 ? pip(u) : '<span class="fallen-mark">×</span>'}
      </button>`;
    }).join('')}
  </div>`;
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
  return `<div class="unit-art ${faction}">
      <div class="portrait-runes">✦<span>ᛟ</span>✦</div>${portrait(unit, true)}
      <span class="unit-banner">${FACTIONS[faction].title}</span>
      <span class="unit-level">I</span>
    </div>
    <div class="unit-details">
      <div class="eyebrow">${faction === state.active ? '当前军团' : '敌方军团'} <span> / </span> ${def.role}</div>
      <h2>${def.name}</h2>
      <div class="health-label"><span>生命值</span><strong>${unit.hp}<small> / ${def.hp}</small></strong></div>
      <div class="health-track"><span style="width:${100 * unit.hp / def.hp}%"></span></div>
      <div class="stat-grid">
        <div>${icons.sword}<strong>${def.attack}</strong><span>攻击</span></div>
        <div>${icons.shield}<strong>${def.armor}</strong><span>护甲</span></div>
        <div>${icons.arrow}<strong>${def.range}</strong><span>射程</span></div>
      </div>
      <div class="action-points"><span>行动点</span>${pip(unit)}<strong>${unit.ap}<small> / ${def.ap}</small></strong></div>
      <div class="skill-heading"><span>专属技能</span><small>${unit.cooldown ? `冷却 ${unit.cooldown} 个己方回合` : '已就绪'}</small></div>
      <button class="skill-button ${skillMode ? 'armed' : ''}" data-action="skill" ${!skillReady ? 'disabled' : ''} aria-pressed="${skillMode}">
        <span class="skill-icon">${icons.spark}</span><span><strong>${def.skill.name}</strong><small>${def.skill.cost} AP · 射程 ${def.skill.range} · 冷却 ${def.skill.cooldown}</small></span>${icons.chevron}
      </button>
      <p class="skill-description">${def.skill.description}</p>
      ${skillMode ? `<div class="target-hint">选择${def.skill.effect === 'heal' ? '绿色友方' : '红色敌方'}目标施放 · 再次点击取消</div>` : ''}
      ${own && targets.length ? `<div class="target-list"><span>可${skillMode ? '施法' : '攻击'}目标</span>${targets.map(t => `<button data-target="${t.id}">${UNITS[t.kind].name}${icons.chevron}</button>`).join('')}</div>` : ''}
      <div class="terrain-note">${icons.tree}<span><strong>${TERRAIN[terrain.terrain].name}</strong><small>${TERRAIN[terrain.terrain].description}</small></span></div>
    </div>`;
}

function dialogContent(): string {
  if (dialog === 'new') return `
    <span class="eyebrow">A NEW CHAPTER</span><h2>战火，再度燃起。</h2><p class="dialog-lead">黑棘隘口没有永恒的王。选择你的旗帜，写下这一夜的结局。</p>
    <h3 class="field-label">对局模式</h3><div class="segmented">
      <button data-mode="ai" class="${setupMode === 'ai' ? 'active' : ''}" aria-pressed="${setupMode === 'ai'}">对抗战术 AI<small>独自指挥一支军团</small></button>
      <button data-mode="local" class="${setupMode === 'local' ? 'active' : ''}" aria-pressed="${setupMode === 'local'}">本地双人<small>同屏轮流指挥双方</small></button>
    </div>
    <h3 class="field-label">${setupMode === 'ai' ? '你的阵营' : '首位指挥官 · 兽人固定先行'}</h3>
    <div class="faction-options">${(['orc', 'elf'] as const).map(f => `<button data-faction="${f}" class="${f} ${setupFaction === f ? 'active' : ''}" aria-pressed="${setupFaction === f}">${crest(f)}<strong>${FACTIONS[f].name}</strong><small>${f === 'orc' ? '坚甲 · 近战 · 压迫' : '远射 · 机动 · 精准'}</small></button>`).join('')}</div>
    <p class="fine-print">当前进度将被替换。兽人先行；每阵营 5 个单位。所有战斗均在本地运行。</p>
    <button class="primary start-battle" data-action="start">${icons.sword}部署军团，进入战场</button>`;
  if (dialog === 'help') return `
    <span class="eyebrow">THE COMMANDER'S FIELD GUIDE</span><h2>在灰烬中，学会取胜。</h2>
    <div class="rules-grid">
      <section><span class="rule-number">01</span><h3>每一点行动，皆有代价</h3><p>点击己方单位，再点金色格移动。AP 是移动、攻击、技能共用的资源。普通单位每回合 3 AP，游击单位 4 AP；攻击与技能均消耗 2 AP。可多次行动，AP 耗尽后点击「结束回合」。</p></section>
      <section><span class="rule-number">02</span><h3>占据地利，而非只求先手</h3><p>荒原 / 王墟移动 1 AP，密林 / 高地移动 2 AP。密林防御 +2；王墟、高地防御 +1。高地上的远程单位普通攻击伤害 +2。深潭不可通行；单位阻挡移动，高地阻挡中间射线。</p></section>
      <section><span class="rule-number">03</span><h3>预判你的下一击</h3><p>红色角标为可攻击目标。普通伤害 = 攻击 + 高地加成 − 护甲 − 地形防御，最低 2。技能无视防御；治疗不能复活。技能冷却在己方回合开始时减 1，因此冷却 2 会跳过下一己方回合。</p></section>
      <section><span class="rule-number">04</span><h3>让最后一面旗帜属于你</h3><p>消灭全部敌军即获胜，统帅阵亡并不立即结束战役。兽人先行，双方各行动一次为一轮；40 轮后仍未决出胜负则平局。AI 会考虑集火、击杀、治疗、地形与威胁；没有战争迷雾或命中随机。</p></section>
    </div>
    <div class="key-guide"><span><kbd>E</kbd> 结束回合</span><span><kbd>Esc</kbd> 取消技能 / 选择</span><span><kbd>H</kbd> 战地手册</span><span><kbd>Tab</kbd> + <kbd>Enter</kbd> 键盘操作</span></div>
    <p class="fine-print">21+ 主题定位 · 原创暗黑奇幻世界，包含战争与死亡的非写实描述，无露骨画面；并非官方年龄分级。自动存档仅保存在当前浏览器，无账号、无追踪、无网络对战。</p>
    <button class="primary" data-action="close">我已准备就绪</button>`;
  const winner = state.winner;
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
  const own = interactive();
  app.innerHTML = `
    <header class="masthead">
      <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="灰烬王冠首页"><span class="brand-mark">${icons.crown}</span><span>ASHEN CROWN<small>灰 烬 王 冠</small></span></a>
      <nav aria-label="主导航"><span class="nav-active">战役 <span class="nav-dot"></span></span><button data-action="help">战地手册 <kbd>H</kbd></button><a href="https://github.com/grot666/ashen-crown" target="_blank" rel="noopener noreferrer">源代码 ↗</a></nav>
      <span class="edition">CHAPTER I <i></i> ORCS & ELVES</span>
    </header>
    <main>
      <section class="campaign-heading">
        <div><div class="eyebrow"><span class="tiny-line"></span> THE ASHEN MARCHES <span class="muted"> / 第一章</span></div><h1>黑棘隘口<span>Blackthorn Pass</span></h1><p>旧王已死。新的秩序，始于灰烬。</p></div>
        <div class="campaign-actions"><span class="mode-tag"><i></i>${state.mode === 'ai' ? '单人 · 战术 AI' : '本地双人 · 同屏对弈'}</span><button class="outline-button" data-action="new">${icons.flag}新战役</button></div>
      </section>
      <section class="war-table" aria-label="战棋对局">
        <aside class="army-panel">
          <div class="panel-label"><span>参战军团</span><small>ORDER OF BATTLE</small></div>
          <div class="faction-summary orc">${crest('orc')}<span><strong>灰牙氏族</strong><small>铁与火，铸成王座。</small></span><span class="faction-count">${living(state, 'orc').length}<small>UNITS</small></span></div>
          ${roster('orc')}
          <div class="armies-divider"><span>VS</span></div>
          <div class="faction-summary elf">${crest('elf')}<span><strong>暮誓王庭</strong><small>月下的誓言，未曾凋零。</small></span><span class="faction-count">${living(state, 'elf').length}<small>UNITS</small></span></div>
          ${roster('elf')}
          <div class="army-footnote">${icons.shield}<span>无随机命中 · 无氪金<br/>只有你的决策</span></div>
        </aside>
        <section class="battlefield">
          <div class="battle-toolbar"><div class="turn-badge ${state.active}"><i></i>${state.winner ? '战役结束' : `${FACTIONS[state.active].name}回合`}</div><div class="round-label">ROUND <strong>${String(Math.min(state.round, 40)).padStart(2, '0')}</strong><span>/ 40</span></div><button class="coordinate-toggle ${coordinates ? 'on' : ''}" data-action="coordinates" aria-pressed="${coordinates}" title="显示或隐藏坐标">⌗<span>坐标</span></button></div>
          <div class="map-scroll">${renderBoard(state, { selected: selected(), skill: skillMode, coordinates, interactive: own })}</div>
          <div class="battle-atmosphere" aria-hidden="true"><span>✦</span> CROWNS FALL. ASHES REMAIN. <span>✦</span></div>
          <div class="battle-bottom"><div class="map-legend"><span><i class="legend-move"></i>可移动</span><span><i class="legend-attack"></i>可攻击</span><span><i class="legend-selected"></i>已选择</span></div><button class="speed-button" data-action="speed" aria-pressed="${fastAI}">AI ${fastAI ? '2×' : '1×'}</button></div>
          <div class="turn-controls"><div class="turn-instruction"><span class="pulse ${isAITurn(state) ? 'thinking' : ''}"></span><span><strong>${state.winner ? '尘埃落定' : isAITurn(state) ? '敌方正在部署战术…' : skillMode ? '选择技能目标' : '轮到你了，指挥官'}</strong><small>${state.winner ? '查看战报，或开启新的战役' : isAITurn(state) ? '正在分析目标、地形与战线' : skillMode ? '点击高亮单位施放，Esc 取消' : '选择单位 → 移动 / 攻击 / 技能'}</small></span></div><button class="end-turn primary" data-action="${state.winner ? 'result' : 'end'}" ${!own && !state.winner ? 'disabled' : ''}>${state.winner ? icons.crown : icons.end}<span>${state.winner ? '战役结算' : '结束回合'}</span>${!state.winner ? '<kbd>E</kbd>' : ''}</button></div>
        </section>
        <aside class="inspector"><div class="panel-label"><span>单位档案</span><small>UNIT DOSSIER</small></div>${unitPanel()}</aside>
      </section>
      <div class="notice ${noticeError ? 'error' : ''}" role="status" aria-live="polite"><span>${noticeError ? '!' : '✧'}</span><span>${escapeHTML(notice)}</span><small>${saveFailed ? '本地保存不可用' : '本地自动存档'}</small></div>
      <section class="lower-grid">
        <section class="battle-journal"><div class="section-title"><h2><span class="tiny-line"></span>战斗纪事 <small>BATTLE CHRONICLE</small></h2><span>最近 ${Math.min(state.log.length, 6)} 条 / ${state.log.length} 条</span></div>
          <div class="journal-entries" role="log" aria-label="战斗日志">${state.log.slice(-6).reverse().map(entry => `<div class="journal-entry ${entry.type}"><span class="log-round">${String(Math.min(entry.round, 40)).padStart(2, '0')}</span><span class="log-dot ${entry.faction}"></span><p>${escapeHTML(entry.text)}</p><span class="log-kind">${({ system: '军令', move: '行军', attack: '交锋', skill: '技能', death: '阵亡' })[entry.type]}</span></div>`).join('')}</div>
          <button class="text-button export-log" data-action="export">导出完整战报 ↓</button>
        </section>
        <aside class="field-notes"><span class="eyebrow">KNOW YOUR BATTLEFIELD</span><h2>地形，即是无声的盟友。</h2><p>密林掩护锋线，高地成就远射。每一步都在改变下一次交锋的结局。</p><div class="terrain-key"><span><i class="forest"></i>密林 <small>防御 +2</small></span><span><i class="ridge"></i>高地 <small>远攻 +2</small></span><span><i class="ruins"></i>王墟 <small>防御 +1</small></span><span><i class="water"></i>深潭 <small>不可通行</small></span></div><button class="text-button" data-action="help">翻阅战地手册 ${icons.chevron}</button></aside>
      </section>
    </main>
    <footer><span>${icons.crown} ASHEN CROWN <small>灰烬王冠</small></span><p>原创奇幻战棋 · 第一章：兽人与精灵 <span> / </span> 21+ 主题 · 非官方评级</p><a href="https://grot666.github.io/">GROT666 的项目集 ↗</a></footer>
    <dialog class="game-dialog ${dialog === 'help' ? 'help-dialog' : ''}" aria-label="${dialog === 'new' ? '配置新战役' : dialog === 'help' ? '战地手册' : '战役结算'}"><button class="dialog-close" data-action="close" aria-label="关闭弹窗">${icons.cross}</button>${dialog ? dialogContent() : ''}</dialog>
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

function notify(text: string, error = false): void {
  notice = text;
  noticeError = error;
}
function persist(): void {
  const ok = saveGame(state);
  saveFailed = !ok;
  if (!ok) notify('浏览器拒绝保存进度；请勿关闭本页，以免丢失当前战役。', true);
}
function commit(action: Action): boolean {
  const result = applyAction(state, action);
  if (!result.ok) {
    notify(result.error, true);
    render();
    return false;
  }
  state = result.state;
  skillMode = false;
  if (action.type === 'end') {
    selectedId = living(state, state.active)[0]?.id ?? null;
    notify(`${FACTIONS[state.active].name}开始行动。${isAITurn(state) ? 'AI 正在思考。' : '行动点已恢复。'}`);
  } else {
    const last = state.log.at(-1)!;
    notify(last.text);
  }
  if (state.winner) dialog = 'victory';
  persist();
  render();
  return true;
}

async function runAI(): Promise<void> {
  if (aiRunning || !isAITurn(state)) return;
  aiRunning = true;
  const generation = aiGeneration;
  let steps = 0;
  while (isAITurn(state) && generation === aiGeneration) {
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
    notify(`已选择${UNITS[target.kind].name}。金色格可移动；红色目标可攻击。`);
    render();
  } else if (target && unit && factionOf(unit) === state.active && canAttack(state, unit, target)) {
    commit({ type: 'attack', unitId: unit.id, targetId: target.id });
  } else if (target) {
    selectedId = target.id;
    skillMode = false;
    notify(`正在检视${UNITS[target.kind].name}。选择己方单位后，靠近敌军再发起攻击。`);
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

function openDialog(kind: NonNullable<typeof dialog>): void {
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
  const text = `灰烬王冠 · 黑棘隘口\n${state.mode === 'ai' ? '战术 AI' : '本地双人'} · 第 ${Math.min(state.round, 40)} 轮\n${state.winner ? state.winner === 'draw' ? '平局' : `${FACTIONS[state.winner].name}胜利` : '战役进行中'}\n\n` +
    state.log.map(l => `[${l.round}] ${FACTIONS[l.faction].name} · ${l.text}`).join('\n') +
    '\n\n灰烬王冠 · ASHEN CROWN\n';
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ashen-crown-battle-report.txt';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

app.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const element = event.target.closest<HTMLElement | SVGElement>('[data-action], [data-hex], [data-unit], [data-target], [data-mode], [data-faction]');
  if (!element) return;
  if (element.dataset.hex) {
    const [q, r] = element.dataset.hex.split(',').map(Number);
    handleHex({ q, r });
  } else if (element.dataset.unit) {
    selectedId = element.dataset.unit;
    skillMode = false;
    render();
  } else if (element.dataset.target) {
    const unit = selected();
    if (unit && interactive()) commit({ type: skillMode ? 'skill' : 'attack', unitId: unit.id, targetId: element.dataset.target });
  } else if (element.dataset.mode) {
    setupMode = element.dataset.mode === 'local' ? 'local' : 'ai';
    render();
  } else if (element.dataset.faction) {
    setupFaction = element.dataset.faction === 'elf' ? 'elf' : 'orc';
    render();
  } else {
    switch (element.dataset.action) {
      case 'help': openDialog('help'); break;
      case 'new': setupMode = state.mode; setupFaction = state.player; openDialog('new'); break;
      case 'close': closeDialog(); break;
      case 'result': openDialog('victory'); break;
      case 'start':
        aiGeneration++;
        aiRunning = false;
        state = createGame(setupMode, setupFaction);
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
  if ((event.key === 'Enter' || event.key === ' ') && target instanceof SVGElement && target.dataset.hex) {
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

render();
void runAI();
