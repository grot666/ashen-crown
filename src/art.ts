import { factionOf } from './engine/game';
import { UNITS } from './engine/content';
import type { Faction, Unit } from './engine/types';

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

export function portrait(unit: Unit, large = false): string {
  const faction = factionOf(unit);
  const elf = faction === 'elf';
  const kind = unit.kind;
  const caster = kind === 'shaman' || kind === 'oracle';
  const ranger = kind === 'ranger';
  const armored = ['warlord', 'brute', 'warden'].includes(kind);
  const skin = elf ? '#b7c8b3' : '#87926b';
  return `<svg viewBox="0 0 120 130" width="120" height="130" class="${large ? 'portrait-large' : 'portrait'}" aria-hidden="true">
    <path d="m60 5 47 28v57l-47 34-47-34V33Z" fill="${elf ? '#233d35' : '#3c3528'}"/>
    <path d="M14 110 30 88l20-8h20l20 8 16 22v20H14Z" fill="${elf ? '#344d43' : '#4a4937'}"/>
    <path d="m26 92 18-9 16 18 16-18 18 9-8 31H34Z" fill="${elf ? '#788779' : '#79745b'}"/>
    <path d="M49 73h22v20l-11 8-11-8Z" fill="${skin}"/>
    <path d="${elf ? 'M34 38 60 22l26 16-4 33-22 18-22-18Z' : 'M33 35 60 23l27 12 3 34-18 17H48L30 69Z'}" fill="${skin}"/>
    ${elf ? '<path d="m35 45-16-9 15 26Zm50 0 16-9-15 26Z" fill="#a3b59f"/><path d="M30 43c0-34 60-34 60 0l-10 23-3-31-17 8-17-8-3 31Z" fill="#c2c3ad"/>' :
      '<path d="m33 46-13-5 13 22Zm54 0 13-5-13 22Z" fill="#76845d"/><path d="m44 65 4 12 7-5m21-7-4 12-7-5" fill="#d2c8a4"/>'}
    <path d="m42 51 12 3m12 0 12-3" stroke="#313e32" stroke-width="4"/>
    <path d="m46 55 6 1m16 0 6-1" stroke="${elf ? '#d9e8bf' : '#efbb79'}" stroke-width="2"/>
    <path d="m60 55-4 11h8M52 74h16" fill="none" stroke="#53604b" stroke-width="2"/>
    ${armored ? `<path d="m31 38 5-14 16-7 8-12 8 12 16 7 5 14-29-8Z" fill="${elf ? '#a7ab8e' : '#aaa086'}"/><path d="M60 10v24" stroke="#e0ca98" stroke-width="2"/><path d="m20 91 19-7 5 21-24-3m80-11-19-7-5 21 24-3" fill="${elf ? '#959e83' : '#89836c'}"/>` : ''}
    ${caster ? `<path d="m30 47 2-20L60 9l28 18 2 20-30-13Z" fill="${elf ? '#63766a' : '#796b4e'}"/><path d="m60 16 5 10-5 8-5-8Z" fill="${elf ? '#b9daca' : '#e3b875'}"/><path d="M94 120V52m-7 0 7-13 7 13-7 10Z" fill="none" stroke="#c5b98d" stroke-width="3"/>` : ''}
    ${ranger ? '<path d="M29 48C20 0 100 0 91 48L78 29H42Z" fill="#556a55"/><path d="M96 62q22 28 0 58M96 62v58" fill="none" stroke="#c7b98c" stroke-width="3"/>' : ''}
    <path d="m47 108 13 8 13-8-13 17Z" fill="${elf ? '#bdd1b7' : '#c9ae76'}" opacity=".7"/>
  </svg>`;
}

export function unitLabel(unit: Unit): string {
  return `${UNITS[unit.kind].name}，生命 ${unit.hp}/${UNITS[unit.kind].hp}，行动点 ${unit.ap}`;
}
