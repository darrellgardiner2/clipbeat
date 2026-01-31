# Convex Implementation Guide

## File Structure

```
convex/
├── schema.ts           # Database schema (tables + indexes)
├── jobs.ts             # Public queries & mutations (app-facing)
├── pipeline.ts         # Internal actions (background processing)
├── notifications.ts    # Push notification helpers
├── http.ts             # HTTP endpoints (webhooks, etc.)
└── _generated/         # Auto-generated types
```

## Architecture Decisions

### 1. Why Internal Actions for Pipeline?

The processing pipeline uses `internalAction` because:
- Long-running (10-60 seconds total)
- Makes external HTTP calls (Replicate, ACRCloud)
- Needs retry logic on failure
- Shouldn't block the user's request

The user calls `createJob` mutation → returns immediately with job ID → pipeline runs async.

### 2. Status Updates for Real-time UI

Each pipeline step updates the job status:
```
queued → downloading → extracting_audio → removing_vocals → identifying → completed
```

The React app subscribes to the job with `useQuery(api.jobs.getJob, { jobId })` and gets live updates as status changes.

### 3. File Storage Strategy

Using Convex's built-in file storage (`ctx.storage.store()`) for:
- Downloaded videos (temporary)
- Extracted audio (temporary)
- Vocal-stripped audio (keep for potential re-identification)

Files can be cleaned up with a scheduled job after 24 hours.

### 4. Retry Logic

Jobs retry up to 3 times with exponential backoff:
- Retry 1: 2 seconds
- Retry 2: 4 seconds
- Retry 3: 8 seconds

After 3 failures, job is marked as `failed` and user is notified.

### 5. Priority Queue

Pro users and queue-skip purchases get `priority: "high"`.

When picking the next job to process, query with:
```typescript
.withIndex("by_status_and_priority", (q) => 
  q.eq("status", "queued")
)
.order("desc") // high priority first, then by createdAt
```

## Missing Pieces to Implement

### 1. Video Download Service

You need one of:

**Option A: Apify Actor**
```typescript
const response = await fetch(
  `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`,
    },
    body: JSON.stringify({
      directUrls: [url],
    }),
  }
);
```

**Option B: Self-hosted** (see github.com/Okramjimmy/Instagram-reels-downloader)

**Option C: Use yt-dlp** on a serverless function (Railway, Fly.io)

### 2. Audio Extraction Service

For MVP, you can chain this in the same service as download:
1. Download video with yt-dlp
2. Extract audio with ffmpeg: `ffmpeg -i video.mp4 -vn -acodec libmp3lame audio.mp3`
3. Return audio URL

Or use a cloud function that takes a video URL and returns audio URL.

### 3. ShazamKit Integration (Better Option)

Since Shazam beat ACRCloud in your test, consider:

**Option A: iOS On-device Recognition**
- Send audio to iOS app
- Use ShazamKit SDK
- Return results to Convex

**Option B: Mac Mini Backend with ShazamKit**
- Run a Mac Mini with your backend
- Use ShazamKit's macOS APIs
- Free, unlimited, most accurate

This would replace ACRCloud/AudD entirely.

### 4. Cleanup Scheduled Job

Add a cron job to clean old files:

```typescript
// convex/cron.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "cleanup old files",
  { hourUTC: 3, minuteUTC: 0 },
  internal.cleanup.deleteOldFiles
);

export default crons;
```

## Testing Locally

1. Set up Convex project: `npx convex dev`
2. Add environment variables in Convex dashboard
3. Test mutations in Convex dashboard's "Functions" tab
4. Watch logs in real-time for debugging

## Deployment Checklist

- [ ] Set all environment variables in Convex dashboard
- [ ] Deploy: `npx convex deploy`
- [ ] Test with a real Instagram reel URL
- [ ] Verify push notifications work
- [ ] Set up Clerk authentication
- [ ] Connect iOS app with `ConvexProvider`
