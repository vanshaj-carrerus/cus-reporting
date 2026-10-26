import { Schema, model, models, type InferSchemaType } from "mongoose";

export const OFFICE_NAME_MAX_LENGTH = 60;
export const OFFICE_RADIUS_MIN = 10;
export const OFFICE_RADIUS_MAX = 5000;
export const OFFICE_RADIUS_DEFAULT = 70;

// Case-insensitive comparison, so "head office" and "Head Office" are the same place.
export const OFFICE_COLLATION = { locale: "en", strength: 2 } as const;

// A place employees may check in/out from: a point plus a radius in meters.
const officeSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Office name is required."],
      trim: true,
      maxlength: [
        OFFICE_NAME_MAX_LENGTH,
        `Office name must be at most ${OFFICE_NAME_MAX_LENGTH} characters.`,
      ],
    },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: {
      type: Number,
      required: true,
      min: OFFICE_RADIUS_MIN,
      max: OFFICE_RADIUS_MAX,
      default: OFFICE_RADIUS_DEFAULT,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

officeSchema.index({ name: 1 }, { unique: true, collation: OFFICE_COLLATION });

export type OfficeDoc = InferSchemaType<typeof officeSchema>;

export const Office = models.Office ?? model("Office", officeSchema);
