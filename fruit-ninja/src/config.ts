export type GameMode = 'adventure' | 'arcade' | 'zen' | 'survival';

export interface LevelConfig {
  id: number;
  name: string;
  location: string;
  objective: string;
  targetScore: number;
  duration: number;
  spawnDelay: number;
  gravity: number;
  bombChance: number;
  specialChance: number;
  burstMin: number;
  burstMax: number;
  wind: number;
  tint: number;
}

export const LEVELS: readonly LevelConfig[] = [
  { id: 1, name: '初试锋芒', location: '青竹道场', objective: '达到 500 分', targetScore: 500, duration: 45, spawnDelay: 900, gravity: 860, bombChance: 0.04, specialChance: 0.05, burstMin: 1, burstMax: 2, wind: 0, tint: 0xffffff },
  { id: 2, name: '果园疾风', location: '晨光果园', objective: '达到 900 分', targetScore: 900, duration: 50, spawnDelay: 760, gravity: 900, bombChance: 0.08, specialChance: 0.07, burstMin: 1, burstMax: 3, wind: 22, tint: 0xfff1cc },
  { id: 3, name: '夜市乱舞', location: '灯火夜市', objective: '达到 1,400 分', targetScore: 1400, duration: 55, spawnDelay: 650, gravity: 940, bombChance: 0.12, specialChance: 0.09, burstMin: 2, burstMax: 3, wind: -30, tint: 0xd9ddff },
  { id: 4, name: '霜刃试炼', location: '雪岭祭坛', objective: '达到 2,000 分', targetScore: 2000, duration: 60, spawnDelay: 560, gravity: 980, bombChance: 0.15, specialChance: 0.12, burstMin: 2, burstMax: 4, wind: 38, tint: 0xccefff },
  { id: 5, name: '熔火连斩', location: '赤焰火山', objective: '达到 2,700 分', targetScore: 2700, duration: 65, spawnDelay: 480, gravity: 1020, bombChance: 0.18, specialChance: 0.13, burstMin: 2, burstMax: 4, wind: -45, tint: 0xffc9a9 },
  { id: 6, name: '宗师之境', location: '月影天守', objective: '达到 3,600 分', targetScore: 3600, duration: 70, spawnDelay: 410, gravity: 1070, bombChance: 0.22, specialChance: 0.15, burstMin: 2, burstMax: 5, wind: 52, tint: 0xe5d6ff },
] as const;

export const MODE_COPY: Record<GameMode, { label: string; caption: string }> = {
  adventure: { label: '冒险', caption: '六重试炼' },
  arcade: { label: '街机', caption: '90 秒高分' },
  zen: { label: '禅境', caption: '无炸弹连斩' },
  survival: { label: '生存', caption: '极限三命' },
};

export function getRunConfig(mode: GameMode, levelId: number): LevelConfig {
  if (mode === 'adventure') return LEVELS.find((level) => level.id === levelId) ?? LEVELS[0]!;
  const base = LEVELS[2]!;
  if (mode === 'arcade') return { ...base, id: 0, name: '街机狂热', location: '百果擂台', objective: '90 秒内挑战最高分', targetScore: 0, duration: 90, spawnDelay: 520, bombChance: 0.14, specialChance: 0.16 };
  if (mode === 'zen') return { ...base, id: 0, name: '禅境连斩', location: '静心庭院', objective: '60 秒无炸弹连斩', targetScore: 0, duration: 60, spawnDelay: 650, bombChance: 0, specialChance: 0.08, wind: 0 };
  return { ...base, id: 0, name: '无尽生存', location: '风暴竹林', objective: '守住三条生命', targetScore: 0, duration: 120, spawnDelay: 500, bombChance: 0.2, specialChance: 0.12, burstMax: 4 };
}
