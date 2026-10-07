import { ARENA_SRC, AVATAR_SRCS, CROWN_SRC } from "./constants";

export type GameImages = {
  arena: HTMLImageElement | null;
  crown: HTMLImageElement | null;
  avatars: (HTMLImageElement | null)[];
  remote: Map<string, HTMLImageElement>;
};

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

export function createImageCache(): GameImages {
  return {
    arena: null,
    crown: null,
    avatars: AVATAR_SRCS.map(() => null),
    remote: new Map(),
  };
}

export async function loadGameImages(cache: GameImages) {
  const [arena, crown, ...avatars] = await Promise.all([
    load(ARENA_SRC).catch(() => null),
    load(CROWN_SRC).catch(() => null),
    ...AVATAR_SRCS.map((src) => load(src).catch(() => null)),
  ]);
  cache.arena = arena;
  cache.crown = crown;
  cache.avatars = avatars;
}

export function loadRemoteAvatar(cache: GameImages, url: string): HTMLImageElement | null {
  const hit = cache.remote.get(url);
  if (hit) return hit.complete && hit.naturalWidth > 0 ? hit : null;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.onload = () => {};
  img.onerror = () => {
    cache.remote.delete(url);
  };
  img.src = url;
  cache.remote.set(url, img);
  return null;
}
