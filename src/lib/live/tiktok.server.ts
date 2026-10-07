import WebSocket from "ws";
import type { LiveEvent, LiveUser } from "./types";

type UnknownRecord = Record<string, unknown>;

type EulerMessage = {
  type?: string;
  data?: unknown;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function avatarFrom(user: UnknownRecord): string | undefined {
  const direct = asString(user.profilePictureUrl) || asString(user.avatarUrl);
  if (direct) return direct;
  const pic = asRecord(user.profilePicture);
  const urls = pic.urlList ?? pic.urls ?? pic.url;
  if (Array.isArray(urls) && typeof urls[0] === "string") return urls[0];
  if (typeof urls === "string") return urls;
  return undefined;
}

function userFrom(data: unknown): LiveUser {
  const root = asRecord(data);
  const user = asRecord(root.user ?? root.userInfo ?? root.author);
  const uniqueId = asString(user.uniqueId, asString(user.unique_id, asString(user.displayId, "anon")));
  const nickname = asString(user.nickname, asString(user.displayName, uniqueId));
  const userId = asString(user.userId, asString(user.user_id, asString(user.id, uniqueId)));
  return { userId, uniqueId, nickname, avatarUrl: avatarFrom(user) };
}

export function translateLiveError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not live") || m.includes("offline") || m.includes("isn't live")) {
    return "Essa conta não está ao vivo agora. Abra a live e tente de novo, ou jogue o demo.";
  }
  if (m.includes("not found") || m.includes("no user") || m.includes("user_not_found")) {
    return "Usuário não encontrado. Confira o @ sem espaços.";
  }
  if (m.includes("api key") || m.includes("invalid auth") || m.includes("permission")) {
    return "A chave da Euler Stream não está configurada ou não tem permissão. Configure EULER_API_KEY no Render.";
  }
  if (m.includes("timeout") || m.includes("timed out") || m.includes("tempo")) {
    return "A conexão demorou demais. A live está aberta?";
  }
  return "Não foi possível conectar à live. Tente outro @ ou jogue o demo.";
}

function normalizeEulerMessages(value: unknown): EulerMessage[] {
  const root = asRecord(value);
  const messages = root.messages;
  if (Array.isArray(messages)) return messages.map(asRecord) as EulerMessage[];
  if (root.type || root.data) return [root as EulerMessage];
  return [];
}

function mapEulerMessage(message: EulerMessage): LiveEvent | null {
  const type = asString(message.type).toLowerCase();
  const data = asRecord(message.data);

  if (type === "roominfo" || type === "room_info") {
    const roomId = asString(data.roomId, asString(data.room_id));
    return { type: "status", connected: true, uniqueId: asString(data.uniqueId), message: roomId ? `Sala ${roomId}` : "Conectado" };
  }

  if (type === "chat" || type === "comment") {
    const comment = asString(data.comment, asString(data.text));
    if (!comment) return null;
    return { type: "chat", ...userFrom(data), comment };
  }

  if (type === "gift") {
    return {
      type: "gift",
      ...userFrom(data),
      giftName: asString(data.giftName, asString(data.gift_name, "Presente")),
      diamondCount: Math.max(1, asNumber(data.diamondCount, asNumber(data.diamond_count, 1))),
      repeatCount: Math.max(1, asNumber(data.repeatCount, asNumber(data.repeat_count, 1))),
      repeatEnd: data.repeatEnd !== false && data.repeat_end !== false,
    };
  }

  if (type === "like") {
    return { type: "like", ...userFrom(data), likeCount: Math.max(1, asNumber(data.likeCount, asNumber(data.like_count, 1))) };
  }

  if (type === "follow") return { type: "follow", ...userFrom(data) };
  if (type === "share") return { type: "share", ...userFrom(data) };

  if (type === "member" || type === "join" || type === "syntheticjoinmessage") {
    return { type: "status", connected: true, uniqueId: userFrom(data).uniqueId, message: `${userFrom(data).nickname} entrou na live.` };
  }

  if (type === "roomuserseq" || type === "room_user" || type === "roomupdate" || type === "room.update") {
    const count = asNumber(data.viewerCount, asNumber(data.viewer_count, asNumber(data.totalUser)));
    return count > 0 ? { type: "viewer", count } : null;
  }

  if (type === "streamend" || type === "stream_end" || type === "tiktok.disconnect") {
    return { type: "status", connected: false, message: "A live encerrou." };
  }

  if (type === "room.status") {
    const state = asString(data.state);
    if (state === "offline" || state === "ended" || state === "error") {
      return { type: "status", connected: false, message: asString(data.message, "A live encerrou ou ficou indisponível.") };
    }
    if (state === "connected") {
      const roomId = asString(data.roomId);
      return { type: "status", connected: true, message: roomId ? `Sala ${roomId}` : "Conectado" };
    }
  }

  return null;
}

