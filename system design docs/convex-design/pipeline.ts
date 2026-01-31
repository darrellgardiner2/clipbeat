import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// MAIN PIPELINE ORCHESTRATOR
// ============================================

export const processJob = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
      jobId: args.jobId,
    });

    if (!job || job.status === "completed" || job.status === "failed") {
      return;
    }

    try {
      // Step 1: Download video
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "downloading",
        startedAt: Date.now(),
      });

      const videoResult = await downloadVideo(job.sourceUrl, job.platform);

      await ctx.runMutation(internal.pipeline.updateJobDownload, {
        jobId: args.jobId,
        downloadJobId: videoResult.jobId,
      });

      // Step 2: Extract audio
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "extracting_audio",
      });

      const audioUrl = await extractAudio(videoResult.videoUrl);

      // Store audio in Convex file storage
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      const audioFileId = await ctx.storage.store(audioBlob);

      await ctx.runMutation(internal.pipeline.updateJobAudio, {
        jobId: args.jobId,
        audioFileId,
      });

      // Step 3: Remove vocals
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "removing_vocals",
      });

      const strippedAudioUrl = await removeVocals(audioUrl);

      // Store stripped audio
      const strippedResponse = await fetch(strippedAudioUrl);
      const strippedBlob = await strippedResponse.blob();
      const strippedAudioFileId = await ctx.storage.store(strippedBlob);

      await ctx.runMutation(internal.pipeline.updateJobStrippedAudio, {
        jobId: args.jobId,
        strippedAudioFileId,
      });

      // Step 4: Identify music
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "identifying",
      });

      // Try multiple segments for better coverage
      const songs = await identifyMusic(strippedAudioUrl);

      // Also try original audio (sometimes vocals don't hurt)
      const songsFromOriginal = await identifyMusic(audioUrl);

      // Merge and dedupe results
      const allSongs = dedupeAndRankSongs([...songs, ...songsFromOriginal]);

      // Step 5: Save results
      for (const song of allSongs) {
        await ctx.runMutation(internal.pipeline.saveSong, {
          jobId: args.jobId,
          userId: job.userId,
          song,
        });
      }

      // Mark complete
      await ctx.runMutation(internal.pipeline.updateJobStatus, {
        jobId: args.jobId,
        status: "completed",
        completedAt: Date.now(),
      });

      // Send push notification
      await ctx.runAction(internal.notifications.sendJobComplete, {
        jobId: args.jobId,
        songTitle: allSongs[0]?.title ?? "Unknown",
        songArtist: allSongs[0]?.artist ?? "Unknown",
      });

    } catch (error) {
      console.error("Pipeline error:", error);

      const job = await ctx.runQuery(internal.pipeline.getJobInternal, {
        jobId: args.jobId,
      });

      if (job && job.retryCount < 3) {
        // Retry with backoff
        await ctx.runMutation(internal.pipeline.incrementRetry, {
          jobId: args.jobId,
          error: String(error),
        });

        const backoffMs = Math.pow(2, job.retryCount) * 1000;
        await ctx.scheduler.runAfter(backoffMs, internal.pipeline.processJob, {
          jobId: args.jobId,
        });
      } else {
        // Mark as failed
        await ctx.runMutation(internal.pipeline.updateJobStatus, {
          jobId: args.jobId,
          status: "failed",
          error: String(error),
        });

        // Notify user of failure
        await ctx.runAction(internal.notifications.sendJobFailed, {
          jobId: args.jobId,
          error: String(error),
        });
      }
    }
  },
});

// ============================================
// INTERNAL MUTATIONS (for pipeline state updates)
// ============================================

export const getJobInternal = internalMutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
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
    const updates: any = { status: args.status };
    if (args.startedAt) updates.startedAt = args.startedAt;
    if (args.completedAt) updates.completedAt = args.completedAt;
    if (args.error) updates.error = args.error;

    await ctx.db.patch(args.jobId, updates);
  },
});

