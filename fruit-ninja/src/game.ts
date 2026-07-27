import Phaser from 'phaser';
import { getRunConfig, type GameMode, type LevelConfig } from './config';
import { GameAudio } from './audio';
import { applyMiss, applySlice, createStats, distanceToSegment, FRUITS, type ItemKind, type RunStats } from './rules';

export interface GameStatus {
  score: number;
  combo: number;
  lives: number;
  seconds: number;
  progress: number;
  objective: string;
  runName: string;
}

export interface GameResult {
  mode: GameMode;
  levelId: number;
  config: LevelConfig;
  stats: RunStats;
  won: boolean;
}

type GamePhase = 'idle' | 'playing' | 'paused' | 'ended';

type SliceItem = Phaser.Physics.Arcade.Image & { body: Phaser.Physics.Arcade.Body };

const ITEM_KEYS: readonly ItemKind[] = [...FRUITS, 'bomb', 'golden', 'ice', 'frenzy'];
const JUICE_COLORS: Record<ItemKind, number> = {
  apple: 0xe64338,
  orange: 0xf49a27,
  watermelon: 0x3fc86a,
  kiwi: 0x91ca4c,
  peach: 0xff987d,
  bomb: 0x2a3033,
  golden: 0xf2c94c,
  ice: 0x8bdbf5,
  frenzy: 0xffd548,
};

class BladeScene extends Phaser.Scene {
  private readonly gameAudio: GameAudio;
  private phase: GamePhase = 'idle';
  private mode: GameMode = 'adventure';
  private levelId = 1;
  private runConfig = getRunConfig('adventure', 1);
  private stats = createStats();
  private remainingMs = 45_000;
  private spawnEvent: Phaser.Time.TimerEvent | null = null;
  private items = new Set<SliceItem>();
  private backdrop!: Phaser.GameObjects.Image;
  private shade!: Phaser.GameObjects.Rectangle;
  private trail!: Phaser.GameObjects.Graphics;
  private trailPoints: Array<{ x: number; y: number; at: number }> = [];
  private lastPointer: Phaser.Math.Vector2 | null = null;
  private lastStatusSecond = -1;
  private freezeUntil = 0;
  private frenzyUntil = 0;

  constructor(gameAudio: GameAudio) {
    super('blade');
    this.gameAudio = gameAudio;
  }

  preload(): void {
    this.load.image('dojo', 'assets/dojo.svg');
    for (const key of ITEM_KEYS) this.load.image(key, `assets/${key}.svg`);
  }

