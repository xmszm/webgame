export class GameAudio {
  private context: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  play(type: 'slice' | 'combo' | 'bomb' | 'special' | 'win'): void {
    const context = this.ensureContext();
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    const values = {
      slice: [420, 160, 0.05],
      combo: [620, 980, 0.09],
      bomb: [110, 45, 0.28],
      special: [540, 1180, 0.18],
      win: [520, 1040, 0.3],
    } as const;
    const [from, to, duration] = values[type];
    oscillator.type = type === 'bomb' ? 'sawtooth' : type === 'slice' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(type === 'bomb' ? 0.12 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
