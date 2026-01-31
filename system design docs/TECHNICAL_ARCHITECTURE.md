# ClipBeat - Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              iOS App (Expo)                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Share     │  │    Main     │  │    Push     │  │      Auth           │ │
│  │  Extension  │  │    App      │  │   Handler   │  │     (Clerk)         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                    │            │
│         │         ┌──────┴──────┐         │                    │            │
│         │         │  ShazamKit  │         │                    │            │
│         │         │ (on-device) │         │                    │            │
│         │         └──────┬──────┘         │                    │            │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          │         Real-time sync          │                    │
          │    ┌───────────┴───────────┐    │                    │
          │    │                       │    │                    │
          ▼    ▼                       ▼    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Convex Backend                                  │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Mutations  │  │   Queries   │  │   Actions   │  │     Scheduler       │ │
│  │  (writes)   │  │  (reads)    │  │  (external) │  │     (cron)          │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                │                    │            │
│         └────────────────┼────────────────┼────────────────────┘            │
│                          │                │                                  │
│                    ┌─────┴─────┐          │                                  │
│                    │  Database │          │                                  │
│                    │  (Tables) │          │                                  │
│                    └───────────┘          │                                  │
│                                           │                                  │
│                          ┌────────────────┼────────────────┐                │
│                          │                │                │                │
│                          ▼                ▼                ▼                │
│                    ┌───────────┐    ┌───────────┐    ┌───────────┐         │
│                    │   File    │    │  Replicate │   │  ACRCloud │         │
│                    │  Storage  │    │  (Demucs)  │   │ (fallback)│         │
│                    └───────────┘    └───────────┘    └───────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                          ▼                ▼                ▼
                    ┌───────────┐    ┌───────────┐    ┌───────────┐
                    │  yt-dlp   │    │   Expo    │    │ RevenueCat│
                    │ (primary) │    │   Push    │    │           │
                    ├───────────┤    │  Service  │    │           │
                    │  Apify    │    │           │    │           │
                    │ (backup)  │    │           │    │           │
                    └───────────┘    └───────────┘    └───────────┘
```

**Key Architecture Decisions:**
- **On-device ShazamKit** for primary recognition (free, fast, accurate)
- **ACRCloud** as server-side fallback (500 free/day)
- **yt-dlp** for video download (Apify as backup when rate-limited)
- **Replicate Demucs** for vocal separation when needed
- **System-wide duplicate detection** to avoid reprocessing same URLs

---

## Infrastructure Decisions

### Why Convex?

| Requirement | Convex Solution |
|-------------|-----------------|
| Real-time job status | Built-in subscriptions |
| Background processing | Actions + Scheduler |
| File storage | Integrated blob storage |
| Authentication | Clerk integration |
| Serverless scaling | Automatic |
| Type safety | End-to-end TypeScript |

**Trade-offs:**
- Vendor lock-in (acceptable for speed)
- Actions have 10-minute timeout (sufficient for our pipeline)
- No raw SQL (acceptable, document model works)

### Why Expo?

| Requirement | Expo Solution |
|-------------|---------------|
| Share Extension | `expo-share-intent` plugin |
| Push Notifications | `expo-notifications` |
| Fast iteration | Hot reload, EAS Build |
| iOS + Android | Single codebase |

**Trade-offs:**
- Larger app size (~50MB vs ~20MB native)
- Some native limitations (acceptable for v1)
- Must use `expo prebuild` (no Expo Go for share extension)

### Why Clerk?

| Requirement | Clerk Solution |
|-------------|----------------|
| Apple Sign-In | Built-in, App Store compliant |
| Google Sign-In | Built-in |
| Session management | Handled automatically |
| Convex integration | First-class support |

**Trade-offs:**
- $25/mo after 10k MAU (acceptable)
- Another vendor dependency (acceptable for speed)

---

## Processing Pipeline

### Pipeline Strategy: Recognition Before Vocal Removal

The key optimization is to **try recognition on original audio first**. This:
- Saves 5-15 seconds of Demucs processing
- Saves ~$0.005 per job
- Works for ~40% of videos with clean audio

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        RECOGNITION PIPELINE                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Check Duplicate (system-wide)                                        │
│     └─ Found? → Return cached result immediately                         │
│                                                                          │
│  2. Download Video (yt-dlp → Apify fallback)                             │
│     └─ Extract audio (FFmpeg)                                            │
│                                                                          │
│  3. Try Recognition on Original Audio (ShazamKit on-device)              │
│     └─ Found? → Done! Skip vocal removal                                 │
│                                                                          │
│  4. Remove Vocals (Replicate Demucs)                                     │
│     └─ Output: "accompaniment" stem (instrumental)                       │
│                                                                          │
│  5. Try Recognition on Stripped Audio (ShazamKit)                        │
│     └─ Found? → Done!                                                    │
│                                                                          │
│  6. Segment Analysis (if still not found)                                │
│     └─ Split audio into 15-second segments                               │
│     └─ Try recognition on each segment                                   │
│     └─ Catches multiple songs in one video                               │
│                                                                          │
│  7. ACRCloud Fallback (server-side, if ShazamKit fails)                  │
│     └─ 500 free/day                                                      │
│                                                                          │
│  8. No match found → Notify user                                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Stage 0: Duplicate Check (System-wide)

```typescript
// Before processing, check if URL was already processed by ANY user
async function checkDuplicate(ctx, { sourceUrl }) {
  const normalizedUrl = normalizeUrl(sourceUrl); // Remove tracking params
  
  const existing = await ctx.db
    .query("jobs")
    .withIndex("by_source_url", (q) => q.eq("normalizedSourceUrl", normalizedUrl))
    .filter((q) => q.eq(q.field("status"), "completed"))
    .first();
  
  if (existing) {
    // Return cached songs, no processing needed
    const songs = await ctx.db
      .query("songs")
      .withIndex("by_job", (q) => q.eq("jobId", existing._id))
      .collect();
    return { cached: true, songs };
  }
  
  return { cached: false };
}
```

**Latency:** <50ms for cache hit

### Stage 1: Job Creation

```typescript
// Triggered by: Share Extension / Paste URL / Offline Queue
async function createJob(ctx, { sourceUrl }) {
  // 1. Normalize and validate URL
  // 2. Check system-wide duplicate → return cached if exists
  // 3. Check user limits (first day unlimited, then 3/day free)
  // 4. Detect platform (instagram > tiktok > youtube)
  // 5. Insert job record (status: "queued")
  // 6. Schedule processing action
  // 7. Return job ID immediately
}
```

**Latency target:** <100ms

### Stage 2: Video Download

```typescript
// PRIMARY: yt-dlp (self-hosted or serverless)
// BACKUP: Apify (when yt-dlp rate-limited)

