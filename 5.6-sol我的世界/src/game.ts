import * as THREE from 'three';
import { createBlockMaterials } from './textures';
import {
  BLOCK_DEFINITIONS,
  BlockType,
  PLACEABLE_BLOCKS,
  SAVE_KEY,
  SEA_LEVEL,
  VoxelWorld,
  WORLD_SIZE,
  randomSeed,
  type WorldSave,
} from './world';

interface TargetBlock {
  x: number;
  y: number;
  z: number;
  normal: THREE.Vector3;
  type: BlockType;
}

interface Particle {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  velocity: THREE.Vector3;
  life: number;
}

interface GameElements {
  canvas: HTMLCanvasElement;
  startScreen: HTMLElement;
  worldSummary: HTMLElement;
  playButton: HTMLButtonElement;
  newWorldButton: HTMLButtonElement;
  hud: HTMLElement;
  position: HTMLElement;
  targetLabel: HTMLElement;
  toast: HTMLElement;
  hotbar: HTMLElement;
  soundButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  pauseDialog: HTMLDialogElement;
  resetDialog: HTMLDialogElement;
  resumeButton: HTMLButtonElement;
  pauseNewWorldButton: HTMLButtonElement;
  exitButton: HTMLButtonElement;
  cancelResetButton: HTMLButtonElement;
  confirmResetButton: HTMLButtonElement;
  joystick: HTMLElement;
  joystickKnob: HTMLElement;
  jumpButton: HTMLButtonElement;
  breakButton: HTMLButtonElement;
  placeButton: HTMLButtonElement;
  srStatus: HTMLElement;
}

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function collectElements(): GameElements {
  return {
    canvas: requireElement<HTMLCanvasElement>('#game-canvas'),
    startScreen: requireElement('#start-screen'),
    worldSummary: requireElement('#world-summary'),
    playButton: requireElement<HTMLButtonElement>('#play-button'),
    newWorldButton: requireElement<HTMLButtonElement>('#new-world-button'),
    hud: requireElement('#hud'),
    position: requireElement('#position-readout'),
    targetLabel: requireElement('#target-label'),
    toast: requireElement('#toast'),
    hotbar: requireElement('#hotbar'),
    soundButton: requireElement<HTMLButtonElement>('#sound-button'),
    pauseButton: requireElement<HTMLButtonElement>('#pause-button'),
    pauseDialog: requireElement<HTMLDialogElement>('#pause-dialog'),
    resetDialog: requireElement<HTMLDialogElement>('#reset-dialog'),
    resumeButton: requireElement<HTMLButtonElement>('#resume-button'),
    pauseNewWorldButton: requireElement<HTMLButtonElement>('#pause-new-world-button'),
    exitButton: requireElement<HTMLButtonElement>('#exit-button'),
    cancelResetButton: requireElement<HTMLButtonElement>('#cancel-reset-button'),
    confirmResetButton: requireElement<HTMLButtonElement>('#confirm-reset-button'),
    joystick: requireElement('#joystick'),
    joystickKnob: requireElement('#joystick-knob'),
    jumpButton: requireElement<HTMLButtonElement>('#jump-button'),
    breakButton: requireElement<HTMLButtonElement>('#break-button'),
    placeButton: requireElement<HTMLButtonElement>('#place-button'),
    srStatus: requireElement('#sr-status'),
  };
}

export class MinecraftGame {
  private readonly elements = collectElements();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(72, 1, 0.08, 120);
  private readonly raycaster = new THREE.Raycaster();
  private readonly blockGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly materials = createBlockMaterials();
  private readonly blockMeshes: THREE.InstancedMesh[] = [];
  private readonly selection: THREE.LineSegments;
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly playerPosition = new THREE.Vector3();
  private readonly playerVelocity = new THREE.Vector3();
  private readonly particles: Particle[] = [];
  private readonly mobile = matchMedia('(pointer: coarse)').matches;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private world: VoxelWorld;
  private selectedIndex = 0;
  private currentTarget: TargetBlock | null = null;
  private yaw = Math.PI * 0.25;
  private pitch = -0.08;
  private grounded = false;
  private playing = false;
  private pendingResetResume = false;
  private soundEnabled = true;
  private audioContext: AudioContext | null = null;
  private toastTimer = 0;
  private joystickPointer: number | null = null;
  private joystickX = 0;
  private joystickY = 0;
  private lookPointer: number | null = null;
  private lookX = 0;
  private lookY = 0;

