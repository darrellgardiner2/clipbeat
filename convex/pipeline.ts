// @ts-nocheck - Run `npx convex dev` to generate proper types
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { downloadVideo } from "./lib/download";
import { separateAudio } from "./lib/audioSeparation";
import { identifyWithACRCloud, type RecognizedSong } from "./lib/recognition";

export const processJob = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }

    const startedAt = Date.now();

    try {
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "downloading",
        startedAt,
      });

      const downloadResult = await downloadVideo(job.sourceUrl, job.platform);

      const audioRes = await fetch(downloadResult.audioUrl);
      if (!audioRes.ok) throw new Error("Failed to fetch audio");
      const audioBlob = await audioRes.blob();
      const audioFileId = await ctx.storage.store(audioBlob);

      await ctx.runMutation(internal.pipeline.updateJobAudio, {
        jobId: args.jobId,
        audioFileId,
      });

      const audioUrl = await ctx.storage.getUrl(audioFileId);
      if (!audioUrl) throw new Error("Failed to get audio URL");

      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "recognizing_original",
      });

      await ctx.runMutation(internal.pipeline.setRecognitionAttempt, {
        jobId: args.jobId,
        attempt: "original",
      });

      let songs = await identifyWithACRCloud(audioUrl);

      if (songs.length === 0) {
        await ctx.runMutation(internal.pipeline.updateJobStatus, {
          jobId: args.jobId,
          status: "removing_vocals",
        });

        const { accompanimentUrl } = await separateAudio(audioUrl);

        await ctx.runMutation(internal.pipeline.updateJobStatus, {
          jobId: args.jobId,
          status: "recognizing_stripped",
        });

        await ctx.runMutation(internal.pipeline.setRecognitionAttempt, {
          jobId: args.jobId,
          attempt: "stripped",
        });

        songs = await identifyWithACRCloud(accompanimentUrl);
      }

      if (songs.length === 0) {
        await ctx.runMutation(internal.pipeline.updateJobStatus, {
          jobId: args.jobId,
          status: "failed",
          error: "Could not identify music",
        });
        await ctx.runAction(internal.notifications.sendJobFailed, {
          jobId: args.jobId,
          error: "Could not identify music",
        });
        return;
      }

      const deduped = dedupeSongs(songs);

      for (const song of deduped) {
        await ctx.runMutation(internal.pipeline.saveSong, {
          jobId: args.jobId,
          userId: job.userId,
          song,
        });
      }

      const completedAt = Date.now();
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "completed",
        completedAt,
        processingTimeMs: completedAt - startedAt,
      });

      await ctx.runAction(internal.notifications.sendJobComplete, {
        jobId: args.jobId,
        songTitle: deduped[0].title,
        songArtist: deduped[0].artist,
      });
    } catch (error) {
      console.error("Pipeline error:", error);

      const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
        jobId: args.jobId,
      });

      if (job && job.retryCount < 3) {
        await ctx.runMutation(internal.pipeline.incrementRetry, {
          jobId: args.jobId,
          error: String(error),
        });
        const backoffMs = Math.pow(2, job.retryCount) * 1000;
        await ctx.scheduler.runAfter(backoffMs, internal.pipeline.processJob, {
          jobId: args.jobId,
        });
      } else {
        await ctx.runMutation(internal.pipeline.updateJobStatus, {
          jobId: args.jobId,
          status: "failed",
          error: String(error),
        });
        await ctx.runAction(internal.notifications.sendJobFailed, {
          jobId: args.jobId,
          error: String(error),
        });
      }
    }
  },
});

function dedupeSongs(songs: RecognizedSong[]): RecognizedSong[] {
  const seen = new Map<string, RecognizedSong>();
  for (const s of songs) {
    const key = s.isrc ?? `${s.title.toLowerCase()}-${s.artist.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || s.confidence > existing.confidence) {
      seen.set(key, s);
    }
  }
  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
}

export const getJobInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => ctx.db.get(args.jobId),
});

export const updateJobAudio = internalMutation({
  args: { jobId: v.id("jobs"), audioFileId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, { audioFileId: args.audioFileId });
  },
});

export const setRecognitionAttempt = internalMutation({
  args: {
    jobId: v.id("jobs"),
    attempt: v.union(
      v.literal("original"),
      v.literal("stripped"),
      v.literal("segments"),
      v.literal("acrcloud")
    ),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    const base = job?.recognitionAttempts ?? {
      original: false,
      stripped: false,
      segments: false,
      acrcloud: false,
    };
    const attempts = { ...base };
    if (args.attempt === "original") attempts.original = true;
    if (args.attempt === "stripped") attempts.stripped = true;
    if (args.attempt === "segments") attempts.segments = true;
    if (args.attempt === "acrcloud") attempts.acrcloud = true;
    await ctx.db.patch(args.jobId, { recognitionAttempts: attempts });
  },
});

export const saveSong = internalMutation({
  args: {
    jobId: v.id("jobs"),
    userId: v.id("users"),
    song: v.object({
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
      recognitionService: v.literal("acrcloud"),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("songs", {
      jobId: args.jobId,
      userId: args.userId,
      ...args.song,
      createdAt: Date.now(),
    });
  },
});

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.string(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.startedAt) updates.startedAt = args.startedAt;
    if (args.completedAt) updates.completedAt = args.completedAt;
    if (args.error) updates.error = args.error;
    await ctx.db.patch(args.jobId, updates);
  },
});

export const incrementRetry = internalMutation({
  args: { jobId: v.id("jobs"), error: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;
    await ctx.db.patch(args.jobId, {
      retryCount: job.retryCount + 1,
      error: args.error,
      status: "queued",
    });
  },
});