// yt-dlp command:
// yt-dlp -f best -o output.mp4 <url>

// Deploy options:
// - Railway/Fly.io: Docker container with yt-dlp + FFmpeg
// - AWS Lambda: yt-dlp layer (watch for timeouts)
// - Cloudflare Workers: Not suitable (no binary execution)

// Automatic fallback:
async function downloadVideo(url, platform) {
  try {
    return await downloadWithYtDlp(url);
  } catch (e) {
    if (isRateLimitError(e)) {
      return await downloadWithApify(url, platform);
    }
    throw e;
  }
}
```

**Latency target:** 2-8 seconds (varies by platform)
**Output:** Video file or CDN URL

### Stage 3: Audio Extraction

```typescript
// FFmpeg command (bundled with download service):
// ffmpeg -i video.mp4 -vn -acodec libmp3lame -ab 192k -ar 44100 audio.mp3

// Also extract metadata:
// ffprobe -v quiet -print_format json -show_format video.mp4
```

**Latency target:** 1-3 seconds
**Output:** Audio file (MP3, ~1MB for 60 sec)
**Note:** Process full video length initially, assess limits later

### Stage 4: On-Device Recognition (ShazamKit)

```typescript
// On iOS device using ShazamKit framework
import ShazamKit

// Generate audio signature from audio file
let signature = try SHSignature(dataRepresentation: audioData)

// Match against Shazam catalog
let session = SHSession()
session.match(signature)

// If match found:
// - song.title, song.artist, song.appleMusicURL
// - Skip vocal removal entirely (saves time + cost)
```

**Latency target:** 1-3 seconds
**Success rate:** ~40% on original audio (higher for clean videos)

### Stage 5: Audio Separation (Pluggable Provider)

Only runs if Stage 4 (recognition on original) fails.

**Important:** Standard "vocal removal" removes ALL vocals including singing. For reels with voiceovers over music that contains singing, we output multiple stems and try recognition on each.

```typescript
// Output stems from separation:
// - accompaniment: Instrumental only (no vocals/speech)
// - vocals: All vocal content (speech + singing)
// - drums: Drum track
// - bass: Bass track
// - other: Everything else (synths, guitars, etc.)

// Recognition strategy after separation:
// 1. Try "accompaniment" (works when original song has minimal vocals)
// 2. Try "other" + "drums" + "bass" mixed (alternative instrumental)
// 3. Try segments of each stem
```

#### Pluggable Audio Separation Provider

```typescript
// convex/lib/audioSeparation.ts

// ============================================
// PROVIDER INTERFACE
// ============================================

interface AudioSeparationResult {
  accompaniment?: string;  // URL to instrumental track
  vocals?: string;         // URL to vocals track
  drums?: string;          // URL to drums track
  bass?: string;           // URL to bass track
  other?: string;          // URL to other instruments
  processingTimeMs: number;
}

interface AudioSeparationProvider {
  name: string;
  separate(audioUrl: string): Promise<AudioSeparationResult>;
  estimateCost(durationSeconds: number): number;
  isAvailable(): Promise<boolean>;
}

// ============================================
// PROVIDER IMPLEMENTATIONS
// ============================================

