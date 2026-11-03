import type { Faction, Gender, UnitKind } from './engine/types';

/**
 * Hand-built SVG busts (viewBox 120×130). No <defs>/ids, so many copies can live on one page.
 * Species/face follow the unit kind, banner colours follow the owner, hair/silhouette follow gender.
 */
interface Palette { bg: string; inner: string; rim: string; glow: string }
const BANNERS: Record<Faction, Palette> = {
  orc: { bg: '#3a3226', inner: '#2b261c', rim: '#c9ae76', glow: '#e0a55a' },
  elf: { bg: '#21392f', inner: '#182c24', rim: '#8eb6a2', glow: '#9fd0c0' },
};
const INK = '#141a14';

function frame(p: Palette): string {
  return `<path d="m60 3 51 29.5v61L60 127 9 93.5v-61Z" fill="${p.bg}"/>
    <path d="m60 9 45.5 26.5v55L60 120.5 14.5 90.5v-55Z" fill="${p.inner}" stroke="${p.rim}" stroke-opacity=".32" stroke-width="1"/>
    <circle cx="60" cy="54" r="36" fill="${p.glow}" opacity=".1"/>`;
}
const bust = (fill: string, trim: string): string =>
  `<path d="M12 130 15 106q5-15 24-20l12-3h18l12 3q19 5 24 20l3 24Z" fill="${fill}" stroke="${INK}" stroke-width="1.6"/>
   <path d="M44 86 60 104 76 86" fill="none" stroke="${trim}" stroke-width="2.4"/>`;

// ───────── orcs ─────────
interface OrcLook { skin: string; shade: string; eye: string; tusk: string }
const ORC: OrcLook = { skin: '#7f9160', shade: '#5f7148', eye: '#f2b45e', tusk: '#ece0b8' };
const BLACK_ORC: OrcLook = { skin: '#56604c', shade: '#3e4637', eye: '#ff8a4c', tusk: '#f3e7c2' };
const GOBLIN: OrcLook = { skin: '#9aa652', shade: '#76813c', eye: '#ffe066', tusk: '#f5ecc8' };

