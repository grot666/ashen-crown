import { genderMark } from './art';
import { factionOf } from './engine/game';
import type { Faction, Unit, UnitKind } from './engine/types';

/** Board-token role, which decides the frame silhouette. */
export type TokenRole = 'melee' | 'ranged' | 'caster' | 'leader' | 'cavalry' | 'structure';

export const TOKEN_ROLE: Record<UnitKind, TokenRole> = {
  warlord: 'leader',
  brute: 'melee',
  raider: 'melee',
  goblin: 'melee',
  blade: 'melee',
  ranger: 'ranged',
  exile: 'ranged',
  shaman: 'caster',
  oracle: 'caster',
  warden: 'leader',
  regent: 'leader',
  goblinKnight: 'cavalry',
  totem: 'structure',
  thrall: 'melee',
  bloodKnight: 'melee',
  nightStalker: 'cavalry',
  bloodMage: 'caster',
  crimsonLord: 'leader',
};

interface Ink { fill: string; mark: string; shade: string; accent: string }

const INK: Record<Faction, Ink> = {
  orc: { fill: '#4a3f30', mark: '#f3e3b4', shade: '#1c1812', accent: '#e0b25a' },
  elf: { fill: '#243d36', mark: '#e7f6ef', shade: '#101a16', accent: '#9fd0c0' },
  vampire: { fill: '#3a1c24', mark: '#f0c9c9', shade: '#1a0c10', accent: '#c45a6a' },
};

/** Distinct frame paths, sized to sit above the HP bar (~54×66). */
const FRAME: Record<TokenRole, string> = {
  // Wide pointed banner
  leader: 'M0-36 24-22v38L0 30l-24-14v-38Z',
  // Heater shield: flat top, pointed bottom
  melee: 'M-20-28h40l3 8v28L0 32l-23-24V-20Z',
  // Arrowhead plaque, point up
  ranged: 'M0-36 26-6l-7 34-19-9-19 9-7-34Z',
  // Circle is drawn separately
  caster: '',
  // Wide horizontal hex
  cavalry: 'M0-28 28-10v22L0 28l-28-16v-22Z',
  // Chamfered square (wagon / tower)
  structure: 'M-20-30 20-30l6 6v42l-6 6h-40l-6-6V-24Z',
};

const STROKE = 'stroke-linecap="round" stroke-linejoin="round"';

