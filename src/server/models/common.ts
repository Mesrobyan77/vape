import { Schema, model, models, type Model } from "mongoose";
import type { Localized } from "@/lib/api/types";

/** Registers a model once (Next.js hot reload re-evaluates modules). */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (models[name] as Model<T> | undefined) ?? model<T>(name, schema);
}

export const LocalizedSchema = new Schema<Localized>(
  {
    hy: { type: String, default: "" },
    ru: { type: String, default: "" },
    en: { type: String, default: "" },
  },
  { _id: false },
);

export interface ImageRef {
  url: string;
  publicId?: string | null;
  alt: Localized;
  width: number;
  height: number;
}

export const ImageSchema = new Schema<ImageRef>(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    alt: { type: LocalizedSchema, default: () => ({ hy: "", ru: "", en: "" }) },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);
