import { ArenaEngine } from "./engine";
import { GameAudio } from "./audio";
import { LiveSimulator } from "@/lib/live/simulator";
import type { LiveEvent } from "@/lib/live/types";

export type PlayMode = "demo" | "live";

class GameSession {
  engine = new ArenaEngine();
  simulator = new LiveSimulator();
  audio = new GameAudio();
  source: EventSource | null = null;
  mode: PlayMode = "demo";
  uniqueId = "";
  onHud: () => void = () => {};
  onConnection: (state: ConnectionState) => void = () => {};
  hudAcc = 0;

  constructor() {
    this.simulator.onEvent = (event) => this.ingest(event);
  }

  ingest(event: LiveEvent) {
    if (event.type === "status") {
      this.onConnection(
        event.connected
          ? { status: "live", message: event.message, uniqueId: event.uniqueId ?? this.uniqueId }
          : { status: "error", message: event.message ?? "Conexão encerrada." },
      );
      if (!event.connected) this.closeSource();
    }
    this.engine.pushEvent(event);
    this.onHud();
  }

  tick(dt: number) {
    this.simulator.tick(dt);
    this.engine.step(dt);
    this.hudAcc += dt;
    if (this.hudAcc >= 0.1) {
      this.hudAcc = 0;
      this.onHud();
    }
    for (const kind of this.engine.consumeSounds()) this.audio.play(kind);
  }

  startDemo() {
    this.stopStream();
    this.mode = "demo";
    this.engine.reset();
    this.simulator.start();
    this.audio.unlock();
    this.onConnection({ status: "demo", message: "Simulação de live" });
    this.onHud();
  }

  startLive(uniqueId: string) {
    const id = uniqueId.replace(/^@/, "").trim();
    this.stopStream();
    this.mode = "live";
    this.uniqueId = id;
    this.engine.reset();
    this.simulator.stop();
    this.audio.unlock();
    this.onConnection({ status: "connecting", message: "Conectando à live…", uniqueId: id });
    const diagnostic = new URLSearchParams(window.location.search).get("diagnostic") === "1";
    const diagnosticQuery = diagnostic ? "&diagnostic=1" : "";
    const es = new EventSource(`/api/live?uniqueId=${encodeURIComponent(id)}${diagnosticQuery}`);
    this.source = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as LiveEvent;
        this.ingest(data);
      } catch {
        /* ignore malformed */
      }
    };
    es.onerror = () => {
      if (this.source !== es) return;
      if (es.readyState === EventSource.CLOSED) {
        this.onConnection({
          status: "error",
          message: "Não foi possível manter a conexão com a live. Tente o demo.",
          uniqueId: id,
        });
        this.closeSource();
      }
    };
    this.onHud();
  }

  inject(event: LiveEvent) {
    this.audio.unlock();
    this.ingest(event);
  }

  smash(nx: number, ny: number) {
    this.audio.unlock();
    this.engine.smash(nx, ny);
  }

  stopStream() {
    this.simulator.stop();
    this.closeSource();
  }

  closeSource() {
    if (this.source) {
      this.source.close();
      this.source = null;
    }
  }
}

export type ConnectionState = {
  status: "idle" | "demo" | "connecting" | "live" | "error";
  message?: string;
  uniqueId?: string;
};

export const gameSession = new GameSession();
