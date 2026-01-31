// @ts-nocheck - Run `npx convex dev` to generate proper types
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

function detectPlatform(
  url: string
): "instagram" | "tiktok" | "youtube" | "unknown" {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am"))
    return "instagram";
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok"))
    return "tiktok";
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("shorts")
  )
    return "youtube";
  return "unknown";
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    ["utm_source", "utm_medium", "utm_campaign", "igshid", "fbclid", "si"].forEach(
      (p) => parsed.searchParams.delete(p)
    );
    if (parsed.hostname.includes("instagram.com")) {
      const match = parsed.pathname.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
      if (match) return `https://instagram.com/${match[1]}/${match[2]}/`;
    }
    if (parsed.hostname.includes("tiktok.com")) {
      const match = parsed.pathname.match(/\/@[^/]+\/video\/(\d+)/);
      if (match) return `https://tiktok.com/video/${match[1]}`;
    }
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      const match = parsed.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      if (match) return `https://youtube.com/shorts/${match[1]}`;
    }
    return url;
  } catch {
    return url;
  }
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

export const listMyJobs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit ?? 20);

    return Promise.all(
      jobs.map(async (job) => {
        const songs =
          job.status === "completed"
            ? await ctx.db
                .query("songs")
                .withIndex("by_job", (q) => q.eq("jobId", job._id))
                .collect()
            : [];
        return { ...job, songs };
      })
    );
  },
});

export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || job.userId !== user._id) return null;

    const songs = await ctx.db
      .query("songs")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    return { ...job, songs };
  },
});

export const getMyStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const dailyUsed =
      now - user.dailyIdentifiesResetAt > dayMs
        ? 0
        : user.dailyIdentifiesUsed;
    const isFirstDay =
      now - user.signupDate < dayMs && !user.firstDayFreeUsed;
    const hasReferralBonus =
      user.proExpiresAt !== undefined && user.proExpiresAt > now;
    const effectivelyPro =
      user.tier === "pro" || hasReferralBonus;
    const dailyLimit = effectivelyPro || isFirstDay ? Infinity : 3;

    return {
      tier: user.tier,
      effectivelyPro,
      isFirstDay,
      hasReferralBonus,
      proExpiresAt: user.proExpiresAt,
      dailyUsed,
      dailyLimit,
      remainingToday: Math.max(0, dailyLimit - dailyUsed),
      referralCode: user.referralCode,
    };
  },
});

export const getTrending = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("trending")
      .withIndex("by_weekly_recognitions")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const createJob = mutation({
  args: { sourceUrl: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const now = Date.now();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email,
        tier: "free",
        dailyIdentifiesUsed: 0,
        dailyIdentifiesResetAt: now,
        firstDayFreeUsed: false,
        signupDate: now,
        referralCode: generateReferralCode(),
        createdAt: now,
      });
      user = (await ctx.db.get(userId))!;
    }

    const normalizedUrl = normalizeUrl(args.sourceUrl);

    const existingJob = await ctx.db
      .query("jobs")
      .withIndex("by_source_url", (q) =>
        q.eq("normalizedSourceUrl", normalizedUrl)
      )
      .filter((q) => q.eq(q.field("status"), "completed"))
      .first();

    if (existingJob) {
      const cachedSongs = await ctx.db
        .query("songs")
        .withIndex("by_job", (q) => q.eq("jobId", existingJob._id))
        .collect();

      if (cachedSongs.length > 0) {
        const jobId = await ctx.db.insert("jobs", {
          userId: user._id,
          sourceUrl: args.sourceUrl,
          normalizedSourceUrl: normalizedUrl,
          platform: detectPlatform(args.sourceUrl),
          status: "completed",
          priority: "normal",
          createdAt: now,
          completedAt: now,
          processingTimeMs: 0,
          cachedFromJobId: existingJob._id,
          retryCount: 0,
        });

        for (const song of cachedSongs) {
          await ctx.db.insert("songs", {
            jobId,
            userId: user._id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            releaseDate: song.releaseDate,
            durationMs: song.durationMs,
            isrc: song.isrc,
            spotifyUrl: song.spotifyUrl,
            appleMusicUrl: song.appleMusicUrl,
            youtubeUrl: song.youtubeUrl,
            artworkUrl: song.artworkUrl,
            confidence: song.confidence,
            matchedAtSeconds: song.matchedAtSeconds,
            recognitionService: song.recognitionService,
            createdAt: now,
          });
        }

        return { jobId, cached: true };
      }
    }

    const dayMs = 24 * 60 * 60 * 1000;
    if (now - user.dailyIdentifiesResetAt > dayMs) {
      await ctx.db.patch(user._id, {
        dailyIdentifiesUsed: 0,
        dailyIdentifiesResetAt: now,
        firstDayFreeUsed: true,
      });
      user = (await ctx.db.get(user._id))!;
    }

    const hasReferralBonus =
      user.proExpiresAt !== undefined && user.proExpiresAt > now;
    const isFirstDay =
      now - user.signupDate < dayMs && !user.firstDayFreeUsed;
    const effectivelyPro = user.tier === "pro" || hasReferralBonus;

    if (!effectivelyPro && !isFirstDay) {
      if (user.dailyIdentifiesUsed >= 3) {
        throw new Error("Daily limit reached. Upgrade to Pro for unlimited.");
      }
    }

    const jobId = await ctx.db.insert("jobs", {
      userId: user._id,
      sourceUrl: args.sourceUrl,
      normalizedSourceUrl: normalizedUrl,
      platform: detectPlatform(args.sourceUrl),
      status: "queued",
      priority: effectivelyPro ? "high" : "normal",
      createdAt: now,
      retryCount: 0,
      recognitionAttempts: {
        original: false,
        stripped: false,
        segments: false,
        acrcloud: false,
      },
    });

    if (!effectivelyPro && !isFirstDay) {
      await ctx.db.patch(user._id, {
        dailyIdentifiesUsed: user.dailyIdentifiesUsed + 1,
      });
    }

    await ctx.scheduler.runAfter(0, internal.pipeline.processJob, { jobId });

    return { jobId, cached: false };
  },
});

export const updatePushToken = mutation({
  args: { pushToken: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, { pushToken: args.pushToken });
  },
});