  create(): void {
    this.backdrop = this.add.image(0, 0, 'dojo');
    this.shade = this.add.rectangle(0, 0, 1, 1, 0x0b100e, 0.14);
    this.trail = this.add.graphics().setDepth(100);
    this.layoutScene(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => this.layoutScene(gameSize.width, gameSize.height));

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.phase !== 'playing') return;
      this.lastPointer = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
      this.trailPoints = [{ x: pointer.worldX, y: pointer.worldY, at: this.time.now }];
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer));
    this.input.on('pointerup', () => {
      this.lastPointer = null;
    });
    this.input.keyboard?.on('keydown-SPACE', () => this.sliceNearest());
    window.dispatchEvent(new CustomEvent('blade:ready'));
  }

  startRun(mode: GameMode, levelId: number): void {
    this.clearRun();
    this.mode = mode;
    this.levelId = levelId;
    this.runConfig = getRunConfig(mode, levelId);
    this.stats = createStats();
    this.remainingMs = this.runConfig.duration * 1000;
    this.phase = 'playing';
    this.lastStatusSecond = -1;
    this.freezeUntil = 0;
    this.frenzyUntil = 0;
    this.backdrop.setTint(this.runConfig.tint);
    this.shade.setFillStyle(mode === 'zen' ? 0x10251d : mode === 'survival' ? 0x2a1111 : 0x0b100e, mode === 'zen' ? 0.08 : 0.16);
    this.physics.world.resume();
    this.physics.world.gravity.y = this.runConfig.gravity;
    this.spawnEvent = this.time.addEvent({
      delay: this.runConfig.spawnDelay,
      loop: true,
      callback: () => this.spawnBatch(),
    });
    this.time.delayedCall(280, () => this.spawnBatch());
    this.emitStatus(true);
  }

  pauseRun(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.physics.world.pause();
    if (this.spawnEvent) this.spawnEvent.paused = true;
  }

  resumeRun(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.physics.world.resume();
    if (this.spawnEvent) this.spawnEvent.paused = false;
  }

  stopRun(): void {
    this.phase = 'idle';
    this.clearRun();
    this.physics.world.resume();
    this.emitStatus(true);
  }

  setMuted(muted: boolean): void {
    this.gameAudio.setMuted(muted);
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    this.drawTrail(now);
    if (this.phase !== 'playing') return;

    const timeScale = now < this.freezeUntil ? 0.58 : 1;
    this.physics.world.timeScale = now < this.freezeUntil ? 1.75 : 1;
    this.remainingMs = Math.max(0, this.remainingMs - delta * timeScale);

    for (const item of [...this.items]) {
      if (!item.active) {
        this.items.delete(item);
        continue;
      }
      if (item.y > this.scale.height + 90) this.handleMiss(item);
    }

    if (this.stats.lives <= 0 || this.remainingMs <= 0) {
      this.finishRun();
      return;
    }
    this.emitStatus(false);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'playing' || !pointer.isDown) return;
    const current = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    const previous = this.lastPointer ?? current;
    if (Phaser.Math.Distance.Between(previous.x, previous.y, current.x, current.y) < 4) return;
    this.trailPoints.push({ x: current.x, y: current.y, at: this.time.now });
    for (const item of [...this.items]) {
      if (item.active && distanceToSegment(item.x, item.y, previous.x, previous.y, current.x, current.y) < 48) {
        this.sliceItem(item);
      }
    }
    this.lastPointer = current;
  }

  private sliceNearest(): void {
    if (this.phase !== 'playing') return;
    const candidates = [...this.items].filter((item) => item.active && item.getData('kind') !== 'bomb');
    candidates.sort((a, b) => b.y - a.y);
    const nearest = candidates[0];
    if (nearest) this.sliceItem(nearest);
  }

  private chooseKind(): ItemKind {
    if (Math.random() < this.runConfig.bombChance) return 'bomb';
    if (Math.random() < this.runConfig.specialChance) {
      return Phaser.Utils.Array.GetRandom(['golden', 'ice', 'frenzy'] as ItemKind[]);
    }
    return Phaser.Utils.Array.GetRandom([...FRUITS]);
  }

  private spawnBatch(forcedCount?: number): void {
    if (this.phase !== 'playing') return;
    const bonus = this.time.now < this.frenzyUntil ? 1 : 0;
    const count = forcedCount ?? Phaser.Math.Between(this.runConfig.burstMin, this.runConfig.burstMax + bonus);
    const width = this.scale.width;
    const margin = Math.max(42, width * 0.07);
    const laneWidth = (width - margin * 2) / Math.max(count, 1);
    for (let index = 0; index < count; index += 1) {
      const kind = this.chooseKind();
      const laneCenter = margin + laneWidth * (index + 0.5);
      const jitter = Math.min(90, laneWidth * 0.35);
      const x = Phaser.Math.Clamp(laneCenter + Phaser.Math.FloatBetween(-jitter, jitter), margin, width - margin);
      const item = this.physics.add.image(x, this.scale.height + 70, kind) as SliceItem;
      const compactScale = Phaser.Math.Clamp(width / 620, 0.76, 1);
      const size = (kind === 'bomb' ? 94 : kind === 'ice' || kind === 'frenzy' ? 82 : 88) * compactScale;
      item.setDisplaySize(size, size);
      item.setDepth(10);
      item.setData('kind', kind);
      const bodyRadius = size * 0.45;
      item.setCircle(bodyRadius, (128 - bodyRadius * 2) / 2, (128 - bodyRadius * 2) / 2);
      const launchVelocity = Math.sqrt(2 * this.runConfig.gravity * this.scale.height * 0.82);
      item.setVelocity(
        this.runConfig.wind + Phaser.Math.Between(-Math.min(190, width * 0.2), Math.min(190, width * 0.2)),
        -(launchVelocity + Phaser.Math.Between(80, 250)),
      );
      item.setAngularVelocity(Phaser.Math.Between(-170, 170));
      item.setBounce(0.25);
      this.items.add(item);
    }
  }

  private sliceItem(item: SliceItem): void {
    if (!item.active || item.getData('sliced') === true) return;
    item.setData('sliced', true);
    const kind = item.getData('kind') as ItemKind;
    const result = applySlice(this.stats, kind, this.mode, this.time.now);
    this.stats = result.stats;
    item.body.enable = false;
    this.items.delete(item);

    if (result.effect === 'freeze') this.freezeUntil = this.time.now + 4_000;
    if (result.effect === 'frenzy') {
      this.frenzyUntil = this.time.now + 5_000;
      this.spawnBatch(4);
    }

    this.makeSliceEffect(item.x, item.y, kind);
    this.tweens.add({ targets: item, alpha: 0, scaleX: 1.5, scaleY: 0.35, angle: item.angle + 100, duration: 180, ease: 'Quad.easeOut', onComplete: () => item.destroy() });
    this.gameAudio.play(kind === 'bomb' ? 'bomb' : result.effect === 'juice' ? (this.stats.combo >= 3 ? 'combo' : 'slice') : 'special');
    window.dispatchEvent(new CustomEvent('blade:feedback', { detail: { label: result.label, kind } }));
    this.emitStatus(true);
    if (this.stats.lives <= 0) this.finishRun();
  }

  private makeSliceEffect(x: number, y: number, kind: ItemKind): void {
    const color = JUICE_COLORS[kind];
    const splash = this.add.circle(x, y, kind === 'bomb' ? 68 : 36, color, kind === 'bomb' ? 0.8 : 0.65).setDepth(8);
    this.tweens.add({ targets: splash, scale: kind === 'bomb' ? 2.2 : 1.7, alpha: 0, duration: 190, ease: 'Quad.easeOut', onComplete: () => splash.destroy() });
    for (let index = 0; index < 9; index += 1) {
      const drop = this.add.circle(x, y, Phaser.Math.Between(3, 8), color, 0.9).setDepth(9);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(35, kind === 'bomb' ? 130 : 85);
      this.tweens.add({ targets: drop, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, alpha: 0, duration: 180, ease: 'Quad.easeOut', onComplete: () => drop.destroy() });
    }
  }

  private handleMiss(item: SliceItem): void {
    const kind = item.getData('kind') as ItemKind;
    this.items.delete(item);
    item.destroy();
    if (kind === 'bomb' || kind === 'ice' || kind === 'frenzy' || kind === 'golden') return;
    this.stats = applyMiss(this.stats, this.mode);
    window.dispatchEvent(new CustomEvent('blade:feedback', { detail: { label: this.mode === 'adventure' || this.mode === 'survival' ? '漏切！失去一命' : '连斩中断', kind: 'miss' } }));
    this.emitStatus(true);
  }

  private drawTrail(now: number): void {
    this.trailPoints = this.trailPoints.filter((point) => now - point.at < 150);
    this.trail.clear();
    if (this.trailPoints.length < 2) return;
    for (let index = 1; index < this.trailPoints.length; index += 1) {
      const previous = this.trailPoints[index - 1];
      const current = this.trailPoints[index];
      if (!previous || !current) continue;
      const alpha = Math.max(0, 1 - (now - current.at) / 150);
      this.trail.lineStyle(9 * alpha + 2, 0xfff3c4, alpha);
      this.trail.beginPath();
      this.trail.moveTo(previous.x, previous.y);
      this.trail.lineTo(current.x, current.y);
      this.trail.strokePath();
    }
  }

  private emitStatus(force: boolean): void {
    const second = Math.ceil(this.remainingMs / 1000);
    if (!force && second === this.lastStatusSecond) return;
    this.lastStatusSecond = second;
    const target = this.runConfig.targetScore;
    const progress = target > 0 ? Math.min(1, this.stats.score / target) : Math.min(1, this.remainingMs / (this.runConfig.duration * 1000));
    const detail: GameStatus = {
      score: this.stats.score,
      combo: this.stats.combo,
      lives: this.stats.lives,
      seconds: second,
      progress,
      objective: target > 0 ? `${this.stats.score.toLocaleString('zh-CN')} / ${target.toLocaleString('zh-CN')}` : this.runConfig.objective,
      runName: this.runConfig.name,
    };
    window.dispatchEvent(new CustomEvent('blade:status', { detail }));
  }

  private finishRun(): void {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.spawnEvent?.remove(false);
    this.spawnEvent = null;
    this.physics.world.pause();
    const won = this.mode === 'adventure' ? this.stats.score >= this.runConfig.targetScore && this.stats.lives > 0 : this.mode === 'survival' ? this.stats.lives > 0 : true;
    const detail: GameResult = { mode: this.mode, levelId: this.levelId, config: this.runConfig, stats: { ...this.stats }, won };
    this.gameAudio.play(won ? 'win' : 'bomb');
    window.dispatchEvent(new CustomEvent('blade:end', { detail }));
  }

  private layoutScene(width: number, height: number): void {
    const coverScale = Math.max(width / 1280, height / 720);
    this.backdrop.setPosition(width / 2, height / 2).setDisplaySize(1280 * coverScale, 720 * coverScale);
    this.shade.setPosition(width / 2, height / 2).setSize(width, height).setDisplaySize(width, height);
    this.physics.world.setBounds(-100, -200, width + 200, height + 390);
  }

  private clearRun(): void {
    this.spawnEvent?.remove(false);
    this.spawnEvent = null;
    for (const item of this.items) item.destroy();
    this.items.clear();
    this.trailPoints = [];
    this.trail?.clear();
  }
}

export class FruitNinjaGame {
  private readonly audio = new GameAudio();
  private readonly scene: BladeScene;
  private readonly phaser: Phaser.Game;

  constructor() {
    this.scene = new BladeScene(this.audio);
    this.phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-stage',
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#111714',
      scene: this.scene,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false, roundPixels: false },
      input: { activePointers: 3, touch: { capture: true } },
    });
  }

  start(mode: GameMode, levelId: number): void { this.scene.startRun(mode, levelId); }
  pause(): void { this.scene.pauseRun(); }
  resume(): void { this.scene.resumeRun(); }
  stop(): void { this.scene.stopRun(); }
  setMuted(muted: boolean): void { this.scene.setMuted(muted); }
  destroy(): void { this.phaser.destroy(true); }
}
