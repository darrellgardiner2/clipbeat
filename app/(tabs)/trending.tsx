import { useQuery } from "convex/react";
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { theme } from "@/constants/theme";

export default function TrendingScreen() {
  const trending = useQuery(api.jobs.getTrending, { limit: 20 });

  if (trending === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  if (trending.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No trending songs yet</Text>
        <Text style={styles.emptySubtitle}>
          Start identifying songs to see what others are finding
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={trending as Array<{ _id: string; title: string; artist: string; recognitionsThisWeek: number; spotifyUrl?: string; appleMusicUrl?: string; youtubeUrl?: string }>}
      keyExtractor={(item: { _id: string }) => item._id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => {
            const url = item.spotifyUrl ?? item.appleMusicUrl ?? item.youtubeUrl;
            if (url) Linking.openURL(url);
          }}
        >
          <View style={styles.cardContent}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist}
            </Text>
            <Text style={styles.count}>
              {item.recognitionsThisWeek} finds this week
            </Text>
          </View>
        </Pressable>
      )}
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
    textAlign: "center",
  },
  list: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  card: {
    backgroundColor: theme.colors.bgElevated,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  cardContent: {
    flex: 1,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  artist: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  count: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.xs,
  },
});
