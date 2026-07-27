import ArrowLeft from 'lucide/dist/esm/icons/arrow-left.js';
import Check from 'lucide/dist/esm/icons/check.js';
import ChevronRight from 'lucide/dist/esm/icons/chevron-right.js';
import Heart from 'lucide/dist/esm/icons/heart.js';
import Lock from 'lucide/dist/esm/icons/lock.js';
import LogOut from 'lucide/dist/esm/icons/log-out.js';
import Pause from 'lucide/dist/esm/icons/pause.js';
import Play from 'lucide/dist/esm/icons/play.js';
import RotateCcw from 'lucide/dist/esm/icons/rotate-ccw.js';
import Volume2 from 'lucide/dist/esm/icons/volume-2.js';
import VolumeX from 'lucide/dist/esm/icons/volume-x.js';
import { LEVELS, MODE_COPY, type GameMode } from './config';
import { FruitNinjaGame, type GameResult, type GameStatus } from './game';
import { calculateRank } from './rules';
import './style.css';

type IconNode = readonly [string, Readonly<Record<string, string | number>>, children?: readonly IconNode[]];

const icons: Record<string, IconNode> = {
  'arrow-left': ArrowLeft,
  check: Check,
  'chevron-right': ChevronRight,
  heart: Heart,
  lock: Lock,
  'log-out': LogOut,
  pause: Pause,
  play: Play,
  'rotate-ccw': RotateCcw,
  'volume-2': Volume2,
  'volume-x': VolumeX,
};

function createIconNode(node: IconNode): SVGElement {
  const [tag, values, children = []] = node;
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(values)) element.setAttribute(key, String(value));
  for (const child of children) element.append(createIconNode(child));
  return element;
}

function refreshIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-lucide]').forEach((placeholder) => {
    const icon = icons[placeholder.dataset.lucide ?? ''];
    if (!icon) return;
    const svg = createIconNode(icon);
    if (!(svg instanceof SVGSVGElement)) return;
    if (placeholder.className) svg.setAttribute('class', placeholder.className);
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('aria-hidden', 'true');
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
const levelPanel = required<HTMLElement>('#level-panel');
const quickPanel = required<HTMLElement>('#quick-panel');
const levelList = required<HTMLElement>('#level-list');
const modeCaption = required<HTMLElement>('#mode-caption');
const progressCopy = required<HTMLElement>('#progress-copy');
const startButton = required<HTMLButtonElement>('#start-button');
const pauseDialog = required<HTMLDialogElement>('#pause-dialog');
const resultDialog = required<HTMLDialogElement>('#result-dialog');
const soundButton = required<HTMLButtonElement>('#sound-button');
const game = new FruitNinjaGame();

let mode: GameMode = 'adventure';
let selectedLevel = 1;
let unlockedLevel = Math.min(LEVELS.length, Math.max(1, Number(localStorage.getItem('blade-orchard-unlocked') ?? '1')));
let muted = localStorage.getItem('blade-orchard-muted') === 'true';
let lastStatus: GameStatus = { score: 0, combo: 0, lives: 3, seconds: 0, progress: 0, objective: '', runName: '' };
let pauseTrigger: HTMLElement | null = null;

function renderLevels(): void {
  levelList.replaceChildren();
  for (const level of LEVELS) {
    const locked = level.id > unlockedLevel;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `level-button${selectedLevel === level.id ? ' is-selected' : ''}`;
    button.disabled = locked;
    button.dataset.level = String(level.id);
    button.setAttribute('aria-pressed', String(selectedLevel === level.id));
    button.setAttribute('aria-label', locked ? `第 ${level.id} 关 ${level.name}，尚未解锁` : `第 ${level.id} 关 ${level.name}，${level.objective}`);
    button.innerHTML = `<span class="level-number">${locked ? '<i data-lucide="lock" aria-hidden="true"></i>' : String(level.id).padStart(2, '0')}</span><span><strong>${level.name}</strong><small>${level.location}</small></span>${level.id < unlockedLevel ? '<i data-lucide="check" aria-hidden="true"></i>' : ''}`;
    button.addEventListener('click', () => {
      selectedLevel = level.id;
      renderLevels();
      updateStartLabel();
    });
    levelList.append(button);
  }
  progressCopy.textContent = `已解锁 ${unlockedLevel} / ${LEVELS.length}`;
  refreshIcons(levelList);
}

function updateStartLabel(): void {
  const text = startButton.querySelector('span');
  if (!text) return;
  text.textContent = mode === 'adventure' ? `开始第 ${selectedLevel} 关` : `开始${MODE_COPY[mode].label}模式`;
}

function selectMode(nextMode: GameMode): void {
  mode = nextMode;
  document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const adventure = mode === 'adventure';
  levelPanel.hidden = !adventure;
  quickPanel.hidden = adventure;
  modeCaption.innerHTML = `<strong>${MODE_COPY[mode].label}</strong><span>${MODE_COPY[mode].caption}</span>`;
  updateStartLabel();
}

function startRun(): void {
  if (pauseDialog.open) pauseDialog.close();
  if (resultDialog.open) resultDialog.close();
  menu.classList.add('is-hidden');
  hud.hidden = false;
  game.start(mode, selectedLevel);
  required<HTMLElement>('#sr-status').textContent = `${MODE_COPY[mode].label}模式开始`;
}

