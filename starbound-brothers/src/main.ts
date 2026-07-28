import ArrowLeft from 'lucide/dist/esm/icons/arrow-left.mjs';
import ArrowUp from 'lucide/dist/esm/icons/arrow-up.mjs';
import ChevronLeft from 'lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.mjs';
import Lock from 'lucide/dist/esm/icons/lock.mjs';
import LogOut from 'lucide/dist/esm/icons/log-out.mjs';
import Pause from 'lucide/dist/esm/icons/pause.mjs';
import Play from 'lucide/dist/esm/icons/play.mjs';
import RotateCcw from 'lucide/dist/esm/icons/rotate-ccw.mjs';
import Star from 'lucide/dist/esm/icons/star.mjs';
import Volume2 from 'lucide/dist/esm/icons/volume-2.mjs';
import VolumeX from 'lucide/dist/esm/icons/volume-x.mjs';
import { LEVELS } from './config';
import { PlatformGame, type GameStatus, type RunResult } from './game';
import { sanitizeUnlocked, unlockedAfterWin } from './rules';
import './style.css';

type IconNode = ReadonlyArray<readonly [string, Readonly<Record<string, string | number>>]>;

const icons: Record<string, IconNode> = {
  'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  lock: Lock,
  'log-out': LogOut,
  pause: Pause,
  play: Play,
  'rotate-ccw': RotateCcw,
  star: Star,
  'volume-2': Volume2,
  'volume-x': VolumeX,
};

function createIcon(icon: IconNode): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const attributes = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: '24',
    height: '24',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2.4',
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
  return svg;
}

function refreshIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-lucide]').forEach((placeholder) => {
    const icon = icons[placeholder.dataset.lucide ?? ''];
    if (!icon) return;
    const svg = createIcon(icon);
    if (placeholder.className) svg.setAttribute('class', placeholder.className);
    placeholder.replaceWith(svg);
  });
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

const menu = required<HTMLElement>('#menu-screen');
const hud = required<HTMLElement>('#hud');
const touchControls = required<HTMLElement>('#touch-controls');
const levelList = required<HTMLElement>('#level-list');
const startButton = required<HTMLButtonElement>('#start-button');
const pauseDialog = required<HTMLDialogElement>('#pause-dialog');
const resultDialog = required<HTMLDialogElement>('#result-dialog');
const soundButton = required<HTMLButtonElement>('#sound-button');
const statusRegion = required<HTMLElement>('#sr-status');
const unlockStorageKey = 'starbound-brothers-unlocked';

let unlocked = sanitizeUnlocked(localStorage.getItem(unlockStorageKey), LEVELS.length);
let selectedLevel = 1;
let activeLevel = 1;
let running = false;
let muted = localStorage.getItem('starbound-brothers-muted') === 'true';
let pauseTrigger: HTMLElement | null = null;

const game = new PlatformGame('game-stage', {
  onStatus: updateStatus,
  onEnd: showResult,
  onAnnouncement: (message) => { statusRegion.textContent = message; },
});

function renderLevels(): void {
  levelList.replaceChildren();
  for (const level of LEVELS) {
    const locked = level.id > unlocked;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `level-button${selectedLevel === level.id ? ' is-selected' : ''}`;
    button.disabled = locked;
    button.dataset.level = String(level.id);
    button.setAttribute('aria-pressed', String(selectedLevel === level.id));
    button.setAttribute('aria-label', locked ? `第 ${level.id} 关 ${level.name}，尚未解锁` : `第 ${level.id} 关 ${level.name}，${level.subtitle}`);
    button.innerHTML = locked
      ? `<span><i data-lucide="lock" aria-hidden="true"></i></span><strong>${level.name}</strong><small>尚未解锁</small>`
      : `<span>STAGE ${String(level.id).padStart(2, '0')}</span><strong>${level.name}</strong><small>${level.subtitle}</small>`;
    button.addEventListener('click', () => {
      selectedLevel = level.id;
      renderLevels();
      game.showPreview(selectedLevel);
    });
    levelList.append(button);
  }
  required<HTMLElement>('#unlock-copy').textContent = `${unlocked} / ${LEVELS.length}`;
  refreshIcons(levelList);
}

function startRun(): void {
  if (pauseDialog.open) pauseDialog.close();
  if (resultDialog.open) resultDialog.close();
  activeLevel = selectedLevel;
  running = true;
  menu.classList.add('is-hidden');
  hud.hidden = false;
  touchControls.hidden = false;
  game.start(activeLevel);
  statusRegion.textContent = `第 ${activeLevel} 关开始`;
}

