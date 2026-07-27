import type { GameMode } from './config';

export type FruitKind = 'apple' | 'orange' | 'watermelon' | 'kiwi' | 'peach';
export type ItemKind = FruitKind | 'bomb' | 'golden' | 'ice' | 'frenzy';

export const FRUITS: readonly FruitKind[] = ['apple', 'orange', 'watermelon', 'kiwi', 'peach'];

export interface RunStats {
  score: number;
  combo: number;
  maxCombo: number;
  lives: number;
  sliced: number;
  missed: number;
  bombsHit: number;
  lastSliceAt: number;
}

export interface SliceResult {
  stats: RunStats;
  points: number;
  effect: 'juice' | 'blast' | 'golden' | 'freeze' | 'frenzy';
  label: string;
}

export function createStats(): RunStats {
  return { score: 0, combo: 0, maxCombo: 0, lives: 3, sliced: 0, missed: 0, bombsHit: 0, lastSliceAt: 0 };
}

export function applySlice(stats: RunStats, kind: ItemKind, mode: GameMode, now: number): SliceResult {
  if (kind === 'bomb') {
    const losesLife = mode === 'adventure' || mode === 'survival';
    const next = {
      ...stats,
      score: Math.max(0, stats.score - 100),
      combo: 0,
      lives: losesLife ? Math.max(0, stats.lives - 1) : stats.lives,
      bombsHit: stats.bombsHit + 1,
      lastSliceAt: now,
    };
    return { stats: next, points: -100, effect: 'blast', label: losesLife ? '炸弹！失去一命' : '炸弹！-100' };
  }

  const combo = now - stats.lastSliceAt <= 850 ? stats.combo + 1 : 1;
  const multiplier = Math.min(5, 1 + Math.floor(combo / 3));
  const base = kind === 'golden' ? 75 : kind === 'ice' || kind === 'frenzy' ? 30 : 10;
  const points = base * multiplier;
  const effect = kind === 'golden' ? 'golden' : kind === 'ice' ? 'freeze' : kind === 'frenzy' ? 'frenzy' : 'juice';
  const label = kind === 'golden' ? `黄金果 +${points}` : kind === 'ice' ? `冰封时间 +${points}` : kind === 'frenzy' ? `狂热爆发 +${points}` : combo >= 3 ? `${combo} 连斩 · +${points}` : `+${points}`;
  return {
    stats: {
      ...stats,
      score: stats.score + points,
      combo,
      maxCombo: Math.max(stats.maxCombo, combo),
      sliced: stats.sliced + 1,
      lastSliceAt: now,
    },
    points,
    effect,
    label,
  };
}

export function applyMiss(stats: RunStats, mode: GameMode): RunStats {
  const losesLife = mode === 'adventure' || mode === 'survival';
  return {
    ...stats,
    combo: 0,
    missed: stats.missed + 1,
    lives: losesLife ? Math.max(0, stats.lives - 1) : stats.lives,
  };
}

export function calculateRank(score: number, targetScore: number): 'S' | 'A' | 'B' | 'C' {
  if (targetScore <= 0) {
    if (score >= 2400) return 'S';
    if (score >= 1400) return 'A';
    if (score >= 700) return 'B';
    return 'C';
  }
  const ratio = score / targetScore;
  if (ratio >= 1.5) return 'S';
  if (ratio >= 1.2) return 'A';
  if (ratio >= 1) return 'B';
  return 'C';
}

export function isRunWon(mode: GameMode, score: number, targetScore: number, lives: number): boolean {
  if (mode === 'adventure') return score >= targetScore && lives > 0;
  if (mode === 'survival') return lives > 0;
  return true;
}

export function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
