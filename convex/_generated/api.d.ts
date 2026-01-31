/* eslint-disable */
/**
 * Generated API types for Convex.
 * Run `npx convex dev` to regenerate.
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as jobs from "../jobs";
import type * as pipeline from "../pipeline";
import type * as notifications from "../notifications";

declare const fullApi: ApiFromModules<{
  jobs: typeof jobs;
  pipeline: typeof pipeline;
  notifications: typeof notifications;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
