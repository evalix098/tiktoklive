import type { LiveEvent, FeedItem } from "@/lib/live/types";
import {
  BASE_RADIUS,
  COUNTDOWN_SECONDS,
  END_RADIUS,
  FIGHT_SECONDS,
  FIXED_DT,
  LOBBY_AUTO_START,
  MAX_FIGHTERS,
  MAX_PARTICLES,
  RESULTS_SECONDS,
  RING_COLORS,
  START_RADIUS,
} from "./constants";
import type { Fighter, Floater, GiftAlert, HudFighter, Particle, RoundPhase, SmashFx, Snapshot } from "./types";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

function toHud(f: Fighter): HudFighter {
  return {
    id: f.id,
    nickname: f.nickname,
    uniqueId: f.uniqueId,
    hp: f.hp,
    maxHp: f.maxHp,
    wins: f.wins,
    diamonds: f.diamonds,
    alive: f.alive,
    color: f.color,
    avatarIndex: f.avatarIndex,
  };
}

export class ArenaEngine {
  fighters: Fighter[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  feed: FeedItem[] = [];
  smashFx: SmashFx[] = [];
  phase: RoundPhase = "lobby";
  round = 1;
  phaseT = 0;
  ring = START_RADIUS;
  viewers = 0;
  time = 0;
  acc = 0;
  trauma = 0;
  hitstop = 0;
  smashCd = 0;
  giftAlert: GiftAlert | null = null;
  giftAlertT = 0;
  feedSeq = 1;
  particleSeq = 0;
  winner: Fighter | null = null;
  reducedMotion = false;
  lastSound: { kind: string; t: number } | null = null;
  sounds: string[] = [];
  private giftProgress = new Map<string, { count: number; t: number }>();

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        size: 1,
        color: "#fff",
        kind: "spark",
        active: false,
      });
    }
  }

  reset() {
    this.fighters = [];
    this.floaters = [];
    this.feed = [];
    this.smashFx = [];
    this.phase = "lobby";
    this.round = 1;
    this.phaseT = 0;
    this.ring = START_RADIUS;
    this.viewers = 0;
    this.time = 0;
    this.acc = 0;
    this.trauma = 0;
    this.hitstop = 0;
    this.smashCd = 0;
    this.giftAlert = null;
    this.winner = null;
    this.giftProgress.clear();
    for (const p of this.particles) p.active = false;
    this.pushFeed("system", "Comente para entrar na arena.");
  }

  consumeSounds(): string[] {
    const out = this.sounds;
    this.sounds = [];
    return out;
  }

  private sound(kind: string) {
    const t = this.time;
    if (this.lastSound && this.lastSound.kind === kind && t - this.lastSound.t < 0.05) return;
    this.lastSound = { kind, t };
    this.sounds.push(kind);
  }

  private pushFeed(kind: FeedItem["kind"], text: string, name?: string) {
    this.feed.unshift({ id: this.feedSeq++, kind, text, name, t: this.time });
    if (this.feed.length > 18) this.feed.length = 18;
  }

  private emit(
    x: number,
    y: number,
    n: number,
    kind: Particle["kind"],
    color: string,
    speed: number,
    size: number,
  ) {
    let left = n;
    for (const p of this.particles) {
      if (left <= 0) break;
      if (p.active) continue;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random());
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = 0.35 + Math.random() * 0.5;
      p.max = p.life;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = color;
      p.kind = kind;
      left--;
    }
  }

  private floater(x: number, y: number, text: string, color: string) {
    this.floaters.push({ x, y, text, life: 1.1, color });
    if (this.floaters.length > 24) this.floaters.shift();
  }

  private find(uniqueId: string) {
    return this.fighters.find((f) => f.uniqueId === uniqueId);
  }

  private spawn(uniqueId: string, nickname: string, avatarUrl?: string, bonusHp = 0): Fighter {
    const existing = this.find(uniqueId);
    if (existing) {
      existing.nickname = nickname || existing.nickname;
      if (avatarUrl) existing.avatarUrl = avatarUrl;
      if (!existing.alive && this.phase === "lobby") {
        this.revive(existing);
      }
      return existing;
    }
    if (this.fighters.length >= MAX_FIGHTERS) {
      const dead = this.fighters.find((f) => !f.alive);
      if (dead) {
        this.rebind(dead, uniqueId, nickname, avatarUrl, bonusHp);
        return dead;
      }
      return this.fighters[0]!;
    }
    const h = hash(uniqueId);
    const ang = Math.random() * Math.PI * 2;
    const rad = this.ring * (0.25 + Math.random() * 0.55);
    const fighter: Fighter = {
      id: uniqueId,
      uniqueId,
      nickname: nickname || uniqueId,
      avatarIndex: h % 6,
      avatarUrl,
      color: RING_COLORS[h % RING_COLORS.length]!,
      x: 0.5 + Math.cos(ang) * rad,
      y: 0.5 + Math.sin(ang) * rad,
      vx: 0,
      vy: 0,
      r: BASE_RADIUS,
      hp: 100 + bonusHp,
      maxHp: 100 + bonusHp,
      mass: 1,
      shield: 0,
      dashUntil: 0,
      titanUntil: 0,
      flashUntil: 0,
      spawnT: this.time,
      wins: 0,
      diamonds: 0,
      alive: true,
      wanderA: ang,
      wanderT: 0,
      targetId: null,
      attackCd: 0.2 + Math.random() * 0.4,
      squash: 1,
    };
    this.fighters.push(fighter);
    this.emit(fighter.x, fighter.y, 10, "ring", fighter.color, 0.18, 0.012);
    this.sound("join");
    return fighter;
  }

  private rebind(f: Fighter, uniqueId: string, nickname: string, avatarUrl: string | undefined, bonusHp: number) {
    const h = hash(uniqueId);
    f.id = uniqueId;
    f.uniqueId = uniqueId;
    f.nickname = nickname || uniqueId;
    f.avatarIndex = h % 6;
    f.avatarUrl = avatarUrl;
    f.color = RING_COLORS[h % RING_COLORS.length]!;
    f.wins = 0;
    f.diamonds = 0;
    f.maxHp = 100 + bonusHp;
    this.revive(f);
  }

  private revive(f: Fighter) {
    const ang = Math.random() * Math.PI * 2;
    const rad = this.ring * (0.3 + Math.random() * 0.5);
    f.alive = true;
    f.hp = f.maxHp;
    f.x = 0.5 + Math.cos(ang) * rad;
    f.y = 0.5 + Math.sin(ang) * rad;
    f.vx = 0;
    f.vy = 0;
    f.r = BASE_RADIUS;
    f.mass = 1;
    f.shield = 0;
    f.titanUntil = 0;
    f.targetId = null;
    f.wanderT = 0;
    f.wanderA = Math.random() * Math.PI * 2;
    f.attackCd = 0.25 + Math.random() * 0.35;
    f.spawnT = this.time;
    f.squash = 1.2;
  }

  private dash(f: Fighter, power = 1) {
    if (!f.alive) return;
    let tx = 0.5 - f.x;
    let ty = 0.5 - f.y;
    const target = f.targetId ? this.fighters.find((o) => o.id === f.targetId && o.alive) : null;
    if (target) {
      tx = target.x - f.x;
      ty = target.y - f.y;
    } else {
      let best = 1;
      for (const o of this.fighters) {
        if (!o.alive || o === f) continue;
        const d = dist(f.x, f.y, o.x, o.y);
        if (d < best) {
          best = d;
          tx = o.x - f.x;
          ty = o.y - f.y;
        }
      }
    }
    const len = Math.hypot(tx, ty) || 1;
    const impulse = 0.55 * power;
    f.vx += (tx / len) * impulse;
    f.vy += (ty / len) * impulse;
    f.dashUntil = this.time + 0.35;
    f.squash = 1.18;
    this.emit(f.x, f.y, 8, "spark", f.color, 0.35, 0.008);
    this.sound("dash");
  }

  pushEvent(event: LiveEvent) {
    if (event.type === "viewer") {
      this.viewers = event.count;
      return;
    }
    if (event.type === "status") return;

    if (event.type === "chat") {
      const f = this.spawn(event.uniqueId, event.nickname, event.avatarUrl);
      if (this.phase === "fight" || this.phase === "countdown") this.dash(f);
      this.pushFeed("chat", event.comment, f.nickname);
      return;
    }

    if (event.type === "like") {
      const f = this.find(event.uniqueId);
      if (f?.alive) {
        f.hp = clamp(f.hp + event.likeCount * 1.4, 0, f.maxHp);
        this.emit(f.x, f.y, Math.min(8, 2 + event.likeCount), "heart", "#e24b6a", 0.12, 0.01);
      } else {
        this.emit(0.5, 0.18, Math.min(10, event.likeCount), "heart", "#e24b6a", 0.16, 0.01);
      }
      this.pushFeed("like", `+${event.likeCount} curtidas`, event.nickname);
      this.sound("like");
      return;
    }

    if (event.type === "follow") {
      const f = this.spawn(event.uniqueId, event.nickname, event.avatarUrl, 20);
      f.shield = Math.max(f.shield, 1);
      this.floater(f.x, f.y - 0.04, "ESCUDO", f.color);
      this.pushFeed("follow", "seguiu e ganhou escudo", f.nickname);
      this.sound("follow");
      return;
    }

    if (event.type === "share") {
      const f = this.spawn(event.uniqueId, event.nickname, event.avatarUrl);
      this.dash(f, 1.35);
      this.pushFeed("share", "compartilhou — dash", f.nickname);
      return;
    }

    if (event.type === "gift") {
      let deltaCount = Math.max(1, event.repeatCount);
      if (event.transactionId) {
        const previous = this.giftProgress.get(event.transactionId);
        if (previous) {
          deltaCount = Math.max(0, event.repeatCount - previous.count);
          previous.count = Math.max(previous.count, event.repeatCount);
          previous.t = this.time;
        } else {
          this.giftProgress.set(event.transactionId, { count: event.repeatCount, t: this.time });
        }
      } else if ((event.giftType ?? 0) === 1 && !event.repeatEnd) {
        this.pushFeed("gift", `${event.giftName} x${event.repeatCount}`, event.nickname);
        return;
      }
      if (deltaCount <= 0) return;

      const diamonds = Math.max(1, event.diamondCount * deltaCount);
      const f = this.spawn(event.uniqueId, event.nickname, event.avatarUrl, Math.min(80, diamonds * 0.2));
      f.diamonds += diamonds;
      this.applyGift(f, event.giftName, diamonds);
      this.pushFeed("gift", `${event.giftName} · ${diamonds}`, f.nickname);
      this.giftAlert = {
        name: f.nickname,
        giftName: event.giftName,
        diamonds,
        color: f.color,
      };
      this.giftAlertT = 2.8;
      this.sound(diamonds >= 200 ? "giftBig" : "gift");
    }
  }

  private applyGift(f: Fighter, giftName: string, diamonds: number) {
    if (!f.alive) this.revive(f);
    const power = diamonds >= 200 ? 3.2 : diamonds >= 20 ? 1.8 : 1;
    f.titanUntil = this.time + (diamonds >= 200 ? 8 : diamonds >= 20 ? 5 : 2.4);
    f.mass = diamonds >= 200 ? 2.4 : 1.6;
    f.r = BASE_RADIUS * (diamonds >= 200 ? 1.7 : 1.35);
    f.hp = clamp(f.hp + 18 * power, 0, f.maxHp + 40);
    f.maxHp = Math.max(f.maxHp, f.hp);
    f.squash = 1.25;
    this.shockwave(f.x, f.y, 0.42 * power, f);
    this.floater(f.x, f.y - 0.05, giftName.toUpperCase(), f.color);
    this.trauma = Math.min(1, this.trauma + (diamonds >= 200 ? 0.7 : 0.35));
  }

  private shockwave(x: number, y: number, force: number, except?: Fighter) {
    this.smashFx.push({ x, y, t: 0 });
    this.emit(x, y, 18, "ring", "#2ee6dc", 0.28, 0.014);
    for (const o of this.fighters) {
      if (!o.alive || o === except) continue;
      const d = dist(x, y, o.x, o.y) || 0.001;
      const falloff = clamp(1 - d / 0.55, 0, 1);
      const nx = (o.x - x) / d;
      const ny = (o.y - y) / d;
      o.vx += nx * force * falloff * 0.9;
      o.vy += ny * force * falloff * 0.9;
    }
  }

  smash(nx: number, ny: number) {
    if (this.smashCd > 0 || this.phase === "results") return;
    this.smashCd = 1.35;
    this.shockwave(nx, ny, 0.95);
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.sound("smash");
  }

  step(dt: number) {
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= FIXED_DT) {
      this.simulate(FIXED_DT);
      this.acc -= FIXED_DT;
    }
  }

  private simulate(dt: number) {
    this.time += dt;
    this.phaseT += dt;
    this.smashCd = Math.max(0, this.smashCd - dt);
    this.giftAlertT -= dt;
    if (this.giftAlertT <= 0) this.giftAlert = null;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.giftProgress.size > 0 && Math.floor(this.time) % 15 === 0) {
      for (const [key, value] of this.giftProgress) {
        if (this.time - value.t > 90) this.giftProgress.delete(key);
      }
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      this.present(dt);
      return;
    }

    if (this.phase === "lobby") {
      this.ring = START_RADIUS;
      const alive = this.fighters.filter((f) => f.alive).length;
      if (alive >= 2 && this.phaseT >= LOBBY_AUTO_START) {
        this.phase = "countdown";
        this.phaseT = 0;
        this.sound("count");
      }
    } else if (this.phase === "countdown") {
      if (this.phaseT >= COUNTDOWN_SECONDS) {
        this.phase = "fight";
        this.phaseT = 0;
        this.sound("go");
      }
    } else if (this.phase === "fight") {
      const t = this.phaseT / FIGHT_SECONDS;
      this.ring = START_RADIUS + (END_RADIUS - START_RADIUS) * clamp(t, 0, 1);
      this.tickCombat(dt);
      const alive = this.fighters.filter((f) => f.alive);
      if (alive.length <= 1 || this.phaseT >= FIGHT_SECONDS) {
        this.endRound(alive);
      }
    } else if (this.phase === "results") {
      if (this.phaseT >= RESULTS_SECONDS) {
        this.nextRound();
      }
    }

    this.present(dt);
  }

  private endRound(alive: Fighter[]) {
    this.phase = "results";
    this.phaseT = 0;
    if (alive.length > 1) {
      const winner = [...alive].sort((a, b) => {
        const hpDiff = b.hp - a.hp;
        if (Math.abs(hpDiff) > 0.001) return hpDiff;
        const diamondDiff = b.diamonds - a.diamonds;
        if (diamondDiff !== 0) return diamondDiff;
        return hash(a.uniqueId) - hash(b.uniqueId);
      })[0]!;
      this.winner = winner;
      winner.wins += 1;
      for (const f of alive) {
        if (f !== winner) this.eliminate(f);
      }
      this.pushFeed("win", "venceu no desempate", winner.nickname);
      this.emit(winner.x, winner.y, 28, "confetti", winner.color, 0.32, 0.012);
      this.sound("win");
      return;
    }
    if (alive.length === 1) {
      this.winner = alive[0]!;
      this.winner.wins += 1;
      this.pushFeed("win", "venceu a rodada", this.winner.nickname);
      this.emit(this.winner.x, this.winner.y, 28, "confetti", this.winner.color, 0.32, 0.012);
      this.sound("win");
      this.trauma = Math.min(1, this.trauma + 0.3);
    } else {
      // Nunca deixa uma rodada travada em empate: se os dois caírem no mesmo
      // instante, usa o saldo de presentes e depois um desempate determinístico.
      const winner = [...this.fighters].sort((a, b) => {
        const diamondDiff = b.diamonds - a.diamonds;
        if (diamondDiff !== 0) return diamondDiff;
        return hash(a.uniqueId) - hash(b.uniqueId);
      })[0]!;
      this.winner = winner;
      winner.wins += 1;
      this.pushFeed("win", "venceu no desempate final", winner.nickname);
      this.emit(winner.x, winner.y, 28, "confetti", winner.color, 0.32, 0.012);
      this.sound("win");
    }
  }

  private nextRound() {
    this.round += 1;
    this.phase = "lobby";
    this.phaseT = 0;
    this.ring = START_RADIUS;
    this.winner = null;
    for (const f of this.fighters) {
      f.maxHp = 100;
      f.hp = 100;
      f.r = BASE_RADIUS;
      f.mass = 1;
      f.shield = 0;
      f.titanUntil = 0;
      f.dashUntil = 0;
      f.targetId = null;
      f.wanderT = 0;
      f.attackCd = 0.25 + Math.random() * 0.35;
      this.revive(f);
    }
    this.pushFeed("system", `Rodada ${this.round} — comente para entrar.`);
  }

  private tickCombat(dt: number) {
    const alive = this.fighters.filter((f) => f.alive);
    for (const f of alive) {
      if (this.time > f.titanUntil) {
        f.mass += (1 - f.mass) * 3 * dt;
        f.r += (BASE_RADIUS - f.r) * 3 * dt;
      }
      f.attackCd = Math.max(0, f.attackCd - dt);
      f.wanderT -= dt;
      if (f.wanderT <= 0) {
        f.wanderT = 0.6 + Math.random() * 1.2;
        f.wanderA += (Math.random() - 0.5) * 1.6;
        const others = alive.filter((o) => o !== f);
        f.targetId = others.length ? others[Math.floor(Math.random() * others.length)]!.id : null;
      }
      const target = f.targetId ? this.fighters.find((o) => o.id === f.targetId && o.alive) : null;
      let ax = Math.cos(f.wanderA) * 0.22;
      let ay = Math.sin(f.wanderA) * 0.22;
      if (target) {
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const d = Math.hypot(dx, dy) || 1;
        ax += (dx / d) * 0.42;
        ay += (dy / d) * 0.42;
      }
      const cx = 0.5 - f.x;
      const cy = 0.5 - f.y;
      const cd = Math.hypot(cx, cy);
      if (cd > this.ring * 0.72) {
        ax += (cx / (cd || 1)) * 0.55;
        ay += (cy / (cd || 1)) * 0.55;
      }
      f.vx += ax * dt;
      f.vy += ay * dt;
      const damp = Math.exp(-1.8 * dt);
      f.vx *= damp;
      f.vy *= damp;
      const sp = Math.hypot(f.vx, f.vy);
      const maxSp = f.titanUntil > this.time ? 0.55 : 0.42;
      if (sp > maxSp) {
        f.vx *= maxSp / sp;
        f.vy *= maxSp / sp;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      const fromCenter = dist(f.x, f.y, 0.5, 0.5);
      if (fromCenter > this.ring - f.r * 0.2) {
        f.hp -= 18 * dt;
        if (Math.random() < 0.2) this.emit(f.x, f.y, 1, "smoke", "#e24b6a", 0.08, 0.01);
        if (fromCenter > this.ring + f.r) {
          const n = fromCenter || 1;
          const push = (fromCenter - this.ring) * 1.8;
          f.x -= ((f.x - 0.5) / n) * push * dt * 6;
          f.y -= ((f.y - 0.5) / n) * push * dt * 6;
        }
      }
      if (f.hp <= 0) this.eliminate(f);
    }

    for (let i = 0; i < alive.length; i++) {
      const a = alive[i]!;
      if (!a.alive) continue;
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j]!;
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        const min = a.r + b.r;
        const attackRange = min + 0.022;
        if (d > attackRange) continue;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - d;
        const im = 1 / a.mass;
        const jm = 1 / b.mass;
        const share = overlap / (im + jm);
        a.x -= nx * share * im;
        a.y -= ny * share * im;
        b.x += nx * share * jm;
        b.y += ny * share * jm;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const e = 0.78;
          const jimp = (-(1 + e) * rel) / (im + jm);
          a.vx -= jimp * im * nx;
          a.vy -= jimp * im * ny;
          b.vx += jimp * jm * nx;
          b.vy += jimp * jm * ny;
          const impact = Math.abs(rel);
          if (impact > 0.18) {
            this.hit(a, b, nx, ny, impact);
          }
        }

        if (d <= attackRange) {
          if (a.attackCd <= 0 && a.alive) {
            const damage = 7 + Math.min(8, Math.hypot(a.vx, a.vy) * 12);
            this.deal(b, damage * (a.mass / (b.mass + 0.75)), nx, ny);
            a.attackCd = a.titanUntil > this.time ? 0.45 : 0.7;
            this.emit((a.x + b.x) / 2, (a.y + b.y) / 2, 3, "spark", a.color, 0.18, 0.006);
          }
          if (b.attackCd <= 0 && b.alive) {
            const damage = 7 + Math.min(8, Math.hypot(b.vx, b.vy) * 12);
            this.deal(a, damage * (b.mass / (a.mass + 0.75)), -nx, -ny);
            b.attackCd = b.titanUntil > this.time ? 0.45 : 0.7;
            this.emit((a.x + b.x) / 2, (a.y + b.y) / 2, 3, "spark", b.color, 0.18, 0.006);
          }
        }
      }
    }
  }

  private hit(a: Fighter, b: Fighter, nx: number, ny: number, impact: number) {
    const dmg = 6 + impact * 28;
    this.deal(a, dmg * (b.mass / (a.mass + 0.35)), -nx, -ny);
    this.deal(b, dmg * (a.mass / (b.mass + 0.35)), nx, ny);
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    this.emit(mx, my, 10, "spark", "#f4f4f5", 0.3, 0.007);
    this.trauma = Math.min(1, this.trauma + Math.min(0.35, impact * 0.4));
    if (impact > 0.32) {
      this.hitstop = 0.045;
      this.sound("hit");
    }
  }

  private deal(f: Fighter, amount: number, nx: number, ny: number) {
    if (f.shield > 0) {
      f.shield -= 1;
      this.floater(f.x, f.y - 0.03, "BLOQUEIO", "#e8eef2");
      return;
    }
    f.hp -= amount;
    f.flashUntil = this.time + 0.12;
    f.squash = 0.82;
    f.vx += nx * 0.08;
    f.vy += ny * 0.08;
    if (f.hp <= 0) this.eliminate(f);
  }

  private eliminate(f: Fighter) {
    if (!f.alive) return;
    f.alive = false;
    f.hp = 0;
    this.emit(f.x, f.y, 16, "smoke", f.color, 0.22, 0.012);
    this.pushFeed("elim", "saiu da arena", f.nickname);
    this.floater(f.x, f.y, "OUT", "#e24b6a");
    this.sound("elim");
  }

  private present(dt: number) {
    for (const f of this.fighters) {
      f.squash += (1 - f.squash) * Math.min(1, 10 * dt);
    }
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.kind === "heart" || p.kind === "confetti" ? -0.12 * dt : 0;
      if (p.life <= 0) p.active = false;
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i]!;
      fl.life -= dt;
      fl.y -= 0.05 * dt;
      if (fl.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.smashFx.length - 1; i >= 0; i--) {
      const s = this.smashFx[i]!;
      s.t += dt;
      if (s.t > 0.55) this.smashFx.splice(i, 1);
    }
  }

  snapshot(): Snapshot {
    const alive = this.fighters.filter((f) => f.alive);
    const ranked = [...this.fighters].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.hp - a.hp;
    });
    let timeLeft = 0;
    if (this.phase === "fight") timeLeft = Math.max(0, FIGHT_SECONDS - this.phaseT);
    else if (this.phase === "countdown") timeLeft = Math.max(0, COUNTDOWN_SECONDS - this.phaseT);
    else if (this.phase === "results") timeLeft = Math.max(0, RESULTS_SECONDS - this.phaseT);
    else timeLeft = Math.max(0, LOBBY_AUTO_START - this.phaseT);
    return {
      phase: this.phase,
      round: this.round,
      timeLeft,
      ring: this.ring,
      aliveCount: alive.length,
      total: this.fighters.length,
      viewers: this.viewers,
      winner: this.winner ? toHud(this.winner) : null,
      countdown: this.phase === "countdown" ? Math.ceil(COUNTDOWN_SECONDS - this.phaseT) : 0,
      fighters: ranked.slice(0, 8).map(toHud),
      feed: this.feed.slice(0, 10),
      giftAlert: this.giftAlert,
      smashReady: this.smashCd <= 0 && this.phase !== "results",
    };
  }
}
