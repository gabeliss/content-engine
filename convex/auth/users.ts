import type { UserIdentity } from "convex/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type AuthCtx = {
  auth: {
    getUserIdentity: () => Promise<UserIdentity | null>;
  };
};

type UserProfilePatch = {
  clerkUserId: string;
  subject: string;
  tokenIdentifier: string;
  issuer: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
};

export async function requireCurrentIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity;
}

export async function requireCurrentUserId(ctx: AuthCtx) {
  const identity = await requireCurrentIdentity(ctx);
  return identity.subject;
}

function profileFromIdentity(identity: UserIdentity): UserProfilePatch {
  return {
    clerkUserId: identity.subject,
    subject: identity.subject,
    tokenIdentifier: identity.tokenIdentifier,
    issuer: identity.issuer,
    email: identity.email,
    name: identity.name,
    avatarUrl: identity.pictureUrl,
  };
}

async function getUserBySubject(ctx: QueryCtx | MutationCtx, subject: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_subject", (q) => q.eq("subject", subject))
    .unique();
}

function personalWorkspaceName(identity: UserIdentity) {
  const name = identity.name?.trim();
  if (name) return `${name}'s workspace`;

  return "Personal workspace";
}

async function getActiveWorkspaceMembership(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  userId: string
) {
  const membership = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace_user", (q) =>
      q.eq("workspaceId", workspaceId).eq("userId", userId)
    )
    .unique();

  return membership?.status === "active" ? membership : null;
}

async function ensurePersonalWorkspace(ctx: MutationCtx, identity: UserIdentity) {
  const userId = identity.subject;
  const existingOwnedWorkspaces = await ctx.db
    .query("workspaces")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", userId))
    .collect();
  const existingPersonalWorkspace = existingOwnedWorkspaces.find(
    (workspace) => workspace.workspaceType === "personal"
  );
  const now = Date.now();

  if (existingPersonalWorkspace) {
    const membership = await getActiveWorkspaceMembership(
      ctx,
      existingPersonalWorkspace._id,
      userId
    );
    if (!membership) {
      await ctx.db.insert("workspaceMembers", {
        workspaceId: existingPersonalWorkspace._id,
        userId,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }
    return existingPersonalWorkspace;
  }

  const workspaceId = await ctx.db.insert("workspaces", {
    name: personalWorkspaceName(identity),
    workspaceType: "personal",
    ownerUserId: userId,
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("workspaceMembers", {
    workspaceId,
    userId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) throw new Error("Failed to create personal workspace");
  return workspace;
}

export async function ensureCurrentUser(ctx: MutationCtx) {
  const identity = await requireCurrentIdentity(ctx);
  const now = Date.now();
  const profile = profileFromIdentity(identity);
  const existing = await getUserBySubject(ctx, identity.subject);

  if (!existing) {
    const docId = await ctx.db.insert("users", {
      ...profile,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
    const user = await ctx.db.get(docId);
    if (!user) throw new Error("Failed to create user");
    const personalWorkspace = await ensurePersonalWorkspace(ctx, identity);
    return { identity, userId: identity.subject, user, personalWorkspace };
  }

  const patch: Partial<Doc<"users">> = {
    ...profile,
    updatedAt: now,
    lastSeenAt: now,
  };
  await ctx.db.patch(existing._id, patch);
  const user = await ctx.db.get(existing._id);
  if (!user) throw new Error("Failed to update user");
  const personalWorkspace = await ensurePersonalWorkspace(ctx, identity);
  return { identity, userId: identity.subject, user, personalWorkspace };
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await getUserBySubject(ctx, identity.subject);
    if (!user) return null;

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", identity.subject).eq("status", "active")
      )
      .collect();
    const workspaces = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.workspaceId))
    );

    return {
      user,
      memberships,
      workspaces: workspaces.filter(
        (workspace): workspace is Doc<"workspaces"> => Boolean(workspace)
      ),
    };
  },
});

export const ensure = mutation({
  args: {},
  handler: async (ctx) => {
    const { personalWorkspace, user } = await ensureCurrentUser(ctx);
    return { user, personalWorkspace };
  },
});
