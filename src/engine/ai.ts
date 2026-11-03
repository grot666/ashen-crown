import { UNITS } from './content';
import { canAttack, canSkill, damage, hasSight, living, opponent, reachable, tileAt } from './game';
import { distance } from './hex';
import type { Action, GameState, Unit } from './types';

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
        const amount = Math.min(def.skill.power, heal ? UNITS[target.kind].hp - target.hp : target.hp);
        candidates.push({
          action: { type: 'skill', unitId: unit.id, targetId: target.id },
          score: heal ? amount * 1.7 + (target.hp < 12 ? 8 : 0) : amount * 2 + (target.hp <= amount ? 35 : 0),
        });
      }
      if (canAttack(state, unit, target)) {
        const amount = damage(state, unit, target);
        candidates.push({ action: { type: 'attack', unitId: unit.id, targetId: target.id }, score: amount * 2 + (target.hp <= amount ? 35 : 0) });
      }
    }
    const nearest = Math.min(...enemies.map(e => distance(unit, e)));
    for (const [position, cost] of reachable(state, unit)) {
      const [q, r] = position.split(',').map(Number);
      const moved: Unit = { ...unit, q, r, ap: unit.ap - cost };
      const nextDistance = Math.min(...enemies.map(e => distance(moved, e)));
      const advance = nearest - nextDistance;
      const attackable = enemies.filter(e => canAttack(state, moved, e));
      const skillTargets = living(state).filter(e => canSkill(state, moved, e));
      const threat = enemies.filter(e => distance(moved, e) <= UNITS[e.kind].range + 1 && hasSight(state, e, moved)).length;
      const support = def.skill.effect === 'heal'
        ? allies.filter(a => a.hp <= UNITS[a.kind].hp - 6 && distance(moved, a) <= def.skill.range).length : 0;
      const cover = tileAt(state, moved)?.terrain === 'forest' ? 1.2 : 0;
      const height = def.range > 1 && tileAt(state, moved)?.terrain === 'ridge' ? 2 : 0;
      const score = advance * 3 + attackable.length * 8 + skillTargets.length * 5 + support * 4 + cover + height - cost * 0.5 -
        threat * (unit.hp < def.hp / 2 ? 2 : 0.4);
      if (score > 0 && (advance > 0 || attackable.length || skillTargets.length || support)) {
        candidates.push({ action: { type: 'move', unitId: unit.id, to: { q, r } }, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.action ?? { type: 'end' };
}
