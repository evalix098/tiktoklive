export class GameAudio {
  ctx: AudioContext | null = null;
  muted = false;

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
  }

  play(kind: string) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const burst = (freq: number, dur: number, type: OscillatorType, gain = 0.06, slide = 0) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };
    switch (kind) {
      case "join":
        burst(520, 0.12, "triangle", 0.05, 180);
        break;
      case "dash":
        burst(180, 0.09, "square", 0.03, 80);
        break;
      case "hit":
        burst(140, 0.08, "sawtooth", 0.05, -70);
        break;
      case "like":
        burst(760, 0.08, "sine", 0.03, 40);
        break;
      case "follow":
        burst(440, 0.14, "triangle", 0.05, 220);
        break;
      case "gift":
        burst(392, 0.16, "square", 0.05, 200);
        burst(588, 0.18, "triangle", 0.03, 160);
        break;
      case "giftBig":
        burst(196, 0.28, "sawtooth", 0.06, 80);
        burst(523, 0.32, "triangle", 0.045, 260);
        break;
      case "smash":
        burst(90, 0.2, "sawtooth", 0.07, -30);
        break;
      case "count":
        burst(660, 0.1, "square", 0.04);
        break;
      case "go":
        burst(220, 0.18, "triangle", 0.06, 300);
        break;
      case "elim":
        burst(160, 0.16, "sine", 0.045, -80);
        break;
      case "win":
        burst(523, 0.22, "triangle", 0.05, 40);
        burst(659, 0.28, "triangle", 0.04, 80);
        burst(784, 0.34, "sine", 0.035, 40);
        break;
      default:
        break;
    }
  }
}
