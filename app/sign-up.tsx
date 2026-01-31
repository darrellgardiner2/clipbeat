import {
  useSignInWithApple,
  useSSO,
} from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/constants/theme";

export default function SignUpScreen() {
  const router = useRouter();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const { startSSOFlow } = useSSO();

  const handleAppleSignUp = async () => {
    try {
      const { createdSessionId, setActive } =
        await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err) {
      console.error("Apple sign up error:", err);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err) {
      console.error("Google sign up error:", err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an account</Text>
      <Text style={styles.subtitle}>
        Sign up to save your detection history and get unlimited finds
      </Text>

      {Platform.OS === "ios" && (
        <Pressable style={styles.appleButton} onPress={handleAppleSignUp}>
          <Text style={styles.appleButtonText}>Sign up with Apple</Text>
        </Pressable>
      )}

      <Pressable style={styles.googleButton} onPress={handleGoogleSignUp}>
        <Text style={styles.googleButtonText}>Sign up with Google</Text>
      </Pressable>

      <Pressable
        style={styles.skipButton}
        onPress={() => router.replace("/(tabs)")}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    marginBottom: theme.spacing.xl,
  },
  appleButton: {
    backgroundColor: "#fff",
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  appleButtonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
  googleButton: {
    backgroundColor: theme.colors.bgElevated,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  googleButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
    fontSize: 16,
  },
  skipButton: {
    padding: theme.spacing.md,
    alignItems: "center",
  },
  skipButtonText: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
});
