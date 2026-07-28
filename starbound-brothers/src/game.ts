import Phaser from 'phaser';
import { COIN_SCORE, getLevel, JUMP_SPEED, LEVELS, PLAYER_SPEED, STARTING_LIVES, STOMP_SCORE, type LevelDefinition, type RectPlacement } from './config';
import { GameAudio } from './audio';
import { calculateRunScore, resolveEnemyContact } from './rules';

export interface GameStatus {
  levelId: number;
  levelName: string;
  score: number;
  coins: number;
  lives: number;
  seconds: number;
  progress: number;
}

export interface RunResult extends GameStatus {
  won: boolean;
  enemies: number;
}

interface GameCallbacks {
  onStatus: (status: GameStatus) => void;
  onEnd: (result: RunResult) => void;
  onAnnouncement: (message: string) => void;
}

interface EnemySprite extends Phaser.Physics.Arcade.Sprite {
  patrolDirection: number;
}

const DESKTOP_VIEW_WIDTH = 1280;
const VIEW_WIDTH = window.innerHeight > window.innerWidth && window.innerWidth <= 900 ? 480 : DESKTOP_VIEW_WIDTH;
const VIEW_HEIGHT = 720;
const STORAGE_MUTED = 'starbound-brothers-muted';

class AdventureScene extends Phaser.Scene {
  private readonly callbacks: GameCallbacks;
  private readonly audio: GameAudio;
  private level: LevelDefinition = LEVELS[0]!;
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private coins!: Phaser.Physics.Arcade.Group;
  private spikes!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private leftKey!: Phaser.Input.Keyboard.Key;
  private rightKey!: Phaser.Input.Keyboard.Key;
  private jumpKey!: Phaser.Input.Keyboard.Key;
  private running = false;
  private ending = false;
  private lives = STARTING_LIVES;
  private collectedCoins = 0;
  private defeatedEnemies = 0;
  private secondsLeft = 0;
  private elapsed = 0;
  private lastStatusAt = 0;
  private coyoteUntil = 0;
  private jumpBufferedUntil = 0;
  private jumpHeld = false;
  private invulnerableUntil = 0;
  private checkpointX = 120;
  private virtualLeft = false;
  private virtualRight = false;
  private virtualJump = false;

  constructor(callbacks: GameCallbacks, audio: GameAudio) {
    super({ key: 'adventure' });
    this.callbacks = callbacks;
    this.audio = audio;
  }

  create(data?: { levelId?: number; preview?: boolean }): void {
    this.level = getLevel(data?.levelId ?? 1);
    this.running = data?.preview === false;
    this.ending = false;
    this.lives = STARTING_LIVES;
    this.collectedCoins = 0;
    this.defeatedEnemies = 0;
    this.secondsLeft = this.level.timeLimit;
    this.elapsed = 0;
    this.lastStatusAt = 0;
    this.checkpointX = 120;
    this.virtualLeft = false;
    this.virtualRight = false;
    this.virtualJump = false;

    this.createTextures();
    this.createBackdrop();
    this.createWorld();
    this.createInput();
    this.emitStatus();

    if (!this.running) this.physics.pause();
  }