// MVSEP-MDX23 - Best quality (9.5 dB SDR)
// Cost: ~$0.12/run, Runtime: ~120s
const mvsepMdx23Provider: AudioSeparationProvider = {
  name: "mvsep-mdx23",
  
  async separate(audioUrl: string): Promise<AudioSeparationResult> {
    const startTime = Date.now();
    
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: "cd128044253523c86abfd743dea680c88559ad975ccd72378c8433cd7626a2da",
        input: {
          audio: audioUrl,
          single_onnx: false, // Use full quality
          overlap_demucs: 0.25,
          overlap_VOCFT: 0.1,
        },
      }),
    });
    
    const prediction = await response.json();
    const result = await pollForCompletion(prediction.id);
    
    return {
      accompaniment: result.output?.instrumental,
      vocals: result.output?.vocals,
      drums: result.output?.drums,
      bass: result.output?.bass,
      other: result.output?.other,
      processingTimeMs: Date.now() - startTime,
    };
  },
  
  estimateCost: (durationSeconds) => 0.12, // Fixed per run
  isAvailable: async () => !!process.env.REPLICATE_API_TOKEN,
};

// Demucs v4 (htdemucs) - Good quality (9.0 dB SDR), faster
// Cost: ~$0.005/run, Runtime: ~15-30s
const demucsProvider: AudioSeparationProvider = {
  name: "demucs-v4",
  
  async separate(audioUrl: string): Promise<AudioSeparationResult> {
    const startTime = Date.now();
    
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: "25a173108cff36ef9f80f854c162d01df9e6528be175794b81571f6ae71f64fd",
        input: {
          audio: audioUrl,
          stems: "all", // Get all stems
        },
      }),
    });
    
    const prediction = await response.json();
    const result = await pollForCompletion(prediction.id);
    
    return {
      accompaniment: result.output?.no_vocals || result.output?.accompaniment,
      vocals: result.output?.vocals,
      drums: result.output?.drums,
      bass: result.output?.bass,
      other: result.output?.other,
      processingTimeMs: Date.now() - startTime,
    };
  },
  
  estimateCost: (durationSeconds) => 0.005,
  isAvailable: async () => !!process.env.REPLICATE_API_TOKEN,
};

// Spleeter - Fastest (100x realtime), lower quality (6.8 dB SDR)
// Cost: ~$0.002/run, Runtime: ~5s
const spleeterProvider: AudioSeparationProvider = {
  name: "spleeter",
  
  async separate(audioUrl: string): Promise<AudioSeparationResult> {
    const startTime = Date.now();
    
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
      },
      body: JSON.stringify({
        version: "YOUR_SPLEETER_VERSION_ID", // Add when available
        input: {
          audio: audioUrl,
          stems: 4, // 4-stem separation
        },
      }),
    });
    
    const prediction = await response.json();
    const result = await pollForCompletion(prediction.id);
    
    return {
      accompaniment: result.output?.accompaniment,
      vocals: result.output?.vocals,
      processingTimeMs: Date.now() - startTime,
    };
  },
  
  estimateCost: (durationSeconds) => 0.002,
  isAvailable: async () => false, // Enable when model ID available
};

// ============================================
// PROVIDER REGISTRY & CONFIGURATION
// ============================================

const separationProviders: Record<string, AudioSeparationProvider> = {
  "mvsep-mdx23": mvsepMdx23Provider,
  "demucs-v4": demucsProvider,
  "spleeter": spleeterProvider,
};

// Configuration (can be changed via environment or database)
interface SeparationConfig {
  primaryProvider: string;
  fallbackProvider: string;
  enableABTesting: boolean;
  abTestPercentage: number; // % of requests to send to test provider
  testProvider?: string;
}

const DEFAULT_CONFIG: SeparationConfig = {
  primaryProvider: "demucs-v4",      // Good balance of quality/speed/cost
  fallbackProvider: "mvsep-mdx23",   // Best quality as fallback
  enableABTesting: false,
  abTestPercentage: 10,
};

// Get config from environment or database
async function getSeparationConfig(): Promise<SeparationConfig> {
  // Can load from Convex database for hot-swapping
  const envConfig = process.env.AUDIO_SEPARATION_CONFIG;
  if (envConfig) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(envConfig) };
  }
  return DEFAULT_CONFIG;
}

// ============================================
// MAIN SEPARATION FUNCTION
// ============================================

