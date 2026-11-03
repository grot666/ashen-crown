import { describe, expect, it } from 'vitest';
import { chooseAction } from '../src/engine/ai';
import { newCampaign, startBattle, type CampaignState, type PerkId } from '../src/engine/campaign';
import { applyAction, living, maxHp } from '../src/engine/game';
import { CAMPAIGN } from '../src/engine/scenarios';

/** A campaign that reached `level` with only the guaranteed level rewards (no perks, no recruits). */
function campaignAt(level: number, morale = 50, deploy?: number, perks: PerkId[] = []): CampaignState {
  const c = newCampaign(7);
  for (let l = 0; l < level; l++) {
    const reward = CAMPAIGN[l].reward;
    if (reward) c.roster.push({ id: `r-reward${l}`, kind: reward.kind, name: reward.name, origin: 'native' });
  }
  return { ...c, level, morale, perks, deploy: c.roster.map(r => r.id).slice(0, deploy ?? CAMPAIGN[level].playerSlots.length) };
}
function simulate(c: CampaignState) {
  let state = startBattle(c).battle!;
  let actions = 0;
  while (!state.winner && actions++ < 4000) {
    const result = applyAction(state, chooseAction(state));
    if (!result.ok) throw new Error(result.error);
    state = result.state;
  }
  const own = state.units.filter(u => u.owner === 'orc');
  const hpShare = living(state, 'orc').reduce((a, u) => a + u.hp, 0) / own.reduce((a, u) => a + maxHp(u), 0);
  return { winner: state.winner, round: state.round, hpShare, fallen: own.filter(u => u.hp === 0).length };
}

// AI-vs-AI on both sides: same heuristic the enemy uses, so a human should do at least this well.
describe('campaign balance (AI vs AI)', () => {
  CAMPAIGN.forEach((scenario, level) => {
    it(`${scenario.chapter}「${scenario.name}」is winnable with the baseline army, but not trivially`, () => {
      const base = simulate(campaignAt(level));
      expect(base.winner).toBe('orc');
      expect(base.hpShare).toBeLessThan(0.8);
      expect(base.fallen + (1 - base.hpShare) > 0.3).toBe(true);
      expect(base.round).toBeGreaterThanOrEqual(3);
    });
    // 1–2 are meant to be comfortable (a half-strength army can still scrape through), so only a
    // skeleton crew must fail there; 3–4 need most of the warband.
    const skeleton = level < 2 ? 2 : 3;
    it(`${scenario.chapter}「${scenario.name}」is lost by an under-strength army (${skeleton} units)`, () => {
      expect(simulate(campaignAt(level, 50, skeleton)).winner).toBe('elf');
    });
  });
  it('perks and high morale do not make a winnable level unwinnable', () => {
    for (let level = 0; level < CAMPAIGN.length; level++) {
      expect(simulate(campaignAt(level, 70, undefined, ['oathbreak', 'moonwell'])).winner).toBe('orc');
    }
  });
});