function orcHead(c: OrcLook, scarred = false): string {
  return `<path d="m31 52-14-9 4 14 12 8Zm58 0 14-9-4 14-12 8Z" fill="${c.shade}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M60 83h0" />
    <path d="M47 76h26v14l-13 6-13-6Z" fill="${c.shade}"/>
    <path d="M33 40q27-17 54 0l3 26q-4 17-17 22H47Q34 83 30 66Z" fill="${c.skin}" stroke="${INK}" stroke-width="1.8"/>
    <path d="M37 47q11-7 21 1m4 0q10-8 21-1" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M42 53q5-3 10 0-5 3-10 0Zm26 0q5-3 10 0-5 3-10 0Z" fill="${c.eye}" stroke="${INK}" stroke-width="1"/>
    <circle cx="47" cy="53" r="1.4" fill="${INK}"/><circle cx="73" cy="53" r="1.4" fill="${INK}"/>
    <path d="M56 56q-3 7 0 9h8q3-2 0-9" fill="${c.shade}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M44 73q16 6 32 0" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="m46 74-2-11 6 9Zm28 0 2-11-6 9Z" fill="${c.tusk}" stroke="${INK}" stroke-width="1"/>
    ${scarred ? `<path d="m68 40 9 17m-3-13-4 3" stroke="#c98a6b" stroke-width="1.6" fill="none"/>` : ''}`;
}
function warlord(): string {
  return `<path d="M98 18 104 120" stroke="#5b4630" stroke-width="5"/><path d="M90 12q22 6 18 30l-12-4q2-12-6-16Z" fill="#9aa0a6" stroke="${INK}" stroke-width="1.5"/>
    ${bust('#5a4a33', '#c9ae76')}
    <path d="M10 104q8-22 30-22l-6 16q-12 2-24 6Zm100 0q-8-22-30-22l6 16q12 2 24 6Z" fill="#8b7655" stroke="${INK}" stroke-width="1.4"/>
    <path d="m14 98 6-6 4 6 5-7 4 6m54 1 4-6 5 7 4-6 6 6" fill="none" stroke="#b49a6b" stroke-width="1.5"/>
    <path d="M46 98h28l-4 18H50Z" fill="#8f2f24" stroke="${INK}" stroke-width="1.2"/>
    ${orcHead(ORC, true)}
    <path d="M31 42q29-24 58 0l-2 6q-27-12-54 0Z" fill="#7d7a70" stroke="${INK}" stroke-width="1.6"/>
    <path d="M32 40q-12-8-14-24 8 10 20 15Zm56 0q12-8 14-24-8 10-20 15Z" fill="#e0d3ac" stroke="${INK}" stroke-width="1.4"/>
    <path d="m48 30 4-10 4 8 4-11 4 11 4-8 4 10" fill="#d9b867" stroke="${INK}" stroke-width="1.2"/>`;
}
function blackOrc(): string {
  return `<path d="M18 16 26 124" stroke="#3a2e22" stroke-width="5"/><path d="M8 18q10-16 30-6l-4 18q-14-6-24 0Z" fill="#7a7f86" stroke="${INK}" stroke-width="1.5"/><path d="M14 20q8-6 18-2" stroke="#c6ccd2" stroke-width="1.2" fill="none"/>
    ${bust('#2f3230', '#8a8f93')}
    <path d="M6 106q4-24 32-26l2 22q-20 0-34 4Zm108 0q-4-24-32-26l-2 22q20 0 34 4Z" fill="#45494c" stroke="${INK}" stroke-width="1.6"/>
    <path d="m14 86-6-10 12 5Zm10-5-2-12 8 9Zm72 5 6-10-12 5Zm-10-5 2-12-8 9Z" fill="#c9ccd0" stroke="${INK}" stroke-width="1"/>
    <path d="M40 92h40v30H40Z" fill="#3a3d3f" stroke="${INK}" stroke-width="1.2"/><path d="M40 102h40M40 112h40" stroke="#5a5f63" stroke-width="1.5"/>
    <circle cx="60" cy="97" r="3" fill="#c9ae76"/>
    ${orcHead(BLACK_ORC, true)}
    <path d="M30 46q30-30 60 0v4H30Z" fill="#33363a" stroke="${INK}" stroke-width="1.8"/>
    <path d="m40 34-2-12 7 9Zm20-7v-13l5 12Zm20 7 2-12-7 9Z" fill="#c9ccd0" stroke="${INK}" stroke-width="1"/>
    <path d="M57 46h6v14h-6Z" fill="#33363a" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="36" cy="46" r="1.4" fill="#9aa0a6"/><circle cx="84" cy="46" r="1.4" fill="#9aa0a6"/>`;
}
function orcBoy(): string {
  return `<path d="M100 40 92 120" stroke="#5b4630" stroke-width="4"/><path d="M96 22h16l-4 26H94Z" fill="#a7a9a6" stroke="${INK}" stroke-width="1.4"/><path d="M98 26h10" stroke="#e1e3df" stroke-width="1.2"/>
    ${bust('#6b5a3f', '#a8875a')}
    <path d="M26 88 86 124M94 88 34 124" stroke="#4a3b28" stroke-width="5"/><circle cx="60" cy="106" r="4" fill="#c9ae76" stroke="${INK}"/>
    <path d="M14 106q6-14 24-18l-2 12q-12 2-22 6Z" fill="#8b7655" stroke="${INK}" stroke-width="1.3"/>
    ${orcHead(ORC)}
    <path d="M55 36q5-26 10 0q-5-6-10 0Z" fill="#2f2a22" stroke="${INK}" stroke-width="1.2"/><path d="M52 39q8-30 16 0" fill="none" stroke="#2f2a22" stroke-width="3"/>
    <path d="M36 62h8m32 0h8" stroke="#b5463a" stroke-width="2.2" stroke-linecap="round"/>`;
}
function shaman(): string {
  return `<path d="M100 30 96 124" stroke="#7a6446" stroke-width="4"/><circle cx="100" cy="24" r="8" fill="#e8a24e" stroke="${INK}" stroke-width="1.4"/><circle cx="100" cy="24" r="3.5" fill="#fbe2a2"/>
    <path d="m92 20-4-6m16 4 5-5" stroke="#e0d3ac" stroke-width="1.6"/>
    ${bust('#5a4b3b', '#c9ae76')}
    <path d="M30 92q30 14 60 0" fill="none" stroke="#e0d3ac" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M42 100h36l-6 24H48Z" fill="#7b5a3c" stroke="${INK}" stroke-width="1.2"/><path d="m52 108 8 8 8-8" fill="none" stroke="#e8a24e" stroke-width="1.6"/>
    ${orcHead(ORC)}
    <path d="M32 44q28-30 56 0l-6 2q-22-16-44 0Z" fill="#e0d3ac" stroke="${INK}" stroke-width="1.4"/>
    <path d="m44 24-10-14 14 10Zm32 0 10-14-14 10Z" fill="#b5463a" stroke="${INK}" stroke-width="1.2"/>
    <circle cx="60" cy="28" r="6" fill="#e0d3ac" stroke="${INK}" stroke-width="1.2"/><path d="M57 27h1m4 0h1M58 31h4" stroke="${INK}" stroke-width="1.4"/>
    <path d="M44 60l4 6m28-6-4 6" stroke="#e8a24e" stroke-width="1.6"/>`;
}
function goblin(): string {
  return `<path d="M18 34q8 4 6 14" fill="none" stroke="#8a7a5a" stroke-width="1.6"/><circle cx="16" cy="32" r="4.5" fill="#6d6f73" stroke="${INK}"/><circle cx="25" cy="50" r="4.5" fill="#6d6f73" stroke="${INK}"/>
    ${bust('#4b4535', '#8a7a5a')}
    <path d="M28 130q2-30 32-36 30 6 32 36Z" fill="#3c4a36" stroke="${INK}" stroke-width="1.4"/>
    <path d="m42 64-34-16 14 20 18 8Zm36 0 34-16-14 20-18 8Z" fill="${GOBLIN.shade}" stroke="${INK}" stroke-width="1.5"/>
    <path d="m40 62-20-8 8 10Zm40 0 20-8-8 10Z" fill="#c98f7a" opacity=".6"/>
    <path d="M40 54q20-16 40 0l2 18q-4 16-22 20-18-4-22-20Z" fill="${GOBLIN.skin}" stroke="${INK}" stroke-width="1.8"/>
    <path d="M30 60q2-34 30-38 28 4 30 38-8-18-30-20-22 2-30 20Z" fill="#3c4a36" stroke="${INK}" stroke-width="1.6"/>
    <path d="M44 61q5-5 10 0-5 4-10 0Zm22 0q5-5 10 0-5 4-10 0Z" fill="${GOBLIN.eye}" stroke="${INK}" stroke-width="1"/>
    <circle cx="49" cy="61" r="1.6" fill="${INK}"/><circle cx="71" cy="61" r="1.6" fill="${INK}"/>
    <path d="M58 63q2 12 8 12-4 2-8-1" fill="${GOBLIN.shade}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M48 80q12 6 24 0" fill="none" stroke="${INK}" stroke-width="1.8"/><path d="m52 81 2 4 2-3 2 4 2-4 2 3 2-4" fill="${GOBLIN.tusk}" stroke="${INK}" stroke-width=".6"/>
    <path d="M86 92 98 74" stroke="#9aa0a6" stroke-width="3"/><path d="M84 96h8" stroke="#5b4630" stroke-width="4"/>`;
}

