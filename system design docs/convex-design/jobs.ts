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

    const jobsQuery = ctx.db
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

    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Check if daily reset needed
    const resetTime = user.dailyIdentifiesResetAt;
    const dailyUsed = now - resetTime > dayInMs ? 0 : user.dailyIdentifiesUsed;

    // Check if still in first day (unlimited)
    const isFirstDay = now - user.signupDate < dayInMs && !user.firstDayFreeUsed;

    // Check referral bonus (temporary Pro)
    const hasReferralBonus = user.proExpiresAt && user.proExpiresAt > now;

    // Determine effective tier
    const effectivelyPro = user.tier === "pro" || hasReferralBonus;

    // Calculate limits
    let dailyLimit: number;
    if (effectivelyPro) {
      dailyLimit = Infinity;
    } else if (isFirstDay) {
      dailyLimit = Infinity;
    } else {
      dailyLimit = 3;
    }

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

// Get trending songs (public data)
export const getTrending = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const trending = await ctx.db
      .query("trending")
      .withIndex("by_weekly_recognitions")
      .order("desc")
      .take(limit);

    return trending;
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new job from share intent or paste URL
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

    const now = Date.now();

    if (!user) {
      // Create user on first job
      const referralCode = generateReferralCode();
      const userId = await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email,
        tier: "free",
        dailyIdentifiesUsed: 0,
        dailyIdentifiesResetAt: now,
        firstDayFreeUsed: false,
        signupDate: now,
        referralCode,
        createdAt: now,
      });
      user = await ctx.db.get(userId);
    }

    // Normalize URL for duplicate detection
    const normalizedUrl = normalizeUrl(args.sourceUrl);

    // Check SYSTEM-WIDE duplicate
    const existingJob = await ctx.db
      .query("jobs")
      .withIndex("by_source_url", (q) => q.eq("normalizedSourceUrl", normalizedUrl))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .first();

    if (existingJob) {
      // Return cached result - create a new job record that references the cache
      const cachedSongs = await ctx.db
        .query("songs")
        .withIndex("by_job", (q) => q.eq("jobId", existingJob._id))
        .collect();

      if (cachedSongs.length > 0) {
        // Create job record that references cache (for user's history)
        const jobId = await ctx.db.insert("jobs", {
          userId: user!._id,
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

        // Copy songs to new job (for user's history)
        for (const song of cachedSongs) {
          await ctx.db.insert("songs", {
            jobId,
            userId: user!._id,
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

          // Update trending counts
          if (song.isrc) {
            await updateTrending(ctx, song, normalizedUrl);
          }
        }

        return { jobId, cached: true };
      }
    }

    // Check daily limits for free users
    const dayInMs = 24 * 60 * 60 * 1000;

    // Reset daily counter if needed
    if (now - user!.dailyIdentifiesResetAt > dayInMs) {
      await ctx.db.patch(user!._id, {
        dailyIdentifiesUsed: 0,
        dailyIdentifiesResetAt: now,
        firstDayFreeUsed: true, // First day is over
      });
      user = await ctx.db.get(user!._id);
    }

    // Determine effective tier (including referral bonus)
    const hasReferralBonus = user!.proExpiresAt && user!.proExpiresAt > now;
    const isFirstDay = now - user!.signupDate < dayInMs && !user!.firstDayFreeUsed;
    const effectivelyPro = user!.tier === "pro" || hasReferralBonus;

    // Check limit (skip for Pro, referral bonus, or first day)
    if (!effectivelyPro && !isFirstDay) {
      const dailyLimit = 3;
      if (user!.dailyIdentifiesUsed >= dailyLimit) {
        throw new Error("Daily limit reached. Upgrade to Pro for unlimited.");
      }
    }

    // Detect platform from URL
    const platform = detectPlatform(args.sourceUrl);

    // Create the job
    const jobId = await ctx.db.insert("jobs", {
      userId: user!._id,
      sourceUrl: args.sourceUrl,
      normalizedSourceUrl: normalizedUrl,
      platform,
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

    // Increment daily usage (only for non-Pro users)
    if (!effectivelyPro && !isFirstDay) {
      await ctx.db.patch(user!._id, {
        dailyIdentifiesUsed: user!.dailyIdentifiesUsed + 1,
      });
    }

    // Kick off the processing pipeline
    await ctx.scheduler.runAfter(0, internal.pipeline.processJob, { jobId });

    return { jobId, cached: false };
  },
});

// Purchase priority processing for a specific job
export const purchasePriority = mutation({
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

    // Only allow for queued jobs
    if (job.status !== "queued") {
      throw new Error("Job is already processing");
    }

    // Record the purchase
    await ctx.db.insert("priorityPurchases", {
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

// Apply referral code during signup
export const applyReferralCode = mutation({
  args: {
    referralCode: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Check if user already used a referral
    if (user.referredBy) {
      throw new Error("Referral already applied");
    }

    // Find referrer by code
    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", args.referralCode))
      .unique();

    if (!referrer) {
      throw new Error("Invalid referral code");
    }

    // Can't refer yourself
    if (referrer._id === user._id) {
      throw new Error("Cannot use your own referral code");
    }

    const now = Date.now();
    const fiveDays = 5 * 24 * 60 * 60 * 1000;

    // Grant 5 days Pro to both users
    await ctx.db.patch(user._id, {
      referredBy: referrer._id,
      proExpiresAt: now + fiveDays,
    });

    await ctx.db.patch(referrer._id, {
      proExpiresAt: Math.max(referrer.proExpiresAt ?? 0, now) + fiveDays,
    });

    // Record referral
    await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      refereeId: user._id,
      referralCode: args.referralCode,
      bonusGranted: true,
      createdAt: now,
    });

    return { success: true };
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

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove tracking parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "igshid",
      "fbclid",
      "si",
    ];
    trackingParams.forEach((p) => parsed.searchParams.delete(p));

    // Normalize Instagram URLs
    if (parsed.hostname.includes("instagram.com")) {
      const match = parsed.pathname.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
      if (match) {
        return `https://instagram.com/${match[1]}/${match[2]}/`;
      }
    }

    // Normalize TikTok URLs
    if (parsed.hostname.includes("tiktok.com")) {
      const match = parsed.pathname.match(/\/@[^\/]+\/video\/(\d+)/);
      if (match) {
        return `https://tiktok.com/video/${match[1]}`;
      }
      // Handle vm.tiktok.com short URLs
      const shortMatch = parsed.pathname.match(/\/([A-Za-z0-9]+)/);
      if (shortMatch && parsed.hostname === "vm.tiktok.com") {
        return `https://vm.tiktok.com/${shortMatch[1]}`;
      }
    }

    // Normalize YouTube Shorts
    if (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be")
    ) {
      const shortMatch = parsed.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
      if (shortMatch) {
        return `https://youtube.com/shorts/${shortMatch[1]}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function updateTrending(ctx: any, song: any, reelUrl: string) {
  const existing = await ctx.db
    .query("trending")
    .withIndex("by_isrc", (q: any) => q.eq("isrc", song.isrc))
    .unique();

  const now = Date.now();

  if (existing) {
    const sampleReels = existing.sampleReelUrls.includes(reelUrl)
      ? existing.sampleReelUrls
      : [...existing.sampleReelUrls, reelUrl].slice(-5);

    await ctx.db.patch(existing._id, {
      totalRecognitions: existing.totalRecognitions + 1,
      uniqueReels: sampleReels.length === existing.sampleReelUrls.length
        ? existing.uniqueReels
        : existing.uniqueReels + 1,
      sampleReelUrls: sampleReels,
      lastRecognizedAt: now,
      recognitionsThisWeek: existing.recognitionsThisWeek + 1,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("trending", {
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      artworkUrl: song.artworkUrl,
      spotifyUrl: song.spotifyUrl,
      appleMusicUrl: song.appleMusicUrl,
      totalRecognitions: 1,
      uniqueReels: 1,
      sampleReelUrls: [reelUrl],
      lastRecognizedAt: now,
      recognitionsThisWeek: 1,
      recognitionsLastWeek: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
}
