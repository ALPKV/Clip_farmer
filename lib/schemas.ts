import { z } from "zod";
import { CATEGORY_KEYS } from "./domain";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

export const Details = z
  .record(z.string().max(40), z.union([z.string().max(300), z.number(), z.boolean()]))
  .refine((d) => Object.keys(d).length <= 20, "too many fields");

export const Completion = z.object({
  duration_min: z.number().int().min(1).max(600),
  rpe: z.number().int().min(1).max(10),
  reflection: z.string().trim().max(2000),
  completed_at: z.iso.datetime({ offset: true }),
  details: Details.optional(),
});

export const NewPractice = z.object({
  date: isoDate,
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]),
  title: z.string().trim().max(120).default(""),
  planned_minutes: z.number().int().min(1).max(600).nullable().default(null),
  intent: z.string().trim().min(3, "write your intent for the session").max(1000),
  details: Details.default({}),
  completion: Completion.nullable().default(null),
});

export const Match = z.object({
  date: isoDate,
  opponent: z.string().trim().max(120).default(""),
  format: z.enum(["T20", "One-day", "Multi-day", "T10", "Other"]),
  batted: z.boolean(),
  runs: z.number().int().min(0).max(1000).default(0),
  balls_faced: z.number().int().min(0).max(2000).default(0),
  not_out: z.boolean().default(false),
  dismissal: z.string().trim().max(40).default(""),
  dismissal_error: z.string().trim().max(500).default(""),
  balls_bowled: z.number().int().min(0).max(600).default(0),
  runs_conceded: z.number().int().min(0).max(600).default(0),
  wickets: z.number().int().min(0).max(10).default(0),
  notes: z.string().trim().max(2000).default(""),
});

export const InventoryInput = z.object({
  kind: z.enum(["strength", "weakness"]),
  pillar: z.enum(["physical", "technical", "mental", "tactical"]),
  text: z.string().trim().min(2).max(300),
});

export const GoalInput = z.object({
  title: z.string().trim().min(2).max(120),
  metric: z.enum(["runs", "wickets", "practice_hours", "sessions", "custom"]),
  unit: z.string().trim().max(20).default(""),
  target: z.number().positive().max(1_000_000),
  baseline: z.number().min(0).max(1_000_000).default(0),
  season_start: isoDate,
  season_end: isoDate,
});

export const CarbInput = z.object({
  date: isoDate,
  meal: z.string().trim().min(1).max(120),
  carbs_g: z.number().min(0).max(1000),
  timing: z.enum(["pre", "during", "post", "meal", "snack"]),
});

export const DeliveryInput = z.object({
  date: isoDate,
  speed_kmh: z.number().min(10).max(200).nullable(),
  length_m: z.number().min(0).max(25).nullable(),
  line_cm: z.number().min(-500).max(500).nullable(),
  video_name: z.string().max(200).default(""),
  clip_time: z.number().min(0).nullable().default(null),
  method: z.string().max(60).default(""),
});
