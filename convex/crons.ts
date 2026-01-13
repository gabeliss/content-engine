import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process scheduled posts at fixed 15-minute intervals
// Runs at :00, :15, :30, :45 of every hour
crons.cron(
  "process-scheduled-posts",
  "0,15,30,45 * * * *",
  internal.scheduledPosts.processDuePosts
);

// Sync all TikTok videos hourly
// Fetches video list from TikTok and upserts into postedContent
// This pulls ALL videos from connected accounts, not just Content Engine posts
crons.cron(
  "sync-tiktok-videos",
  "0 * * * *",
  internal.tiktokAnalytics.syncAllAccounts
);

// Refresh metrics for existing videos (30 mins after sync)
// Uses video/query API to get latest counts
crons.cron(
  "refresh-analytics-metrics",
  "30 * * * *",
  internal.tiktokAnalytics.refreshAllMetrics
);

// Process automation runs at fixed 15-minute intervals
// Runs at :07, :22, :37, :52 of every hour (offset from scheduled posts)
crons.cron(
  "process-automation-runs",
  "7,22,37,52 * * * *",
  internal.automations.process.processDueRuns
);

export default crons;