// ───────── elves ─────────
const ELF_SKIN = '#cfdac6';
const ELF_SHADE = '#a9b9a3';
const HAIR = { silver: '#dcd9c1', raven: '#2f3442', copper: '#a7643f', ash: '#b9bfb1' };
function elfHead(female: boolean, hair: string, eye = '#7fd2c1'): string {
  const jaw = female ? 'M41 40q19-18 38 0l1 20q-3 18-20 26-17-8-20-26Z' : 'M40 40q20-18 40 0l1 21q-3 16-14 22l-7 3-7-3q-11-6-14-22Z';
  return `${female ? `<path d="M34 40q26-34 52 0l6 56q-8 6-14 0l-2-40H44l-2 40q-6 6-14 0Z" fill="${hair}" stroke="${INK}" stroke-width="1.4"/>` : ''}
    <path d="m42 52-24-18 10 22 14 8Zm36 0 24-18-10 22-14 8Z" fill="${ELF_SHADE}" stroke="${INK}" stroke-width="1.3"/>
    <path d="M52 78h16v12l-8 5-8-5Z" fill="${ELF_SHADE}"/>
    <path d="${jaw}" fill="${ELF_SKIN}" stroke="${INK}" stroke-width="1.7"/>
    <path d="M44 50q6-4 12-1m8 0q6-3 12 1" fill="none" stroke="${INK}" stroke-width="${female ? 1.4 : 2}" stroke-linecap="round"/>
    <path d="M45 56q5-4 10 0-5 3-10 0Zm20 0q5-4 10 0-5 3-10 0Z" fill="${eye}" stroke="${INK}" stroke-width="1"/>
    <circle cx="50" cy="56" r="1.3" fill="${INK}"/><circle cx="70" cy="56" r="1.3" fill="${INK}"/>
    ${female ? `<path d="m44 55-2-2m34 2 2-2" stroke="${INK}" stroke-width="1"/>` : ''}
    <path d="M60 58v8l-3 2" fill="none" stroke="${ELF_SHADE}" stroke-width="1.6"/>
    <path d="M54 75q6 ${female ? 3 : 2} 12 0" fill="none" stroke="${female ? '#9a6a64' : INK}" stroke-width="1.5"/>`;
}
const fringe = (female: boolean, hair: string): string => female
  ? `<path d="M38 46q4-26 22-28 18 2 22 28-6-12-16-14l-6 6-6-6q-10 2-16 14Z" fill="${hair}" stroke="${INK}" stroke-width="1.3"/>`
  : `<path d="M38 48q0-30 22-30t22 30l-4-6q-8-14-30-8-6 4-10 14Z" fill="${hair}" stroke="${INK}" stroke-width="1.3"/>`;
