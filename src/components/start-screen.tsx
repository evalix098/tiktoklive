import { useState } from "react";
import { Gift, MessageSquare, Radio, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useArenaStore } from "@/lib/game/store";
import { ARENA_SRC } from "@/lib/game/constants";

export function StartScreen() {
  const startDemo = useArenaStore((s) => s.startDemo);
  const startLive = useArenaStore((s) => s.startLive);
  const connection = useArenaStore((s) => s.connection);
  const [handle, setHandle] = useState("");
  const connecting = connection.status === "connecting";

  const connect = () => {
    const id = handle.replace(/^@/, "").trim();
    if (!id) return;
    startLive(id);
  };

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-bg text-fg">
      <img
        src={ARENA_SRC}
        alt=""
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-45"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/80 to-bg" />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 py-10 sm:px-8">
        <header className="max-w-xl space-y-5">
          <Badge variant="live" className="rise-in tracking-[0.18em]">
            <Radio className="size-3" />
            LIVE
          </Badge>
          <h1
            className="font-display rise-in text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl"
            style={{ animationDelay: "40ms" }}
          >
            Arena Live
          </h1>
          <p
            className="rise-in max-w-md text-base text-muted sm:text-lg"
            style={{ animationDelay: "80ms" }}
          >
            Comentários entram na arena. Presentes viram poder. O último em pé
            vence a rodada da sua live do TikTok.
          </p>
        </header>

        <form
          className="rise-in flex w-full max-w-xl flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "120ms" }}
          onSubmit={(e) => {
            e.preventDefault();
            connect();
          }}
        >
          <label className="sr-only" htmlFor="tiktok-handle">
            Usuário do TikTok
          </label>
          <Input
            id="tiktok-handle"
            autoComplete="off"
            spellCheck={false}
            placeholder="@usuario da live"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="h-12 rounded-lg sm:flex-1"
          />
          <Button type="submit" variant="accent" size="lg" className="rounded-lg" disabled={connecting}>
            {connecting ? "Conectando…" : "Conectar live"}
          </Button>
        </form>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="rounded-lg sm:shrink-0"
            onClick={startDemo}
          >
            Jogar demo
          </Button>
          <p className="text-sm text-muted">
            O demo simula comentários, curtidas e presentes na hora.
          </p>
        </div>

        {connection.status === "error" && connection.message ? (
          <p className="max-w-xl text-sm text-danger">{connection.message}</p>
        ) : null}

        <ul className="grid max-w-3xl gap-3 sm:grid-cols-3">
          <Rule
            icon={MessageSquare}
            title="Comentário"
            body="Quem comenta entra na arena. Comentar de novo é um dash."
          />
          <Rule
            icon={Gift}
            title="Presente"
            body="Rosa empurra. Leão e Galaxy viram titã e abrem espaço."
          />
          <Rule
            icon={Trophy}
            title="Último em pé"
            body="O círculo fecha. Quem ficar vivo leva a rodada."
          />
        </ul>
      </div>
    </div>
  );
}

function Rule({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Gift;
  title: string;
  body: string;
}) {
  return (
    <li className="rounded-xl border border-border bg-surface/80 p-4 shadow-panel">
      <div className="mb-3 flex size-9 items-center justify-center rounded-md bg-surface-2 text-accent">
        <Icon className="size-4" />
      </div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-snug text-muted">{body}</p>
    </li>
  );
}
