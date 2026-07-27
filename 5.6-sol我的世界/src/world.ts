export const WORLD_SIZE = 36;
export const WORLD_HEIGHT = 24;
export const SEA_LEVEL = 5;
export const SAVE_KEY = 'sol56-minecraft-world-v1';

export enum BlockType {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Sand = 4,
  Wood = 5,
  Leaves = 6,
  Brick = 7,
  Bedrock = 8,
}

export interface BlockDefinition {
  name: string;
  swatch: string;
}

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  [BlockType.Air]: { name: '空气', swatch: '#9fd5ee' },
  [BlockType.Grass]: { name: '草方块', swatch: '#62a83f' },
  [BlockType.Dirt]: { name: '泥土', swatch: '#885a35' },
  [BlockType.Stone]: { name: '圆石', swatch: '#7f8587' },
  [BlockType.Sand]: { name: '沙子', swatch: '#d8c17c' },
  [BlockType.Wood]: { name: '橡木', swatch: '#8b6639' },
  [BlockType.Leaves]: { name: '树叶', swatch: '#3f7f3b' },
  [BlockType.Brick]: { name: '红砖', swatch: '#a14e3f' },
  [BlockType.Bedrock]: { name: '基岩', swatch: '#34383a' },
};

export const PLACEABLE_BLOCKS = [
  BlockType.Grass,
  BlockType.Dirt,
  BlockType.Stone,
  BlockType.Sand,
  BlockType.Wood,
  BlockType.Brick,
] as const;

export interface WorldSave {
  version: 1;
  seed: number;
  edits: Array<[string, BlockType]>;
}

export function blockKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