export async function separateAudio(
  audioUrl: string,
  options?: { forceProvider?: string }
): Promise<AudioSeparationResult & { provider: string }> {
  const config = await getSeparationConfig();
  
  // Determine which provider to use
  let providerName = options?.forceProvider || config.primaryProvider;
  
  // A/B testing
  if (config.enableABTesting && config.testProvider && !options?.forceProvider) {
    if (Math.random() * 100 < config.abTestPercentage) {
      providerName = config.testProvider;
    }
  }
  
  const provider = separationProviders[providerName];
  if (!provider || !(await provider.isAvailable())) {
    // Fall back to fallback provider
    providerName = config.fallbackProvider;
    const fallback = separationProviders[providerName];
    if (!fallback || !(await fallback.isAvailable())) {
      throw new Error("No audio separation provider available");
    }
  }
  
  try {
    const result = await separationProviders[providerName].separate(audioUrl);
    return { ...result, provider: providerName };
  } catch (error) {
    // Try fallback on error
    if (providerName !== config.fallbackProvider) {
      console.warn(`Primary provider ${providerName} failed, trying fallback`);
      const fallbackResult = await separationProviders[config.fallbackProvider].separate(audioUrl);
      return { ...fallbackResult, provider: config.fallbackProvider };
    }
    throw error;
  }
}
```

**Current Model Comparison:**

| Model | Quality (SDR) | Speed | Cost/run | Best For |
|-------|---------------|-------|----------|----------|
| MVSEP-MDX23 | 9.5 dB | ~120s | $0.12 | Highest quality needed |
| Demucs v4 | 9.0 dB | ~20s | $0.005 | Default (good balance) |
| Spleeter | 6.8 dB | ~5s | $0.002 | Speed over quality |

**Hot-Swapping:** Change `AUDIO_SEPARATION_CONFIG` env var or update database config to switch models without redeploying.

### Stage 6: Segment Analysis

For longer videos or when recognition fails, split audio into segments.

```typescript
async function analyzeSegments(audioUrl: string): Promise<RecognizedSong[]> {
  const segments = await splitAudio(audioUrl, {
    segmentLength: 15, // seconds
    overlap: 5,        // seconds overlap between segments
  });
  
  const results: RecognizedSong[] = [];
  
  for (const segment of segments) {
    const song = await recognizeWithShazamKit(segment.url);
    if (song && !results.some(r => r.isrc === song.isrc)) {
      results.push({
        ...song,
        matchedAtSeconds: segment.startTime,
      });
    }
  }
  
  return results;
}
```

**Use case:** Videos with multiple songs, or songs that only play briefly

### Stage 7: ACRCloud Fallback

Server-side fallback when ShazamKit fails.

```typescript
// Only used when:
// 1. ShazamKit returns no match on original
// 2. ShazamKit returns no match on stripped
// 3. Segment analysis returns no match

// Free tier: 500 requests/day
// Cost after: ~$0.002/request
```

### Stage 8: Result Storage & Notification

```typescript
// 1. Save song(s) to database (linked to job)
// 2. Update trending counts (increment audio/reel recognition counts)
// 3. Update job status to "completed"
// 4. Send push notification via Expo
// 5. Schedule file cleanup (24h cron)
```

### Pipeline Latency Summary

| Scenario | Time | Cost |
|----------|------|------|
| Cache hit (duplicate URL) | <1s | $0 |
| Clean audio (recognition on original) | 5-10s | ~$0.01 |
| Needs vocal removal | 15-30s | ~$0.015 |
| Multiple songs (segment analysis) | 30-60s | ~$0.02 |

---

## Database Schema (Convex)

### Tables

```typescript
// users
{
  _id: Id<"users">,
  clerkId: string,           // Clerk user ID
  email?: string,
  tier: "free" | "pro",
  dailyUsed: number,
  dailyResetAt: number,      // Timestamp
  firstDayFreeUsed: boolean, // Track if first day unlimited was used
  pushToken?: string,
  // Referral tracking
  referralCode: string,      // Unique code like "ABC123"
  referredBy?: Id<"users">,  // Who referred this user
  proExpiresAt?: number,     // For referral bonuses / trials
  createdAt: number,
}

// jobs
{
  _id: Id<"jobs">,
  userId: Id<"users">,
  sourceUrl: string,
  normalizedSourceUrl: string, // URL without tracking params (for dedup)
  platform: "instagram" | "tiktok" | "youtube" | "unknown",
  status: "queued" | "downloading" | "extracting" | "removing_vocals" | "identifying" | "completed" | "failed",
  // Pipeline tracking
  recognitionAttempts: {
    original: boolean,       // Tried on original audio?
    stripped: boolean,       // Tried on stripped audio?
    segments: boolean,       // Tried segment analysis?
    acrcloud: boolean,       // Used ACRCloud fallback?
  },
  priority: "normal" | "high",
  error?: string,
  retryCount: number,
  createdAt: number,
  startedAt?: number,
  completedAt?: number,
  processingTimeMs?: number, // Total time taken
  // File references
  videoFileId?: Id<"_storage">,
  audioFileId?: Id<"_storage">,
  strippedAudioFileId?: Id<"_storage">,
  // Cache reference (if this job used cached result)
  cachedFromJobId?: Id<"jobs">,
}

// songs
{
  _id: Id<"songs">,
  jobId: Id<"jobs">,
  userId: Id<"users">,       // Denormalized for queries
  title: string,
  artist: string,
  album?: string,
  releaseDate?: string,
  durationMs?: number,
  isrc?: string,             // For deduplication
  spotifyUrl?: string,
  appleMusicUrl?: string,
  youtubeUrl?: string,
  artworkUrl?: string,
  confidence: number,        // 0-100
  matchedAtSeconds: number,  // Where in audio
  service: "shazamkit" | "acrcloud",
  createdAt: number,
}

// trending - Aggregate data for trending page
{
  _id: Id<"trending">,
  isrc: string,              // Song identifier (unique per song)
  title: string,
  artist: string,
  artworkUrl?: string,
  spotifyUrl?: string,
  appleMusicUrl?: string,
  // Counts
  totalRecognitions: number, // How many times this song was found
  uniqueReels: number,       // How many unique reels contained this song
  // Sample data
  sampleReelUrls: string[],  // Up to 5 example reels (for display)
  // Time-based tracking
  lastRecognizedAt: number,
  recognitionsThisWeek: number,
  recognitionsLastWeek: number,
  createdAt: number,
  updatedAt: number,
}