  private createTextures(): void {
    if (this.textures.exists('hero')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0xe94132).fillRoundedRect(5, 0, 29, 12, 3).fillRect(1, 9, 39, 7);
    graphics.fillStyle(0xf3b47f).fillRect(9, 16, 24, 13).fillRect(5, 21, 32, 8);
    graphics.fillStyle(0x293649).fillRect(5, 29, 32, 14);
    graphics.fillStyle(0x5a9bd5).fillRect(10, 29, 22, 17);
    graphics.fillStyle(0xffffff).fillRect(12, 16, 5, 5).fillRect(27, 16, 5, 5);
    graphics.fillStyle(0x202832).fillRect(14, 17, 3, 4).fillRect(29, 17, 3, 4).fillRect(3, 43, 15, 5).fillRect(25, 43, 15, 5);
    graphics.generateTexture('hero', 42, 48).clear();

    graphics.fillStyle(0x71502e).fillRoundedRect(2, 8, 38, 26, 6);
    graphics.fillStyle(0xa66b38).fillRoundedRect(5, 2, 32, 20, 9);
    graphics.fillStyle(0xffffff).fillRect(9, 12, 7, 7).fillRect(26, 12, 7, 7);
    graphics.fillStyle(0x202832).fillRect(11, 14, 4, 5).fillRect(27, 14, 4, 5).fillRect(3, 32, 14, 4).fillRect(25, 32, 14, 4);
    graphics.generateTexture('walker', 42, 36).clear();

    graphics.fillStyle(0xffd34e).fillEllipse(3, 0, 18, 26);
    graphics.fillStyle(0xfff0a2).fillRect(8, 3, 4, 20);
    graphics.lineStyle(2, 0xd99120).strokeEllipse(3, 0, 18, 26);
    graphics.generateTexture('coin', 24, 28).clear();

    graphics.fillStyle(0x7b512d).fillRect(0, 0, 64, 64);
    graphics.fillStyle(0x3f9f55).fillRect(0, 0, 64, 15);
    graphics.fillStyle(0x77ce62).fillRect(0, 0, 64, 6);
    graphics.fillStyle(0x654126).fillRect(0, 23, 64, 4).fillRect(8, 40, 38, 4);
    graphics.generateTexture('ground', 64, 64).clear();

    graphics.fillStyle(0xd87c32).fillRect(0, 0, 64, 34);
    graphics.fillStyle(0xffad4d).fillRect(0, 0, 64, 5);
    graphics.lineStyle(3, 0x9b4d26).strokeRect(1, 1, 62, 32).lineBetween(21, 2, 21, 17).lineBetween(44, 17, 44, 32).lineBetween(0, 17, 64, 17);
    graphics.generateTexture('brick', 64, 34).clear();

    graphics.fillStyle(0xffffff).fillTriangle(0, 30, 16, 0, 32, 30).fillTriangle(27, 30, 43, 0, 59, 30).fillTriangle(54, 30, 70, 0, 86, 30);
    graphics.fillStyle(0x96a9b5).fillTriangle(5, 30, 16, 8, 27, 30).fillTriangle(32, 30, 43, 8, 54, 30).fillTriangle(59, 30, 70, 8, 81, 30);
    graphics.generateTexture('spikes', 86, 30).clear();

    graphics.fillStyle(0xe8ecdc).fillRect(8, 0, 8, 150);
    graphics.fillStyle(0xf5cc42).fillCircle(12, 9, 12);
    graphics.fillStyle(0xe94c3d).fillTriangle(16, 21, 16, 78, 74, 49);
    graphics.fillStyle(0xffffff).fillCircle(37, 45, 7);
    graphics.generateTexture('goal', 76, 150).destroy();
  }

  private createBackdrop(): void {
    const palettes = {
      meadow: { sky: 0x75c8f4, far: 0xa8d989, near: 0x55a766, cloud: 0xf8f4dc },
      sunset: { sky: 0xf49b68, far: 0xd9a35e, near: 0x8e7651, cloud: 0xffd4ae },
      night: { sky: 0x202c50, far: 0x54658a, near: 0x334763, cloud: 0x9ca9c4 },
    }[this.level.palette];
    this.cameras.main.setBackgroundColor(palettes.sky);

    const backdrop = this.add.graphics().setScrollFactor(0).setDepth(-20);
    if (this.level.palette === 'night') {
      backdrop.fillStyle(0xf5e6a9).fillCircle(1080, 105, 44);
      backdrop.fillStyle(palettes.sky).fillCircle(1059, 91, 44);
      backdrop.fillStyle(0xffffff, 0.8);
      const stars: readonly (readonly [number, number])[] = [[90, 90], [210, 170], [350, 80], [520, 140], [670, 65], [840, 175], [990, 70], [1190, 165]];
      for (const [x, y] of stars) backdrop.fillCircle(x, y, 2);
    } else {
      backdrop.fillStyle(0xffe18a).fillCircle(1080, 110, 55);
    }
    backdrop.fillStyle(palettes.cloud, 0.8);
    for (const x of [170, 640, 1030]) {
      backdrop.fillCircle(x, 145 + (x % 90), 28).fillCircle(x + 34, 136 + (x % 90), 38).fillCircle(x + 72, 148 + (x % 90), 25).fillRect(x, 145 + (x % 90), 72, 29);
    }
    backdrop.fillStyle(palettes.far).fillTriangle(-120, 620, 220, 250, 530, 620).fillTriangle(270, 620, 660, 310, 980, 620).fillTriangle(700, 620, 1050, 265, 1400, 620);
    backdrop.fillStyle(palettes.near).fillCircle(90, 610, 170).fillCircle(360, 640, 230).fillCircle(820, 630, 190).fillCircle(1170, 630, 210);
  }

  private createWorld(): void {
    this.physics.world.setBounds(0, 0, this.level.width, VIEW_HEIGHT + 220);
    this.platforms = this.physics.add.staticGroup();
    for (const ground of this.level.grounds) this.addPlatform(ground, 'ground');
    for (const platform of this.level.platforms) this.addPlatform(platform, 'brick');

    this.coins = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const [x, y] of this.level.coins) {
      const coin = this.coins.create(x, y, 'coin') as Phaser.Physics.Arcade.Sprite;
      coin.setDepth(2);
      this.tweens.add({ targets: coin, scaleX: 0.35, yoyo: true, repeat: -1, duration: 420, ease: 'Sine.InOut' });
    }

