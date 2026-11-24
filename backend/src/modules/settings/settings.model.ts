import { Schema, model } from "mongoose";
import { INDEPENDENCE_DISCLAIMER } from "@sgh/shared";

/**
 * Singleton (key: "global"). Legal identity fields stay EMPTY until the owner provides them —
 * legal pages refuse to publish to production while required ones are missing (M8).
 */
const settingsSchema = new Schema(
  {
    key: { type: String, default: "global" },
    siteName: { type: String, default: "Shivanshi Gaming Hub" },
    tagline: { type: String, default: "Your ultimate destination for BGMI tournaments, sensitivity setups and mobile gaming intelligence." },
    owner: { type: String, default: "Shivanshi Tripathi" },
    contact: { name: { type: String, default: "" }, email: { type: String, default: "" }, phone: { type: String, default: "" } },
    grievanceOfficer: { name: { type: String, default: "" }, email: { type: String, default: "" }, address: { type: String, default: "" } },
    company: { legalName: { type: String, default: "" }, entityType: { type: String, default: "" }, cin: { type: String, default: "" }, gstin: { type: String, default: "" }, registeredAddress: { type: String, default: "" }, jurisdiction: { type: String, default: "" } },
    socials: {
      youtube: { type: String, default: "" },
      instagram: { type: String, default: "" },
      instagramChannel: { type: String, default: "" },
      facebook: { type: String, default: "" },
      discord: { type: String, default: "" },
      telegram: { type: String, default: "" },
      x: { type: String, default: "" },
    },
    analytics: { ga4Id: { type: String, default: "" }, gscVerification: { type: String, default: "" }, bingVerification: { type: String, default: "" } },
    ads: { enabled: { type: Boolean, default: false }, gamNetworkCode: { type: String, default: "" }, personalizedAds: { type: Boolean, default: false } },
    disclaimerText: { type: String, default: INDEPENDENCE_DISCLAIMER },
    maintenanceMode: { type: Boolean, default: false },
    /** Data retention (days) per data type — set with legal counsel (0 = keep until manually deleted). */
    retentionDays: {
      contactEnquiries: { type: Number, default: 0 },
      feedback: { type: Number, default: 0 },
      reports: { type: Number, default: 0 },
      privacyRequests: { type: Number, default: 0 },
      ipHashes: { type: Number, default: 30 },
    },
  },
  { timestamps: true, optimisticConcurrency: true },
);
settingsSchema.index({ key: 1 }, { unique: true });

export const SettingsModel = model("WebsiteSetting", settingsSchema, "website_settings");

export async function getSettings() {
  return (await SettingsModel.findOne({ key: "global" })) ?? (await SettingsModel.create({ key: "global" }));
}

/** Values the owner provided (2026-11-23). Applied only where fields are still empty. */
export const OWNER_PROVIDED_DEFAULTS = {
  "contact.name": "Budhi Parkash",
  "contact.email": "budhiparkash00@gmail.com",
  "grievanceOfficer.name": "Budhi Parkash",
  "grievanceOfficer.email": "budhiparkash00@gmail.com",
  "socials.youtube": "https://www.youtube.com/@ShivanshiGamings",
  "socials.instagram": "https://www.instagram.com/shivanshigaming/",
  "socials.instagramChannel": "https://www.instagram.com/channel/7zFYFMVALxg8FyMh/",
  "socials.facebook": "https://www.facebook.com/profile.php?id=61583809210977",
} as const;
