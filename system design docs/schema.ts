import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // USERS
  // ============================================
  users: defineTable({
    // Auth - using Clerk or Auth0
    clerkId: v.string(),
    email: v.optional(v.string()),
    
    // Subscription
    tier: v.union(v.literal("free"), v.literal("pro")),
    
    // Limits tracking (resets daily for free users)
    dailyIdentifiesUsed: v.number(),
    dailyIdentifiesResetAt: v.number(), // timestamp
    
    // Push notifications
    pushToken: v.optional(v.string()),
    
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // ============================================
  // JOBS - Each shared reel becomes a job
  // ============================================
  jobs: defineTable({
    userId: v.id("users"),
    
    // Input
    sourceUrl: v.string(), // The Instagram/TikTok URL
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
      v.literal("removing_vocals"),
      v.literal("identifying"),
      v.literal("completed"),
      v.literal("failed")
    ),
    
    // Priority (pro users skip queue)
    priority: v.union(v.literal("normal"), v.literal("high")),
    
    // Processing metadata
    videoFileId: v.optional(v.id("_storage")), // Convex file storage
    audioFileId: v.optional(v.id("_storage")),
    strippedAudioFileId: v.optional(v.id("_storage")),
    
    // External service IDs for tracking
    downloadJobId: v.optional(v.string()),
    demucsJobId: v.optional(v.string()),
    
    // Timing
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    
    // Error handling
    error: v.optional(v.string()),
    retryCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_status_and_priority", ["status", "priority", "createdAt"])
    .index("by_created", ["createdAt"]),

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
    recognitionService: v.union(
      v.literal("shazamkit"),
      v.literal("acrcloud"),
      v.literal("audd")
    ),
    
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_isrc", ["isrc"]),

  // ============================================
  // QUEUE SKIP PURCHASES (one-time)
  // ============================================
  queueSkips: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    purchasedAt: v.number(),
    // Payment reference (Stripe, RevenueCat, etc.)
    paymentId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"]),
});