    this.spikes = this.physics.add.staticGroup();
    for (const placement of this.level.spikes) {
      const spike = this.add.tileSprite(placement.x, placement.y, placement.width, placement.height, 'spikes');
      this.spikes.add(spike);
      (spike.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }

    this.enemies = this.physics.add.group({ bounceX: 0, bounceY: 0, collideWorldBounds: false });
    for (const [x, y] of this.level.enemies) {
      const enemy = this.enemies.create(x, y, 'walker') as EnemySprite;
      enemy.patrolDirection = -1;
      enemy.setVelocityX(-80).setDepth(3);
      (enemy.body as Phaser.Physics.Arcade.Body).setSize(36, 30).setOffset(3, 6);
    }

    const goal = this.physics.add.staticImage(this.level.goalX, 562, 'goal').setOrigin(0.5, 1).setDepth(2);
    (goal.body as Phaser.Physics.Arcade.StaticBody).setSize(52, 150).setOffset(10, 0);

    this.player = this.physics.add.sprite(120, 575, 'hero').setDepth(4);
    this.player.setCollideWorldBounds(true).setMaxVelocity(PLAYER_SPEED, 900).setDragX(1500);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(32, 46).setOffset(5, 2);

    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.overlap(this.player, this.coins, (_player, coin) => this.collectCoin(coin as Phaser.Physics.Arcade.Sprite));
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => this.contactEnemy(enemy as EnemySprite));
    this.physics.add.overlap(this.player, this.spikes, () => this.hurtPlayer('尖刺'));
    this.physics.add.overlap(this.player, goal, () => this.finish(true));