function returnToMenu(): void {
  if (pauseDialog.open) pauseDialog.close();
  if (resultDialog.open) resultDialog.close();
  game.stop();
  hud.hidden = true;
  menu.classList.remove('is-hidden');
  startButton.focus();
}

function openPause(trigger: HTMLElement): void {
  pauseTrigger = trigger;
  game.pause();
  required<HTMLElement>('#pause-score').textContent = lastStatus.score.toLocaleString('zh-CN');
  pauseDialog.showModal();
  required<HTMLButtonElement>('#resume-button').focus();
}

function resumeRun(): void {
  pauseDialog.close();
  game.resume();
  pauseTrigger?.focus();
}

function updateStatus(status: GameStatus): void {
  lastStatus = status;
  required<HTMLElement>('#score-value').textContent = status.score.toLocaleString('zh-CN');
  required<HTMLElement>('#time-value').textContent = String(status.seconds);
  required<HTMLElement>('#run-name').textContent = status.runName;
  required<HTMLElement>('#objective-value').textContent = status.objective;
  required<HTMLElement>('#score-progress').style.transform = `scaleX(${status.progress})`;
  const combo = required<HTMLElement>('#combo');
  combo.textContent = status.combo >= 2 ? `${status.combo} 连斩` : '';
  combo.classList.toggle('is-visible', status.combo >= 2);
  const lives = required<HTMLElement>('#lives');
  lives.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const icon = document.createElement('i');
    icon.dataset.lucide = 'heart';
    icon.className = index < status.lives ? 'is-full' : '';
    icon.setAttribute('aria-hidden', 'true');
    lives.append(icon);
  }
  lives.setAttribute('aria-label', `剩余生命 ${status.lives}`);
  refreshIcons(lives);
}

function showResult(result: GameResult): void {
  const rank = calculateRank(result.stats.score, result.config.targetScore);
  const won = result.won;
  required<HTMLElement>('#result-kicker').textContent = won ? '试炼完成' : '试炼未竟';
  required<HTMLElement>('#result-title').textContent = won ? (rank === 'S' ? '一代宗师' : rank === 'A' ? '锋芒毕露' : '锋芒初现') : '重整刀锋';
  const rankElement = required<HTMLElement>('#rank-value');
  rankElement.textContent = rank;
  rankElement.dataset.rank = rank;
  rankElement.setAttribute('aria-label', `评级 ${rank}`);
  required<HTMLElement>('#result-score').textContent = result.stats.score.toLocaleString('zh-CN');
  required<HTMLElement>('#result-combo').textContent = String(result.stats.maxCombo);
  required<HTMLElement>('#result-sliced').textContent = String(result.stats.sliced);

  const nextButton = required<HTMLButtonElement>('#next-button');
  const canAdvance = result.mode === 'adventure' && won && result.levelId < LEVELS.length;
  nextButton.hidden = !canAdvance;
  if (canAdvance) {
    unlockedLevel = Math.max(unlockedLevel, result.levelId + 1);
    localStorage.setItem('blade-orchard-unlocked', String(unlockedLevel));
    renderLevels();
  }
  resultDialog.showModal();
  (canAdvance ? nextButton : required<HTMLButtonElement>('#result-restart-button')).focus();
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

function toggleSound(): void {
  muted = !muted;
  localStorage.setItem('blade-orchard-muted', String(muted));
  renderSoundControl();
}

document.querySelectorAll<HTMLButtonElement>('.mode-tab').forEach((tab, index, tabs) => {
  tab.addEventListener('click', () => selectMode(tab.dataset.mode as GameMode));
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const target = tabs[(index + offset + tabs.length) % tabs.length];
    target?.focus();
    target?.click();
  });
});

startButton.addEventListener('click', startRun);
required<HTMLButtonElement>('#pause-button').addEventListener('click', (event) => openPause(event.currentTarget as HTMLElement));
soundButton.addEventListener('click', toggleSound);
required<HTMLButtonElement>('#resume-button').addEventListener('click', resumeRun);
required<HTMLButtonElement>('#restart-button').addEventListener('click', startRun);
required<HTMLButtonElement>('#exit-button').addEventListener('click', returnToMenu);
required<HTMLButtonElement>('#result-restart-button').addEventListener('click', startRun);
required<HTMLButtonElement>('#result-exit-button').addEventListener('click', returnToMenu);
required<HTMLButtonElement>('#next-button').addEventListener('click', () => {
  selectedLevel = Math.min(LEVELS.length, selectedLevel + 1);
  startRun();
});

pauseDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  resumeRun();
});
resultDialog.addEventListener('cancel', (event) => {
  event.preventDefault();
  returnToMenu();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.classList.contains('is-hidden') && !pauseDialog.open && !resultDialog.open) {
    event.preventDefault();
    openPause(required<HTMLButtonElement>('#pause-button'));
  }
});
window.addEventListener('blade:status', (event) => updateStatus((event as CustomEvent<GameStatus>).detail));
window.addEventListener('blade:feedback', (event) => {
  const detail = (event as CustomEvent<{ label: string }>).detail;
  const combo = required<HTMLElement>('#combo');
  combo.textContent = detail.label;
  combo.classList.add('is-visible');
  required<HTMLElement>('#sr-status').textContent = detail.label;
});
window.addEventListener('blade:end', (event) => showResult((event as CustomEvent<GameResult>).detail));
window.addEventListener('beforeunload', () => game.destroy());

renderLevels();
selectMode('adventure');
refreshIcons();
renderSoundControl();
