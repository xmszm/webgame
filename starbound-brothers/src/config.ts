export interface RectPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelDefinition {
  id: number;
  name: string;
  subtitle: string;
  palette: 'meadow' | 'sunset' | 'night';
  width: number;
  timeLimit: number;
  grounds: readonly RectPlacement[];
  platforms: readonly RectPlacement[];
  coins: readonly (readonly [number, number])[];
  enemies: readonly (readonly [number, number])[];
  spikes: readonly RectPlacement[];
  goalX: number;
}

export const PLAYER_SPEED = 290;
export const JUMP_SPEED = 590;
export const STARTING_LIVES = 3;
export const COIN_SCORE = 100;
export const STOMP_SCORE = 250;

export const LEVELS: readonly LevelDefinition[] = [
  {
    id: 1,
    name: '青草启程',
    subtitle: '越过风车原野，抵达星旗',
    palette: 'meadow',
    width: 3520,
    timeLimit: 105,
    grounds: [
      { x: 490, y: 688, width: 980, height: 96 },
      { x: 1570, y: 688, width: 980, height: 96 },
      { x: 2845, y: 688, width: 1370, height: 96 },
    ],
    platforms: [
      { x: 520, y: 525, width: 190, height: 34 },
      { x: 820, y: 430, width: 190, height: 34 },
      { x: 1105, y: 585, width: 120, height: 34 },
      { x: 1450, y: 515, width: 210, height: 34 },
      { x: 1850, y: 420, width: 195, height: 34 },
      { x: 2220, y: 560, width: 150, height: 34 },
      { x: 2570, y: 490, width: 220, height: 34 },
      { x: 2960, y: 395, width: 210, height: 34 },
    ],
    coins: [[390, 565], [520, 470], [790, 365], [850, 365], [910, 365], [1110, 525], [1420, 455], [1490, 455], [1815, 360], [1880, 360], [2180, 500], [2540, 430], [2610, 430], [2925, 335], [2995, 335], [3240, 570]],
    enemies: [[680, 610], [1320, 610], [1720, 610], [2440, 610], [3060, 610]],
    spikes: [{ x: 1980, y: 626, width: 96, height: 30 }],
    goalX: 3340,
  },
  {
    id: 2,
    name: '落日高塔',
    subtitle: '沿着城垣向上，穿过金色暮光',
    palette: 'sunset',
    width: 3880,
    timeLimit: 115,
    grounds: [
      { x: 420, y: 688, width: 840, height: 96 },
      { x: 1420, y: 688, width: 1040, height: 96 },
      { x: 2580, y: 688, width: 980, height: 96 },
      { x: 3560, y: 688, width: 640, height: 96 },
    ],
    platforms: [
      { x: 430, y: 535, width: 180, height: 34 },
      { x: 745, y: 420, width: 170, height: 34 },
      { x: 1010, y: 555, width: 130, height: 34 },
      { x: 1320, y: 470, width: 220, height: 34 },
      { x: 1620, y: 355, width: 170, height: 34 },
      { x: 1930, y: 500, width: 210, height: 34 },
      { x: 2280, y: 400, width: 180, height: 34 },
      { x: 2700, y: 520, width: 200, height: 34 },
      { x: 3060, y: 410, width: 200, height: 34 },
      { x: 3420, y: 305, width: 190, height: 34 },
    ],
    coins: [[350, 475], [430, 475], [700, 360], [760, 360], [1280, 410], [1350, 410], [1580, 295], [1640, 295], [1890, 440], [1960, 440], [2240, 340], [2310, 340], [2660, 460], [2730, 460], [3020, 350], [3090, 350], [3380, 245], [3450, 245], [3650, 575]],
    enemies: [[610, 610], [1190, 610], [1800, 610], [2470, 610], [2870, 610], [3550, 610]],
    spikes: [{ x: 1500, y: 626, width: 120, height: 30 }, { x: 3220, y: 626, width: 120, height: 30 }],
    goalX: 3700,
  },
  {
    id: 3,
    name: '星夜终章',
    subtitle: '登上月影山脊，点亮最后一颗星',
    palette: 'night',
    width: 4300,
    timeLimit: 125,
    grounds: [
      { x: 450, y: 688, width: 900, height: 96 },
      { x: 1430, y: 688, width: 900, height: 96 },
      { x: 2520, y: 688, width: 1080, height: 96 },
      { x: 3830, y: 688, width: 940, height: 96 },
    ],
    platforms: [
      { x: 450, y: 520, width: 170, height: 34 },
      { x: 720, y: 395, width: 160, height: 34 },
      { x: 980, y: 520, width: 150, height: 34 },
      { x: 1260, y: 420, width: 180, height: 34 },
      { x: 1540, y: 315, width: 170, height: 34 },
      { x: 1830, y: 455, width: 190, height: 34 },
      { x: 2170, y: 350, width: 170, height: 34 },
      { x: 2480, y: 500, width: 190, height: 34 },
      { x: 2800, y: 390, width: 200, height: 34 },
      { x: 3150, y: 285, width: 190, height: 34 },
      { x: 3500, y: 430, width: 190, height: 34 },
      { x: 3890, y: 335, width: 220, height: 34 },
    ],
    coins: [[390, 460], [450, 460], [680, 335], [740, 335], [940, 460], [1220, 360], [1280, 360], [1500, 255], [1560, 255], [1790, 395], [1850, 395], [2130, 290], [2190, 290], [2440, 440], [2500, 440], [2760, 330], [2830, 330], [3110, 225], [3170, 225], [3460, 370], [3530, 370], [3850, 275], [3920, 275], [4090, 570]],
    enemies: [[620, 610], [1140, 610], [1700, 610], [2340, 610], [2700, 610], [3360, 610], [3950, 610]],
    spikes: [{ x: 1350, y: 626, width: 110, height: 30 }, { x: 2900, y: 626, width: 130, height: 30 }, { x: 3650, y: 626, width: 110, height: 30 }],
    goalX: 4120,
  },
] as const;

export function getLevel(id: number): LevelDefinition {
  return LEVELS.find((level) => level.id === id) ?? LEVELS[0]!;
}
