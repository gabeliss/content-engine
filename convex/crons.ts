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

export default crons;
