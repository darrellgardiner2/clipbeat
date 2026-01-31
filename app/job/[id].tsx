import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { theme } from "@/constants/theme";

const statusLabels: Record<string, string> = {
  queued: "Queued",
  downloading: "Downloading...",
  extracting_audio: "Extracting audio...",
  recognizing_original: "Identifying...",
  removing_vocals: "Removing vocals...",
  recognizing_stripped: "Identifying...",
  segment_analysis: "Analyzing...",
  completed: "Found",
  failed: "Failed",
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const job = useQuery(
    api.jobs.getJob,
    id ? { jobId: id as Id<"jobs"> } : "skip"
  );

  if (job === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  if (job === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Job not found</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const j = job as { status: string; platform: string; error?: string; songs?: Array<{ title: string; artist: string; spotifyUrl?: string; appleMusicUrl?: string; youtubeUrl?: string }> };
  const song = j.songs?.[0];
  const isComplete = j.status === "completed";
  const isFailed = j.status === "failed";

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <Text style={styles.platform}>
          {j.platform === "instagram"
            ? "Instagram"
            : j.platform === "tiktok"
              ? "TikTok"
              : j.platform === "youtube"
                ? "YouTube"
                : "Video"}
        </Text>
        <Text style={styles.status}>
          {statusLabels[j.status] ?? j.status}
        </Text>
        {j.error && (
          <Text style={styles.errorText}>{j.error}</Text>
        )}
      </View>

      {song && (
        <View style={styles.resultCard}>
          <Text style={styles.songTitle}>{song.title}</Text>
          <Text style={styles.artist}>{song.artist}</Text>

          <View style={styles.links}>
            {song.spotifyUrl && (
              <Pressable
                style={[styles.linkButton, { backgroundColor: theme.colors.spotify }]}
                onPress={() => Linking.openURL(song.spotifyUrl!)}
              >
                <Text style={styles.linkButtonText}>Spotify</Text>
              </Pressable>
            )}
            {song.appleMusicUrl && (
              <Pressable
                style={[styles.linkButton, { backgroundColor: theme.colors.appleMusic }]}
                onPress={() => Linking.openURL(song.appleMusicUrl!)}
              >
                <Text style={styles.linkButtonText}>Apple Music</Text>
              </Pressable>
            )}
            {song.youtubeUrl && (
              <Pressable
                style={[styles.linkButton, { backgroundColor: theme.colors.youtube }]}
                onPress={() => Linking.openURL(song.youtubeUrl!)}
              >
                <Text style={styles.linkButtonText}>YouTube</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {isFailed && (
        <Pressable
          style={styles.pasteButton}
          onPress={() => router.push("/paste")}
        >
          <Text style={styles.pasteButtonText}>Try with a different clip</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loading: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  error: {
    color: theme.colors.error,
    fontSize: 16,
    marginBottom: theme.spacing.md,
  },
  statusCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  platform: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  status: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "600",
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
    marginTop: theme.spacing.sm,
  },
  resultCard: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  songTitle: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  artist: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    marginBottom: theme.spacing.lg,
  },
  links: {
    gap: theme.spacing.sm,
  },
  linkButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  linkButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    marginTop: theme.spacing.lg,
  },
  buttonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
  pasteButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    marginTop: theme.spacing.lg,
  },
  pasteButtonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
});
