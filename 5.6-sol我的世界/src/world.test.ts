import { describe, expect, it } from 'vitest';
import { BlockType, VoxelWorld, WORLD_HEIGHT, WORLD_SIZE } from './world';

describe('VoxelWorld', () => {
  it('generates the same terrain for the same seed', () => {
    const first = new VoxelWorld(5601);
    const second = new VoxelWorld(5601);
    for (let x = 0; x < WORLD_SIZE; x += 3) {
      for (let z = 0; z < WORLD_SIZE; z += 3) {
        expect(first.surfaceHeight(x, z)).toBe(second.surfaceHeight(x, z));
      }
    }
  });

  it('keeps spawn above solid terrain and inside the world', () => {
    const world = new VoxelWorld(1234);
    const spawn = world.getSpawn();
    expect(spawn.x).toBeGreaterThan(0);
    expect(spawn.x).toBeLessThan(WORLD_SIZE);
    expect(spawn.y).toBeGreaterThan(1);
    expect(spawn.y).toBeLessThan(WORLD_HEIGHT);
    expect(world.isSolid(Math.floor(spawn.x), Math.floor(spawn.y - 1), Math.floor(spawn.z))).toBe(true);
  });

  it('persists player edits without allowing bedrock removal', () => {
    const world = new VoxelWorld(5678);
    expect(world.setBlock(3, 0, 3, BlockType.Air)).toBe(false);
    const y = world.surfaceHeight(5, 5) + 1;
    expect(world.setBlock(5, y, 5, BlockType.Brick)).toBe(true);

    const restored = VoxelWorld.fromSave(world.serialize());
    expect(restored).not.toBeNull();
    expect(restored?.getBlock(5, y, 5)).toBe(BlockType.Brick);
    expect(restored?.seed).toBe(5678);
  });

  it('rejects malformed saves', () => {
    expect(VoxelWorld.fromSave(null)).toBeNull();
    expect(VoxelWorld.fromSave({ version: 2, seed: 4, edits: [] })).toBeNull();
  });
});
