import { useState } from "react";
import {
  Eye,
  EyeOff,
  Gift,
  Heart,
  LogOut,
  Radio,
  UserPlus,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ArenaCanvas } from "@/components/arena-canvas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATAR_SRCS } from "@/lib/game/constants";
import { useArenaStore } from "@/lib/game/store";
import { cn } from "@/lib/utils";

export function PlayView() {
  const snapshot = useArenaStore((s) => s.snapshot);
  const overlay = useArenaStore((s) => s.overlay);
  const muted = useArenaStore((s) => s.muted);
  const connection = useArenaStore((s) => s.connection);
  const setOverlay = useArenaStore((s) => s.setOverlay);
  const toggleMute = useArenaStore((s) => s.toggleMute);
  const stop = useArenaStore((s) => s.stop);
  const inject = useArenaStore((s) => s.inject);

  const live = connection.status === "live" || connection.status === "demo";
  const phaseLabel =
    snapshot.phase === "lobby"
      ? "Lobby"
      : snapshot.phase === "countdown"
        ? "Largada"
        : snapshot.phase === "fight"
          ? "Combate"
          : "Resultado";

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg">
      <ArenaCanvas className="absolute inset-0 size-full" />

      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            <Badge variant={live ? "live" : "mute"} className="tracking-[0.16em]">
              <Radio className="size-3" />
              {connection.status === "live"
                ? "LIVE"
                : connection.status === "connecting"
                  ? "…"
                  : connection.status === "demo"
                    ? "DEMO"
                    : "OFF"}
            </Badge>
            <span className="rounded-full border border-border bg-bg/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur-sm">
              Rodada {snapshot.round} · {phaseLabel}
            </span>
            <span className="hidden rounded-full border border-border bg-bg/70 px-3 py-1 font-mono text-xs text-fg tabular-nums backdrop-blur-sm sm:inline-flex">
              {formatTime(snapshot.timeLeft)}
            </span>
          </div>
          {!overlay ? (
            <div className="pointer-events-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleMute} aria-label={muted ? "Ativar som" : "Silenciar"}>
                {muted ? <VolumeX /> : <Volume2 />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOverlay(true)}
                aria-label="Modo overlay"
              >
                <EyeOff />
              </Button>
              <Button variant="ghost" size="icon" onClick={stop} aria-label="Sair">
                <LogOut />
              </Button>
            </div>
          ) : (
            <div className="pointer-events-auto">
              <Button variant="ghost" size="icon" onClick={() => setOverlay(false)} aria-label="Mostrar painéis">
                <Eye />
              </Button>
            </div>
          )}
        </div>

        {!overlay ? (
          <div className="flex min-h-0 flex-1 items-stretch justify-between gap-3 pt-3">
            <aside className="pointer-events-auto hidden w-56 shrink-0 flex-col gap-2 self-start rounded-xl border border-border bg-bg/70 p-3 shadow-panel backdrop-blur-sm md:flex">
              <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Ranking</h2>
              <ol className="space-y-2">
                {snapshot.fighters.length === 0 ? (
                  <li className="text-sm text-muted">Ninguém na arena ainda.</li>
                ) : (
                  snapshot.fighters.map((f, i) => (
                    <li key={f.id} className="flex items-center gap-2">
                      <span className="w-4 font-mono text-xs text-subtle tabular-nums">{i + 1}</span>
                      <img
                        src={AVATAR_SRCS[f.avatarIndex] ?? AVATAR_SRCS[0]}
                        alt=""
                        className="size-7 rounded-full object-cover"
                        style={{ boxShadow: `0 0 0 1.5px ${f.color}` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm", f.alive ? "text-fg" : "text-subtle")}>
                          {f.nickname}
                        </p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.max(4, (f.hp / f.maxHp) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-muted tabular-nums">{f.wins}W</span>
                    </li>
                  ))
                )}
              </ol>
            </aside>

            <aside className="pointer-events-auto ml-auto hidden w-64 shrink-0 flex-col self-start rounded-xl border border-border bg-bg/70 p-3 shadow-panel backdrop-blur-sm lg:flex">
              <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Feed</h2>
              <ul className="mt-2 space-y-2">
                {snapshot.feed.length === 0 ? (
                  <li className="text-sm text-muted">Aguardando a live…</li>
                ) : (
                  snapshot.feed.map((item) => (
                    <li key={item.id} className="text-sm leading-snug">
                      {item.name ? (
                        <span className="font-medium text-fg">{item.name} </span>
                      ) : null}
                      <span className="text-muted">{item.text}</span>
                    </li>
                  ))
                )}
              </ul>
            </aside>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex flex-col gap-3">
          {snapshot.giftAlert ? (
            <div className="banner-in pointer-events-none mx-auto flex max-w-md items-center gap-3 rounded-xl border border-border bg-surface/90 px-4 py-3 shadow-panel">
              <Gift className="size-5 text-accent" />
              <div>
                <p className="text-sm font-semibold">{snapshot.giftAlert.name}</p>
                <p className="text-xs text-muted">
                  {snapshot.giftAlert.giftName} · {snapshot.giftAlert.diamonds} diamantes
                </p>
              </div>
            </div>
          ) : null}

          {connection.status === "error" && connection.message ? (
            <p className="pointer-events-none mx-auto max-w-lg rounded-lg border border-border bg-bg/80 px-3 py-2 text-center text-sm text-danger">
              {connection.message}
            </p>
          ) : null}

          {!overlay ? <InjectBar onInject={inject} smashReady={snapshot.smashReady} /> : null}
        </div>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function InjectBar({
  onInject,
  smashReady,
}: {
  onInject: ReturnType<typeof useArenaStore.getState>["inject"];
  smashReady: boolean;
}) {
  const [name, setName] = useState("voce");
  const [comment, setComment] = useState("entrei");
  const user = {
    userId: name || "voce",
    uniqueId: (name || "voce").replace(/\s+/g, ".").toLowerCase(),
    nickname: name || "você",
  };

  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border border-border bg-bg/80 p-3 shadow-panel backdrop-blur-sm sm:flex-row sm:items-center">
      <Input
        aria-label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-10 rounded-md sm:max-w-36"
        placeholder="Nome"
      />
      <Input
        aria-label="Comentário"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="h-10 rounded-md flex-1"
        placeholder="Comentário"
        onKeyDown={(e) => {
          if (e.key === "Enter") onInject({ type: "chat", ...user, comment: comment || "entrei" });
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="rounded-md"
          onClick={() => onInject({ type: "chat", ...user, comment: comment || "entrei" })}
        >
          Comentar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-md"
          onClick={() => onInject({ type: "like", ...user, likeCount: 7 })}
        >
          <Heart className="size-3.5" />
          Curtir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-md"
          onClick={() =>
            onInject({
              type: "gift",
              ...user,
              giftName: "Leão",
              diamondCount: 299,
              repeatCount: 1,
              repeatEnd: true,
            })
          }
        >
          <Gift className="size-3.5" />
          Presente
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-md"
          onClick={() => onInject({ type: "follow", ...user })}
        >
          <UserPlus className="size-3.5" />
          Seguir
        </Button>
      </div>
      <p className="hidden text-[11px] text-subtle lg:block">
        {smashReady ? "Toque na arena para um impacto." : "Impacto recarregando…"}
      </p>
    </div>
  );
}
