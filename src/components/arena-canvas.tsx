import { useEffect, useRef } from "react";
import { gameSession } from "@/lib/game/session";
import { createImageCache, loadGameImages, type GameImages } from "@/lib/game/assets";
import { renderArena } from "@/lib/game/render";

type Props = {
  className?: string;
};

export function ArenaCanvas({ className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const images: GameImages = createImageCache();
    void loadGameImages(images);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
      gameSession.engine.reducedMotion = reduced.matches;
    };
    applyMotion();
    reduced.addEventListener("change", applyMotion);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      gameSession.tick(dt);

      const parent = canvas.parentElement;
      const cw = parent?.clientWidth ?? window.innerWidth;
      const ch = parent?.clientHeight ?? window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const tw = Math.max(1, Math.floor(cw * dpr));
      const th = Math.max(1, Math.floor(ch * dpr));
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderArena(ctx, gameSession.engine, images, cw, ch);
    };
    raf = requestAnimationFrame(loop);

    const onPointer = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const size = Math.min(w, h);
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;
      const nx = (ev.clientX - rect.left - ox) / size;
      const ny = (ev.clientY - rect.top - oy) / size;
      gameSession.smash(nx, ny);
    };
    canvas.addEventListener("pointerdown", onPointer);

    return () => {
      cancelAnimationFrame(raf);
      reduced.removeEventListener("change", applyMotion);
      canvas.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ touchAction: "none" }}
      aria-label="Arena de batalha da live"
    />
  );
}
