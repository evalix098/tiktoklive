import type { LiveEvent } from "./types";

const NAMES = [
  "gabi.live",
  "pedro.gg",
  "ana.costa",
  "luiz_tok",
  "mari.plays",
  "joao.live",
  "leticia",
  "rafa.gg",
  "bia.live",
  "davi.tok",
  "camila",
  "thiago",
  "nanda.live",
  "bruno.gg",
  "lara",
  "caio.live",
  "isa.costa",
  "felipe",
  "ju.live",
  "otavio",
  "sofia.gg",
  "henrique",
  "mel.live",
  "vitor.tok",
];

const COMMENTS = [
  "entrei",
  "vamo",
  "gg",
  "é nois",
  "manda rose",
  "top",
  "boa",
  "kkkkk",
  "sobe",
  "me coloca",
  "vamo que vamo",
  "primeiro",
  "ao ataque",
  "eu vou ganhar",
  "dash",
  "protege",
  "bora",
  "é o meu",
  "last stand",
  "não cai",
];

const GIFTS: { name: string; diamonds: number; weight: number }[] = [
  { name: "Rosa", diamonds: 1, weight: 38 },
  { name: "TikTok", diamonds: 1, weight: 22 },
  { name: "Café", diamonds: 10, weight: 16 },
  { name: "Buquê", diamonds: 25, weight: 12 },
  { name: "Leão", diamonds: 299, weight: 8 },
  { name: "Galaxy", diamonds: 1000, weight: 4 },
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function weightedGift() {
  const total = GIFTS.reduce((s, g) => s + g.weight, 0);
  let r = Math.random() * total;
  for (const g of GIFTS) {
    r -= g.weight;
    if (r <= 0) return g;
  }
  return GIFTS[0]!;
}

function identity(uniqueId: string) {
  return {
    userId: uniqueId,
    uniqueId,
    nickname: uniqueId,
  };
}

export class LiveSimulator {
  active = false;
  acc = 0;
  next = 0.4;
  viewers = 128;
  roster: string[] = [];
  onEvent: (event: LiveEvent) => void = () => {};

  start() {
    this.active = true;
    this.acc = 0;
    this.next = 0.25;
    this.viewers = 80 + Math.floor(Math.random() * 220);
    this.roster = [];
    for (let i = 0; i < 4; i++) this.onEvent(this.makeEvent());
  }

  stop() {
    this.active = false;
  }

  tick(dt: number) {
    if (!this.active) return;
    this.acc += dt;
    if (this.acc < this.next) return;
    this.acc = 0;
    this.next = 0.28 + Math.random() * 0.9;
    this.onEvent(this.makeEvent());
  }

  private person(): string {
    if (this.roster.length > 3 && Math.random() < 0.62) {
      return pick(this.roster);
    }
    const unused = NAMES.filter((n) => !this.roster.includes(n));
    const name = unused.length ? pick(unused) : pick(NAMES);
    if (!this.roster.includes(name)) this.roster.push(name);
    return name;
  }

  private makeEvent(): LiveEvent {
    const roll = Math.random();
    if (roll < 0.08) {
      this.viewers = Math.max(24, this.viewers + Math.floor(Math.random() * 21) - 8);
      return { type: "viewer", count: this.viewers };
    }
    const uniqueId = this.person();
    const user = identity(uniqueId);
    if (roll < 0.56) {
      return { type: "chat", ...user, comment: pick(COMMENTS) };
    }
    if (roll < 0.74) {
      return { type: "like", ...user, likeCount: 1 + Math.floor(Math.random() * 12) };
    }
    if (roll < 0.9) {
      const gift = weightedGift();
      return {
        type: "gift",
        ...user,
        giftName: gift.name,
        diamondCount: gift.diamonds,
        repeatCount: 1,
        repeatEnd: true,
        giftType: gift.name === "Rosa" || gift.name === "TikTok" ? 1 : 0,
        transactionId: `${uniqueId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
    }
    if (roll < 0.96) {
      return { type: "follow", ...user };
    }
    return { type: "share", ...user };
  }
}
