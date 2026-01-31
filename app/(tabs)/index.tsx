import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

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

export default function HistoryScreen() {
  const jobs = useQuery(api.jobs.listMyJobs, { limit: 50 });
  const router = useRouter();

  if (jobs === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  if (jobs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Your finds will show up here</Text>
        <Text style={styles.emptySubtitle}>
          Share a reel from Instagram or TikTok to get started
        </Text>
        <Pressable
          style={styles.pasteButton}
          onPress={() => router.push("/paste")}
        >
          <Text style={styles.pasteButtonText}>Paste URL</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={jobs as Array<{ _id: string; status: string; platform: string; songs?: Array<{ title: string; artist: string }> }>}
      keyExtractor={(item: { _id: string }) => item._id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const song = item.songs?.[0];
        const statusColor =
          item.status === "completed"
            ? theme.colors.success
            : item.status === "failed"
              ? theme.colors.error
              : theme.colors.textSecondary;

        return (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/job/${item._id}`)}
          >
            <View style={styles.cardContent}>
              <Text style={styles.platform}>
                {item.platform === "instagram"
                  ? "Instagram"
                  : item.platform === "tiktok"
                    ? "TikTok"
                    : item.platform === "youtube"
                      ? "YouTube"
                      : "Video"}
              </Text>
              <Text style={styles.songTitle} numberOfLines={1}>
                {song
                  ? `${song.title} – ${song.artist}`
                  : statusLabels[item.status] ?? item.status}
              </Text>
              <Text style={[styles.status, { color: statusColor }]}>
                {item.status === "completed" && song
                  ? "Tap to open"
                  : statusLabels[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xl,
  },
  loading: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginBottom: theme.spacing.xl,
    textAlign: "center",
  },
  pasteButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  pasteButtonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    flex: 1,
  },
  platform: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 2,
  },
  songTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  status: {
    fontSize: 13,
    marginTop: 2,
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 24,
    marginLeft: theme.spacing.sm,
  },
});
