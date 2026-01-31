// @ts-nocheck - Run `npx convex dev` to generate proper types
import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

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

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: user.pushToken,
        title: "Song Found! 🎵",
        body: `${args.songTitle} by ${args.songArtist}`,
        data: { jobId: args.jobId, url: `clipbeat://job/${args.jobId}` },
        sound: "default",
      }),
    });
  },
});

export const sendJobFailed = internalAction({
  args: { jobId: v.id("jobs"), error: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
      jobId: args.jobId,
    });
    if (!job) return;

    const user = await ctx.runQuery(internal.notifications.getUserInternal, {
      userId: job.userId,
    });
    if (!user?.pushToken) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: user.pushToken,
        title: "Couldn't identify this one 😕",
        body: "Tap to try again",
        data: { jobId: args.jobId, url: `clipbeat://job/${args.jobId}` },
        sound: "default",
      }),
    });
  },
});

export const getUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ? { pushToken: user.pushToken } : null;
  },
});