export const updateJobDownload = internalMutation({
  args: {
    jobId: v.id("jobs"),
    downloadJobId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      downloadJobId: args.downloadJobId,
    });
  },
});

export const updateJobAudio = internalMutation({
  args: {
    jobId: v.id("jobs"),
    audioFileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      audioFileId: args.audioFileId,
    });
  },
});

export const updateJobStrippedAudio = internalMutation({
  args: {
    jobId: v.id("jobs"),
    strippedAudioFileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      strippedAudioFileId: args.strippedAudioFileId,
    });
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
      recognitionService: v.union(
        v.literal("shazamkit"),
        v.literal("acrcloud"),
        v.literal("audd")
      ),
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

export const incrementRetry = internalMutation({
  args: {
    jobId: v.id("jobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    await ctx.db.patch(args.jobId, {
      retryCount: job.retryCount + 1,
      error: args.error,
      status: "queued", // Reset to queued for retry
    });
  },
});

// ============================================
// EXTERNAL SERVICE INTEGRATIONS
// ============================================

async function downloadVideo(
  url: string,
  platform: string
): Promise<{ videoUrl: string; jobId: string }> {
  // Option 1: Use Apify Instagram Reel Downloader
  // Option 2: Use RapidAPI
  // Option 3: Self-hosted solution

  // Example using a generic downloader service:
  const response = await fetch(process.env.VIDEO_DOWNLOADER_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VIDEO_DOWNLOADER_API_KEY}`,
    },
    body: JSON.stringify({ url, platform }),
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    videoUrl: data.videoUrl,
    jobId: data.jobId || "direct",
  };
}

async function extractAudio(videoUrl: string): Promise<string> {
  // Option 1: Use a hosted FFmpeg service
  // Option 2: Download locally and process (if running on a VM)
  // Option 3: Use Replicate's FFmpeg model

  const response = await fetch(process.env.AUDIO_EXTRACTOR_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AUDIO_EXTRACTOR_API_KEY}`,
    },
    body: JSON.stringify({ videoUrl }),
  });

  if (!response.ok) {
    throw new Error(`Audio extraction failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.audioUrl;
}

async function removeVocals(audioUrl: string): Promise<string> {
  // Use Replicate's Demucs model
  const response = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
    },
    body: JSON.stringify({
      version: "25a173108cff36ef9f80f854c162d01df9e6528be175794b81571f6ae71f64fd", // Demucs
      input: {
        audio: audioUrl,
        stems: "vocals", // Returns vocals + accompaniment
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Demucs request failed: ${response.statusText}`);
  }

  const prediction = await response.json();

  // Poll for completion
  let result = prediction;
  while (result.status !== "succeeded" && result.status !== "failed") {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const pollResponse = await fetch(
      `https://api.replicate.com/v1/predictions/${result.id}`,
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        },
      }
    );
    result = await pollResponse.json();
  }

  if (result.status === "failed") {
    throw new Error(`Demucs failed: ${result.error}`);
  }

  // Return the accompaniment (no vocals) track
  return result.output.accompaniment || result.output.no_vocals;
}

interface RecognizedSong {
  title: string;
  artist: string;
  album?: string;
  releaseDate?: string;
  durationMs?: number;
  isrc?: string;
  spotifyUrl?: string;
  appleMusicUrl?: string;
  youtubeUrl?: string;
  artworkUrl?: string;
  confidence: number;
  matchedAtSeconds: number;
  recognitionService: "shazamkit" | "acrcloud" | "audd";
}

async function identifyMusic(audioUrl: string): Promise<RecognizedSong[]> {
  const songs: RecognizedSong[] = [];

  // Try ACRCloud first (if configured)
  if (process.env.ACRCLOUD_ACCESS_KEY) {
    try {
      const acrResults = await identifyWithACRCloud(audioUrl);
      songs.push(...acrResults);
    } catch (e) {
      console.error("ACRCloud failed:", e);
    }
  }

  // Fallback to AudD
  if (songs.length === 0 && process.env.AUDD_API_TOKEN) {
    try {
      const auddResults = await identifyWithAudD(audioUrl);
      songs.push(...auddResults);
    } catch (e) {
      console.error("AudD failed:", e);
    }
  }

  return songs;
}

