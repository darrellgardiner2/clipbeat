import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// QUERIES
// ============================================

// Get current user's jobs with pagination
export const listMyJobs = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const limit = args.limit ?? 20;

    let jobsQuery = ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");

    const jobs = await jobsQuery.take(limit);

    // Fetch songs for completed jobs
    const jobsWithSongs = await Promise.all(
      jobs.map(async (job) => {
        if (job.status === "completed") {
          const songs = await ctx.db
            .query("songs")
            .withIndex("by_job", (q) => q.eq("jobId", job._id))
            .collect();
          return { ...job, songs };
        }
        return { ...job, songs: [] };
      })
    );

    return jobsWithSongs;
  },
});

// Get single job with songs (real-time updates)
export const getJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) return null;

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || job.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const songs = await ctx.db
      .query("songs")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();

    return { ...job, songs };
  },
});

// Get user stats (for UI)
export const getMyStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Check if daily reset needed
    const now = Date.now();
    const resetTime = user.dailyIdentifiesResetAt;
    const dayInMs = 24 * 60 * 60 * 1000;

    const dailyUsed =
      now - resetTime > dayInMs ? 0 : user.dailyIdentifiesUsed;

    const dailyLimit = user.tier === "pro" ? Infinity : 3;

    return {
      tier: user.tier,
      dailyUsed,
      dailyLimit,
      remainingToday: Math.max(0, dailyLimit - dailyUsed),
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new job from share intent
export const createJob = mutation({
  args: {
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or create user
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      // Create user on first job
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email,
        tier: "free",
        dailyIdentifiesUsed: 0,
        dailyIdentifiesResetAt: Date.now(),
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }

    // Check daily limits for free users
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Reset daily counter if needed
    if (now - user!.dailyIdentifiesResetAt > dayInMs) {
      await ctx.db.patch(user!._id, {
        dailyIdentifiesUsed: 0,
        dailyIdentifiesResetAt: now,
      });
      user = await ctx.db.get(user!._id);
    }

    // Check limit
    const dailyLimit = user!.tier === "pro" ? Infinity : 3;
    if (user!.dailyIdentifiesUsed >= dailyLimit) {
      throw new Error("Daily limit reached. Upgrade to Pro for unlimited.");
    }

    // Detect platform from URL
    const platform = detectPlatform(args.sourceUrl);

    // Create the job
    const jobId = await ctx.db.insert("jobs", {
      userId: user!._id,
      sourceUrl: args.sourceUrl,
      platform,
      status: "queued",
      priority: user!.tier === "pro" ? "high" : "normal",
      createdAt: now,
      retryCount: 0,
    });

    // Increment daily usage
    await ctx.db.patch(user!._id, {
      dailyIdentifiesUsed: user!.dailyIdentifiesUsed + 1,
    });

    // Kick off the processing pipeline
    await ctx.scheduler.runAfter(0, internal.pipeline.processJob, { jobId });

    return jobId;
  },
});

// Skip queue for a specific job (paid feature)
export const skipQueue = mutation({
  args: {
    jobId: v.id("jobs"),
    paymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || job.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // Only allow skipping queued jobs
    if (job.status !== "queued") {
      throw new Error("Job is already processing");
    }

    // Record the purchase
    await ctx.db.insert("queueSkips", {
      userId: user._id,
      jobId: args.jobId,
      purchasedAt: Date.now(),
      paymentId: args.paymentId,
    });

    // Upgrade job priority
    await ctx.db.patch(args.jobId, {
      priority: "high",
    });

    return { success: true };
  },
});

// Update push token
export const updatePushToken = mutation({
  args: {
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      pushToken: args.pushToken,
    });
  },
});

// ============================================
// HELPERS
// ============================================

function detectPlatform(
  url: string
): "instagram" | "tiktok" | "youtube" | "unknown" {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("instagr.am")) {
    return "instagram";
  }
  if (lower.includes("tiktok.com") || lower.includes("vm.tiktok")) {
    return "tiktok";
  }
  if (
    lower.includes("youtube.com") ||
    lower.includes("youtu.be") ||
    lower.includes("shorts")
  ) {
    return "youtube";
  }
  return "unknown";
}