// referrals - Track referral conversions
{
  _id: Id<"referrals">,
  referrerId: Id<"users">,   // Who shared
  refereeId: Id<"users">,    // Who signed up
  referralCode: string,
  bonusGranted: boolean,     // Did both get 5 days?
  createdAt: number,
}

// priorityPurchases (one-time purchases, renamed from queueSkips)
{
  _id: Id<"priorityPurchases">,
  userId: Id<"users">,
  jobId: Id<"jobs">,
  paymentId: string,         // RevenueCat transaction ID
  purchasedAt: number,
}

// offlineQueue - URLs saved when offline
{
  _id: Id<"offlineQueue">,
  userId: Id<"users">,
  sourceUrl: string,
  savedAt: number,           // When saved offline
  processedAt?: number,      // When finally processed
  jobId?: Id<"jobs">,        // Resulting job ID
}
```

### Indexes

```typescript
// users
.index("by_clerk_id", ["clerkId"])
.index("by_referral_code", ["referralCode"])

// jobs
.index("by_user", ["userId", "createdAt"])
.index("by_status_priority", ["status", "priority", "createdAt"])
.index("by_source_url", ["normalizedSourceUrl"]) // SYSTEM-WIDE duplicate detection

// songs
.index("by_job", ["jobId"])
.index("by_user", ["userId", "createdAt"])
.index("by_isrc", ["isrc"])

// trending
.index("by_isrc", ["isrc"])
.index("by_recognitions_this_week", ["recognitionsThisWeek"]) // For trending page

// referrals
.index("by_referrer", ["referrerId"])
.index("by_referee", ["refereeId"])
.index("by_code", ["referralCode"])

// offlineQueue
.index("by_user_unprocessed", ["userId", "processedAt"])
```

### URL Normalization

For system-wide duplicate detection, normalize URLs before storing:

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  
  // Remove tracking parameters
  const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'igshid', 'fbclid'];
  trackingParams.forEach(p => parsed.searchParams.delete(p));
  
  // Normalize Instagram URLs
  if (parsed.hostname.includes('instagram.com')) {
    // Convert /reel/ABC123/?anything to /reel/ABC123/
    const match = parsed.pathname.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
    if (match) {
      return `https://instagram.com/${match[1]}/${match[2]}/`;
    }
  }
  
  // Normalize TikTok URLs
  if (parsed.hostname.includes('tiktok.com')) {
    const match = parsed.pathname.match(/\/@[^\/]+\/video\/(\d+)/);
    if (match) {
      return `https://tiktok.com/video/${match[1]}`;
    }
  }
  
  // Normalize YouTube Shorts
  if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
    const shortMatch = parsed.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
    if (shortMatch) {
      return `https://youtube.com/shorts/${shortMatch[1]}`;
    }
  }
  
  return url;
}
```

---

## External Service Integration

### Video Download Service

**PRIMARY: yt-dlp (self-hosted)**

Deploy on Railway/Fly.io with Docker:

```dockerfile
FROM python:3.11-slim
RUN pip install yt-dlp
RUN apt-get update && apt-get install -y ffmpeg
COPY server.py .
CMD ["python", "server.py"]
```

```typescript
// server.py (Flask example)
from flask import Flask, request, jsonify
import yt_dlp
import os

app = Flask(__name__)

@app.route("/download", methods=["POST"])
def download():
    url = request.json["url"]
    
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': '/tmp/%(id)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        video_path = ydl.prepare_filename(info)
        audio_path = video_path.rsplit('.', 1)[0] + '.mp3'
    
    # Upload to Convex storage or return URLs
    return jsonify({
        "videoPath": video_path,
        "audioPath": audio_path,
        "title": info.get("title"),
        "duration": info.get("duration"),
    })

// Environment variables
YT_DLP_SERVICE_URL=https://your-service.railway.app
YT_DLP_API_KEY=your_secret_key
```

**BACKUP: Apify (when yt-dlp rate-limited)**

```typescript
// Environment variables
APIFY_API_TOKEN=apify_api_xxx