function updateStatus(status: GameStatus): void {
  required<HTMLElement>('#score-value').textContent = String(status.score).padStart(6, '0');
  required<HTMLElement>('#coin-value').textContent = String(status.coins).padStart(2, '0');
  required<HTMLElement>('#lives-value').textContent = String(status.lives);
  required<HTMLElement>('#time-value').textContent = String(status.seconds);
  required<HTMLElement>('#level-name').textContent = `${status.levelId}-${status.levelName}`;
  required<HTMLElement>('#run-progress').style.transform = `scaleX(${status.progress})`;
}

function showResult(result: RunResult): void {
  running = false;
  touchControls.hidden = true;
  resultDialog.classList.toggle('is-loss', !result.won);
  required<HTMLElement>('#result-kicker').textContent = result.won ? '关卡完成' : '冒险中断';
  required<HTMLElement>('#result-title').textContent = result.won ? '旗帜升起' : '重新整装';
  required<HTMLElement>('#result-score').textContent = result.score.toLocaleString('zh-CN');
  required<HTMLElement>('#result-coins').textContent = String(result.coins);
  required<HTMLElement>('#result-enemies').textContent = String(result.enemies);

  if (result.won) {
    unlocked = unlockedAfterWin(unlocked, result.levelId, LEVELS.length);
    localStorage.setItem(unlockStorageKey, String(unlocked));
    renderLevels();
  }
  const nextButton = required<HTMLButtonElement>('#next-button');
  const canAdvance = result.won && result.levelId < LEVELS.length;
  nextButton.hidden = !canAdvance;
  resultDialog.showModal();
  (canAdvance ? nextButton : required<HTMLButtonElement>('#result-restart-button')).focus();
  statusRegion.textContent = result.won ? `第 ${result.levelId} 关完成` : `生命耗尽，关卡失败`;
}

function returnToMap(): void {
  if (pauseDialog.open) pauseDialog.close();
  if (resultDialog.open) resultDialog.close();
  running = false;
  hud.hidden = true;
  touchControls.hidden = true;
  menu.classList.remove('is-hidden');
  selectedLevel = activeLevel;
  renderLevels();
  game.showPreview(selectedLevel);
  startButton.focus();
}

function openPause(trigger: HTMLElement): void {
  if (!running || pauseDialog.open || resultDialog.open) return;
  pauseTrigger = trigger;
  game.pause();
  touchControls.hidden = true;
  pauseDialog.showModal();
  required<HTMLButtonElement>('#resume-button').focus();
}

function resumeRun(): void {
  if (!pauseDialog.open) return;
  pauseDialog.close();
  game.resume();
  running = true;
  touchControls.hidden = false;
  pauseTrigger?.focus();
}

function renderSoundControl(): void {
  game.setMuted(muted);
  soundButton.setAttribute('aria-label', muted ? '开启声音' : '关闭声音');
  soundButton.setAttribute('title', muted ? '开启声音' : '声音');
  soundButton.replaceChildren();
  const icon = document.createElement('i');
  icon.dataset.lucide = muted ? 'volume-x' : 'volume-2';
  icon.setAttribute('aria-hidden', 'true');
  soundButton.append(icon);
  refreshIcons(soundButton);
}

startButton.addEventListener('click', startRun);
required<HTMLButtonElement>('#pause-button').addEventListener('click', (event) => openPause(event.currentTarget as HTMLElement));
required<HTMLButtonElement>('#resume-button').addEventListener('click', resumeRun);
required<HTMLButtonElement>('#restart-button').addEventListener('click', startRun);
required<HTMLButtonElement>('#exit-button').addEventListener('click', returnToMap);
required<HTMLButtonElement>('#result-restart-button').addEventListener('click', startRun);
required<HTMLButtonElement>('#result-exit-button').addEventListener('click', returnToMap);
required<HTMLButtonElement>('#next-button').addEventListener('click', () => {
  selectedLevel = Math.min(LEVELS.length, activeLevel + 1);
  startRun();
});
soundButton.addEventListener('click', () => {
  muted = !muted;
  renderSoundControl();
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
  const control = button.dataset.control as 'left' | 'right' | 'jump';
  const setControl = (active: boolean) => {
    button.classList.toggle('is-pressed', active);
    game.setVirtualControl(control, active);
  };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (event.isTrusted) button.setPointerCapture(event.pointerId);
    setControl(true);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    button.addEventListener(eventName, () => setControl(false));
  }
}

pauseDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  resumeRun();
});
resultDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  returnToMap();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && running && !pauseDialog.open && !resultDialog.open) {
    event.preventDefault();
    openPause(required<HTMLButtonElement>('#pause-button'));
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && running) openPause(required<HTMLButtonElement>('#pause-button'));
});
window.addEventListener('beforeunload', () => game.destroy());

renderLevels();
refreshIcons();
renderSoundControl();
