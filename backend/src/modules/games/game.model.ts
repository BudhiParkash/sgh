import { Schema, model } from "mongoose";

const gameSchema = new Schema(
  {
    key: { type: String, required: true, enum: ["bgmi", "pubg-mobile"] },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    publisher: { type: String }, // factual reference only — no affiliation implied
    platforms: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
gameSchema.index({ key: 1 }, { unique: true });
gameSchema.index({ slug: 1 }, { unique: true });

export const GameModel = model("Game", gameSchema, "games");

export const DEFAULT_GAMES = [
  { key: "bgmi", name: "BGMI", slug: "bgmi", publisher: "KRAFTON", platforms: ["android", "ios"] },
  { key: "pubg-mobile", name: "PUBG Mobile", slug: "pubg-mobile", publisher: "Tencent Games / KRAFTON", platforms: ["android", "ios"] },
] as const;

export function toGameRef(g: unknown): { key: "bgmi" | "pubg-mobile"; name: string } | null {
  if (!g || typeof g !== "object" || !("key" in g)) return null;
  const x = g as { key: "bgmi" | "pubg-mobile"; name: string };
  return { key: x.key, name: x.name };
}
