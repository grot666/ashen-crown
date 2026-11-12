import { describe, expect, it } from 'vitest';
import { TOKEN_ROLE, tokenGlyph, tokenMark } from '../src/tokens';
import { makeUnit } from '../src/engine/game';
import type { UnitKind } from '../src/engine/types';

const KINDS: UnitKind[] = [
  'warlord', 'brute', 'raider', 'shaman', 'goblin', 'goblinKnight', 'totem',
  'ranger', 'blade', 'oracle', 'exile', 'warden', 'regent',
];
const hex = { q: 0, r: 0 };

describe('board token marks', () => {
  it('gives every unit kind a unique glyph, and covers the full roster', () => {
    expect(Object.keys(TOKEN_ROLE).sort()).toEqual([...KINDS].sort());
    const glyphs = KINDS.map(kind => tokenGlyph(kind));
    expect(new Set(glyphs).size).toBe(KINDS.length);
  });

  it('tints the frame by owner, so a recruited elf still reads as an orc ally', () => {
    const enemy = makeUnit('e', 'warden', 'elf', hex);
    const recruit = makeUnit('r', 'warden', 'orc', hex);
    const enemyMark = tokenMark(enemy);
    const recruitMark = tokenMark(recruit);
    expect(enemyMark).toContain('#243d36');
    expect(recruitMark).toContain('#4a3f30');
    expect(tokenGlyph('warden')).toEqual(tokenGlyph('warden'));
    expect(enemyMark).toContain('token-glyph');
    expect(recruitMark).toContain('token-glyph');
  });

  it('shows a gender pip on elf and exile tokens, but not on orc kinds', () => {
    const female = tokenMark(makeUnit('a', 'ranger', 'elf', hex, { gender: 'female' }));
    const male = tokenMark(makeUnit('b', 'ranger', 'elf', hex, { gender: 'male' }));
    expect(female).toContain('>♀</text>');
    expect(male).toContain('>♂</text>');
    expect(female).not.toEqual(male);
    expect(tokenMark(makeUnit('c', 'warlord', 'orc', hex))).not.toMatch(/[♀♂]/);
    expect(tokenMark(makeUnit('d', 'exile', 'orc', hex))).toMatch(/[♀♂]/);
  });
});