// Usage (only when yt-dlp fails with rate limit)
async function downloadWithApify(url: string, platform: string) {
  const actorId = platform === 'instagram' 
    ? 'apify/instagram-scraper'
    : platform === 'tiktok'
    ? 'clockworks/tiktok-scraper'
    : 'bernardo/youtube-scraper';
    
  const run = await apifyClient.actor(actorId).call({
    directUrls: [url],
    resultsType: "details",
  });

  return {
    videoUrl: run.items[0].videoUrl,
    jobId: run.id,
  };
}
```

**Download Wrapper with Fallback:**

```typescript
async function downloadVideo(url: string, platform: string) {
  try {
    // Try yt-dlp first (free, fast)
    const response = await fetch(process.env.YT_DLP_SERVICE_URL + "/download", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.YT_DLP_API_KEY}`,
      },
      body: JSON.stringify({ url }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      if (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED") {
        throw new Error("RATE_LIMITED");
      }
      throw new Error(error.message);
    }
    
    return await response.json();
    
  } catch (e) {
    if (e.message === "RATE_LIMITED") {
      console.log("yt-dlp rate limited, falling back to Apify");
      return await downloadWithApify(url, platform);
    }
    throw e;
  }
}
```

### Vocal Removal (Replicate)

```typescript
// Environment variables
REPLICATE_API_TOKEN=r8_xxx

// Usage
const output = await replicate.run(
  "cjwbw/demucs:version_id",
  {
    input: {
      audio: audioUrl,
      stems: "vocals",  // Returns vocals + accompaniment
    }
  }
);

const strippedAudioUrl = output.accompaniment;
```

### Music Recognition

**Option A: ACRCloud**

```typescript
// Environment variables
ACRCLOUD_HOST=identify-us-west-2.acrcloud.com
ACRCLOUD_ACCESS_KEY=xxx
ACRCLOUD_ACCESS_SECRET=xxx

// Usage (simplified)
const formData = new FormData();
formData.append("sample", audioBuffer);
formData.append("access_key", accessKey);
formData.append("signature", computeSignature());

const response = await fetch(`https://${host}/v1/identify`, {
  method: "POST",
  body: formData,
});

const { metadata } = await response.json();
return metadata.music[0];
```

**Option B: ShazamKit (iOS)**

```swift
// On-device recognition
import ShazamKit

let session = SHSession()
session.delegate = self

let audioBuffer = getAudioBuffer(from: audioUrl)
let signature = try SHSignature(dataRepresentation: audioBuffer)

session.match(signature)

// Delegate receives:
func session(_ session: SHSession, didFind match: SHMatch) {
  let song = match.mediaItems.first
  // song.title, song.artist, song.appleMusicURL, etc.
}
```

### Push Notifications (Expo)

```typescript
// Send via Expo's push service
await fetch("https://exp.host/--/api/v2/push/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    to: userPushToken,
    title: "Song Found! 🎵",
    body: `${song.title} by ${song.artist}`,
    data: { jobId },
    sound: "default",
  }),
});
```

### Payments (RevenueCat)

```typescript
// iOS in-app purchases
import Purchases from "react-native-purchases";

Purchases.configure({ apiKey: "revenuecat_api_key" });

// Check subscription status
const { customerInfo } = await Purchases.getCustomerInfo();
const isPro = customerInfo.entitlements.active["pro"] !== undefined;

// Check referral bonus (5 days free)
const hasReferralBonus = user.proExpiresAt && user.proExpiresAt > Date.now();
const effectivelyPro = isPro || hasReferralBonus;

// Purchase subscription
const { customerInfo } = await Purchases.purchasePackage(proPackage);

// Purchase priority processing (one-time)
const { customerInfo } = await Purchases.purchasePackage(priorityPackage);
```

**RevenueCat Products:**
- `clipbeat_pro_monthly` - $4.99/mo subscription
- `clipbeat_priority` - $0.99 one-time (consumable)

---

## Scheduled Jobs (Cron)

### Storage Cleanup (Daily)

Delete temporary files older than 24 hours.

```typescript
// convex/cron.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run daily at 3 AM UTC
crons.daily(
  "cleanup old files",
  { hourUTC: 3, minuteUTC: 0 },
  internal.cleanup.deleteOldFiles
);

// Run hourly to update trending stats
crons.hourly(
  "update trending",
  { minuteUTC: 0 },
  internal.trending.updateWeeklyStats
);

export default crons;
```

```typescript
// convex/cleanup.ts
import { internalMutation } from "./_generated/server";

export const deleteOldFiles = internalMutation({
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Get jobs older than 24h with files
    const oldJobs = await ctx.db
      .query("jobs")
      .filter((q) => 
        q.and(
          q.lt(q.field("createdAt"), oneDayAgo),
          q.or(
            q.neq(q.field("videoFileId"), undefined),
            q.neq(q.field("audioFileId"), undefined),
            q.neq(q.field("strippedAudioFileId"), undefined)
          )
        )
      )
      .take(100); // Process in batches
    
    for (const job of oldJobs) {
      // Delete files from storage
      if (job.videoFileId) {
        await ctx.storage.delete(job.videoFileId);
      }
      if (job.audioFileId) {
        await ctx.storage.delete(job.audioFileId);
      }
      if (job.strippedAudioFileId) {
        await ctx.storage.delete(job.strippedAudioFileId);
      }
      
      // Clear file references
      await ctx.db.patch(job._id, {
        videoFileId: undefined,
        audioFileId: undefined,
        strippedAudioFileId: undefined,
      });
    }
    
    console.log(`Cleaned up files for ${oldJobs.length} jobs`);
  },
});
```

### Trending Stats Update (Hourly)

```typescript
// convex/trending.ts
export const updateWeeklyStats = internalMutation({
  handler: async (ctx) => {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Get all trending entries
    const trendingEntries = await ctx.db.query("trending").collect();
    
    for (const entry of trendingEntries) {
      // Count recognitions in the last week
      const recentSongs = await ctx.db
        .query("songs")
        .withIndex("by_isrc", (q) => q.eq("isrc", entry.isrc))
        .filter((q) => q.gt(q.field("createdAt"), oneWeekAgo))
        .collect();
      
      await ctx.db.patch(entry._id, {
        recognitionsLastWeek: entry.recognitionsThisWeek,
        recognitionsThisWeek: recentSongs.length,
        updatedAt: Date.now(),
      });
    }
  },
});
```

---

## Error Handling

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  backoff: [2000, 4000, 8000], // ms
  retryableErrors: [
    "NETWORK_ERROR",
    "TIMEOUT",
    "RATE_LIMITED",
    "SERVICE_UNAVAILABLE",
  ],
};

async function processWithRetry(jobId: Id<"jobs">) {
  const job = await ctx.db.get(jobId);
  
  try {
    await processJob(job);
  } catch (error) {
    if (shouldRetry(error, job.retryCount)) {
      const delay = RETRY_CONFIG.backoff[job.retryCount];
      await ctx.db.patch(jobId, { 
        retryCount: job.retryCount + 1,
        status: "queued",
      });
      await ctx.scheduler.runAfter(delay, internal.pipeline.process, { jobId });
    } else {
      await ctx.db.patch(jobId, { 
        status: "failed",
        error: error.message,
      });
      await sendFailureNotification(job);
    }
  }
}
```

