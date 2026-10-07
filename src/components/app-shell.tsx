import { PlayView } from "@/components/play-view";
import { StartScreen } from "@/components/start-screen";
import { useArenaStore } from "@/lib/game/store";

export function AppShell() {
  const screen = useArenaStore((s) => s.screen);
  if (screen === "play") return <PlayView />;
  return <StartScreen />;
}
