import { factionOf, genderOf, maxHp, nameOf } from './engine/game';
import { portraitSvg } from './portraits';
import { UNITS } from './engine/content';
import type { Faction, Gender, Unit, UnitKind } from './engine/types';

export const crown = '<path d="m4 8 6 5 6-10 6 10 6-5-3 17H7Z"/><path d="M9 21h14M16 8v9"/>';
export const icon = (paths: string, cls = ''): string =>
  `<svg class="icon ${cls}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
export const icons = {
  crown: icon(crown),
  sword: icon('<path d="m8 25 4-4M7 18l7 7M12 20 24 4l3 1-1 5-12 13M5 27l4-4"/>'),
  shield: icon('<path d="m16 3 11 5v9c0 6-11 12-11 12S5 23 5 17V8Z"/><path d="M16 8v14M11 13h10"/>'),
  arrow: icon('<path d="M5 27 27 5M16 5h11v11M5 20v7h7"/>'),
  spark: icon('<path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/>'),
  end: icon('<path d="M7 7h13a8 8 0 0 1 0 16H8M13 18l-5 5 5 5M7 3v8"/>'),
  help: icon('<circle cx="16" cy="16" r="12"/><path d="M12 12a4 4 0 1 1 6 4c-2 1-2 2-2 3M16 23h.01"/>'),
  cross: icon('<path d="m8 8 16 16M24 8 8 24"/>'),
  flag: icon('<path d="M7 28V4l18 3-4 7 4 7-18-3"/>'),
  tree: icon('<path d="m16 3-7 9h4l-7 9h8v8h4v-8h8l-7-9h4Z"/>'),
  chevron: icon('<path d="m12 7 9 9-9 9"/>'),
};

export function crest(faction: Faction, className = ''): string {
  return `<svg class="crest ${className}" viewBox="0 0 80 90" aria-hidden="true">
    <path d="m40 3 32 13-4 42-28 27L12 58 8 16Z" fill="${faction === 'orc' ? '#322b22' : '#1f3430'}" stroke="currentColor" stroke-width="1.2"/>
    <path d="m40 9 26 11-4 35-22 23-22-23-4-35Z" fill="none" stroke="currentColor" stroke-opacity=".25"/>
    ${faction === 'orc' ? '<path d="m20 31 12 5 8-16 8 16 12-5-7 25-13 12-13-12Z" fill="currentColor" opacity=".8"/><path d="m28 43 8 3-3 5Zm24 0-8 3 3 5Z" fill="#22251f"/><path d="m32 60 2-9 6 5 6-5 2 9" fill="#22251f"/>' :
      '<path d="M40 17c-19 17-22 32 0 49 22-17 19-32 0-49Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 26v43M23 37l17 14 17-14M27 29l13 11 13-11M31 57l9-10 9 10" fill="none" stroke="currentColor" stroke-width="2"/>'}
  </svg>`;
}

const ORC_PORTRAITS: Partial<Record<UnitKind, string>> = {
  warlord: 'warlord.jpg',
  brute: 'brute.jpg',
  raider: 'raider.jpg',
  shaman: 'shaman.jpg',
  goblin: 'goblin.jpg',
  goblinKnight: 'goblin.jpg',
  totem: 'orc-generic.jpg',
};

const ELF_PORTRAITS: Partial<Record<UnitKind, Record<Gender, string>>> = {
  ranger: { female: 'ranger-f.jpg', male: 'ranger-m.jpg' },
  blade: { female: 'blade-f.jpg', male: 'blade-m.jpg' },
  oracle: { female: 'oracle-f.jpg', male: 'oracle-m.jpg' },
  exile: { female: 'exile-f.jpg', male: 'exile-m.jpg' },
  warden: { female: 'warden-f.jpg', male: 'warden-m.jpg' },
  regent: { female: 'regent-f.jpg', male: 'regent-m.jpg' },
};

/** Filename under assets/portraits/, or undefined when only the SVG fallback exists. */
export function portraitFile(unit: Unit): string | undefined {
  const gender = genderOf(unit);
  if ((UNITS[unit.kind].faction === 'elf' || unit.kind === 'exile') && gender) {
    return ELF_PORTRAITS[unit.kind]?.[gender];
  }
  return ORC_PORTRAITS[unit.kind];
}

/** Face/species follows the unit kind; banner colours follow the owner, so recruits read as allies.
 *  Prefer a PNG when one is mapped; if the file is missing the sibling SVG is shown.
 *  Pass `embedInSvg` when inserting into the board <svg>, so the bitmap lives in a foreignObject. */
export function portrait(unit: Unit, large = false, embedInSvg = false): string {
  const svg = portraitSvg(unit.kind, factionOf(unit), genderOf(unit), large);
  const png = portraitFile(unit);
  if (!png) return svg;
  const cls = large ? 'portrait-large' : embedInSvg ? 'portrait' : 'roster-portrait-img';
  const fallback = svg.replace('<svg ', '<svg hidden ');
  const img = `<img src="assets/portraits/${png}" alt="${nameOf(unit)}" class="${cls}" loading="lazy" onerror="this.hidden=true;this.style.setProperty('display','none','important');const s=this.parentElement&&this.parentElement.tagName==='foreignObject'?this.parentElement.nextElementSibling:this.nextElementSibling;if(s){s.removeAttribute('hidden');s.style.removeProperty('display')}" />`;
  if (embedInSvg) return `<foreignObject class="portrait" x="0" y="0" width="120" height="130">${img}</foreignObject>${fallback}`;
  return `${img}${fallback}`;
}

export const genderMark = (unit: Unit): string => {
  const g = UNITS[unit.kind].faction === 'elf' || unit.kind === 'exile' ? genderOf(unit) : undefined;
  return g === 'female' ? '♀' : g === 'male' ? '♂' : '';
};

export function unitLabel(unit: Unit): string {
  const g = genderMark(unit);
  return `${nameOf(unit)}${g ? `（${g === '♀' ? '女' : '男'}）` : ''}，生命 ${unit.hp}/${maxHp(unit)}，行动点 ${unit.ap}`;
}
