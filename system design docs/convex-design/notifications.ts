import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// PUSH NOTIFICATIONS
// ============================================

export const sendJobComplete = internalAction({
  args: {
    jobId: v.id("jobs"),
    songTitle: v.string(),
    songArtist: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job) return;

    const user = await ctx.runQuery(internal.notifications.getUserInternal, {
      userId: job.userId,
    });

    if (!user?.pushToken) return;

    // Using Expo Push Notifications
    await sendExpoPushNotification(user.pushToken, {
      title: "Song Found! 🎵",
      body: `${args.songTitle} by ${args.songArtist}`,
      data: {
        jobId: args.jobId,
        type: "job_complete",
      },
    });
  },
});

export const sendJobFailed = internalAction({
  args: {
    jobId: v.id("jobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job) return;

    const user = await ctx.runQuery(internal.notifications.getUserInternal, {
      userId: job.userId,
    });

    if (!user?.pushToken) return;

    await sendExpoPushNotification(user.pushToken, {
      title: "Song Detection Failed",
      body: "We couldn't identify the song. Tap to try again.",
      data: {
        jobId: args.jobId,
        type: "job_failed",
      },
    });
  },
});

export const getUserInternal = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // This would need to be an internalQuery in real implementation
    // Simplified for example
    return null;
  },
});

// ============================================
// EXPO PUSH NOTIFICATION HELPER
// ============================================

interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: "default" | null;
  badge?: number;
}

async function sendExpoPushNotification(
  pushToken: string,
  payload: PushNotificationPayload
): Promise<void> {
  const message = {
    to: pushToken,
    sound: payload.sound ?? "default",
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,
  };

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  const result = await response.json();

  if (result.data?.status === "error") {
    console.error("Push notification failed:", result.data.message);

    // Handle invalid tokens
    if (
      result.data.details?.error === "DeviceNotRegistered" ||
      result.data.details?.error === "InvalidCredentials"
    ) {
      // TODO: Remove invalid push token from user record
      console.warn("Invalid push token, should be removed:", pushToken);
    }
  }
}
