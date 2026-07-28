export type SoundCue = 'coin' | 'jump' | 'stomp' | 'hurt' | 'win';

const CUES: Record<SoundCue, readonly [number, number, number]> = {
  coin: [880, 1320, 0.08],
  jump: [280, 520, 0.1],
  stomp: [180, 110, 0.1],
  hurt: [170, 70, 0.22],
  win: [520, 1040, 0.36],
};

export class GameAudio {
  private context: AudioContext | null = null;
  muted = false;

  play(cue: SoundCue): void {
    if (this.muted) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    const [start, end, duration] = CUES[cue];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = cue === 'hurt' ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
