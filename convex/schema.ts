import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    tier: v.union(v.literal("free"), v.literal("pro")),
    dailyIdentifiesUsed: v.number(),
    dailyIdentifiesResetAt: v.number(),
    firstDayFreeUsed: v.boolean(),
    signupDate: v.number(),
    proExpiresAt: v.optional(v.number()),
    pushToken: v.optional(v.string()),
    referralCode: v.string(),
    referredBy: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_referral_code", ["referralCode"]),

  jobs: defineTable({
    userId: v.id("users"),
    sourceUrl: v.string(),
    normalizedSourceUrl: v.string(),
    platform: v.union(
      v.literal("instagram"),
      v.literal("tiktok"),
      v.literal("youtube"),
      v.literal("unknown")
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("downloading"),
      v.literal("extracting_audio"),
      v.literal("recognizing_original"),
      v.literal("removing_vocals"),
      v.literal("recognizing_stripped"),
      v.literal("segment_analysis"),
      v.literal("completed"),
      v.literal("failed")
    ),
    recognitionAttempts: v.optional(
      v.object({
        original: v.boolean(),
        stripped: v.boolean(),
        segments: v.boolean(),
        acrcloud: v.boolean(),
      })
    ),
    priority: v.union(v.literal("normal"), v.literal("high")),
    videoFileId: v.optional(v.id("_storage")),
    audioFileId: v.optional(v.id("_storage")),
    strippedAudioFileId: v.optional(v.id("_storage")),
    downloadJobId: v.optional(v.string()),
    demucsJobId: v.optional(v.string()),
    cachedFromJobId: v.optional(v.id("jobs")),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    processingTimeMs: v.optional(v.number()),
    error: v.optional(v.string()),
    retryCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_status_and_priority", ["status", "priority", "createdAt"])
    .index("by_created", ["createdAt"])
    .index("by_source_url", ["normalizedSourceUrl"]),

  songs: defineTable({
    jobId: v.id("jobs"),
    userId: v.id("users"),
    title: v.string(),
    artist: v.string(),
    album: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    isrc: v.optional(v.string()),
    spotifyUrl: v.optional(v.string()),
    appleMusicUrl: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),
    artworkUrl: v.optional(v.string()),
    confidence: v.number(),
    matchedAtSeconds: v.number(),
    recognitionService: v.union(v.literal("shazamkit"), v.literal("acrcloud")),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_isrc", ["isrc"]),

  trending: defineTable({
    isrc: v.string(),
    title: v.string(),
    artist: v.string(),
    artworkUrl: v.optional(v.string()),
    spotifyUrl: v.optional(v.string()),
    appleMusicUrl: v.optional(v.string()),
    totalRecognitions: v.number(),
    uniqueReels: v.number(),
    sampleReelUrls: v.array(v.string()),
    lastRecognizedAt: v.number(),
    recognitionsThisWeek: v.number(),
    recognitionsLastWeek: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isrc", ["isrc"])
    .index("by_weekly_recognitions", ["recognitionsThisWeek"])
    .index("by_total_recognitions", ["totalRecognitions"]),

  referrals: defineTable({
    referrerId: v.id("users"),
    refereeId: v.id("users"),
    referralCode: v.string(),
    bonusGranted: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_referrer", ["referrerId"])
    .index("by_referee", ["refereeId"])
    .index("by_code", ["referralCode"]),

  priorityPurchases: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    purchasedAt: v.number(),
    paymentId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"]),

  offlineQueue: defineTable({
    userId: v.id("users"),
    sourceUrl: v.string(),
    savedAt: v.number(),
    processedAt: v.optional(v.number()),
    jobId: v.optional(v.id("jobs")),
  }).index("by_user", ["userId"]),
});
