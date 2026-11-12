import { portrait, unitLabel } from './art';
import { TERRAIN, UNITS } from './engine/content';
import { canAttack, canSkill, factionOf, goblinSnare, isCampaign, living, maxAp, maxHp, reachable, scenarioFor } from './engine/game';
import { equal, key, pixel } from './engine/hex';
import type { GameState, Terrain, Unit } from './engine/types';

const points = Array.from({ length: 6 }, (_, i) => {
  const angle = (60 * i - 30) * Math.PI / 180;
  return `${(43 * Math.cos(angle)).toFixed(2)},${(43 * Math.sin(angle)).toFixed(2)}`;
}).join(' ');
const trees = (seed: number): string => [-18, 0, 17].map((x, i) => {
  const y = (i === 1 ? -14 : -2) + seed % 6;
  return `<g transform="translate(${x} ${y})"><path d="M0 5v14" stroke="#73765a" stroke-width="2"/><path d="m0-23-11 20h5L-15 7h30L6-3h5Z" fill="${i === 1 ? '#566d54' : '#435c49'}" stroke="#6b7b5d" stroke-width=".6"/><path d="M0-19v24" stroke="#819072" stroke-opacity=".25"/></g>`;
}).join('');
function terrainArt(terrain: Terrain, seed: number): string {
  if (terrain === 'forest') return trees(seed);
  if (terrain === 'ridge') return '<path d="m-31 13 17-32 13 12 10-20 23 40Z" fill="#727367" stroke="#91917b" stroke-width="1"/><path d="m-14-19 2 19 11-7m10-20 3 25 20 15" fill="none" stroke="#414d43" stroke-width="2"/><path d="m9-27-6 14 8-3 7 5Z" fill="#a2a08a" opacity=".65"/>';
  if (terrain === 'ruins') return '<path d="m-25 16 29-17 24 15L-1 30Z" fill="#7a7860" stroke="#999078" stroke-width=".7"/><path d="M-19 14V-8l8-5 7 4v22m15 2v-36l8 3v29" fill="#8b8770" stroke="#b3a68a" stroke-width="1"/><path d="m-19-8 8 4 7-5M11-21l8 3M-11-4v20" fill="none" stroke="#474f43" stroke-width="1.5"/><path d="m-3 21 9-5 8 4" fill="none" stroke="#444d40"/>';
  if (terrain === 'water') return '<path d="m-25-3 12-6 16 4 18-5M-24 8l13-3L4 9l19-5M-12 18l13-2 13 3" fill="none" stroke="#829e90" stroke-width="1" opacity=".5"/><path d="m-26 20-2-9m4 6 2-6m41-24 2-8m3 12 2-7" stroke="#73856c" stroke-width="1.5"/>';
  return `<path d="m${-21 + seed % 14} 10 5-2m11-21 4 1m-2 30 7-1" stroke="#9d9873" stroke-width="1" opacity=".27"/><path d="m-10 8 1-6m0 4 3-2" stroke="#9b9d6d" opacity=".35"/>`;
}
export interface BoardOptions { selected: Unit | undefined; skill: boolean; coordinates: boolean; interactive: boolean }
export function renderBoard(state: GameState, options: BoardOptions): string {
  const { selected, skill, coordinates, interactive } = options;
  const moves = selected && factionOf(selected) === state.active && interactive && !skill ? reachable(state, selected) : new Map<string, number>();
  const targets = selected && interactive ? living(state).filter(t => skill ? canSkill(state, selected, t) : canAttack(state, selected, t)) : [];
  const scenario = scenarioFor(state);
  const scale = 4 / scenario.radius;
  const altar = scenario.objective.altar;
  const goals = scenario.objective.goal ?? [];
  const campaign = isCampaign(state);
  return `<svg class="battle-map" viewBox="0 0 800 680" role="group" aria-label="${scenario.name}六角战场，点击单位选择，点击高亮格移动，点击红色目标攻击">
    <defs>
      <radialGradient id="ground"><stop stop-color="#455344" stop-opacity=".3"/><stop offset="1" stop-color="#1b241e" stop-opacity="0"/></radialGradient>
      <linearGradient id="tile-plain" x2=".6" y2="1"><stop stop-color="#46513d"/><stop offset="1" stop-color="#374535"/></linearGradient>
      <linearGradient id="tile-forest" x2=".7" y2="1"><stop stop-color="#344b3b"/><stop offset="1" stop-color="#293e31"/></linearGradient>
      <linearGradient id="tile-ridge" x2=".7" y2="1"><stop stop-color="#51564a"/><stop offset="1" stop-color="#3e493e"/></linearGradient>
      <linearGradient id="tile-ruins" x2=".7" y2="1"><stop stop-color="#686650"/><stop offset="1" stop-color="#4f5743"/></linearGradient>
      <linearGradient id="tile-water" x2=".7" y2="1"><stop stop-color="#2a4946"/><stop offset="1" stop-color="#213e39"/></linearGradient>
      <filter id="unit-shadow" x="-40%" y="-30%" width="180%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="3" flood-opacity=".5"/></filter>
    </defs>
    <ellipse cx="400" cy="350" rx="395" ry="320" fill="url(#ground)"/>
    <g class="map-decoration" fill="none" stroke="#b7a57b" stroke-width=".7" opacity=".23">
      <path d="M400 15v20m0 580v35M25 333h25m700 0h25"/><circle cx="400" cy="333" r="309" stroke-dasharray="2 12"/>
      <path d="m385 28 15-15 15 15m-30 612 15 15 15-15M31 318l-15 15 15 15m738-30 15 15-15 15"/>
    </g>
    <text x="400" y="46" text-anchor="middle" class="map-direction">N</text>
    <text x="76" y="605" class="map-place">THE ASHEN MARCHES</text>
    <text x="724" y="605" text-anchor="end" class="map-place">${scenario.english.toUpperCase()}${campaign ? '' : ' · IV'}</text>
    <g transform="translate(400 333) scale(${scale})">
      ${state.tiles.map((tile, i) => {
        const { x, y } = pixel(tile);
        const reachableCost = moves.get(key(tile));
        const selectedTile = selected && equal(tile, selected);
        return `<g class="hex ${reachableCost !== undefined ? 'reachable' : ''} ${selectedTile ? 'selected-hex' : ''}" transform="translate(${x} ${y})" data-hex="${key(tile)}" role="button" tabindex="${interactive ? 0 : -1}" aria-label="${TERRAIN[tile.terrain].name} ${key(tile)}${reachableCost !== undefined ? `，可移动，消耗 ${reachableCost} AP` : ''}">
          <title>${TERRAIN[tile.terrain].name} · ${TERRAIN[tile.terrain].description}${reachableCost !== undefined ? ` · 到达消耗 ${reachableCost} AP` : ''}</title>
          <polygon points="${points}" transform="translate(0 5)" fill="#17261d" stroke="#17231c" stroke-width="2"/>
          <polygon class="tile-surface" points="${points}" fill="url(#tile-${tile.terrain})" stroke="#7d8564" stroke-opacity=".36" stroke-width="1"/>
          <g class="terrain-art" pointer-events="none">${terrainArt(tile.terrain, i)}</g>
          ${altar && equal(altar, tile) ? '<g class="altar-mark" pointer-events="none"><circle r="27" fill="none" stroke="#9fd0c0" stroke-width="2" stroke-dasharray="4 5"/><circle r="11" fill="#9fd0c055"/><path d="M0-9v18M-9 0h18" stroke="#d8f0e6" stroke-width="1.5"/></g>' : ''}
          ${goals.some(g => equal(g, tile)) ? '<g class="goal-mark" pointer-events="none"><polygon points="' + points + '" transform="scale(.82)" fill="#e2c59022" stroke="#e2c590" stroke-width="2" stroke-dasharray="5 4"/><path d="M-6 8V-12l14 4-14 5" fill="#e2c590"/></g>' : ''}
          ${reachableCost !== undefined ? `<polygon class="move-overlay" points="${points}"/><text class="move-cost" x="0" y="7" text-anchor="middle">${reachableCost}<tspan font-size="8" dx="2">AP</tspan></text>` : ''}
          ${selectedTile ? `<polygon class="selection-ring" points="${points}"/>` : ''}
          ${coordinates ? `<text class="coordinate" x="0" y="32" text-anchor="middle">${key(tile)}</text>` : ''}
        </g>`;
      }).join('')}
      ${living(state).sort((a, b) => a.r - b.r).map(unit => {
        const def = UNITS[unit.kind];
        const { x, y } = pixel(unit);
        const target = targets.some(t => t.id === unit.id);
        const hpMax = maxHp(unit);
        const apMax = maxAp(unit);
        const recruit = def.faction !== factionOf(unit);
        return `<g transform="translate(${x} ${y})" class="map-unit ${factionOf(unit)} ${unit.role ?? ''} ${recruit ? 'recruit' : ''} ${selected?.id === unit.id ? 'chosen' : ''} ${target ? (skill && factionOf(unit) === state.active ? 'heal-target' : 'attack-target') : ''} ${unit.ap < def.attackCost ? 'spent' : ''}" data-hex="${key(unit)}" data-unit-id="${unit.id}" role="button" tabindex="0" aria-label="${unitLabel(unit)}${target ? skill ? '，可施放技能' : '，可攻击' : ''}" filter="url(#unit-shadow)">
          <title>${unitLabel(unit)}</title>
          <ellipse cx="0" cy="19" rx="26" ry="13" fill="#0b120e" opacity=".55"/>
          <path class="token-border" d="m0-37 27 15v38L0 33-27 16v-38Z" fill="${factionOf(unit) === 'orc' ? '#786246' : '#62877a'}" stroke-width="1.5"/>
          <g transform="translate(-25 -34) scale(.4167)">${portrait(unit, false, true)}</g>
          <path class="target-corners" d="M-31-18v-10h10m42 0h10v10M-31 9v10h10m42 0h10V9" fill="none" stroke-width="2"/>
          <rect x="-23" y="25" width="46" height="5" rx="2" fill="#18221c" stroke="#131d17" stroke-width="1"/>
          <rect x="-23" y="25" width="${46 * unit.hp / hpMax}" height="5" rx="2" fill="${unit.hp < hpMax * .35 ? '#d79b73' : factionOf(unit) === 'orc' ? '#c3a16a' : '#83b99e'}"/>
          ${Array.from({ length: apMax }, (_, i) => `<circle cx="${(i - (apMax - 1) / 2) * 7}" cy="36" r="2" fill="${i < unit.ap ? '#e2c99a' : '#435044'}"/>`).join('')}
          ${recruit ? '<g class="recruit-badge"><circle cx="22" cy="-30" r="7" fill="#3c3528" stroke="#e2c590"/><text x="22" y="-27" text-anchor="middle" font-size="8" fill="#e2c590">降</text></g>' : ''}
          ${target && selected && goblinSnare(selected, unit) && isCampaign(state) ? '<g class="snare-badge"><circle cx="-22" cy="-30" r="7" fill="#4a2f16" stroke="#ffcf7a"/><text x="-22" y="-27" text-anchor="middle" font-size="8" fill="#ffcf7a">擒</text></g>' : ''}
          ${unit.role === 'boss' ? '<path d="m-12-44 4-8 4 5 4-7 4 7 4-5 4 8Z" fill="#e2d397" stroke="#7d6c3f"/>' : ''}
          ${unit.statuses?.some(s => s.id === 'slowed') ? '<circle cx="-22" cy="-30" r="5" fill="#6f87a8" stroke="#c7d6ea"/>' : ''}
          ${selected?.id === unit.id ? '<path class="unit-pointer" d="m-5-46 5 6 5-6" fill="#e1c38a"/>' : ''}
        </g>`;
      }).join('')}
    </g>
  </svg>`;
}