  constructor() {
    const loaded = this.loadWorld();
    this.world = loaded ?? new VoxelWorld(randomSeed());
    this.elements.worldSummary.textContent = loaded ? `世界 #${this.world.seed.toString(16).toUpperCase()} · 已保存` : `世界 #${this.world.seed.toString(16).toUpperCase()} · 新生成`;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.elements.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color(0x78b7d5);
    this.scene.fog = new THREE.Fog(0x9ccde0, 32, 78);
    this.raycaster.far = 6;
    this.camera.rotation.order = 'YXZ';

    const selectionGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025, 1.025, 1.025));
    this.selection = new THREE.LineSegments(selectionGeometry, new THREE.LineBasicMaterial({ color: 0xf5e36b, depthTest: false }));
    this.selection.renderOrder = 5;
    this.selection.visible = false;
    this.scene.add(this.selection);

    this.setupScene();
    this.rebuildWorldMeshes();
    this.respawn();
    this.buildHotbar();
    this.bindEvents();
    this.updateHotbar();
    this.animate();
  }

  private setupScene(): void {
    const hemisphere = new THREE.HemisphereLight(0xccecff, 0x526043, 2.05);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff4cf, 2.4);
    sun.position.set(-28, 42, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.camera.far = 90;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const sunDisk = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffefab, fog: false }),
    );
    sunDisk.position.set(-31, 36, -46);
    sunDisk.lookAt(this.camera.position);
    this.scene.add(sunDisk);

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshPhongMaterial({ color: 0x3e97b8, transparent: true, opacity: 0.78, shininess: 70 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(WORLD_SIZE / 2, SEA_LEVEL + 0.36, WORLD_SIZE / 2);
    water.receiveShadow = true;
    this.scene.add(water);

    const cloudMaterial = new THREE.MeshLambertMaterial({ color: 0xf4fafb, transparent: true, opacity: 0.88 });
    const cloudGeometry = new THREE.BoxGeometry(1, 1, 1);
    const clouds = new THREE.Group();
    const cloudParts = [
      [-7, 19, 8, 7, 1, 3], [-3, 20, 8, 4, 1, 3],
      [23, 21, -5, 8, 1, 3], [28, 20, -5, 4, 1, 3],
      [41, 18, 24, 9, 1, 3], [36, 19, 24, 4, 1, 2],
      [9, 22, 43, 8, 1, 3], [14, 21, 43, 5, 1, 2],
    ] as const;
    for (const [x, y, z, sx, sy, sz] of cloudParts) {
      const part = new THREE.Mesh(cloudGeometry, cloudMaterial);
      part.position.set(x, y, z);
      part.scale.set(sx, sy, sz);
      clouds.add(part);
    }
    this.scene.add(clouds);
  }

  private loadWorld(): VoxelWorld | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return VoxelWorld.fromSave(JSON.parse(raw) as unknown);
    } catch {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
  }

  private saveWorld(announce = false): void {
    try {
      const save: WorldSave = this.world.serialize();
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      if (announce) this.showToast('世界已保存');
    } catch {
      this.showToast('无法保存：浏览器存储不可用');
    }
  }

  private rebuildWorldMeshes(): void {
    for (const mesh of this.blockMeshes) this.scene.remove(mesh);
    this.blockMeshes.length = 0;

    const positions = new Map<BlockType, THREE.Vector3[]>();
    this.world.forEachVisible((type, x, y, z) => {
      const list = positions.get(type) ?? [];
      list.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5));
      positions.set(type, list);
    });

    const matrix = new THREE.Matrix4();
    for (const [type, coords] of positions) {
      const blockMaterials = this.materials.get(type);
      if (!blockMaterials || coords.length === 0) continue;
      const mesh = new THREE.InstancedMesh(this.blockGeometry, blockMaterials, coords.length);
      mesh.name = `blocks-${type}`;
      mesh.userData.coordinates = coords;
      mesh.castShadow = type !== BlockType.Leaves;
      mesh.receiveShadow = true;
      coords.forEach((position, index) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.blockMeshes.push(mesh);
      this.scene.add(mesh);
    }
  }

  private buildHotbar(): void {
    this.elements.hotbar.replaceChildren();
    PLACEABLE_BLOCKS.forEach((type, index) => {
      const definition = BLOCK_DEFINITIONS[type];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotbar-slot';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', `选择${definition.name}`);
      button.innerHTML = `<span class="slot-key">${index + 1}</span><span class="block-swatch block-swatch--${type}" aria-hidden="true"></span><span class="slot-name">${definition.name}</span>`;
      button.addEventListener('click', () => this.selectSlot(index));
      this.elements.hotbar.append(button);
    });
  }

  private updateHotbar(): void {
    this.elements.hotbar.querySelectorAll<HTMLButtonElement>('.hotbar-slot').forEach((slot, index) => {
      const selected = index === this.selectedIndex;
      slot.classList.toggle('is-selected', selected);
      slot.setAttribute('aria-pressed', String(selected));
    });
  }

  private selectSlot(index: number): void {
    if (index < 0 || index >= PLACEABLE_BLOCKS.length) return;
    this.selectedIndex = index;
    this.updateHotbar();
    const type = PLACEABLE_BLOCKS[index] ?? BlockType.Grass;
    this.showToast(BLOCK_DEFINITIONS[type].name);
    this.playTone(360, 0.035, 'square', 0.025);
  }

  private bindEvents(): void {
    this.elements.playButton.addEventListener('click', () => this.start());
    this.elements.newWorldButton.addEventListener('click', () => this.openResetDialog(false));
    this.elements.pauseButton.addEventListener('click', () => this.pause());
    this.elements.resumeButton.addEventListener('click', () => this.resume());
    this.elements.pauseNewWorldButton.addEventListener('click', () => this.openResetDialog(true));
    this.elements.exitButton.addEventListener('click', () => this.exitToMenu());
    this.elements.cancelResetButton.addEventListener('click', () => this.cancelReset());
    this.elements.confirmResetButton.addEventListener('click', () => this.confirmReset());
    this.elements.soundButton.addEventListener('click', () => this.toggleSound());
    this.elements.jumpButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.jump();
    });
    this.elements.breakButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.breakBlock();
    });
    this.elements.placeButton.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.placeBlock();
    });

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.elements.canvas.addEventListener('mousedown', (event) => this.onMouseDown(event));
    this.elements.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    document.addEventListener('mousemove', (event) => this.onMouseMove(event));
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    this.elements.canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });

    this.elements.pauseDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.resume();
    });
    this.elements.resetDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.cancelReset();
    });

    this.bindTouchControls();
  }

  private bindTouchControls(): void {
    this.elements.joystick.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.joystickPointer = event.pointerId;
      this.elements.joystick.setPointerCapture(event.pointerId);
      this.updateJoystick(event.clientX, event.clientY);
    });
    this.elements.joystick.addEventListener('pointermove', (event) => {
      if (event.pointerId === this.joystickPointer) this.updateJoystick(event.clientX, event.clientY);
    });
    const stopJoystick = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.joystickX = 0;
      this.joystickY = 0;
      this.elements.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
    };
    this.elements.joystick.addEventListener('pointerup', stopJoystick);
    this.elements.joystick.addEventListener('pointercancel', stopJoystick);

    this.elements.canvas.addEventListener('pointerdown', (event) => {
      if (!this.mobile || !this.playing) return;
      this.lookPointer = event.pointerId;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.elements.canvas.setPointerCapture(event.pointerId);
    });
    this.elements.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointer) return;
      const dx = event.clientX - this.lookX;
      const dy = event.clientY - this.lookY;
      this.lookX = event.clientX;
      this.lookY = event.clientY;
      this.yaw -= dx * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.004, -1.48, 1.48);
    });
    const stopLook = (event: PointerEvent): void => {
      if (event.pointerId === this.lookPointer) this.lookPointer = null;
    };
    this.elements.canvas.addEventListener('pointerup', stopLook);
    this.elements.canvas.addEventListener('pointercancel', stopLook);
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const rect = this.elements.joystick.getBoundingClientRect();
    const radius = rect.width * 0.32;
    let x = clientX - (rect.left + rect.width / 2);
    let y = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(x, y);
    if (distance > radius) {
      x = (x / distance) * radius;
      y = (y / distance) * radius;
    }
    this.joystickX = x / radius;
    this.joystickY = y / radius;
    this.elements.joystickKnob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      if (this.playing && !this.elements.pauseDialog.open && !this.elements.resetDialog.open) {
        event.preventDefault();
        this.pause();
      }
      return;
    }
    if (!this.playing || this.elements.pauseDialog.open || this.elements.resetDialog.open) return;
    if (event.code === 'Space') {
      event.preventDefault();
      this.jump();
    }
    if (event.code.startsWith('Digit')) {
      const index = Number(event.code.slice(5)) - 1;
      this.selectSlot(index);
    }
    this.keys.add(event.code);
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.playing || this.mobile) return;
    if (document.pointerLockElement !== this.elements.canvas) {
      void this.elements.canvas.requestPointerLock();
      return;
    }
    if (event.button === 0) this.breakBlock();
    if (event.button === 2) this.placeBlock();
  }

  private onMouseMove(event: MouseEvent): void {
    if (document.pointerLockElement !== this.elements.canvas || !this.playing) return;
    this.yaw -= event.movementX * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0022, -1.48, 1.48);
  }

  private onWheel(event: WheelEvent): void {
    if (!this.playing) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    this.selectSlot((this.selectedIndex + direction + PLACEABLE_BLOCKS.length) % PLACEABLE_BLOCKS.length);
  }

  private onPointerLockChange(): void {
    if (!this.mobile && this.playing && document.pointerLockElement !== this.elements.canvas && !this.elements.pauseDialog.open && !this.elements.resetDialog.open) {
      this.pause();
    }
  }

  private start(): void {
    this.playing = true;
    this.elements.startScreen.classList.add('is-hidden');
    this.elements.hud.hidden = false;
    document.body.classList.add('is-playing');
    this.ensureAudio();
    this.playTone(440, 0.08, 'square', 0.04);
    this.elements.srStatus.textContent = '已进入世界';
    if (!this.mobile) void this.elements.canvas.requestPointerLock();
  }

  private pause(): void {
    if (!this.playing || this.elements.pauseDialog.open) return;
    this.keys.clear();
    this.saveWorld();
    if (document.pointerLockElement) document.exitPointerLock();
    this.elements.pauseDialog.showModal();
  }

  private resume(): void {
    if (this.elements.pauseDialog.open) this.elements.pauseDialog.close();
    if (!this.playing) return;
    if (!this.mobile) void this.elements.canvas.requestPointerLock();
    this.elements.srStatus.textContent = '继续游戏';
  }

  private exitToMenu(): void {
    this.saveWorld();
    this.playing = false;
    this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.elements.pauseDialog.open) this.elements.pauseDialog.close();
    this.elements.hud.hidden = true;
    this.elements.startScreen.classList.remove('is-hidden');
    document.body.classList.remove('is-playing');
    this.elements.worldSummary.textContent = `世界 #${this.world.seed.toString(16).toUpperCase()} · 已保存`;
    this.elements.playButton.focus();
  }

  private openResetDialog(resumeAfter: boolean): void {
    this.pendingResetResume = resumeAfter;
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.elements.pauseDialog.open) this.elements.pauseDialog.close();
    this.elements.resetDialog.showModal();
    this.elements.cancelResetButton.focus();
  }

  private cancelReset(): void {
    if (this.elements.resetDialog.open) this.elements.resetDialog.close();
    if (this.pendingResetResume && this.playing) {
      this.elements.pauseDialog.showModal();
      this.elements.resumeButton.focus();
    } else {
      this.elements.newWorldButton.focus();
    }
  }

  private confirmReset(): void {
    this.world = new VoxelWorld(randomSeed());
    this.rebuildWorldMeshes();
    this.respawn();
    this.saveWorld();
    this.elements.worldSummary.textContent = `世界 #${this.world.seed.toString(16).toUpperCase()} · 新生成`;
    if (this.elements.resetDialog.open) this.elements.resetDialog.close();
    this.showToast('新世界已生成');
    this.elements.srStatus.textContent = '新世界已生成';
    if (this.pendingResetResume && this.playing) {
      this.resume();
    } else {
      this.elements.newWorldButton.focus();
    }
  }

  private toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    this.elements.soundButton.setAttribute('aria-label', this.soundEnabled ? '关闭声音' : '开启声音');
    this.elements.soundButton.innerHTML = `<i data-lucide="${this.soundEnabled ? 'volume-2' : 'volume-x'}" aria-hidden="true"></i>`;
    document.dispatchEvent(new CustomEvent('refresh-icons'));
    if (this.soundEnabled) this.playTone(520, 0.06, 'square', 0.03);
  }

  private ensureAudio(): void {
    if (!this.audioContext) this.audioContext = new AudioContext();
    if (this.audioContext.state === 'suspended') void this.audioContext.resume();
  }

  private playTone(frequency: number, duration: number, wave: OscillatorType, volume: number): void {
    if (!this.soundEnabled || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private respawn(): void {
    const spawn = this.world.getSpawn();
    this.playerPosition.set(spawn.x, spawn.y, spawn.z);
    this.playerVelocity.set(0, 0, 0);
    this.yaw = Math.PI * 0.78;
    this.pitch = -0.12;
  }

  private jump(): void {
    if (!this.grounded) return;
    this.playerVelocity.y = 8.2;
    this.grounded = false;
    this.playTone(230, 0.06, 'square', 0.022);
  }

  private breakBlock(): void {
    const target = this.currentTarget;
    if (!target) {
      this.showToast('准星未对准方块');
      this.playTone(110, 0.05, 'square', 0.02);
      return;
    }
    if (target.type === BlockType.Bedrock) {
      this.showToast('基岩无法采掘');
      this.playTone(110, 0.05, 'square', 0.02);
      return;
    }
    if (this.world.setBlock(target.x, target.y, target.z, BlockType.Air)) {
      this.spawnBlockParticles(target);
      this.rebuildWorldMeshes();
      this.saveWorld();
      this.playTone(target.type === BlockType.Stone ? 130 : 180, 0.08, 'square', 0.045);
      this.showToast(`采掘 ${BLOCK_DEFINITIONS[target.type].name}`);
    }
  }

  private placeBlock(): void {
    const target = this.currentTarget;
    if (!target) {
      this.showToast('准星未对准方块');
      this.playTone(100, 0.05, 'square', 0.02);
      return;
    }
    const x = target.x + Math.round(target.normal.x);
    const y = target.y + Math.round(target.normal.y);
    const z = target.z + Math.round(target.normal.z);
    const type = PLACEABLE_BLOCKS[this.selectedIndex] ?? BlockType.Grass;
    if (!this.world.isInBounds(x, y, z) || this.world.getBlock(x, y, z) !== BlockType.Air || this.blockOverlapsPlayer(x, y, z)) {
      this.showToast('这里不能放置方块');
      this.playTone(100, 0.05, 'square', 0.02);
      return;
    }
    if (this.world.setBlock(x, y, z, type)) {
      this.rebuildWorldMeshes();
      this.saveWorld();
      this.playTone(290, 0.055, 'square', 0.04);
      this.showToast(`放置 ${BLOCK_DEFINITIONS[type].name}`);
    }
  }

  private blockOverlapsPlayer(x: number, y: number, z: number): boolean {
    const radius = 0.34;
    const height = 1.78;
    return (
      x + 1 > this.playerPosition.x - radius && x < this.playerPosition.x + radius &&
      z + 1 > this.playerPosition.z - radius && z < this.playerPosition.z + radius &&
      y + 1 > this.playerPosition.y && y < this.playerPosition.y + height
    );
  }

  private spawnBlockParticles(target: TargetBlock): void {
    if (this.reducedMotion) return;
    const color = BLOCK_DEFINITIONS[target.type].swatch;
    for (let index = 0; index < 9; index += 1) {
      const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
      const material = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 1.2 + Math.random() * 2, (Math.random() - 0.5) * 3),
        life: 0.55 + Math.random() * 0.2,
      });
    }
  }

  private updateParticles(delta: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      if (!particle) continue;
      particle.life -= delta;
      particle.velocity.y -= 8 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.x += delta * 4;
      particle.mesh.rotation.y += delta * 3;
      particle.mesh.material.opacity = Math.max(0, particle.life * 2);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        particle.mesh.material.dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  private updatePlayer(delta: number): void {
    if (!this.playing || this.elements.pauseDialog.open || this.elements.resetDialog.open) return;
    const forwardInput = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.joystickY;
    const sideInput = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.joystickX;
    const length = Math.hypot(forwardInput, sideInput) || 1;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const speed = this.keys.has('ShiftLeft') ? 6.4 : 4.6;
    const movement = forward.multiplyScalar((forwardInput / length) * speed * delta)
      .add(right.multiplyScalar((sideInput / length) * speed * delta));

    this.moveAxis('x', movement.x);
    this.moveAxis('z', movement.z);
    this.playerVelocity.y -= 23 * delta;
    this.playerVelocity.y = Math.max(this.playerVelocity.y, -18);
    this.grounded = false;
    this.moveAxis('y', this.playerVelocity.y * delta);

    if (this.playerPosition.y < -8) {
      this.respawn();
      this.showToast('已返回出生点');
    }

    this.camera.position.set(this.playerPosition.x, this.playerPosition.y + 1.62, this.playerPosition.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number): void {
    if (amount === 0) return;
    this.playerPosition[axis] += amount;
    if (this.playerCollides()) {
      this.playerPosition[axis] -= amount;
      if (axis === 'y') {
        if (amount < 0) this.grounded = true;
        this.playerVelocity.y = 0;
      }
    }
  }

  private playerCollides(): boolean {
    const radius = 0.32;
    const minX = Math.floor(this.playerPosition.x - radius);
    const maxX = Math.floor(this.playerPosition.x + radius);
    const minY = Math.floor(this.playerPosition.y + 0.001);
    const maxY = Math.floor(this.playerPosition.y + 1.77);
    const minZ = Math.floor(this.playerPosition.z - radius);
    const maxZ = Math.floor(this.playerPosition.z + radius);
    if (this.playerPosition.x - radius < 0 || this.playerPosition.x + radius > WORLD_SIZE || this.playerPosition.z - radius < 0 || this.playerPosition.z + radius > WORLD_SIZE) return true;
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (this.world.isSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  private updateTarget(): void {
    if (!this.playing) {
      this.selection.visible = false;
      return;
    }
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.raycaster.intersectObjects(this.blockMeshes, false)[0];
    if (!hit || hit.instanceId === undefined || !hit.face) {
      this.currentTarget = null;
      this.selection.visible = false;
      this.elements.targetLabel.textContent = '';
      return;
    }
    const coords = hit.object.userData.coordinates as THREE.Vector3[] | undefined;
    const position = coords?.[hit.instanceId];
    if (!position) return;
    const x = Math.floor(position.x);
    const y = Math.floor(position.y);
    const z = Math.floor(position.z);
    const type = this.world.getBlock(x, y, z);
    this.currentTarget = { x, y, z, normal: hit.face.normal.clone(), type };
    this.selection.position.copy(position);
    this.selection.visible = true;
    this.elements.targetLabel.textContent = BLOCK_DEFINITIONS[type].name;
  }

  private updatePreview(elapsed: number): void {
    if (this.playing) return;
    const spawn = this.world.getSpawn();
    const angle = this.reducedMotion ? 0.75 : 0.75 + Math.sin(elapsed * 0.12) * 0.16;
    this.camera.position.set(spawn.x + Math.cos(angle) * 18, spawn.y + 10, spawn.z + Math.sin(angle) * 18);
    this.camera.lookAt(spawn.x, spawn.y + 2, spawn.z);
  }

  private updateHud(): void {
    const x = Math.floor(this.playerPosition.x).toString().padStart(2, '0');
    const y = Math.floor(this.playerPosition.y).toString().padStart(2, '0');
    const z = Math.floor(this.playerPosition.z).toString().padStart(2, '0');
    this.elements.position.textContent = `X ${x} · Y ${y} · Z ${z}`;
  }

  private showToast(message: string): void {
    this.elements.toast.textContent = message;
    this.elements.toast.classList.add('is-visible');
    this.toastTimer = 1.4;
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight, false);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.updatePreview(elapsed);
    this.updatePlayer(delta);
    this.updateParticles(delta);
    this.updateTarget();
    this.updateHud();
    if (this.toastTimer > 0) {
      this.toastTimer -= delta;
      if (this.toastTimer <= 0) this.elements.toast.classList.remove('is-visible');
    }
    this.renderer.render(this.scene, this.camera);
  };
}
