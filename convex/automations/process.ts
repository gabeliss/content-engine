/**
 * Automation run processing
 * Handles the cron job that processes due automation runs
 */

import { internalAction, internalMutation, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { getNextPostingTime } from "./schedule";

const MAX_RUNS_PER_BATCH = 10;

interface AutomationRun {
  _id: Id<"automationRuns">;
  automationId: Id<"automations">;
  status: string;
}

/**
 * Process all due automation runs
 * Called by cron every 15 minutes
 */
export const processDueRuns = internalAction({
  handler: async (ctx): Promise<{ processed: number; succeeded: number; failed: number }> => {
    const now = Date.now();

    // Get all pending runs that are due
    const dueRuns: AutomationRun[] = await ctx.runQuery(internal.automations.internal.getDueRuns, {
      beforeTimestamp: now,
    });

    if (dueRuns.length === 0) {
      console.log("No due automation runs to process");
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    console.log(`Processing ${dueRuns.length} due automation runs`);

    // Process up to MAX_RUNS_PER_BATCH runs
    const runsToProcess: AutomationRun[] = dueRuns.slice(0, MAX_RUNS_PER_BATCH);

    let succeeded = 0;
    let failed = 0;

    // Process runs sequentially to avoid overwhelming the AI API
    for (const run of runsToProcess) {
      try {
        const result = await processRun(ctx, run._id, run.automationId);

        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Error processing run ${run._id}:`, error);
        failed++;

        // Mark run as failed
        await ctx.runMutation(internal.automations.internal.failRun, {
          runId: run._id,
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          errorStep: "processing",
        });
      }

      // Schedule the next run for this automation
      try {
        await scheduleNextRunForAutomation(ctx, run.automationId);
      } catch (error) {
        console.error(`Error scheduling next run for automation ${run.automationId}:`, error);
      }
    }

    console.log(`Processed ${runsToProcess.length} runs: ${succeeded} succeeded, ${failed} failed`);

    return {
      processed: runsToProcess.length,
      succeeded,
      failed,
    };
  },
});

/**
 * Process a single automation run
 */
async function processRun(
  ctx: ActionCtx,
  runId: Id<"automationRuns">,
  automationId: Id<"automations">
): Promise<{ success: boolean; error?: string }> {
  // Execute the generation
  const result = await ctx.runAction(internal.automations.generate.generateForAutomation, {
    automationId,
    runId,
  });

  if (!result.success) {
    // Mark run as failed
    await ctx.runMutation(internal.automations.internal.failRun, {
      runId,
      errorMessage: result.error || "Unknown error",
      errorStep: result.errorStep || "unknown",
    });

    return { success: false, error: result.error };
  }

  return { success: true };
}

/**
 * Schedule the next run for an automation
 */
async function scheduleNextRunForAutomation(
  ctx: ActionCtx,
  automationId: Id<"automations">
): Promise<void> {
  // Get the automation
  const automation = await ctx.runQuery(internal.automations.internal.getAutomation, {
    id: automationId,
  });

  if (!automation || !automation.isActive) {
    return; // Don't schedule if automation is not active
  }

  // Calculate next run time
  const nextRunAt = getNextPostingTime(automation.scheduleConfig, Date.now());

  // Schedule the next run
  await ctx.runMutation(internal.automations.internal.scheduleNextRun, {
    automationId,
    nextRunAt,
  });
}

/**
 * Manually trigger an automation run (for testing/debugging)
 */
export const triggerRun = internalAction({
  args: {
    automationId: v.id("automations"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; contentId?: Id<"content">; topic?: string; caption?: string }> => {
    // Get the automation
    const automation = await ctx.runQuery(internal.automations.internal.getAutomation, {
      id: args.automationId,
    });

    if (!automation) {
      return { success: false, error: "Automation not found" };
    }

    // Create a run entry
    const runId: Id<"automationRuns"> = await ctx.runMutation(internal.automations.process.createManualRun, {
      automationId: args.automationId,
      userId: automation.userId,
    });

    // Process the run
    const result = await ctx.runAction(internal.automations.generate.generateForAutomation, {
      automationId: args.automationId,
      runId,
    });

    return result;
  },
});

/**
 * Create a manual run entry (for testing)
 */
export const createManualRun = internalMutation({
  args: {
    automationId: v.id("automations"),
    userId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"automationRuns">> => {
    const runId = await ctx.db.insert("automationRuns", {
      automationId: args.automationId,
      userId: args.userId,
      status: "pending",
      scheduledFor: Date.now(),
      createdAt: Date.now(),
    });

    return runId;
  },
});
