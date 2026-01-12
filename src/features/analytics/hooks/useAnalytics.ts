import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { DateRange } from "../types";

export function useAnalytics(options?: {
  accountId?: Id<"accounts">;
  dateRange?: DateRange;
}) {
  const stats = useQuery(api.analytics.getStats, {
    accountId: options?.accountId,
    dateRange: options?.dateRange,
  });

  const accountStats = useQuery(api.analytics.getAccountStats);

  const postedContentResult = useQuery(api.analytics.listPostedContent, {
    accountId: options?.accountId,
    limit: 50,
  });

  const refreshMetrics = useAction(api.tiktokAnalytics.refreshAllUserMetrics);

  return {
    stats,
    accountStats,
    postedContent: postedContentResult?.posts ?? [],
    nextCursor: postedContentResult?.nextCursor,
    refreshMetrics,
    isLoading: stats === undefined || postedContentResult === undefined,
  };
}
