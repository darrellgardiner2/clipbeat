/**
 * Video download: yt-dlp service (primary), Apify (fallback).
 * Audio extraction: via download service or ConvertAPI when we have video only.
 */

const APIFY_BASE = "https://api.apify.com/v2";

type Platform = "instagram" | "tiktok" | "youtube" | "unknown";

export interface DownloadResult {
  audioUrl: string;
  videoUrl?: string;
  title?: string;
  duration?: number;
  source: "yt-dlp" | "apify";
}

function isRateLimitError(err: unknown): boolean {
  const msg = String(err);
  return (
    /rate.?limit|429|too many requests|blocked|ip.?blocked/i.test(msg) ||
    msg.includes("RATE_LIMITED")
  );
}

export async function downloadVideo(
  url: string,
  platform: Platform
): Promise<DownloadResult> {
  const ytDlpUrl = process.env.YT_DLP_SERVICE_URL;
  const ytDlpKey = process.env.YT_DLP_API_KEY;
  const apifyToken = process.env.APIFY_API_TOKEN;

  if (ytDlpUrl && ytDlpKey) {
    try {
      const res = await fetch(`${ytDlpUrl}/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ytDlpKey}`,
        },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (isRateLimitError(err) || res.status === 429) {
          throw new Error("RATE_LIMITED");
        }
        throw new Error(err.message || `yt-dlp: ${res.status}`);
      }
      const data = (await res.json()) as {
        audioUrl?: string;
        audioPath?: string;
        videoUrl?: string;
        title?: string;
        duration?: number;
      };
      const audioUrl = data.audioUrl ?? data.audioPath;
      if (!audioUrl) throw new Error("yt-dlp returned no audio");
      return {
        audioUrl,
        videoUrl: data.videoUrl,
        title: data.title,
        duration: data.duration,
        source: "yt-dlp",
      };
    } catch (e) {
      if (isRateLimitError(e) || String(e).includes("RATE_LIMITED")) {
        if (apifyToken) {
          return downloadWithApify(url, platform, apifyToken);
        }
      }
      throw e;
    }
  }

  if (apifyToken) {
    return downloadWithApify(url, platform, apifyToken);
  }

  throw new Error(
    "No download service configured. Set YT_DLP_SERVICE_URL or APIFY_API_TOKEN."
  );
}

async function downloadWithApify(
  url: string,
  platform: Platform,
  token: string
): Promise<DownloadResult> {
  const actorId = getApifyActor(platform);
  const runRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(getApifyInput(url, platform)),
  });
  if (!runRes.ok) {
    const err = await runRes.text();
    throw new Error(`Apify run failed: ${err}`);
  }
  const run = (await runRes.json()) as { data: { id: string } };
  const runId = run.data.id;

  let attempts = 0;
  const maxAttempts = 60;
  while (attempts < maxAttempts) {
    await sleep(2000);
    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
    );
    const status = (await statusRes.json()) as { data: { status: string } };
    if (status.data.status === "SUCCEEDED") break;
    if (status.data.status === "FAILED") {
      throw new Error("Apify actor failed");
    }
    attempts++;
  }
  if (attempts >= maxAttempts) throw new Error("Apify timeout");

  const itemsRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}`
  );
  const items = (await itemsRes.json()) as Record<string, unknown>[];
  const first = items?.[0];
  if (!first) throw new Error("Apify returned no items");

  const audioUrl =
    (first.audioUrl as string) ??
    (first.audio as string) ??
    (first.audioLink as string);
  const videoUrl =
    (first.videoUrl as string) ??
    (first.video as string) ??
    (first.url as string) ??
    (first.downloadUrl as string);

  const resultUrl = audioUrl ?? videoUrl;
  if (!resultUrl) throw new Error("Apify returned no audio or video URL");

  let finalAudioUrl = audioUrl;
  if (!finalAudioUrl && videoUrl) {
    finalAudioUrl = await extractAudioFromVideo(videoUrl);
  }
  if (!finalAudioUrl) throw new Error("Could not obtain audio");

  return {
    audioUrl: finalAudioUrl,
    videoUrl: videoUrl || undefined,
    title: (first.title as string) ?? (first.caption as string),
    duration: (first.duration as number) ?? (first.durationSeconds as number),
    source: "apify",
  };
}

function getApifyActor(platform: Platform): string {
  switch (platform) {
    case "youtube":
      return "streamers~youtube-video-downloader";
    case "instagram":
      return "apilabs~instagram-downloader";
    case "tiktok":
      return "epctex~tiktok-video-downloader";
    default:
      return "streamers~youtube-video-downloader";
  }
}

function getApifyInput(url: string, platform: Platform): Record<string, unknown> {
  switch (platform) {
    case "youtube":
      return { startUrls: [{ url }], format: "mp3" };
    case "instagram":
      return { directUrls: [url] };
    case "tiktok":
      return { startUrls: [{ url }] };
    default:
      return { startUrls: [{ url }] };
  }
}

async function extractAudioFromVideo(videoUrl: string): Promise<string> {
  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) {
    throw new Error(
      "Video URL but no audio. Set CONVERTAPI_SECRET for video-to-audio extraction."
    );
  }
  const res = await fetch(
    `https://v2.convertapi.com/convert/mp4/to/mp3?Secret=${secret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Parameters: [
          { Name: "File", FileValue: { Name: "video.mp4", Url: videoUrl } },
        ],
      }),
    }
  );
  if (!res.ok) throw new Error(`ConvertAPI failed: ${res.status}`);
  const data = (await res.json()) as {
    Files?: { FileName?: string; Url?: string }[];
  };
  const file = data.Files?.[0];
  if (!file?.Url) throw new Error("ConvertAPI returned no audio");
  return file.Url;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
