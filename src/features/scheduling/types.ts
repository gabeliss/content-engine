import { Id } from "../../../convex/_generated/dataModel";

export type ScheduledPostStatus = "scheduled" | "posting" | "posted" | "failed";

export type PrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";

export type PostMode = "DIRECT_POST" | "MEDIA_UPLOAD";

export interface ScheduledPostAccount {
  _id: Id<"accounts">;
  platform: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface ScheduledPost {
  _id: Id<"scheduledPosts">;
  userId: string;
  contentId: Id<"content">;
  accountId: Id<"accounts">;
  title?: string;
  description?: string;
  privacyLevel: PrivacyLevel;
  postMode: PostMode;
  autoAddMusic: boolean;
  renderedImageUrls: string[];
  scheduledFor: number;
  timezone: string;
  status: ScheduledPostStatus;
  publishId?: string;
  errorMessage?: string;
  postedAt?: number;
  createdAt: number;
  updatedAt: number;
  account?: ScheduledPostAccount | null;
}
