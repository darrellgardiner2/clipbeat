/**
 * Pluggable audio separation via Replicate Demucs.
 * Output: accompaniment (instrumental) for recognition when vocals obscure music.
 */

const DEMUCS_VERSION =
  "25a173108cff36ef9f80f854c162d01df9e6528be175794b81571f6ae71f64fd";

export interface SeparationResult {
  accompanimentUrl: string;
  processingTimeMs: number;
}

export async function separateAudio(
  audioUrl: string
): Promise<SeparationResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("REPLICATE_API_TOKEN not set");
  }

  const start = Date.now();
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({
      version: DEMUCS_VERSION,
      input: {
        audio: audioUrl,
        stems: "vocals",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate Demucs failed: ${err}`);
  }

  const pred = (await res.json()) as { id: string; urls: { get: string } };
  let pollResult: { status: string; output?: unknown; error?: string } | null =
    null;
  let attempts = 0;
  const maxAttempts = 120;

  while (attempts < maxAttempts) {
    await sleep(2000);
    const pollRes = await fetch(pred.urls.get, {
      headers: { Authorization: `Token ${token}` },
    });
    pollResult = (await pollRes.json()) as {
      status: string;
      output?: unknown;
      error?: string;
    };
    if (pollResult.status === "succeeded") break;
    if (pollResult.status === "failed") {
      throw new Error(pollResult.error ?? "Demucs failed");
    }
    attempts++;
  }

  if (attempts >= maxAttempts || !pollResult) throw new Error("Demucs timeout");

  const output = pollResult.output;
  const obj = typeof output === "object" && output !== null ? output : {};
  const accompanimentUrl =
    typeof output === "string"
      ? output
      : (obj as Record<string, string>).accompaniment ??
        (obj as Record<string, string>).no_vocals ??
        (obj as Record<string, string>).instrumental ??
        (obj as Record<string, string>).other;

  if (!accompanimentUrl) {
    throw new Error("Demucs returned no accompaniment");
  }

  return {
    accompanimentUrl,
    processingTimeMs: Date.now() - start,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
