import { create } from "zustand";
import { gameSession, type ConnectionState } from "./session";
import type { Snapshot } from "./types";
import type { LiveEvent } from "@/lib/live/types";

type ArenaStore = {
  screen: "start" | "play";
  overlay: boolean;
  muted: boolean;
  connection: ConnectionState;
  snapshot: Snapshot;
  startDemo: () => void;
  startLive: (uniqueId: string) => void;
  stop: () => void;
  inject: (event: LiveEvent) => void;
  setOverlay: (value: boolean) => void;
  toggleMute: () => void;
  sync: () => void;
};

const emptySnap = (): Snapshot => gameSession.engine.snapshot();

export const useArenaStore = create<ArenaStore>((set, get) => {
  gameSession.onHud = () => get().sync();
  gameSession.onConnection = (connection) => set({ connection });

  return {
    screen: "start",
    overlay: false,
    muted: false,
    connection: { status: "idle" },
    snapshot: emptySnap(),
    startDemo: () => {
      gameSession.startDemo();
      set({ screen: "play", overlay: false });
    },
    startLive: (uniqueId) => {
      gameSession.startLive(uniqueId);
      set({ screen: "play", overlay: false });
    },
    stop: () => {
      gameSession.stopStream();
      set({
        screen: "start",
        overlay: false,
        connection: { status: "idle" },
        snapshot: emptySnap(),
      });
    },
    inject: (event) => gameSession.inject(event),
    setOverlay: (overlay) => set({ overlay }),
    toggleMute: () => {
      const muted = !get().muted;
      gameSession.audio.muted = muted;
      set({ muted });
    },
    sync: () => set({ snapshot: gameSession.engine.snapshot() }),
  };
});