### Circuit Breaker

For external services, implement circuit breaker pattern:

```typescript
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  state: "closed", // closed, open, half-open
  threshold: 5,
  timeout: 60000, // 1 minute
};

async function callWithCircuitBreaker(fn: () => Promise<any>) {
  if (circuitBreaker.state === "open") {
    if (Date.now() - circuitBreaker.lastFailure > circuitBreaker.timeout) {
      circuitBreaker.state = "half-open";
    } else {
      throw new Error("Circuit breaker open");
    }
  }
  
  try {
    const result = await fn();
    circuitBreaker.failures = 0;
    circuitBreaker.state = "closed";
    return result;
  } catch (error) {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();
    if (circuitBreaker.failures >= circuitBreaker.threshold) {
      circuitBreaker.state = "open";
    }
    throw error;
  }
}
```

---

## Monitoring & Observability

### Logging

```typescript
// Structured logging in Convex actions
console.log(JSON.stringify({
  level: "info",
  event: "job_started",
  jobId,
  userId,
  platform: job.platform,
  timestamp: Date.now(),
}));
```

### Metrics to Track

| Metric | Alert Threshold |
|--------|-----------------|
| Job success rate | < 90% |
| Avg processing time | > 60s |
| Download failure rate | > 10% |
| Recognition failure rate | > 30% |
| API error rate | > 5% |
| Queue depth | > 100 jobs |

### Error Tracking

**Recommended: Sentry**

```typescript
// Install
npm install @sentry/react-native

// Initialize
Sentry.init({
  dsn: "https://xxx@sentry.io/xxx",
  tracesSampleRate: 0.1,
});

// Capture errors
try {
  await processJob(job);
} catch (error) {
  Sentry.captureException(error, {
    extra: { jobId, userId, platform },
  });
  throw error;
}
```

---

## Deep Links Implementation

### URL Scheme

```json
// app.json
{
  "expo": {
    "scheme": "clipbeat",
    "ios": {
      "associatedDomains": ["applinks:clipbeat.app"]
    }
  }
}
```

### Supported Deep Links

| Link | Action |
|------|--------|
| `clipbeat://job/[id]` | Open job detail screen |
| `clipbeat://trending` | Open trending tab |
| `clipbeat://paste?url=[url]` | Pre-fill paste URL screen |
| `https://clipbeat.app/r/[code]` | Referral link (universal link) |

### Handling in App

```typescript
// app/_layout.tsx
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { router } from 'expo-router';

export default function RootLayout() {
  useEffect(() => {
    // Handle deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });
    
    // Handle initial URL (app opened from link)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    
    return () => subscription.remove();
  }, []);
  
  function handleDeepLink(url: string) {
    const parsed = Linking.parse(url);
    
    if (parsed.path === 'job' && parsed.queryParams?.id) {
      router.push(`/job/${parsed.queryParams.id}`);
    } else if (parsed.path === 'trending') {
      router.push('/(tabs)/trending');
    } else if (parsed.path === 'paste' && parsed.queryParams?.url) {
      router.push(`/paste?url=${encodeURIComponent(parsed.queryParams.url)}`);
    } else if (parsed.hostname === 'clipbeat.app' && parsed.path?.startsWith('/r/')) {
      const referralCode = parsed.path.replace('/r/', '');
      handleReferral(referralCode);
    }
  }
}
```

### Push Notification Data

```typescript
// When sending push notification
await sendExpoPushNotification(pushToken, {
  title: "Song Found! 🎵",
  body: `${song.title} by ${song.artist}`,
  data: {
    url: `clipbeat://job/${jobId}`, // Deep link
    jobId: jobId,
    type: "job_complete",
  },
});

// When handling notification tap
Notifications.addNotificationResponseReceivedListener((response) => {
  const url = response.notification.request.content.data?.url;
  if (url) {
    Linking.openURL(url);
  }
});
```

---

## Offline Queue Implementation

### Local Storage (AsyncStorage)

```typescript
// lib/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'clipbeat_offline_queue';

