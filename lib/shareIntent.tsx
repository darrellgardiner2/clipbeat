import { useMutation } from "convex/react";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";

const URL_PATTERNS = [
  /instagram\.com\/(reel|p)\//i,
  /instagr\.am\/(reel|p)\//i,
  /tiktok\.com\/@[\w.-]+\/video\//i,
  /vm\.tiktok\.com\//i,
  /youtube\.com\/shorts\//i,
  /youtu\.be\//i,
];

function isValidUrl(url: string): boolean {
  return URL_PATTERNS.some((p) => p.test(url));
}

function extractUrl(text: string): string | null {
  const urlMatch = text.match(
    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/
  );
  return urlMatch ? urlMatch[0] : null;
}

export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const createJob = useMutation(api.jobs.createJob);
  const router = useRouter();

  useEffect(() => {
    if (!hasShareIntent || !shareIntent) return;

    const url = shareIntent.webUrl ?? extractUrl(shareIntent.text ?? "");
    if (!url || !isValidUrl(url)) {
      resetShareIntent();
      router.replace("/paste");
      return;
    }

    let cancelled = false;

    createJob({ sourceUrl: url })
      .then((result) => {
        if (!cancelled) {
          resetShareIntent();
          router.replace(`/job/${result.jobId}`);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          resetShareIntent();
          if (err?.message?.includes("authenticated")) {
            router.replace("/sign-in");
          } else {
            router.replace("/paste");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasShareIntent, shareIntent, createJob, router, resetShareIntent]);

  return null;
}

export function ShareIntentProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShareIntentProvider>{children}</ShareIntentProvider>;
}