export function connectTikTokLive(
  rawId: string,
  onEvent: (event: LiveEvent) => void,
  onFatal: (message: string) => void,
  options: { diagnostic?: boolean } = {},
): { disconnect: () => void } {
  const uniqueId = rawId.replace(/^@/, "").trim();
  const diagnostic = options.diagnostic === true;
  const apiKey = process.env.EULER_API_KEY?.trim();

  if (!apiKey) {
    onFatal("EULER_API_KEY não configurada no servidor.");
    return { disconnect: () => {} };
  }

  const logDiagnostic = (stage: string, details?: unknown) => {
    if (!diagnostic) return;
    console.error(`[TikTok LIVE][diagnostic][${stage}]`, details ?? "");
  };

  const params = new URLSearchParams({
    uniqueId,
    apiKey,
    "features.bundleEvents": "true",
    "features.rawMessages": "false",
    "features.normalizeUniqueId": "true",
    schemaVersion: "v1",
  });

  const ws = new WebSocket(`wss://ws.eulerstream.com?${params.toString()}`);
  let settled = false;
  let connected = false;
  const timer = setTimeout(() => {
    if (settled || connected) return;
    settled = true;
    try { ws.close(); } catch { /* ignore */ }
    onFatal("A conexão demorou mais de 30 segundos. A live está aberta?");
  }, 30000);

  ws.on("open", () => {
    connected = true;
    logDiagnostic("websocketConnected", { uniqueId });
  });

  ws.on("message", (raw: WebSocket.RawData) => {
    try {
      const parsed = JSON.parse(raw.toString()) as unknown;
      for (const message of normalizeEulerMessages(parsed)) {
        const event = mapEulerMessage(message);
        if (event) onEvent(event);
      }
      if (!settled) {
        settled = true;
        clearTimeout(timer);
      }
    } catch (error) {
      logDiagnostic("message-parse-error", error);
    }
  });

  ws.on("error", (error: Error) => {
    logDiagnostic("error", error);
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    onFatal(translateLiveError(error.message || String(error)) + `\n\nDiagnóstico: ${error.message || String(error)}`);
  });

  ws.on("close", (code: number, reason: Buffer) => {
    clearTimeout(timer);
    const reasonText = reason?.toString() || "";
    logDiagnostic("close", { code, reason: reasonText });
    if (code === 4404) {
      onFatal("Essa conta não está ao vivo agora. Abra a live e tente de novo, ou jogue o demo.");
      return;
    }
    if (code === 4401 || code === 4403) {
      onFatal("A chave da Euler Stream não tem permissão para conectar. Verifique EULER_API_KEY.");
      return;
    }
    if (code === 4429) {
      onFatal("Limite de conexões simultâneas da Euler Stream atingido. Tente novamente em alguns segundos.");
      return;
    }
    if (code === 4005) {
      onEvent({ type: "status", connected: false, uniqueId, message: "A live encerrou." });
      return;
    }
    if (!connected) {
      onFatal(reasonText || `Conexão encerrada (código ${code}).`);
    } else {
      const detail = reasonText ? ` (${reasonText})` : ` (código ${code})`;
      logDiagnostic("unexpected-close", { code, reason: reasonText, uniqueId });
      onEvent({ type: "status", connected: false, uniqueId, message: `Conexão encerrada${detail}.` });
    }
  });

  return {
    disconnect: () => {
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
    },
  };
}
