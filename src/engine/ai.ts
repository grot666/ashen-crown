import { UNITS } from './content';
import { canAttack, canSkill, factionOf, strikeDamage, hasSight, isCampaign, living, maxHp, opponent, rangeOf, reachable, scenarioFor, skillAmount, skillRangeOf, tileAt } from './game';
import { distance, equal } from './hex';
import type { Action, GameState, Hex, Unit } from './types';

const nearestGoal = (unit: Hex, goals: Hex[]): number => Math.min(...goals.map(g => distance(unit, g)));

/** Objective-aware extras for campaign scenarios. Skirmish scoring is unchanged. */
function targetBonus(state: GameState, target: Unit): number {
  if (!isCampaign(state)) return 0;
  const objective = scenarioFor(state).objective;
  if (target.role === 'escort') return 18;
  if (target.role === 'boss') return 12;
  if (objective.type === 'defend' && objective.altar && factionOf(target) !== state.player) return Math.max(0, 4 - distance(target, objective.altar)) * 5;
  return 0;
}
function moveBonus(state: GameState, unit: Unit, moved: Hex): { score: number; progress: boolean } {
  if (!isCampaign(state)) return { score: 0, progress: false };
  const objective = scenarioFor(state).objective;
  if (unit.role === 'escort' && objective.goal) {
    const gain = nearestGoal(unit, objective.goal) - nearestGoal(moved, objective.goal);
    return { score: gain * 6 + (objective.goal.some(g => equal(g, moved)) ? 200 : 0), progress: gain > 0 };
  }
  if (objective.type === 'defend' && objective.altar) {
    const gain = distance(unit, objective.altar) - distance(moved, objective.altar);
    if (factionOf(unit) !== state.player) {
      return { score: gain * 4 + (equal(moved, objective.altar) ? 40 : 0) - (equal(unit, objective.altar) ? 60 : 0), progress: gain > 0 };
    }
    // Defenders body-block the well and stay within two hexes of it.
    const onAltar = equal(moved, objective.altar) ? 12 : 0;
    const leaving = equal(unit, objective.altar) ? -25 : 0;
    return { score: onAltar + leaving + (distance(moved, objective.altar) > 2 ? -6 : 0), progress: onAltar > 0 };
  }
  return { score: 0, progress: false };
}

export function chooseAction(state: GameState): Action {
  if (state.winner) return { type: 'end' };
  const allies = living(state, state.active);
  const enemies = living(state, opponent(state.active));
  const candidates: { action: Action; score: number }[] = [];
  for (const unit of allies) {
    const def = UNITS[unit.kind];
    for (const target of living(state)) {
      if (canSkill(state, unit, target)) {
        const heal = def.skill.effect === 'heal';
        const amount = skillAmount(unit, target);
        candidates.push({
          action: { type: 'skill', unitId: unit.id, targetId: target.id },
          score: heal ? amount * 1.7 + (target.hp < 12 ? 8 : 0) + (target.role === 'escort' ? 6 : 0) : amount * 2 + (target.hp <= amount ? 35 : 0) + targetBonus(state, target),
        });
      }
      if (canAttack(state, unit, target)) {
        const amount = strikeDamage(state, unit, target);
        candidates.push({ action: { type: 'attack', unitId: unit.id, targetId: target.id }, score: amount * 2 + (target.hp <= amount ? 35 : 0) + targetBonus(state, target) });
      }
    }
    if (!enemies.length) continue;
    const nearest = Math.min(...enemies.map(e => distance(unit, e)));
    for (const [position, cost] of reachable(state, unit)) {
      const [q, r] = position.split(',').map(Number);
      const moved: Unit = { ...unit, q, r, ap: unit.ap - cost };
      const nextDistance = Math.min(...enemies.map(e => distance(moved, e)));
      const objective = moveBonus(state, unit, moved);
      const advance = unit.role === 'escort' ? 0 : nearest - nextDistance;
      const attackable = enemies.filter(e => canAttack(state, moved, e));
      const skillTargets = living(state).filter(e => canSkill(state, moved, e));
      const threat = enemies.filter(e => distance(moved, e) <= rangeOf(e) + 1 && hasSight(state, e, moved)).length;
      const support = def.skill.effect === 'heal'
        ? allies.filter(a => a.hp <= maxHp(a) - 6 && distance(moved, a) <= skillRangeOf(unit)).length : 0;
      const cover = tileAt(state, moved)?.terrain === 'forest' ? 1.2 : 0;
      const height = def.range > 1 && tileAt(state, moved)?.terrain === 'ridge' ? 2 : 0;
      const score = advance * 3 + attackable.length * 8 + skillTargets.length * 5 + support * 4 + cover + height - cost * 0.5 -
        threat * (unit.hp < maxHp(unit) / 2 ? 2 : 0.4) + objective.score;
      if (score > 0 && (advance > 0 || objective.progress || attackable.length || skillTargets.length || support)) {
        candidates.push({ action: { type: 'move', unitId: unit.id, to: { q, r } }, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.action ?? { type: 'end' };
}
