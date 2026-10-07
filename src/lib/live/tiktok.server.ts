import { ControlEvent, TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";
import type { LiveEvent, LiveUser } from "./types";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function avatarFrom(user: UnknownRecord): string | undefined {
  const direct = asString(user.profilePictureUrl);
  if (direct) return direct;
  const pic = asRecord(user.profilePicture);
  const urls = pic.urlList ?? pic.urls ?? pic.url;
  if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
  if (typeof urls === "string") return urls;
  return undefined;
}

function userFrom(data: unknown): LiveUser {
  const root = asRecord(data);
  const user = asRecord(root.user);
  const uniqueId = asString(user.uniqueId, asString(user.unique_id, "anon"));
  const nickname = asString(user.nickname, uniqueId);
  const userId = asString(user.userId, asString(user.user_id, uniqueId));
  return {
    userId,
    uniqueId,
    nickname,
    avatarUrl: avatarFrom(user),
  };
}

export function translateLiveError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not live") || m.includes("offline") || m.includes("isn't live")) {
    return "Essa conta não está ao vivo agora. Abra a live e tente de novo, ou jogue o demo.";
  }
  if (m.includes("not found") || m.includes("no user") || m.includes("user_not_found")) {
    return "Usuário não encontrado. Confira o @ sem espaços.";
  }
  if (m.includes("timeout") || m.includes("timed out") || m.includes("tempo")) {
    return "A conexão demorou demais. A live está aberta?";
  }
  return "Não foi possível conectar à live. Tente outro @ ou jogue o demo.";
}

export function connectTikTokLive(
  rawId: string,
  onEvent: (event: LiveEvent) => void,
  onFatal: (message: string) => void,
  options: { diagnostic?: boolean } = {},
): { disconnect: () => void } {
  const uniqueId = rawId.replace(/^@/, "").trim();
  const diagnostic = options.diagnostic === true;

  const logDiagnostic = (stage: string, details?: unknown) => {
    if (!diagnostic) return;
    const payload = details instanceof Error
      ? { name: details.name, message: details.message, stack: details.stack }
      : details;
    console.error(`[TikTok LIVE][diagnostic][${stage}]`, payload ?? "");
  };

  logDiagnostic("start", { uniqueId, node: process.version, timestamp: new Date().toISOString() });

  const connection = new TikTokLiveConnection(uniqueId, {
    processInitialData: false,
    enableExtendedGiftInfo: true,
  });

  connection.on(ControlEvent.WEBSOCKET_CONNECTED, () => {
    logDiagnostic("websocketConnected", { uniqueId });
  });

  connection.on(ControlEvent.CONNECTED, (state: unknown) => {
    logDiagnostic("connected", state);
  });

  connection.on(ControlEvent.ERROR, (error: unknown) => {
    logDiagnostic("error-event", error);
  });

  connection.on(ControlEvent.DISCONNECTED, (details: unknown) => {
    logDiagnostic("disconnected", details);
  });

  const safe = (event: LiveEvent) => {
    try {
      onEvent(event);
    } catch {
      /* ignore subscriber errors */
    }
  };

  connection.on(WebcastEvent.CHAT, (data: unknown) => {
    const comment = asString(asRecord(data).comment, "");
    if (!comment) return;
    safe({ type: "chat", ...userFrom(data), comment });
  });

  connection.on(WebcastEvent.GIFT, (data: unknown) => {
    const rec = asRecord(data);
    const gift = asRecord(rec.gift);
    const details = asRecord(rec.extendedGiftInfo);
    const giftName =
      asString(rec.giftName) ||
      asString(gift.name) ||
      asString(details.name) ||
      "Presente";
    const diamondCount =
      asNumber(rec.diamondCount) ||
      asNumber(gift.diamond_count) ||
      asNumber(details.diamond_count) ||
      1;
    const repeatCount = Math.max(1, asNumber(rec.repeatCount, 1));
    const repeatEnd = rec.repeatEnd !== false;
    safe({
      type: "gift",
      ...userFrom(data),
      giftName,
      diamondCount,
      repeatCount,
      repeatEnd,
    });
  });

  connection.on(WebcastEvent.LIKE, (data: unknown) => {
    const rec = asRecord(data);
    safe({
      type: "like",
      ...userFrom(data),
      likeCount: Math.max(1, asNumber(rec.likeCount, 1)),
    });
  });

  connection.on(WebcastEvent.FOLLOW, (data: unknown) => {
    safe({ type: "follow", ...userFrom(data) });
  });

  connection.on(WebcastEvent.SHARE, (data: unknown) => {
    safe({ type: "share", ...userFrom(data) });
  });

  connection.on(WebcastEvent.ROOM_USER, (data: unknown) => {
    const rec = asRecord(data);
    const count =
      asNumber(rec.viewerCount) ||
      asNumber(asRecord(rec.topViewers).viewerCount) ||
      asNumber(rec.totalUser);
    if (count > 0) safe({ type: "viewer", count });
  });

  connection.on(WebcastEvent.STREAM_END, () => {
    safe({ type: "status", connected: false, uniqueId, message: "A live encerrou." });
  });

  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    try {
      connection.disconnect();
    } catch {
      /* ignore */
    }
    logDiagnostic("timeout", { timeoutMs: 30000, uniqueId });
    onFatal("A conexão demorou mais de 30 segundos. Veja o terminal para o diagnóstico detalhado.");
  }, 30000);

  connection
    .connect()
    .then((state: { roomId?: string | number }) => {
      logDiagnostic("connect-resolved", state);
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      safe({
        type: "status",
        connected: true,
        uniqueId,
        message: state?.roomId ? `Sala ${String(state.roomId)}` : "Conectado",
      });
    })
    .catch((err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      logDiagnostic("connect-rejected", err);
      onFatal(`${translateLiveError(message)}

Diagnóstico: ${message}`);
    });

  return {
    disconnect: () => {
      clearTimeout(timer);
      try {
        connection.disconnect();
      } catch {
        /* ignore */
      }
    },
  };
}
