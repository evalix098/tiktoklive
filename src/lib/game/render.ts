import type { ArenaEngine } from "./engine";
import type { GameImages } from "./assets";
import { loadRemoteAvatar } from "./assets";
import { COUNTDOWN_SECONDS, START_RADIUS } from "./constants";
import type { Fighter } from "./types";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function avatarFor(f: Fighter, images: GameImages): HTMLImageElement | null {
  if (f.avatarUrl) {
    const remote = loadRemoteAvatar(images, f.avatarUrl);
    if (remote) return remote;
  }
  return images.avatars[f.avatarIndex] ?? images.avatars[0] ?? null;
}

export function renderArena(
  ctx: CanvasRenderingContext2D,
  engine: ArenaEngine,
  images: GameImages,
  w: number,
  h: number,
) {
  const size = Math.min(w, h);
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  const cx = ox + size / 2;
  const cy = oy + size / 2;
  const toX = (x: number) => ox + x * size;
  const toY = (y: number) => oy + y * size;
  const toR = (r: number) => r * size;

  const shake = engine.reducedMotion ? 0 : engine.trauma * engine.trauma;
  const sx = shake ? (Math.random() * 2 - 1) * 14 * shake : 0;
  const sy = shake ? (Math.random() * 2 - 1) * 14 * shake : 0;

  ctx.save();
  ctx.fillStyle = "#0a0a0b";
  ctx.fillRect(0, 0, w, h);

  ctx.translate(sx, sy);

  if (images.arena) {
    const img = images.arena;
    const scale = Math.max(w / img.width, h / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    ctx.globalAlpha = 0.72;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.globalAlpha = 1;
  }

  const dim = ctx.createRadialGradient(cx, cy, toR(engine.ring * 0.2), cx, cy, toR(START_RADIUS + 0.08));
  dim.addColorStop(0, "rgba(10,10,11,0.08)");
  dim.addColorStop(0.7, "rgba(10,10,11,0.28)");
  dim.addColorStop(1, "rgba(10,10,11,0.72)");
  ctx.fillStyle = dim;
  ctx.fillRect(0, 0, w, h);

  const ringR = toR(engine.ring);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(226, 75, 106, 0.14)";
  ctx.fill("evenodd");
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(46, 230, 220, 0.22)";
  ctx.lineWidth = 14;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = "#2ee6dc";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (const s of engine.smashFx) {
    const p = Math.min(1, s.t / 0.55);
    ctx.beginPath();
    ctx.arc(toX(s.x), toY(s.y), toR(0.04 + p * 0.22), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(46,230,220,${1 - p})`;
    ctx.lineWidth = 3 * (1 - p);
    ctx.stroke();
  }

  for (const p of engine.particles) {
    if (!p.active) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.kind === "heart") {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), toR(p.size), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(toX(p.x), toY(p.y), toR(p.size * (2 - a)), 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(toX(p.x) - 1.5, toY(p.y) - 1.5, Math.max(2, toR(p.size)), Math.max(2, toR(p.size)));
    }
    ctx.globalAlpha = 1;
  }

  const ordered = [...engine.fighters].sort((a, b) => Number(a.alive) - Number(b.alive) || a.y - b.y);
  for (const f of ordered) {
    drawFighter(ctx, f, engine, images, toX, toY, toR);
  }

  for (const fl of engine.floaters) {
    ctx.globalAlpha = Math.max(0, fl.life);
    ctx.font = `600 ${Math.max(11, size * 0.018)}px Figtree, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = fl.color;
    ctx.strokeStyle = "rgba(10,10,11,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(fl.text, toX(fl.x), toY(fl.y));
    ctx.fillText(fl.text, toX(fl.x), toY(fl.y));
    ctx.globalAlpha = 1;
  }

  drawCenterCopy(ctx, engine, cx, cy, size, images, toR);
  ctx.restore();
}

function drawFighter(
  ctx: CanvasRenderingContext2D,
  f: Fighter,
  engine: ArenaEngine,
  images: GameImages,
  toX: (n: number) => number,
  toY: (n: number) => number,
  toR: (n: number) => number,
) {
  const x = toX(f.x);
  const y = toY(f.y);
  const r = toR(f.r) * f.squash;
  ctx.save();
  if (!f.alive) ctx.globalAlpha = 0.22;

  ctx.beginPath();
  ctx.arc(x, y + r * 0.18, r * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();

  const img = avatarFor(f, images);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = "#1c1c20";
    ctx.fill();
  }
  if (f.flashUntil > engine.time) {
    ctx.fillStyle = "rgba(244,244,245,0.45)";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = f.color;
  ctx.lineWidth = f.titanUntil > engine.time ? 4 : 2.4;
  ctx.stroke();

  if (f.alive) {
    const frac = Math.max(0, f.hp / f.maxHp);
    ctx.beginPath();
    ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac < 0.28 ? "#e24b6a" : "#2ee6dc";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (f.shield > 0 && f.alive) {
    ctx.beginPath();
    ctx.arc(x, y, r + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232,238,242,0.7)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (f.alive && engine.winner?.id === f.id && images.crown) {
    const cw = r * 1.35;
    ctx.drawImage(images.crown, x - cw / 2, y - r - cw * 0.85, cw, cw);
  }

  const label = f.nickname.length > 14 ? `${f.nickname.slice(0, 13)}…` : f.nickname;
  const font = Math.max(11, toR(0.016));
  ctx.font = `600 ${font}px Figtree, sans-serif`;
  ctx.textAlign = "center";
  const tw = ctx.measureText(label).width;
  const pad = 8;
  const ly = y + r + 16;
  roundRect(ctx, x - tw / 2 - pad, ly - 12, tw + pad * 2, 18, 9);
  ctx.fillStyle = "rgba(10,10,11,0.78)";
  ctx.fill();
  ctx.fillStyle = "#f4f4f5";
  ctx.fillText(label, x, ly + 1);

  if (f.wins > 0) {
    ctx.font = `500 ${Math.max(10, font - 1)}px IBM Plex Mono, monospace`;
    ctx.fillStyle = "#8a8a93";
    ctx.fillText(`${f.wins}W`, x, ly + 16);
  }
  ctx.restore();
}

function drawCenterCopy(
  ctx: CanvasRenderingContext2D,
  engine: ArenaEngine,
  cx: number,
  cy: number,
  size: number,
  images: GameImages,
  toR: (n: number) => number,
) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (engine.phase === "lobby") {
    const y = engine.fighters.some((f) => f.alive) ? cy - size * 0.4 : cy - 10;
    ctx.font = `700 ${Math.max(22, size * 0.042)}px Syne, sans-serif`;
    ctx.fillStyle = "#f4f4f5";
    ctx.fillText("Aguardando lutadores", cx, y);
    ctx.font = `500 ${Math.max(13, size * 0.02)}px Figtree, sans-serif`;
    ctx.fillStyle = "#8a8a93";
    ctx.fillText("Comente na live para entrar", cx, y + 28);
  } else if (engine.phase === "countdown") {
    ctx.font = `800 ${Math.max(64, size * 0.16)}px Syne, sans-serif`;
    ctx.fillStyle = "#2ee6dc";
    ctx.fillText(String(Math.max(1, Math.ceil(COUNTDOWN_SECONDS - engine.phaseT))), cx, cy);
  } else if (engine.phase === "results") {
    if (engine.winner) {
      ctx.font = `700 ${Math.max(26, size * 0.048)}px Syne, sans-serif`;
      ctx.fillStyle = "#f4f4f5";
      ctx.fillText(`${engine.winner.nickname} venceu`, cx, cy + toR(0.18));
      if (images.crown) {
        const cw = toR(0.08);
        ctx.drawImage(images.crown, cx - cw / 2, cy + toR(0.2), cw, cw);
      }
    } else {
      ctx.font = `700 ${Math.max(22, size * 0.04)}px Syne, sans-serif`;
      ctx.fillStyle = "#f4f4f5";
      ctx.fillText("Empate", cx, cy);
    }
  }
}
