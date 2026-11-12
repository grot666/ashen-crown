import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAction, createGame } from '../src/engine/game';
import { loadGame, saveGame, validSave } from '../src/storage';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe('versioned campaign storage', () => {
  it('accepts fresh and progressed canonical campaigns', () => {
    const state = createGame();
    expect(validSave(state)).toBe(true);
    const result = applyAction(state, { type: 'end' });
    expect(result.ok && validSave(result.state)).toBe(true);
  });
  it('rejects invalid versions, impossible turns, forged units, duplicate positions and altered maps', () => {
    const invalid = [
      null, {}, { ...createGame(), version: 1 }, { ...createGame(), version: 4 }, { ...createGame(), turn: 8 },
      { ...createGame(), winner: 'unknown' }, { ...createGame(), mode: 'multiplayer' },
    ];
    const hp = createGame(); hp.units[0].hp = 100000;
    const duplicate = createGame(); duplicate.units[1].q = duplicate.units[0].q; duplicate.units[1].r = duplicate.units[0].r;
    const map = createGame(); map.tiles[0].terrain = 'water';
    const roster = createGame(); roster.units[0].kind = 'oracle';
    const fakeWin = createGame(); fakeWin.winner = 'orc';
    const log = createGame(); log.log[0].text = 'x'.repeat(251);
    [...invalid, hp, duplicate, map, roster, fakeWin, log].forEach(value => expect(validSave(value)).toBe(false));
  });
  it('round-trips JSON through the browser storage boundary', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    });
    expect(loadGame().status).toBe('empty');
    expect(saveGame(createGame())).toBe(true);
    const result = loadGame();
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') expect(result.state).toEqual(createGame());
  });
  it('reports corrupt and unavailable storage rather than pretending persistence succeeded', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', { getItem: () => '{bad-json', setItem: () => { throw new Error('QuotaExceeded'); } });
    expect(loadGame().status).toBe('error');
    expect(saveGame(createGame())).toBe(false);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });
  it('migrates a v2 orc-vs-elf skirmish save to v3 with lead and rival', () => {
    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
    });
    const v2 = { ...createGame(), version: 2 } as Record<string, unknown>;
    delete v2.lead;
    delete v2.rival;
    expect(validSave(v2)).toBe(true);
    memory.set('ashen-crown:skirmish:v2', JSON.stringify(v2));
    const result = loadGame();
    expect(result.status).toBe('loaded');
    if (result.status === 'loaded') {
      expect(result.state.version).toBe(3);
      expect(result.state.lead).toBe('orc');
      expect(result.state.rival).toBe('elf');
    }
  });
});
