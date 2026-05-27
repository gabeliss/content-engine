import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const insert = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    keyPrefix: v.string(),
    keyHash: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("mcpApiKeys", {
      userId: args.userId,
      name: args.name,
      keyPrefix: args.keyPrefix,
      keyHash: args.keyHash,
      scopes: args.scopes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const resolve = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("mcpApiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!key || key.revokedAt) return null;

    return {
      keyId: key._id,
      userId: key.userId,
      scopes: key.scopes,
      keyPrefix: key.keyPrefix,
    };
  },
});

export const recordUse = internalMutation({
  args: { keyId: v.id("mcpApiKeys") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.keyId, {
      lastUsedAt: now,
      updatedAt: now,
    });
  },
});
