import { describe, expect, it } from 'vitest';
import { calculateRunScore, resolveEnemyContact, sanitizeUnlocked, unlockedAfterWin } from './rules';

describe('platformer rules', () => {
  it('distinguishes a downward stomp from dangerous contact', () => {
    expect(resolveEnemyContact(220, 205, 280)).toBe('stomp');
    expect(resolveEnemyContact(250, 205, 280)).toBe('hurt');
    expect(resolveEnemyContact(215, 205, -40)).toBe('hurt');
  });

  it('scores collected coins, defeated enemies and remaining time', () => {
    expect(calculateRunScore(8, 3, 42.9)).toBe(1970);
    expect(calculateRunScore(0, 0, -3)).toBe(0);
  });

  it('unlocks only the next available stage and clamps saved progress', () => {
    expect(unlockedAfterWin(1, 1, 3)).toBe(2);
    expect(unlockedAfterWin(3, 1, 3)).toBe(3);
    expect(unlockedAfterWin(3, 3, 3)).toBe(3);
    expect(sanitizeUnlocked('2', 3)).toBe(2);
    expect(sanitizeUnlocked('20', 3)).toBe(3);
    expect(sanitizeUnlocked('invalid', 3)).toBe(1);
  });
});
