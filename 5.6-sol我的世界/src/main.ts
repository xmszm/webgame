import ArrowUp from 'lucide/dist/esm/icons/arrow-up.mjs';
import Box from 'lucide/dist/esm/icons/box.mjs';
import Heart from 'lucide/dist/esm/icons/heart.mjs';
import LogOut from 'lucide/dist/esm/icons/log-out.mjs';
import Pause from 'lucide/dist/esm/icons/pause.mjs';
import Pickaxe from 'lucide/dist/esm/icons/pickaxe.mjs';
import Play from 'lucide/dist/esm/icons/play.mjs';
import RefreshCw from 'lucide/dist/esm/icons/refresh-cw.mjs';
import TriangleAlert from 'lucide/dist/esm/icons/triangle-alert.mjs';
import Volume2 from 'lucide/dist/esm/icons/volume-2.mjs';
import VolumeX from 'lucide/dist/esm/icons/volume-x.mjs';
import './style.css';
import { MinecraftGame } from './game';

type IconNode = ReadonlyArray<readonly [string, Readonly<Record<string, string | number>>]>;

const gameIcons: Record<string, IconNode> = {
  'arrow-up': ArrowUp,
  box: Box,
  heart: Heart,
  'log-out': LogOut,
  pause: Pause,
  pickaxe: Pickaxe,
  play: Play,
  'refresh-cw': RefreshCw,
  'triangle-alert': TriangleAlert,
  'volume-2': Volume2,
  'volume-x': VolumeX,
};

function refreshIcons(): void {
  document.querySelectorAll<HTMLElement>('[data-lucide]').forEach((placeholder) => {
    const name = placeholder.dataset.lucide ?? '';
    const icon = gameIcons[name];
    if (!icon) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const attributes = {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '24',
      height: '24',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    };
    for (const [key, value] of Object.entries(attributes)) svg.setAttribute(key, value);
    for (const [tag, nodeAttributes] of icon) {
      const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(nodeAttributes)) child.setAttribute(key, String(value));
      svg.append(child);
    }
    placeholder.replaceWith(svg);
  });
}

refreshIcons();
document.addEventListener('refresh-icons', refreshIcons);
new MinecraftGame();
