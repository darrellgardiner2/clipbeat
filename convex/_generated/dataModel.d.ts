/* eslint-disable */
/**
 * Generated data model types for Convex.
 * Run `npx convex dev` to regenerate.
 */

import type { GenericId } from "convex/values";

export type TableNames =
  | "users"
  | "jobs"
  | "songs"
  | "trending"
  | "referrals"
  | "priorityPurchases"
  | "offlineQueue";

export type Id<TableName extends TableNames = TableNames> =
  GenericId<TableName>;

export type DataModel = {
  users: { table: "users"; document: Record<string, unknown> };
  jobs: { table: "jobs"; document: Record<string, unknown> };
  songs: { table: "songs"; document: Record<string, unknown> };
  trending: { table: "trending"; document: Record<string, unknown> };
  referrals: { table: "referrals"; document: Record<string, unknown> };
  priorityPurchases: { table: "priorityPurchases"; document: Record<string, unknown> };
  offlineQueue: { table: "offlineQueue"; document: Record<string, unknown> };
};
