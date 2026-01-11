import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ScheduledPost } from "../types";

export function useScheduledPosts() {
  // Queries
  const allPosts = useQuery(api.scheduledPosts.list) as ScheduledPost[] | undefined;
  const failedPosts = useQuery(api.scheduledPosts.listByStatus, {
    status: "failed",
  }) as ScheduledPost[] | undefined;

  // Mutations
  const updatePost = useMutation(api.scheduledPosts.update);
  const reschedulePost = useMutation(api.scheduledPosts.reschedule);
  const deletePost = useMutation(api.scheduledPosts.remove);

  // Actions
  const postNowAction = useAction(api.scheduledPosts.postNow);

  // Group posts by date for display
  const postsByDate = allPosts?.reduce(
    (acc, post) => {
      const dateKey = new Date(post.scheduledFor).toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(post);
      // Sort by time within each date
      acc[dateKey].sort((a, b) => a.scheduledFor - b.scheduledFor);
      return acc;
    },
    {} as Record<string, ScheduledPost[]>
  );

  // Get dates with posts (for calendar indicators)
  const datesWithPosts = new Set(
    allPosts?.map((p) => new Date(p.scheduledFor).toDateString())
  );

  // Filter to only scheduled posts (upcoming)
  const scheduledPosts = allPosts?.filter((p) => p.status === "scheduled");

  // Filter to posted posts (history)
  const postedPosts = allPosts?.filter((p) => p.status === "posted");

  return {
    allPosts,
    scheduledPosts,
    postedPosts,
    failedPosts,
    postsByDate,
    datesWithPosts,
    updatePost,
    reschedulePost,
    deletePost,
    postNowAction,
    isLoading: allPosts === undefined,
  };
}
