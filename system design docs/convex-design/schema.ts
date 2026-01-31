import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // USERS
  // ============================================
  users: defineTable({
    // Auth - using Clerk
    clerkId: v.string(),
    email: v.optional(v.string()),

    // Subscription
    tier: v.union(v.literal("free"), v.literal("pro")),

    // Limits tracking
    dailyIdentifiesUsed: v.number(),
    dailyIdentifiesResetAt: v.number(), // timestamp
    firstDayFreeUsed: v.boolean(), // Track if first day unlimited was used
    signupDate: v.number(), // To determine if still in "first day"

    // Referral bonuses (5 days free)
    proExpiresAt: v.optional(v.number()), // Temporary Pro from referral

    // Push notifications
    pushToken: v.optional(v.string()),

    // Referral system
    referralCode: v.string(), // Unique code like "ABC123"
    referredBy: v.optional(v.id("users")), // Who referred this user

    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_referral_code", ["referralCode"]),

  // ============================================
  // JOBS - Each shared reel becomes a job
  // ============================================
  jobs: defineTable({
    userId: v.id("users"),

    // Input
    sourceUrl: v.string(), // The original URL
    normalizedSourceUrl: v.string(), // URL without tracking params (for dedup)
    platform: v.union(
      v.literal("instagram"),
      v.literal("tiktok"),
      v.literal("youtube"),
      v.literal("unknown")
    ),

    // Status tracking
    status: v.union(
      v.literal("queued"),
      v.literal("downloading"),
      v.literal("extracting_audio"),
      v.literal("recognizing_original"), // New: trying original audio
      v.literal("removing_vocals"),
      v.literal("recognizing_stripped"), // New: trying stripped audio
      v.literal("segment_analysis"), // New: trying segments
      v.literal("completed"),
      v.literal("failed")
    ),

    // Pipeline tracking - which stages were attempted
    recognitionAttempts: v.optional(
      v.object({
        original: v.boolean(), // Tried on original audio?
        stripped: v.boolean(), // Tried on stripped audio?
        segments: v.boolean(), // Tried segment analysis?
        acrcloud: v.boolean(), // Used ACRCloud fallback?
      })
    ),

    // Priority (pro users + priority purchases get high)
    priority: v.union(v.literal("normal"), v.literal("high")),

    // Processing metadata
    videoFileId: v.optional(v.id("_storage")),
    audioFileId: v.optional(v.id("_storage")),
    strippedAudioFileId: v.optional(v.id("_storage")),

    // External service IDs for tracking
    downloadJobId: v.optional(v.string()),
    demucsJobId: v.optional(v.string()),

    // Cache reference (if this job used cached result from another job)
    cachedFromJobId: v.optional(v.id("jobs")),

    // Timing
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    processingTimeMs: v.optional(v.number()),

    // Error handling
    error: v.optional(v.string()),
    retryCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_status_and_priority", ["status", "priority", "createdAt"])
    .index("by_created", ["createdAt"])
    .index("by_source_url", ["normalizedSourceUrl"]), // SYSTEM-WIDE duplicate detection

  // ============================================
  // IDENTIFIED SONGS - Results from recognition
  // ============================================
  songs: defineTable({
    jobId: v.id("jobs"),
    userId: v.id("users"), // Denormalized for easy querying

    // Song metadata
    title: v.string(),
    artist: v.string(),
    album: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    durationMs: v.optional(v.number()),

    // Identifiers for linking to streaming services
    isrc: v.optional(v.string()), // International Standard Recording Code

    // Streaming links
    spotifyUrl: v.optional(v.string()),
    appleMusicUrl: v.optional(v.string()),
    youtubeUrl: v.optional(v.string()),

    // Album art
    artworkUrl: v.optional(v.string()),

    // Recognition metadata
    confidence: v.number(), // 0-100
    matchedAtSeconds: v.number(), // Where in the audio the match was found
    recognitionService: v.union(v.literal("shazamkit"), v.literal("acrcloud")),

    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_isrc", ["isrc"]),

  // ============================================
  // TRENDING - Aggregated data for trending page
  // ============================================
  trending: defineTable({
    isrc: v.string(), // Song identifier (unique per song)
    title: v.string(),
    artist: v.string(),
    artworkUrl: v.optional(v.string()),
    spotifyUrl: v.optional(v.string()),
    appleMusicUrl: v.optional(v.string()),

    // Counts
    totalRecognitions: v.number(), // Total times this song was found
    uniqueReels: v.number(), // How many unique reels contained this song

    // Sample data for display
    sampleReelUrls: v.array(v.string()), // Up to 5 example reels

    // Time-based tracking
    lastRecognizedAt: v.number(),
    recognitionsThisWeek: v.number(),
    recognitionsLastWeek: v.number(),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_isrc", ["isrc"])
    .index("by_weekly_recognitions", ["recognitionsThisWeek"])
    .index("by_total_recognitions", ["totalRecognitions"]),

  // ============================================
  // REFERRALS - Track referral conversions
  // ============================================
  referrals: defineTable({
    referrerId: v.id("users"), // Who shared
    refereeId: v.id("users"), // Who signed up
    referralCode: v.string(),
    bonusGranted: v.boolean(), // Did both get 5 days?
    createdAt: v.number(),
  })
    .index("by_referrer", ["referrerId"])
    .index("by_referee", ["refereeId"])
    .index("by_code", ["referralCode"]),

  // ============================================
  // PRIORITY PURCHASES (one-time, formerly queueSkips)
  // ============================================
  priorityPurchases: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    purchasedAt: v.number(),
    paymentId: v.optional(v.string()), // RevenueCat transaction ID
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"]),

  // ============================================
  // OFFLINE QUEUE - URLs saved when offline
  // ============================================
  offlineQueue: defineTable({
    userId: v.id("users"),
    sourceUrl: v.string(),
    savedAt: v.number(), // When saved offline
    processedAt: v.optional(v.number()), // When finally processed
    jobId: v.optional(v.id("jobs")), // Resulting job ID
  }).index("by_user", ["userId"]),
});
