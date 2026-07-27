import * as THREE from 'three';
import { BlockType } from './world';

type TextureStyle = 'grass' | 'grass-side' | 'dirt' | 'stone' | 'sand' | 'bark' | 'wood-top' | 'leaves' | 'brick' | 'bedrock';

const PALETTES: Record<TextureStyle, readonly string[]> = {
  grass: ['#4d8e35', '#5ca43d', '#6cb449', '#3e7d2f'],
  'grass-side': ['#79502f', '#875b35', '#684328', '#5b9638'],
  dirt: ['#79502f', '#875b35', '#684328', '#9a6940'],
  stone: ['#747a7b', '#858b8c', '#626869', '#969b9a'],
  sand: ['#d2bd78', '#e0ce8a', '#c2aa67', '#eadb9c'],
  bark: ['#73512d', '#8a6336', '#604323', '#9c7442'],
  'wood-top': ['#a77b45', '#bb8d52', '#895f34', '#d09e5b'],
  leaves: ['#337334', '#438641', '#285f2b', '#57994c'],
  brick: ['#9d493b', '#ad5948', '#813a31', '#c06b56'],
  bedrock: ['#343738', '#494d4e', '#292c2d', '#5a5d5e'],
};

function hash(value: number): number {
  let next = Math.imul(value ^ (value >>> 16), 2246822507);
  next = Math.imul(next ^ (next >>> 13), 3266489909);
  return (next ^ (next >>> 16)) >>> 0;
}

function paintTexture(style: TextureStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');
  const colors = PALETTES[style];
  const baseColor = colors[0] ?? '#ff00ff';

  context.fillStyle = baseColor;
  context.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const random = hash(x * 73 + y * 173 + style.length * 997);
      context.fillStyle = colors[random % colors.length] ?? baseColor;
      context.fillRect(x, y, 1, 1);
    }
  }

  if (style === 'grass-side') {
    context.fillStyle = '#4d8e35';
    context.fillRect(0, 0, 16, 4);
    for (let x = 0; x < 16; x += 2) {
      context.fillRect(x, 4, 1, 1 + (hash(x * 31) % 3));
    }
  }
  if (style === 'bark') {
    context.fillStyle = '#54391f';
    for (let x = 1; x < 16; x += 4) context.fillRect(x, 0, 1, 16);
  }
  if (style === 'wood-top') {
    context.strokeStyle = '#76502a';
    context.strokeRect(2.5, 2.5, 11, 11);
    context.strokeRect(5.5, 5.5, 5, 5);
  }
  if (style === 'brick') {
    context.strokeStyle = '#d59a7b';
    context.lineWidth = 1;
    for (let y = 3; y < 16; y += 4) {
      context.beginPath();
      context.moveTo(0, y + 0.5);
      context.lineTo(16, y + 0.5);
      context.stroke();
      const offset = y % 8 === 3 ? 4 : 0;
      for (let x = offset; x < 16; x += 8) {
        context.beginPath();
        context.moveTo(x + 0.5, y - 3);
        context.lineTo(x + 0.5, y);
        context.stroke();
      }
    }
  }
  if (style === 'leaves') {
    context.clearRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const random = hash(x * 41 + y * 89);
        if (random % 8 !== 0) {
          context.fillStyle = colors[random % colors.length] ?? baseColor;
          context.fillRect(x, y, 1, 1);
        }
      }
    }
  }
  return canvas;
}

function texture(style: TextureStyle): THREE.CanvasTexture {
  const result = new THREE.CanvasTexture(paintTexture(style));
  result.colorSpace = THREE.SRGBColorSpace;
  result.magFilter = THREE.NearestFilter;
  result.minFilter = THREE.NearestMipmapNearestFilter;
  result.wrapS = THREE.RepeatWrapping;
  result.wrapT = THREE.RepeatWrapping;
  return result;
}

function material(style: TextureStyle, transparent = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    map: texture(style),
    transparent,
    alphaTest: transparent ? 0.35 : 0,
    side: transparent ? THREE.DoubleSide : THREE.FrontSide,
  });
}

export function createBlockMaterials(): Map<BlockType, THREE.Material[]> {
  const grassTop = material('grass');
  const grassSide = material('grass-side');
  const dirt = material('dirt');
  const woodSide = material('bark');
  const woodTop = material('wood-top');
  const leaves = material('leaves', true);

  return new Map([
    [BlockType.Grass, [grassSide, grassSide, grassTop, dirt, grassSide, grassSide]],
    [BlockType.Dirt, Array(6).fill(dirt) as THREE.Material[]],
    [BlockType.Stone, Array(6).fill(material('stone')) as THREE.Material[]],
    [BlockType.Sand, Array(6).fill(material('sand')) as THREE.Material[]],
    [BlockType.Wood, [woodSide, woodSide, woodTop, woodTop, woodSide, woodSide]],
    [BlockType.Leaves, Array(6).fill(leaves) as THREE.Material[]],
    [BlockType.Brick, Array(6).fill(material('brick')) as THREE.Material[]],
    [BlockType.Bedrock, Array(6).fill(material('bedrock')) as THREE.Material[]],
  ]);
}