async function identifyWithACRCloud(audioUrl: string): Promise<RecognizedSong[]> {
  // ACRCloud expects audio file upload, not URL
  // Download the audio first
  const audioResponse = await fetch(audioUrl);
  const audioBuffer = await audioResponse.arrayBuffer();

  // Create signature for ACRCloud
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = [
    "POST",
    "/v1/identify",
    process.env.ACRCLOUD_ACCESS_KEY,
    "audio",
    "1",
    timestamp,
  ].join("\n");

  const signature = await createHmacSignature(
    stringToSign,
    process.env.ACRCLOUD_ACCESS_SECRET!
  );

  const formData = new FormData();
  formData.append("sample", new Blob([audioBuffer]), "audio.mp3");
  formData.append("access_key", process.env.ACRCLOUD_ACCESS_KEY!);
  formData.append("data_type", "audio");
  formData.append("signature_version", "1");
  formData.append("signature", signature);
  formData.append("timestamp", timestamp.toString());
  formData.append("sample_bytes", audioBuffer.byteLength.toString());

  const response = await fetch(
    `https://${process.env.ACRCLOUD_HOST}/v1/identify`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (data.status?.code !== 0 || !data.metadata?.music) {
    return [];
  }

  return data.metadata.music.map((track: any, index: number) => ({
    title: track.title,
    artist: track.artists?.[0]?.name || "Unknown",
    album: track.album?.name,
    releaseDate: track.release_date,
    durationMs: track.duration_ms,
    isrc: track.external_ids?.isrc,
    spotifyUrl: track.external_metadata?.spotify?.track?.id
      ? `https://open.spotify.com/track/${track.external_metadata.spotify.track.id}`
      : undefined,
    appleMusicUrl: track.external_metadata?.apple_music?.url,
    youtubeUrl: track.external_metadata?.youtube?.vid
      ? `https://youtube.com/watch?v=${track.external_metadata.youtube.vid}`
      : undefined,
    artworkUrl: track.album?.cover,
    confidence: track.score || 80,
    matchedAtSeconds: track.play_offset_ms ? track.play_offset_ms / 1000 : index * 10,
    recognitionService: "acrcloud" as const,
  }));
}

async function identifyWithAudD(audioUrl: string): Promise<RecognizedSong[]> {
  const response = await fetch("https://api.audd.io/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      api_token: process.env.AUDD_API_TOKEN!,
      url: audioUrl,
      return: "spotify,apple_music",
    }),
  });

  const data = await response.json();

  if (data.status !== "success" || !data.result) {
    return [];
  }

  const track = data.result;
  return [
    {
      title: track.title,
      artist: track.artist,
      album: track.album,
      releaseDate: track.release_date,
      spotifyUrl: track.spotify?.external_urls?.spotify,
      appleMusicUrl: track.apple_music?.url,
      artworkUrl: track.spotify?.album?.images?.[0]?.url,
      confidence: 85, // AudD doesn't return confidence
      matchedAtSeconds: 0,
      recognitionService: "audd" as const,
    },
  ];
}

function dedupeAndRankSongs(songs: RecognizedSong[]): RecognizedSong[] {
  // Group by ISRC or title+artist
  const seen = new Map<string, RecognizedSong>();

  for (const song of songs) {
    const key = song.isrc || `${song.title.toLowerCase()}-${song.artist.toLowerCase()}`;

    const existing = seen.get(key);
    if (!existing || song.confidence > existing.confidence) {
      seen.set(key, song);
    }
  }

  // Sort by confidence
  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
}

async function createHmacSignature(
  data: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(data)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
