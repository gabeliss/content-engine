import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireBetaAccess } from "../auth/users";
import { requireWorkspaceMember } from "../workspaces/workspaces";

function currentUserId(identity: { subject: string } | null) {
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

async function assertVideoProjectAccess(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"videoProjects">,
  userId: string
) {
  if (project.workspaceId) {
    await requireWorkspaceMember(ctx, project.workspaceId, userId);
    return;
  }
  if (project.userId !== userId) throw new Error("Video project not found");
}

export const list = query({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const userId = currentUserId(await requireBetaAccess(ctx));

    if (args.workspaceId) {
      await requireWorkspaceMember(ctx, args.workspaceId, userId);
      return await ctx.db
        .query("videoProjects")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "draft")
        )
        .order("desc")
        .collect();
    }

    return (await ctx.db
      .query("videoProjects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect()).filter((project) => project.status === "draft");
  },
});

export const get = query({
  args: { id: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const userId = currentUserId(await requireBetaAccess(ctx));
    const project = await ctx.db.get(args.id);
    if (!project || project.status === "archived") return null;
    await assertVideoProjectAccess(ctx, project, userId);
    return project;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    title: v.string(),
    draft: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = currentUserId(await requireBetaAccess(ctx));
    if (args.workspaceId) {
      await requireWorkspaceMember(ctx, args.workspaceId, userId);
    }
    const now = Date.now();
    return await ctx.db.insert("videoProjects", {
      userId,
      workspaceId: args.workspaceId,
      title: args.title.trim() || "Untitled video",
      status: "draft",
      draft: args.draft,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("videoProjects"),
    title: v.optional(v.string()),
    draft: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = currentUserId(await requireBetaAccess(ctx));
    const project = await ctx.db.get(args.id);
    if (!project || project.status === "archived") {
      throw new Error("Video project not found");
    }
    await assertVideoProjectAccess(ctx, project, userId);

    const patch: Partial<Doc<"videoProjects">> = {
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) patch.title = args.title.trim() || "Untitled video";
    if (args.draft !== undefined) patch.draft = args.draft;
    await ctx.db.patch(args.id, patch);
  },
});

export const touch = mutation({
  args: { id: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const userId = currentUserId(await requireBetaAccess(ctx));
    const project = await ctx.db.get(args.id);
    if (!project || project.status === "archived") {
      throw new Error("Video project not found");
    }
    await assertVideoProjectAccess(ctx, project, userId);
    await ctx.db.patch(args.id, { lastOpenedAt: Date.now() });
  },
});

export const archive = mutation({
  args: { id: v.id("videoProjects") },
  handler: async (ctx, args) => {
    const userId = currentUserId(await requireBetaAccess(ctx));
    const project = await ctx.db.get(args.id);
    if (!project || project.status === "archived") {
      throw new Error("Video project not found");
    }
    await assertVideoProjectAccess(ctx, project, userId);
    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});
