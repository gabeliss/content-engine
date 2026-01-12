import { Id } from "../../../convex/_generated/dataModel";

export interface PostedContentAccount {
  _id: Id<"accounts">;
  platform: "tiktok" | "instagram" | "twitter";
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface PostedContentMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface PostedContent {
  _id: Id<"postedContent">;
  userId: string;
  accountId: Id<"accounts">;
  contentId?: Id<"content">;
  scheduledPostId?: Id<"scheduledPosts">;
  videoId: string;
  publishId?: string;
  source: "content_engine" | "synced";
  title?: string;
  description?: string;
  coverImageUrl?: string;
  embedLink?: string;
  shareUrl?: string;
  duration?: number;
  metrics: PostedContentMetrics;
  postedAt: number;
  metricsLastUpdated?: number;
  createdAt: number;
  updatedAt: number;
  account: PostedContentAccount | null;
}

export interface AnalyticsStats {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
  metricsLastUpdated: number | null;
}

export interface AccountStats {
  account: PostedContentAccount | null;
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

export type DateRange = "7d" | "30d" | "90d" | "all";
