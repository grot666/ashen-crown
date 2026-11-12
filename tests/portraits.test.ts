import { describe, expect, it } from 'vitest';
import { portrait, portraitFile } from '../src/art';
import { genderOf, makeUnit } from '../src/engine/game';
import type { Gender, UnitKind } from '../src/engine/types';

const hex = { q: 0, r: 0 };
const elf = (kind: UnitKind, gender?: Gender) => makeUnit('u', kind, 'elf', hex, gender ? { gender } : {});
const orc = (kind: UnitKind) => makeUnit('u', kind, 'orc', hex);

describe('portrait files', () => {
  const kinds: UnitKind[] = ['ranger', 'blade', 'oracle', 'exile', 'warden', 'regent'];
  const vampires: UnitKind[] = ['thrall', 'bloodKnight', 'nightStalker', 'bloodMage', 'crimsonLord'];
  const vamp = (kind: UnitKind, gender?: Gender) => makeUnit('u', kind, 'vampire', hex, gender ? { gender } : {});

  it('gives a female and a male elf of the same kind different files', () => {
    for (const kind of kinds) {
      const female = portraitFile(elf(kind, 'female'));
      const male = portraitFile(elf(kind, 'male'));
      expect(female).toBe(`${kind}-f.jpg`);
      expect(male).toBe(`${kind}-m.jpg`);
      expect(female).not.toBe(male);
    }
  });

  it('gives two different female elf kinds different files, and follows each kind’s default gender', () => {
    const files = kinds.map(kind => portraitFile(elf(kind, 'female')));
    expect(new Set(files).size).toBe(kinds.length);
    expect(portraitFile(elf('ranger'))).toBe('ranger-f.jpg');
    expect(genderOf(elf('ranger'))).toBe('female');
    expect(portraitFile(elf('blade'))).toBe('blade-m.jpg');
    expect(genderOf(elf('warden'))).toBe('male');
    expect(portraitFile(elf('regent'))).toBe('regent-f.jpg');
  });

  it('keeps a single orc portrait per kind, independent of gender', () => {
    expect(portraitFile(orc('warlord'))).toBe('warlord.jpg');
    expect(portraitFile(makeUnit('u', 'warlord', 'orc', hex, { gender: 'female' }))).toBe('warlord.jpg');
    expect(portraitFile(orc('goblinKnight'))).toBe('goblin.jpg');
    expect(portraitFile(orc('totem'))).toBe('orc-generic.jpg');
    expect(portrait(orc('brute'))).toContain('assets/portraits/brute.jpg');
    expect(portrait(elf('oracle', 'female'))).toContain('assets/portraits/oracle-f.jpg');
    expect(portrait(elf('oracle', 'male'))).toContain('assets/portraits/oracle-m.jpg');
  });

  it('gives each vampire kind its own female and male portrait files', () => {
    const females = vampires.map(kind => portraitFile(vamp(kind, 'female')));
    const males = vampires.map(kind => portraitFile(vamp(kind, 'male')));
    expect(new Set(females).size).toBe(vampires.length);
    expect(new Set(males).size).toBe(vampires.length);
    expect(new Set([...females, ...males]).size).toBe(vampires.length * 2);
    for (const kind of vampires) {
      expect(portraitFile(vamp(kind, 'female'))).toBe(`${kind}-f.jpg`);
      expect(portraitFile(vamp(kind, 'male'))).toBe(`${kind}-m.jpg`);
    }
    expect(portraitFile(vamp('nightStalker'))).toBe('nightStalker-f.jpg');
    expect(genderOf(vamp('thrall'))).toBe('male');
    expect(genderOf(vamp('crimsonLord'))).toBe('female');
    expect(portrait(vamp('bloodMage', 'female'))).toContain('assets/portraits/bloodMage-f.jpg');
  });
});
