import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all products for current user
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    return await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

// Get active products only for current user
export const listActive = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const products = await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    return products.filter((p) => p.isActive).sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get a single product by ID
export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== identity.subject) {
      return null;
    }
    return product;
  },
});

// Create a new product
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const now = Date.now();
    const productId = await ctx.db.insert("products", {
      userId: identity.subject,
      name: args.name,
      description: args.description,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return productId;
  },
});

// Update a product
export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== identity.subject) {
      throw new Error("Product not found");
    }

    const { id, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }

    cleanUpdates.updatedAt = Date.now();

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

// Archive a product (soft delete)
export const archive = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== identity.subject) {
      throw new Error("Product not found");
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

// Hard delete a product
export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== identity.subject) {
      throw new Error("Product not found");
    }

    await ctx.db.delete(args.id);
  },
});
