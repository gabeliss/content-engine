import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// TikTok OAuth callback endpoint
http.route({
  path: "/auth/tiktok/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Get the frontend URL from environment
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // Handle errors from TikTok
    if (error) {
      console.error("TikTok OAuth error:", error, errorDescription);
      return Response.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent(errorDescription || error)}&tab=account`
      );
    }

    if (!code || !state) {
      return Response.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent("Missing code or state")}&tab=account`
      );
    }

    // Validate the state
    const stateData = await ctx.runMutation(internal.accounts.validateOAuthState, {
      state,
    });

    if (!stateData) {
      return Response.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent("Invalid or expired state")}&tab=account`
      );
    }

    try {
      // Exchange code for access token
      const clientKey = process.env.TIKTOK_CLIENT_KEY;
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

      if (!clientKey || !clientSecret) {
        throw new Error("TikTok credentials not configured");
      }

      const tokenResponse = await fetch(
        "https://open.tiktokapis.com/v2/oauth/token/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_key: clientKey,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: `${process.env.CONVEX_SITE_URL}/auth/tiktok/callback`,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.error || !tokenData.access_token) {
        console.error("TikTok token exchange error:", tokenData);
        throw new Error(tokenData.error_description || "Failed to get access token");
      }

      // Get user info from TikTok
      const userResponse = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        }
      );

      const userData = await userResponse.json();

      if (userData.error?.code !== "ok" && userData.error) {
        console.error("TikTok user info error:", userData);
        throw new Error("Failed to get user info");
      }

      const userInfo = userData.data?.user || {};

      // Store the account
      await ctx.runMutation(internal.accounts.storeAccount, {
        userId: stateData.userId,
        platform: "tiktok",
        username: userInfo.username || userInfo.display_name || "Unknown",
        displayName: userInfo.display_name,
        avatarUrl: userInfo.avatar_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: tokenData.expires_in
          ? Date.now() + tokenData.expires_in * 1000
          : undefined,
        platformUserId: tokenData.open_id || userInfo.open_id,
        scopes: tokenData.scope ? tokenData.scope.split(",") : undefined,
      });

      // Redirect back to settings with success
      return Response.redirect(
        `${frontendUrl}/settings?success=tiktok_connected&tab=account`
      );
    } catch (err) {
      console.error("TikTok OAuth callback error:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      return Response.redirect(
        `${frontendUrl}/settings?error=${encodeURIComponent(errorMessage)}&tab=account`
      );
    }
  }),
});

export default http;
