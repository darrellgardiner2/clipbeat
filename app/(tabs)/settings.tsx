import { useAuth, useUser } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { theme } from "@/constants/theme";

export default function SettingsScreen() {
  const { signOut, isSignedIn } = useAuth();
  const { user } = useUser();
  const stats = useQuery(api.jobs.getMyStats);
  const router = useRouter();

  if (!isSignedIn) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Pressable
          style={styles.button}
          onPress={() => router.push("/sign-in")}
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {stats && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Remaining today</Text>
            <Text style={styles.statValue}>
              {stats.remainingToday === Infinity
                ? "Unlimited"
                : stats.remainingToday}
            </Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Tier</Text>
            <Text style={styles.statValue}>
              {stats.effectivelyPro ? "Pro" : "Free"}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
      </View>

      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: theme.spacing.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bgSubtle,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "500",
  },
  email: {
    color: theme.colors.textPrimary,
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
  signOutButton: {
    padding: theme.spacing.md,
    alignItems: "center",
    marginTop: theme.spacing.xl,
  },
  signOutText: {
    color: theme.colors.error,
    fontSize: 16,
  },
});
