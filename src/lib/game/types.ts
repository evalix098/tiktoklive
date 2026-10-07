import type { FeedItem } from "@/lib/live/types";

export type RoundPhase = "lobby" | "countdown" | "fight" | "results";

export type Fighter = {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarIndex: number;
  avatarUrl?: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  mass: number;
  shield: number;
  dashUntil: number;
  titanUntil: number;
  flashUntil: number;
  spawnT: number;
  wins: number;
  diamonds: number;
  alive: boolean;
  wanderA: number;
  wanderT: number;
  targetId: string | null;
  attackCd: number;
  squash: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: "spark" | "heart" | "ring" | "confetti" | "smoke";
  active: boolean;
};

export type Floater = {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
};

export type SmashFx = {
  x: number;
  y: number;
  t: number;
};

export type GiftAlert = {
  name: string;
  giftName: string;
  diamonds: number;
  color: string;
};

export type HudFighter = {
  id: string;
  nickname: string;
  uniqueId: string;
  hp: number;
  maxHp: number;
  wins: number;
  diamonds: number;
  alive: boolean;
  color: string;
  avatarIndex: number;
};

export type Snapshot = {
  phase: RoundPhase;
  round: number;
  timeLeft: number;
  ring: number;
  aliveCount: number;
  total: number;
  viewers: number;
  winner: HudFighter | null;
  countdown: number;
  fighters: HudFighter[];
  feed: FeedItem[];
  giftAlert: GiftAlert | null;
  smashReady: boolean;
};