export function parseBlockKey(key: string): [number, number, number] {
  const values = key.split(',').map(Number);
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

function hash2(x: number, z: number, seed: number): number {
  let value = Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function valueNoise(x: number, z: number, seed: number, scale: number): number {
  const scaledX = x / scale;
  const scaledZ = z / scale;
  const x0 = Math.floor(scaledX);
  const z0 = Math.floor(scaledZ);
  const tx = smoothstep(scaledX - x0);
  const tz = smoothstep(scaledZ - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * tz;
}

function terrainHeight(x: number, z: number, seed: number): number {
  const broad = valueNoise(x, z, seed, 12);
  const detail = valueNoise(x, z, seed + 91, 5);
  const center = (WORLD_SIZE - 1) / 2;
  const edgeDistance = Math.max(Math.abs(x - center), Math.abs(z - center)) / center;
  const islandFalloff = Math.max(0, edgeDistance - 0.68) * 5;
  return Math.max(3, Math.min(12, Math.floor(4.6 + broad * 5 + detail * 2 - islandFalloff)));
}

export class VoxelWorld {
  readonly seed: number;
  private readonly baseBlocks = new Map<string, BlockType>();
  private readonly edits = new Map<string, BlockType>();

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.generate();
  }

  private generate(): void {
    const heights = new Int8Array(WORLD_SIZE * WORLD_SIZE);

    for (let x = 0; x < WORLD_SIZE; x += 1) {
      for (let z = 0; z < WORLD_SIZE; z += 1) {
        const height = terrainHeight(x, z, this.seed);
        heights[x * WORLD_SIZE + z] = height;
        for (let y = 0; y <= height; y += 1) {
          let block = BlockType.Stone;
          if (y === 0) block = BlockType.Bedrock;
          else if (y === height) block = height <= SEA_LEVEL ? BlockType.Sand : BlockType.Grass;
          else if (y >= height - 2) block = height <= SEA_LEVEL ? BlockType.Sand : BlockType.Dirt;
          this.baseBlocks.set(blockKey(x, y, z), block);
        }
      }
    }

    const center = (WORLD_SIZE - 1) / 2;
    for (let x = 2; x < WORLD_SIZE - 2; x += 1) {
      for (let z = 2; z < WORLD_SIZE - 2; z += 1) {
        const height = heights[x * WORLD_SIZE + z] ?? 0;
        const farFromSpawn = Math.hypot(x - center, z - center) > 5;
        if (height > SEA_LEVEL && farFromSpawn && hash2(x, z, this.seed + 407) > 0.955) {
          this.addTree(x, height + 1, z, hash2(x, z, this.seed + 809) > 0.48 ? 4 : 3);
        }
      }
    }
  }

  private addTree(x: number, y: number, z: number, trunkHeight: number): void {
    for (let trunkY = y; trunkY < y + trunkHeight; trunkY += 1) {
      this.baseBlocks.set(blockKey(x, trunkY, z), BlockType.Wood);
    }
    const crownY = y + trunkHeight - 1;
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
          if (!corner && Math.abs(dx) + Math.abs(dz) + Math.abs(dy) < 5) {
            const key = blockKey(x + dx, crownY + dy, z + dz);
            if (!this.baseBlocks.has(key)) this.baseBlocks.set(key, BlockType.Leaves);
          }
        }
      }
    }
    this.baseBlocks.set(blockKey(x, crownY + 2, z), BlockType.Leaves);
  }

  isInBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < WORLD_SIZE && z >= 0 && z < WORLD_SIZE && y >= 0 && y < WORLD_HEIGHT;
  }

  getBlock(x: number, y: number, z: number): BlockType {
    if (!this.isInBounds(x, y, z)) return BlockType.Air;
    const key = blockKey(x, y, z);
    return this.edits.get(key) ?? this.baseBlocks.get(key) ?? BlockType.Air;
  }

  setBlock(x: number, y: number, z: number, type: BlockType): boolean {
    if (!this.isInBounds(x, y, z) || this.getBlock(x, y, z) === BlockType.Bedrock) return false;
    const key = blockKey(x, y, z);
    const original = this.baseBlocks.get(key) ?? BlockType.Air;
    if (type === original) this.edits.delete(key);
    else this.edits.set(key, type);
    return true;
  }

  isSolid(x: number, y: number, z: number): boolean {
    const type = this.getBlock(x, y, z);
    return type !== BlockType.Air && type !== BlockType.Leaves;
  }

  surfaceHeight(x: number, z: number): number {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y -= 1) {
      const type = this.getBlock(x, y, z);
      if (type !== BlockType.Air && type !== BlockType.Leaves && type !== BlockType.Wood) return y;
    }
    return 0;
  }

  getSpawn(): { x: number; y: number; z: number } {
    const x = Math.floor(WORLD_SIZE / 2);
    const z = Math.floor(WORLD_SIZE / 2);
    return { x: x + 0.5, y: this.surfaceHeight(x, z) + 1.05, z: z + 0.5 };
  }

  forEachVisible(visitor: (type: BlockType, x: number, y: number, z: number) => void): void {
    for (let x = 0; x < WORLD_SIZE; x += 1) {
      for (let y = 0; y < WORLD_HEIGHT; y += 1) {
        for (let z = 0; z < WORLD_SIZE; z += 1) {
          const type = this.getBlock(x, y, z);
          if (type !== BlockType.Air && this.hasExposedFace(x, y, z)) visitor(type, x, y, z);
        }
      }
    }
  }

  private hasExposedFace(x: number, y: number, z: number): boolean {
    return (
      this.getBlock(x + 1, y, z) === BlockType.Air ||
      this.getBlock(x - 1, y, z) === BlockType.Air ||
      this.getBlock(x, y + 1, z) === BlockType.Air ||
      this.getBlock(x, y - 1, z) === BlockType.Air ||
      this.getBlock(x, y, z + 1) === BlockType.Air ||
      this.getBlock(x, y, z - 1) === BlockType.Air
    );
  }

  serialize(): WorldSave {
    return { version: 1, seed: this.seed, edits: [...this.edits.entries()] };
  }

  static fromSave(value: unknown): VoxelWorld | null {
    if (!value || typeof value !== 'object') return null;
    const save = value as Partial<WorldSave>;
    if (save.version !== 1 || typeof save.seed !== 'number' || !Array.isArray(save.edits)) return null;
    const world = new VoxelWorld(save.seed);
    for (const entry of save.edits) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') continue;
      const type = entry[1];
      const [x, y, z] = parseBlockKey(entry[0]);
      if (typeof type === 'number' && type >= BlockType.Air && type <= BlockType.Bedrock) {
        world.setBlock(x, y, z, type);
      }
    }
    return world;
  }
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
}