const circlet = (gem: string): string => `<path d="M41 42q19-9 38 0" fill="none" stroke="#d9c98f" stroke-width="2"/><path d="m60 34 4 6-4 5-4-5Z" fill="${gem}" stroke="${INK}" stroke-width=".8"/>`;

function warden(female: boolean): string {
  const hair = female ? HAIR.silver : HAIR.ash;
  return `<path d="M100 14 96 120" stroke="#d6dccf" stroke-width="3.4"/><path d="m100 10-3 10h6Z" fill="#e8eee2"/><path d="M90 40h20" stroke="#b9a66d" stroke-width="3"/>
    ${bust('#53625a', '#b9c7b4')}
    <path d="M8 108q4-24 32-26l4 20q-20 0-36 6Zm104 0q-4-24-32-26l-4 20q20 0 36 6Z" fill="#8c9a8b" stroke="${INK}" stroke-width="1.5"/>
    <path d="M18 96q8-8 18-8m66 8q-8-8-18-8" fill="none" stroke="#d9e3d4" stroke-width="1.2"/>
    <path d="M44 94h32l-4 28H48Z" fill="#6b7d70" stroke="${INK}" stroke-width="1.2"/><path d="M60 98v20m-8-10 8-8 8 8" fill="none" stroke="#d9e3d4" stroke-width="1.4"/>
    ${elfHead(female, hair)}
    <path d="M38 50q2-34 22-34t22 34l-6-2q-4-22-16-22T44 48Z" fill="#a8b4a2" stroke="${INK}" stroke-width="1.5"/>
    <path d="M38 40q-18-10-22-26 12 8 24 12Zm44 0q18-10 22-26-12 8-24 12Z" fill="#d9e3d4" stroke="${INK}" stroke-width="1.2"/>
    <path d="M60 16v14" stroke="#d9c98f" stroke-width="2"/>
    ${female ? `<path d="M82 52q10 14 4 40" fill="none" stroke="${hair}" stroke-width="5" stroke-linecap="round"/><path d="M82 52q10 14 4 40" fill="none" stroke="${INK}" stroke-width=".8" stroke-dasharray="3 3"/>` : ''}`;
}
function ranger(female: boolean): string {
  const hair = female ? HAIR.copper : HAIR.raven;
  return `<path d="M102 14q22 50 0 104" fill="none" stroke="#b49a6b" stroke-width="3.4"/><path d="M102 14v104" stroke="#e5ddc4" stroke-width=".9"/>
    <path d="M16 40 22 96" stroke="#6b5a3f" stroke-width="7"/><path d="m14 34 4 6m2-8 2 8m3-7-1 7" stroke="#d9e3d4" stroke-width="1.4"/>
    ${bust('#3f5442', '#9fb79a')}
    <path d="M24 130q4-34 36-42 32 8 36 42" fill="#4d6650" stroke="${INK}" stroke-width="1.3"/>
    <path d="M30 96 90 122" stroke="#6b5a3f" stroke-width="3.5"/>
    ${elfHead(female, hair)}
    ${fringe(female, hair)}
    <path d="M30 64q-4-50 30-52 34 2 30 52l-8-22q-8-18-22-18T38 42Z" fill="#4d6650" stroke="${INK}" stroke-width="1.6"/>
    <path d="M60 12v12" stroke="#33463a" stroke-width="1.4"/>`;
}
function blade(female: boolean): string {
  const hair = female ? HAIR.raven : HAIR.silver;
  return `<path d="M14 18q30 30 70 100M106 18q-30 30-70 100" fill="none" stroke="#dfe6e2" stroke-width="3"/><path d="M14 18q30 30 70 100M106 18q-30 30-70 100" fill="none" stroke="${INK}" stroke-width=".6"/>
    ${bust('#30453d', '#a7c9b9')}
    <path d="M34 92q26 10 52 0l-2 8q-24 8-48 0Z" fill="#7c4a5a" stroke="${INK}" stroke-width="1.1"/>
    <path d="M24 104q6-12 18-14l-2 10q-8 0-16 4Zm72 0q-6-12-18-14l2 10q8 0 16 4Z" fill="#5d7a6c" stroke="${INK}" stroke-width="1.2"/>
    ${elfHead(female, hair)}
    ${fringe(female, hair)}
    ${female ? `<path d="M60 18q22-10 28 8-10-6-20-2Z" fill="${hair}" stroke="${INK}" stroke-width="1.2"/><path d="M86 22q14 14 8 40" fill="none" stroke="${hair}" stroke-width="5" stroke-linecap="round"/>`
      : `<path d="M40 40q20-6 40 0" fill="none" stroke="#7c4a5a" stroke-width="3"/>`}`;
}
function oracle(female: boolean): string {
  const hair = female ? HAIR.silver : HAIR.ash;
  return `<path d="M102 30 98 124" stroke="#c7b98d" stroke-width="3"/><path d="M92 26q10-18 22-2-9-6-14 2-4-6-8 0Z" fill="#cfe7de" stroke="${INK}" stroke-width="1.2"/><circle cx="102" cy="22" r="3" fill="#9fd0c0"/>
    ${bust('#2f4a44', '#cfe7de')}
    <path d="M38 84q22-6 44 0l-4 10q-18-6-36 0Z" fill="#cfe7de" stroke="${INK}" stroke-width="1.2"/>
    <path d="M60 96v28m-10-18q10 6 20 0" fill="none" stroke="#9fd0c0" stroke-width="1.6"/><circle cx="60" cy="102" r="4" fill="#9fd0c0" stroke="${INK}"/>
    ${elfHead(female, hair, '#b6e6ff')}
    ${fringe(female, hair)}
    ${circlet('#b6e6ff')}
    <path d="M54 28q6-10 12 0-6-4-12 0Z" fill="#cfe7de" stroke="${INK}" stroke-width=".8"/>`;
}
function regent(): string {
  const hair = HAIR.silver;
  return `<path d="M100 12 96 124" stroke="#d9c98f" stroke-width="3.4"/><path d="M92 18q8-16 16 0-8 8-16 0Z" fill="#6f4f86" stroke="${INK}" stroke-width="1.2"/><circle cx="100" cy="18" r="3" fill="#e9dbff"/>
    <path d="M14 130 20 70q40-20 80 0l6 60Z" fill="#3b2c4a" stroke="${INK}" stroke-width="1.5"/>
    ${bust('#4b3a5c', '#d9c98f')}
    <path d="M30 84q-6-18 8-26l8 26Zm60 0q6-18-8-26l-8 26Z" fill="#6f4f86" stroke="${INK}" stroke-width="1.3"/>
    <path d="M44 96h32l-4 26H48Z" fill="#2f2440" stroke="#d9c98f" stroke-width="1.2"/><path d="m60 100 6 8-6 8-6-8Z" fill="#d9c98f"/>
    ${elfHead(true, hair, '#e9dbff')}
    ${fringe(true, hair)}
    <path d="m38 38 4-22 8 12 10-18 10 18 8-12 4 22q-22-8-44 0Z" fill="#d9c98f" stroke="${INK}" stroke-width="1.4"/>
    <path d="m60 16 3 6-3 4-3-4Z" fill="#e9dbff"/>`;
}
function totem(): string {
  return `<path d="M22 100h76l-6 14H28Z" fill="#5c4a30" stroke="${INK}" stroke-width="1.4"/><circle cx="36" cy="116" r="9" fill="#2b261c" stroke="#a48a5c" stroke-width="3"/><circle cx="84" cy="116" r="9" fill="#2b261c" stroke="#a48a5c" stroke-width="3"/>
    <path d="M47 100V36h26v64Z" fill="#79745b" stroke="${INK}" stroke-width="1.4"/><path d="m42 36 18-15 18 15Z" fill="#aaa086" stroke="${INK}" stroke-width="1.2"/>
    <path d="m52 52 8-6 8 6m-16 16 8-6 8 6m-16 16 8-6 8 6" fill="none" stroke="#3c3528" stroke-width="3"/>
    <path d="M30 60h17m26 0h17" stroke="#b5463a" stroke-width="3"/>
    <path d="M60 3c-9 10-7 16 0 21 7-5 9-11 0-21Z" fill="#e3a65a"/><path d="M60 9c-3 5-2 8 0 10 2-2 3-5 0-10Z" fill="#f4d58e"/>`;
}

export function portraitSvg(kind: UnitKind, owner: Faction, gender: Gender | undefined, large: boolean): string {
  const female = gender === 'female';
  const body: Record<UnitKind, () => string> = {
    warlord, brute: blackOrc, raider: orcBoy, shaman, goblin, totem,
    warden: () => warden(female), ranger: () => ranger(female), blade: () => blade(female), oracle: () => oracle(female), regent,
  };
  return `<svg viewBox="0 0 120 130" width="120" height="130" class="${large ? 'portrait-large' : 'portrait'}" aria-hidden="true">${frame(BANNERS[owner])}${body[kind]()}</svg>`;
}