/** Icon-only glyph for a kind. Fixed ink so tests can assert uniqueness. */
export function tokenGlyph(kind: UnitKind, mark = '#f3e3b4', shade = '#1c1812'): string {
  switch (kind) {
    case 'warlord':
      // Horned helm with a short crown crest
      return `<path d="M-11-18-8-30-4-18 0-32 4-18 8-30 11-18Z" fill="${mark}"/>
        <path d="M-15-16q15-8 30 0l2 12q-17 12-34 0Z" fill="${mark}"/>
        <path d="M-15-10q-14-10-16 6 8-6 16-2Zm30 0q14-10 16 6-8-6-16-2Z" fill="${mark}"/>
        <path d="M-8-8h16v3H-8Z" fill="${shade}"/>`;
    case 'brute':
      // Wide heavy shield, maul sitting clearly to the right
      return `<path d="M8-32h18v11H8Z" fill="${mark}"/>
        <path d="M14-21h6v24h-6Z" fill="${mark}"/>
        <path d="M-20-16h26l3 6v14L-7 24-23 8V-10Z" fill="${mark}"/>
        <circle cx="-7" cy="0" r="4.5" fill="${shade}"/>`;
    case 'raider':
      // Two crossed throwing axes
      return `<path d="M-16 16 12-18" stroke="${mark}" stroke-width="4" ${STROKE}/>
        <path d="M16 16-12-18" stroke="${mark}" stroke-width="4" ${STROKE}/>
        <path d="M6-28 22-22l-4 12-8-4Z" fill="${mark}"/>
        <path d="M-6-28-22-22l4 12 8-4Z" fill="${mark}"/>`;
    case 'shaman':
      // Staff and ember flame
      return `<path d="M-3-6h6v26h-6Z" fill="${mark}"/>
        <circle cx="0" cy="-12" r="8" fill="${mark}"/>
        <circle cx="0" cy="-12" r="3.5" fill="${shade}"/>
        <path d="M0-34q8 8 0 16Q-8-26 0-34Z" fill="${mark}"/>`;
    case 'goblin':
      // Snare net with a hanging hook
      return `<circle r="15" cx="0" cy="-6" fill="none" stroke="${mark}" stroke-width="3.2"/>
        <path d="M-11-16 11 4M11-16-11 4M-15-6h30" stroke="${mark}" stroke-width="2.2" ${STROKE}/>
        <path d="M0 9v10q8 6 11-2" fill="none" stroke="${mark}" stroke-width="3.2" ${STROKE}/>
        <circle cx="11" cy="16" r="3" fill="${mark}"/>`;
    case 'goblinKnight':
      // Horseshoe and a couched lance
      return `<path d="M-15-6q0-16 15-16t15 16v14q0 6-7 6-1-12-8-12t-8 12q-7 0-7-6Z" fill="${mark}"/>
        <path d="M-18 18 14-26" stroke="${mark}" stroke-width="3.6" ${STROKE}/>
        <path d="m10-32 14 5-9 8Z" fill="${mark}"/>`;
    case 'totem':
      // Wheeled cart and a flaming pillar
      return `<circle cx="-12" cy="12" r="8" fill="${mark}"/><circle cx="12" cy="12" r="8" fill="${mark}"/>
        <circle cx="-12" cy="12" r="3" fill="${shade}"/><circle cx="12" cy="12" r="3" fill="${shade}"/>
        <path d="M-18 2h36v9H-18Z" fill="${mark}"/>
        <path d="M-7-22h14v26H-7Z" fill="${mark}"/>
        <path d="M0-36q8 8 0 16Q-8-28 0-36Z" fill="${mark}"/>`;
    case 'ranger':
      // Recurve bow and nocked arrow
      return `<path d="M8-26C-16-16-16 10 8 20" fill="none" stroke="${mark}" stroke-width="4" ${STROKE}/>
        <path d="M8-26v46" stroke="${mark}" stroke-width="2" ${STROKE}/>
        <path d="M-20-3h40" stroke="${mark}" stroke-width="3" ${STROKE}/>
        <path d="m16-8 12 5-12 5Z" fill="${mark}"/>`;
    case 'blade':
      // Twin outward crescents, thick and mirrored
      return `<path d="M-1-26Q-26-4-8 24Q-20-4-1-26Z" fill="${mark}"/>
        <path d="M1-26Q26-4 8 24Q20-4 1-26Z" fill="${mark}"/>`;
    case 'oracle':
      // Thick open crescent (a clear C) with an eye in the opening
      return `<path d="M10-18A20 20 0 1 0 10 18" fill="none" stroke="${mark}" stroke-width="7.5" ${STROKE}/>
        <ellipse cx="10" cy="0" rx="7.5" ry="5.5" fill="${mark}"/>
        <circle cx="11" cy="0" r="2.6" fill="${shade}"/>`;
    case 'exile':
      // Pointed hood, coin and a short dagger
      return `<path d="M0-32 18-6v16H-18V-6Z" fill="${mark}"/>
        <circle cx="0" cy="-8" r="6" fill="${shade}"/>
        <circle cx="-6" cy="16" r="6" fill="${mark}"/>
        <circle cx="-6" cy="16" r="2.2" fill="${shade}"/>
        <path d="M8 4h5v18H8Zm-1-1h7l-3.5-8Z" fill="${mark}"/>`;
    case 'warden':
      // Tall tower shield with a tree boss
      return `<path d="M-14-26 0-34l14 8v44H-14Z" fill="${mark}"/>
        <path d="M0-16 7-2h-4v16H-3V-2h-4Z" fill="${shade}"/>
        <path d="M-8 2q8-8 16 0" fill="none" stroke="${shade}" stroke-width="2" ${STROKE}/>`;
    case 'regent':
      // Crown with separated spikes; scepter set to the side so it does not read as a tree
      return `<path d="M-18-10  -14-28 -10-10Z" fill="${mark}"/>
        <path d="M-8-10  -4-26 0-10Z" fill="${mark}"/>
        <path d="M-3-10  0-32 3-10Z" fill="${mark}"/>
        <path d="M0-10  4-26 8-10Z" fill="${mark}"/>
        <path d="M10-10  14-28 18-10Z" fill="${mark}"/>
        <path d="M-19-10h38v8H-19Z" fill="${mark}"/>
        <path d="M12 2h6v20h-6Z" fill="${mark}"/>
        <circle cx="15" cy="3" r="5.5" fill="${mark}"/>
        <circle cx="15" cy="3" r="2.2" fill="${shade}"/>`;
    case 'thrall':
      // Broken collar ring and a single fang
      return `<circle cx="0" cy="-8" r="14" fill="none" stroke="${mark}" stroke-width="3.4"/>
        <path d="M-10-2  -4 8 2-2" fill="none" stroke="${mark}" stroke-width="3.2" ${STROKE}/>
        <path d="M-2 8h10l-5 16Z" fill="${mark}"/>`;
    case 'bloodKnight':
      // Heater drop (blood) over a vertical sword
      return `<path d="M-2-32h4v36h-4Z" fill="${mark}"/>
        <path d="M-12-8h24v5H-12Z" fill="${mark}"/>
        <path d="M-8-34h16l2 6H-10Z" fill="${mark}"/>
        <path d="M0 6c-12 14-10 24 0 30 10-6 12-16 0-30Z" fill="${mark}"/>
        <circle cx="0" cy="20" r="3" fill="${shade}"/>`;
    case 'nightStalker':
      // Bat wings and a small central body
      return `<path d="M0-6C-10-28-26-22-28-8-18-16-10-8-4 4Z" fill="${mark}"/>
        <path d="M0-6C10-28 26-22 28-8 18-16 10-8 4 4Z" fill="${mark}"/>
        <ellipse cx="0" cy="2" rx="5" ry="8" fill="${mark}"/>
        <circle cx="0" cy="-4" r="4" fill="${mark}"/>
        <circle cx="0" cy="-4" r="1.6" fill="${shade}"/>`;
    case 'bloodMage':
      // Chalice with a drop above the rim
      return `<path d="M-12-16h24l-3 10H-9Z" fill="${mark}"/>
        <path d="M-7-6q7 14 0 18h14q-7-4 0-18" fill="${mark}"/>
        <path d="M-3 12h6v10h-6Z" fill="${mark}"/>
        <path d="M-10 22h20v4H-10Z" fill="${mark}"/>
        <path d="M0-32c-7 10-6 16 0 20 6-4 7-10 0-20Z" fill="${mark}"/>`;
    case 'crimsonLord':
      // Low three-point circlet and a vertical blood drop
      return `<path d="M-16-8-10-24-4-8Z" fill="${mark}"/>
        <path d="M-4-8 0-28 4-8Z" fill="${mark}"/>
        <path d="M4-8 10-24 16-8Z" fill="${mark}"/>
        <path d="M-17-8h34v6H-17Z" fill="${mark}"/>
        <path d="M0-2c-8 12-7 20 0 26 7-6 8-14 0-26Z" fill="${mark}"/>
        <circle cx="0" cy="12" r="2.4" fill="${shade}"/>`;
  }
}

function frame(role: TokenRole, fill: string): string {
  if (role === 'caster') return `<circle class="token-border" cx="0" cy="-4" r="27" fill="${fill}" stroke-width="1.5"/>`;
  return `<path class="token-border" d="${FRAME[role]}" fill="${fill}" stroke-width="1.5"/>`;
}

function genderPip(mark: string, accent: string, fill: string): string {
  return `<g class="token-gender" pointer-events="none" transform="translate(21 16)">
    <circle r="7.2" fill="${fill}" stroke="${accent}" stroke-width="1.3"/>
    <text y="4.2" text-anchor="middle" font-size="11" font-weight="700" fill="${accent}">${mark}</text>
  </g>`;
}

/** Complete board token: owner-colored frame, unique glyph, optional gender pip. */
export function tokenMark(unit: Unit): string {
  const ink = INK[factionOf(unit)];
  const role = TOKEN_ROLE[unit.kind];
  const gender = genderMark(unit);
  return `${frame(role, ink.fill)}
    <g class="token-glyph" pointer-events="none">${tokenGlyph(unit.kind, ink.mark, ink.shade)}</g>
    ${gender ? genderPip(gender, ink.accent, ink.shade) : ''}`;
}