    this.cameras.main.setBounds(0, 0, this.level.width, VIEW_HEIGHT);
    const followOffsetX = VIEW_WIDTH < 700 ? 0 : -220;
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1, followOffsetX, 40);
    this.cameras.main.setDeadzone(230, 180);
    this.cameras.main.fadeIn(260, 255, 255, 255);
  }

  private addPlatform(placement: RectPlacement, texture: string): void {
    const tile = this.add.tileSprite(placement.x, placement.y, placement.width, placement.height, texture).setDepth(1);
    this.platforms.add(tile);
    (tile.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
  }

  private createInput(): void {
    if (!this.input.keyboard) throw new Error('Keyboard input is unavailable');
    this.cursors = this.input.keyboard.createCursorKeys();
    this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.jumpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
  }

  update(_time: number, delta: number): void {
    if (!this.running || this.ending) return;
    this.elapsed += delta;
    this.secondsLeft = Math.max(0, this.level.timeLimit - this.elapsed / 1000);
    if (this.secondsLeft <= 0) {
      this.finish(false);
      return;
    }

    const now = this.time.now;
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    if (grounded) this.coyoteUntil = now + 115;

    const left = this.cursors.left.isDown || this.leftKey.isDown || this.virtualLeft;
    const right = this.cursors.right.isDown || this.rightKey.isDown || this.virtualRight;
    if (left === right) this.player.setAccelerationX(0);
    else {
      const direction = left ? -1 : 1;
      this.player.setAccelerationX(direction * 1900).setFlipX(direction < 0);
    }

    const jumpDown = this.cursors.up.isDown || this.cursors.space.isDown || this.jumpKey.isDown || this.virtualJump;
    if (jumpDown && !this.jumpHeld) this.jumpBufferedUntil = now + 190;
    if (this.jumpBufferedUntil >= now && this.coyoteUntil >= now) {
      this.player.setVelocityY(-JUMP_SPEED);
      this.jumpBufferedUntil = 0;
      this.coyoteUntil = 0;
      this.audio.play('jump');
    }
    if (!jumpDown && this.jumpHeld && body.velocity.y < -210) this.player.setVelocityY(-210);
    this.jumpHeld = jumpDown;

    for (const member of this.enemies.getChildren()) {
      const enemy = member as EnemySprite;
      if (!enemy.active || !enemy.body) continue;
      if (enemy.body.blocked.left || enemy.body.blocked.right) enemy.patrolDirection *= -1;
      enemy.setVelocityX(82 * enemy.patrolDirection).setFlipX(enemy.patrolDirection > 0);
      if (enemy.y > VIEW_HEIGHT + 90) enemy.destroy();
    }

    this.updateCheckpoint();
    if (this.player.y > VIEW_HEIGHT + 75) this.hurtPlayer('坠落');
    if (now - this.lastStatusAt > 120) this.emitStatus();
  }

  private updateCheckpoint(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const grounded = body.blocked.down || body.touching.down;
    const clearOfHazards = this.level.spikes.every((spike) => Math.abs(spike.x - this.player.x) > 190);
    if (grounded && clearOfHazards && this.player.x > this.checkpointX + 280) this.checkpointX = this.player.x - 80;
  }

  private collectCoin(coin: Phaser.Physics.Arcade.Sprite): void {
    if (!coin.active) return;
    coin.disableBody(true, true);
    this.collectedCoins += 1;
    this.audio.play('coin');
    this.callbacks.onAnnouncement(`收集星币，当前 ${this.collectedCoins} 枚`);
    this.emitStatus();
  }

  private contactEnemy(enemy: EnemySprite): void {
    if (!enemy.active || this.ending) return;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    const playerBottom = playerBody.bottom;
    const enemyTop = enemyBody.top;
    if (resolveEnemyContact(playerBottom, enemyTop, playerBody.velocity.y) === 'stomp') {
      enemy.disableBody(true, true);
      this.player.setVelocityY(-390);
      this.defeatedEnemies += 1;
      this.audio.play('stomp');
      this.callbacks.onAnnouncement('踩扁巡游怪，奖励 250 分');
      this.emitStatus();
      return;
    }
    this.hurtPlayer('碰到巡游怪');
  }

  private hurtPlayer(reason: string): void {
    if (this.ending || this.time.now < this.invulnerableUntil) return;
    this.lives -= 1;
    this.audio.play('hurt');
    this.cameras.main.shake(180, 0.009);
    this.callbacks.onAnnouncement(`${reason}，还剩 ${Math.max(0, this.lives)} 条生命`);
    if (this.lives <= 0) {
      this.finish(false);
      return;
    }
    this.invulnerableUntil = this.time.now + 3200;
    this.player.setPosition(this.checkpointX, 520).setVelocity(0, 0).setTint(0xffd1cb);
    this.tweens.add({ targets: this.player, alpha: 0.25, yoyo: true, repeat: 5, duration: 95, onComplete: () => this.player.setAlpha(1).clearTint() });
    this.emitStatus();
  }

  private emitStatus(): void {
    this.lastStatusAt = this.time.now;
    this.callbacks.onStatus({
      levelId: this.level.id,
      levelName: this.level.name,
      score: this.collectedCoins * COIN_SCORE + this.defeatedEnemies * STOMP_SCORE,
      coins: this.collectedCoins,
      lives: this.lives,
      seconds: Math.max(0, Math.ceil(this.secondsLeft)),
      progress: Phaser.Math.Clamp(this.player ? this.player.x / this.level.goalX : 0, 0, 1),
    });
  }

  private finish(won: boolean): void {
    if (this.ending) return;
    this.ending = true;
    this.running = false;
    this.physics.pause();
    if (won) {
      this.audio.play('win');
      this.cameras.main.flash(350, 255, 231, 118);
    }
    const result: RunResult = {
      levelId: this.level.id,
      levelName: this.level.name,
      score: calculateRunScore(this.collectedCoins, this.defeatedEnemies, won ? this.secondsLeft : 0),
      coins: this.collectedCoins,
      enemies: this.defeatedEnemies,
      lives: this.lives,
      seconds: Math.max(0, Math.ceil(this.secondsLeft)),
      progress: Phaser.Math.Clamp(this.player.x / this.level.goalX, 0, 1),
      won,
    };
    this.time.delayedCall(won ? 500 : 180, () => this.callbacks.onEnd(result));
  }

  setVirtualControl(control: 'left' | 'right' | 'jump', active: boolean): void {
    if (control === 'left') this.virtualLeft = active;
    if (control === 'right') this.virtualRight = active;
    if (control === 'jump') this.virtualJump = active;
  }

  pauseRun(): void {
    if (!this.running || this.ending) return;
    this.running = false;
    this.physics.pause();
  }

  resumeRun(): void {
    if (this.running || this.ending) return;
    this.running = true;
    this.physics.resume();
  }
}

export class PlatformGame {
  private readonly scene: AdventureScene;
  private readonly game: Phaser.Game;
  readonly audio = new GameAudio();

  constructor(parent: string, callbacks: GameCallbacks) {
    this.audio.muted = localStorage.getItem(STORAGE_MUTED) === 'true';
    this.scene = new AdventureScene(callbacks, this.audio);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      backgroundColor: '#75c8f4',
      pixelArt: true,
      antialias: false,
      physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 1450 }, debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { roundPixels: true },
      scene: [this.scene],
      input: { activePointers: 3 },
    });
  }

  showPreview(levelId = 1): void {
    this.scene.scene.restart({ levelId, preview: true });
  }

  start(levelId: number): void {
    this.scene.scene.restart({ levelId, preview: false });
  }

  pause(): void {
    this.scene.pauseRun();
  }

  resume(): void {
    this.scene.resumeRun();
  }

  setVirtualControl(control: 'left' | 'right' | 'jump', active: boolean): void {
    this.scene.setVirtualControl(control, active);
  }

  setMuted(muted: boolean): void {
    this.audio.muted = muted;
    localStorage.setItem(STORAGE_MUTED, String(muted));
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
