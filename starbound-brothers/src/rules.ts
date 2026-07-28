export type EnemyContact = 'stomp' | 'hurt';

export function resolveEnemyContact(playerBottom: number, enemyTop: number, velocityY: number): EnemyContact {
  return velocityY > 80 && playerBottom <= enemyTop + 24 ? 'stomp' : 'hurt';
}

export function calculateRunScore(coins: number, enemies: number, secondsLeft: number): number {
  return coins * 100 + enemies * 250 + Math.max(0, Math.floor(secondsLeft)) * 10;
}

export function unlockedAfterWin(currentUnlocked: number, completedLevel: number, levelCount: number): number {
  return Math.min(levelCount, Math.max(currentUnlocked, completedLevel + 1));
}

export function sanitizeUnlocked(value: string | null, levelCount: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 1;
  return Math.min(levelCount, Math.max(1, parsed));
}
