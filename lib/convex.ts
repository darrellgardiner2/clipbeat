import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://placeholder.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);
