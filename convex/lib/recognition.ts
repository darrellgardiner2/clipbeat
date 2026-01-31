/**
 * ACRCloud music recognition (server-side fallback).
 * ShazamKit runs on-device in the iOS app - this is for when that fails.
 */

export interface RecognizedSong {
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
  recognitionService: "acrcloud";
}

export async function identifyWithACRCloud(
  audioUrl: string
): Promise<RecognizedSong[]> {
  const host = process.env.ACRCLOUD_HOST;
  const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
  const accessSecret = process.env.ACRCLOUD_ACCESS_SECRET;

  if (!host || !accessKey || !accessSecret) {
    return [];
  }

  const audioRes = await fetch(audioUrl);
  const audioBuffer = await audioRes.arrayBuffer();
  const timestamp = Math.floor(Date.now() / 1000);
  const stringToSign = [
    "POST",
    "/v1/identify",
    accessKey,
    "audio",
    "1",
    timestamp,
  ].join("\n");

  const signature = await hmacSha1(stringToSign, accessSecret);

  const form = new FormData();
  form.append("sample", new Blob([audioBuffer]), "audio.mp3");
  form.append("access_key", accessKey);
  form.append("data_type", "audio");
  form.append("signature_version", "1");
  form.append("signature", signature);
  form.append("timestamp", timestamp.toString());
  form.append("sample_bytes", audioBuffer.byteLength.toString());

  const res = await fetch(`https://${host}/v1/identify`, {
    method: "POST",
    body: form,
  });

  const data = (await res.json()) as {
    status?: { code?: number };
    metadata?: { music?: Array<{
      title?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string; cover?: string };
      release_date?: string;
      duration_ms?: number;
      external_ids?: { isrc?: string };
      external_metadata?: {
        spotify?: { track?: { id?: string } };
        apple_music?: { url?: string };
        youtube?: { vid?: string };
      };
      score?: number;
      play_offset_ms?: number;
    }> };
  };

  if (data.status?.code !== 0 || !data.metadata?.music?.length) {
    return [];
  }

  return data.metadata.music.map((track, i) => ({
    title: track.title ?? "Unknown",
    artist: track.artists?.[0]?.name ?? "Unknown",
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
    confidence: track.score ?? 80,
    matchedAtSeconds: track.play_offset_ms
      ? track.play_offset_ms / 1000
      : i * 10,
    recognitionService: "acrcloud" as const,
  }));
}

async function hmacSha1(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(message)
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
