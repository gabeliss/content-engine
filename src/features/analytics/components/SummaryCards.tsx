import { Eye, Heart, MessageCircle, Share2, TrendingUp } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { AnalyticsStats } from "../types";

interface SummaryCardsProps {
  stats: AnalyticsStats;
}

export function SummaryCards({ stats }: SummaryCardsProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "1rem",
      }}
    >
      <MetricCard
        icon={Eye}
        label="Total Views"
        value={stats.totalViews}
        color="#3b82f6"
        bgColor="#eff6ff"
      />
      <MetricCard
        icon={Heart}
        label="Total Likes"
        value={stats.totalLikes}
        color="#ef4444"
        bgColor="#fef2f2"
      />
      <MetricCard
        icon={MessageCircle}
        label="Comments"
        value={stats.totalComments}
        color="#8b5cf6"
        bgColor="#f5f3ff"
      />
      <MetricCard
        icon={Share2}
        label="Shares"
        value={stats.totalShares}
        color="#10b981"
        bgColor="#ecfdf5"
      />
      <MetricCard
        icon={TrendingUp}
        label="Engagement Rate"
        value={`${stats.engagementRate.toFixed(2)}%`}
        color="#f59e0b"
        bgColor="#fffbeb"
      />
    </div>
  );
}
