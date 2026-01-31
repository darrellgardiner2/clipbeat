import { useMutation } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "@/convex/_generated/api";
import { theme } from "@/constants/theme";

const URL_PATTERNS = [
  /instagram\.com\/(reel|p)\//i,
  /instagr\.am\/(reel|p)\//i,
  /tiktok\.com\/@[\w.-]+\/video\//i,
  /vm\.tiktok\.com\//i,
  /youtube\.com\/shorts\//i,
  /youtu\.be\//i,
];

function isValidUrl(url: string): boolean {
  return URL_PATTERNS.some((pattern) => pattern.test(url));
}

export default function PasteScreen() {
  const router = useRouter();
  const createJob = useMutation(api.jobs.createJob);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pasteFromClipboard = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setUrl(text.trim());
  }, []);

  useEffect(() => {
    pasteFromClipboard();
  }, [pasteFromClipboard]);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a URL");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError("Enter a valid Instagram, TikTok, or YouTube Shorts URL");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await createJob({ sourceUrl: trimmed });
      router.replace(`/job/${result.jobId}`);
      if (result.cached) {
        // Cached result - job detail will show immediately
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      if (message.includes("authenticated")) {
        router.replace("/sign-in");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Paste a reel URL</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null]}
        value={url}
        onChangeText={(text) => {
          setUrl(text);
          setError(null);
        }}
        placeholder="https://instagram.com/reel/..."
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.buttons}>
        <Pressable
          style={[styles.pasteButton, loading && styles.buttonDisabled]}
          onPress={pasteFromClipboard}
          disabled={loading}
        >
          <Text style={styles.pasteButtonText}>Paste from clipboard</Text>
        </Pressable>

        <Pressable
          style={[
            styles.submitButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Processing..." : "Find Song"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Supports Instagram Reels, TikTok, and YouTube Shorts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.bgSubtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.bgElevated,
    marginBottom: theme.spacing.sm,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  error: {
    color: theme.colors.error,
    fontSize: 14,
    marginBottom: theme.spacing.md,
  },
  buttons: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  pasteButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    backgroundColor: theme.colors.bgElevated,
  },
  pasteButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  submitButton: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: "center",
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.xl,
  },
});