interface QueuedUrl {
  url: string;
  savedAt: number;
}

export async function addToOfflineQueue(url: string) {
  const queue = await getOfflineQueue();
  queue.push({ url, savedAt: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getOfflineQueue(): Promise<QueuedUrl[]> {
  const data = await AsyncStorage.getItem(QUEUE_KEY);
  return data ? JSON.parse(data) : [];
}

export async function clearOfflineQueue() {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// Process queue when back online
export function setupOfflineQueueProcessor(createJob: (url: string) => Promise<void>) {
  NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const queue = await getOfflineQueue();
      
      if (queue.length > 0) {
        for (const item of queue) {
          try {
            await createJob(item.url);
          } catch (e) {
            console.error('Failed to process queued URL:', e);
          }
        }
        await clearOfflineQueue();
      }
    }
  });
}
```

### Usage in Share Handler

```typescript
// When receiving share intent
async function handleShareIntent(url: string) {
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    await addToOfflineQueue(url);
    showToast("Saved! We'll process when you're back online 📶");
    return;
  }
  
  // Normal flow
  const jobId = await createJob({ sourceUrl: url });
  showToast("Got it! We're on it 🎵");
}
```

---

## Security Considerations

### Data Privacy

- **Video content:** Only temporarily stored during processing, deleted after 24h via cron
- **Audio files:** Same as video
- **User data:** Minimal - email, subscription status, referral code
- **No PII from social platforms:** We only access public video URLs
- **Trending data:** Aggregated and anonymized (no user association)

### API Security

- All external API keys stored in Convex environment variables
- Never exposed to client
- Rate limiting on job creation (per authenticated user)
- Clerk JWT validation on every Convex request

### Authentication

- Clerk handles all auth flows
- Apple Sign-In required (App Store compliance)
- Google Sign-In optional
- JWT validation on every Convex request
- No password storage

### Rate Limiting Strategy

```typescript
// Per-user limits (enforced in createJob mutation)
const LIMITS = {
  FREE_FIRST_DAY: Infinity,  // Unlimited on signup day
  FREE_DAILY: 3,             // After first day
  PRO: Infinity,             // Unlimited for Pro
};

// Anti-abuse measures
// 1. Only authenticated users can create jobs
// 2. Device fingerprinting via Clerk (optional)
// 3. Monitor for suspicious patterns (many accounts, same IP)
// 4. Manual review for high-volume users
```

### App Store Compliance

- Apple Sign-In required ✓
- Privacy policy required (need to create)
- No tracking without consent (App Tracking Transparency not needed - no third-party tracking)

---

## Scaling Considerations

### Current Architecture Limits

| Component | Limit | Mitigation |
|-----------|-------|------------|
| Convex Actions | 10 min timeout | Sufficient for pipeline |
| Convex Scheduler | 1000 pending | Add queue batching if needed |
| Replicate | Rate limits | Add multiple accounts |
| ACRCloud | 500 free/day | Upgrade plan or add ShazamKit |

### Future Scaling Path

1. **10k users:** Current architecture works fine
2. **100k users:** 
   - Add Redis queue for job management
   - Self-host Demucs on GPU cluster
   - Multiple ACRCloud accounts or ShazamKit
3. **1M users:**
   - Dedicated infrastructure
   - CDN for audio file delivery
   - Regional processing nodes

---

## Development Workflow

### Local Development

```bash
# Terminal 1: Convex backend
npx convex dev

# Terminal 2: Expo app
npx expo start

# For share extension testing
npx expo prebuild
npx expo run:ios
```

### Testing

```bash
# Unit tests
npm test

# E2E tests (Detox)
npm run e2e:ios
```

### Deployment

```bash
# Deploy Convex backend
npx convex deploy

# Build iOS app
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

---

## Cost Projections

### Per-Job Cost

| Service | Cost |
|---------|------|
| Video download (Apify) | $0.01 |
| Vocal removal (Replicate) | $0.005 |
| Music recognition (ACRCloud) | $0.002 |
| **Total per job** | **~$0.017** |

### Monthly Infrastructure

| Service | Free Tier | Paid Estimate |
|---------|-----------|---------------|
| Convex | 1M function calls | $25/mo |
| Clerk | 10k MAU | $25/mo |
| Sentry | 5k errors | Free |
| Expo EAS | 30 builds/mo | Free |
| **Total fixed** | - | **~$50/mo** |

### Break-even Analysis

At $4.99/mo subscription:
- After payment processor fees (~30%): $3.49/user
- Fixed costs: $50/mo
- Variable cost: $0.017/job × ~30 jobs/user = $0.51/user

**Break-even: ~20 paying users**

### Projections

| Users | Jobs/mo | Variable Cost | Fixed Cost | Revenue | Profit |
|-------|---------|---------------|------------|---------|--------|
| 100 | 3,000 | $51 | $50 | $350* | $249 |
| 1,000 | 30,000 | $510 | $50 | $3,500* | $2,940 |
| 10,000 | 300,000 | $5,100 | $100 | $35,000* | $29,800 |

*Assuming 10% conversion to Pro
