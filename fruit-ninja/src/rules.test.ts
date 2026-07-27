import { describe, expect, it } from 'vitest';
import { getRunConfig, LEVELS } from './config';
import { applyMiss, applySlice, calculateRank, createStats, distanceToSegment, isRunWon } from './rules';

describe('fruit ninja rules', () => {
  it('builds combos and increases score multipliers', () => {
    const first = applySlice(createStats(), 'apple', 'adventure', 1_000);
    const second = applySlice(first.stats, 'kiwi', 'adventure', 1_500);
    const third = applySlice(second.stats, 'peach', 'adventure', 1_900);
    expect(third.stats.combo).toBe(3);
    expect(third.points).toBe(20);
    expect(third.stats.score).toBe(40);
  });

  it('handles hazards and misses according to each mode', () => {
    const adventureBomb = applySlice(createStats(), 'bomb', 'adventure', 1_000);
    const arcadeBomb = applySlice(createStats(), 'bomb', 'arcade', 1_000);
    expect(adventureBomb.stats.lives).toBe(2);
    expect(arcadeBomb.stats.lives).toBe(3);
    expect(applyMiss(createStats(), 'survival').lives).toBe(2);
    expect(applyMiss(createStats(), 'zen').lives).toBe(3);
  });

  it('awards special fruit effects and bounded ranks', () => {
    expect(applySlice(createStats(), 'golden', 'arcade', 2_000)).toMatchObject({ points: 75, effect: 'golden' });
    expect(applySlice(createStats(), 'ice', 'arcade', 2_000).effect).toBe('freeze');
    expect(applySlice(createStats(), 'frenzy', 'arcade', 2_000).effect).toBe('frenzy');
    expect(calculateRank(1500, 1000)).toBe('S');
    expect(calculateRank(500, 1000)).toBe('C');
  });

  it('evaluates run outcomes without narrowing mode rules', () => {
    expect(isRunWon('adventure', 500, 500, 1)).toBe(true);
    expect(isRunWon('adventure', 499, 500, 1)).toBe(false);
    expect(isRunWon('survival', 500, 0, 0)).toBe(false);
    expect(isRunWon('zen', 0, 0, 3)).toBe(true);
  });

  it('exposes six increasingly demanding adventure levels and four distinct modes', () => {
    expect(LEVELS).toHaveLength(6);
    expect(LEVELS.map((level) => level.name)).toEqual(expect.arrayContaining(['初试锋芒', '宗师之境']));
    expect(LEVELS[5]!.targetScore).toBeGreaterThan(LEVELS[0]!.targetScore);
    expect(LEVELS[5]!.spawnDelay).toBeLessThan(LEVELS[0]!.spawnDelay);
    expect(getRunConfig('arcade', 1)).toMatchObject({ duration: 90, targetScore: 0 });
    expect(getRunConfig('zen', 1)).toMatchObject({ duration: 60, bombChance: 0 });
    expect(getRunConfig('survival', 1).bombChance).toBeGreaterThan(0);
  });

  it('detects a swipe crossing an item', () => {
    expect(distanceToSegment(50, 50, 0, 50, 100, 50)).toBe(0);
    expect(distanceToSegment(50, 80, 0, 50, 100, 50)).toBe(30);
  });
});
