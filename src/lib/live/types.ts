export type LiveEventKind =
  | "chat"
  | "gift"
  | "like"
  | "follow"
  | "share"
  | "member"
  | "viewer"
  | "status";

export type LiveUser = {
  userId: string;
  uniqueId: string;
  nickname: string;
  avatarUrl?: string;
};

export type LiveEvent =
  | ({ type: "chat"; comment: string } & LiveUser)
  | ({
      type: "gift";
      giftName: string;
      diamondCount: number;
      repeatCount: number;
      repeatEnd: boolean;
    } & LiveUser)
  | ({ type: "like"; likeCount: number } & LiveUser)
  | ({ type: "follow" } & LiveUser)
  | ({ type: "share" } & LiveUser)
  | ({ type: "member" } & LiveUser)
  | { type: "viewer"; count: number }
  | { type: "status"; connected: boolean; uniqueId?: string; message?: string };

export type FeedKind = "chat" | "gift" | "like" | "follow" | "share" | "system" | "elim" | "win";

export type FeedItem = {
  id: number;
  kind: FeedKind;
  text: string;
  name?: string;
  t: number;
};
