/**
 * Internal functions for automation processing
 * These are only callable from other Convex functions, not from the client
 */

import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// Get automation by ID (internal, no auth check)
export const getAutomation = internalQuery({
  args: { id: v.id("automations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get pending runs that are due
export const getDueRuns = internalQuery({
  args: { beforeTimestamp: v.number() },
  handler: async (ctx, args) => {
    // Get all pending runs where scheduledFor <= beforeTimestamp
    const runs = await ctx.db
      .query("automationRuns")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return runs.filter((run) => run.scheduledFor <= args.beforeTimestamp);
  },
});

// Update run status
export const updateRunStatus = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("scheduling"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    errorStep: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.startedAt !== undefined) {
      updates.startedAt = args.startedAt;
    }

    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }

    if (args.errorStep !== undefined) {
      updates.errorStep = args.errorStep;
    }

    await ctx.db.patch(args.runId, updates);
  },
});

// Update run with generated topic
export const updateRunTopic = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    topic: v.string(),
    caption: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      generatedTopic: args.topic,
      generatedCaption: args.caption,
    });
  },
});

// Complete a run successfully
export const completeRun = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    contentId: v.id("content"),
    scheduledPostId: v.optional(v.id("scheduledPosts")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "completed",
      contentId: args.contentId,
      scheduledPostId: args.scheduledPostId,
      completedAt: Date.now(),
    });
  },
});

// Fail a run
export const failRun = internalMutation({
  args: {
    runId: v.id("automationRuns"),
    errorMessage: v.string(),
    errorStep: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: "failed",
      errorMessage: args.errorMessage,
      errorStep: args.errorStep,
      completedAt: Date.now(),
    });
  },
});

// Schedule next run for an automation
export const scheduleNextRun = internalMutation({
  args: {
    automationId: v.id("automations"),
    nextRunAt: v.number(),
  },
  handler: async (ctx, args) => {
    const automation = await ctx.db.get(args.automationId);
    if (!automation || !automation.isActive) {
      return; // Don't schedule if automation is not active
    }

    // Update automation's nextRunAt
    await ctx.db.patch(args.automationId, {
      nextRunAt: args.nextRunAt,
      lastRunAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create the next pending run
    await ctx.db.insert("automationRuns", {
      automationId: args.automationId,
      userId: automation.userId,
      status: "pending",
      scheduledFor: args.nextRunAt,
      createdAt: Date.now(),
    });
  },
});

// Get automation run by ID
export const getRun = internalQuery({
  args: { id: v.id("automationRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
