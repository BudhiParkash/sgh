import { Schema, model } from "mongoose";

const redirectSchema = new Schema(
  {
    from: { type: String, required: true, trim: true, maxlength: 300, match: /^\/[^\s?#]*$/ },
    to: { type: String, trim: true, maxlength: 500 },
    code: { type: Number, enum: [301, 302, 410], default: 301 },
    note: { type: String, maxlength: 200 },
    hits: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true, optimisticConcurrency: true },
);
redirectSchema.index({ from: 1 }, { unique: true });

export const RedirectModel = model("Redirect", redirectSchema, "redirects");

/** Called by content services when a published slug changes, so old URLs keep working. */
export async function addSlugRedirect(from: string, to: string, adminId?: string) {
  if (from === to) return;
  await RedirectModel.deleteMany({ from: to }); // never redirect a live URL away
  await RedirectModel.updateMany({ to: from }, { $set: { to } }); // collapse chains
  await RedirectModel.updateOne({ from }, { $set: { to, code: 301, createdBy: adminId, note: "Automatic: slug changed" } }, { upsert: true });
}
