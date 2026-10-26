import {
  OFFICE_NAME_MAX_LENGTH,
  OFFICE_RADIUS_MAX,
  OFFICE_RADIUS_MIN,
} from "@/models/Office";

export interface OfficeValues {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

/** Validates the body of an office create/update request. */
export function parseOfficeBody(body: unknown): { error: string } | { values: OfficeValues } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return { error: "Office name is required." };
  if (name.length > OFFICE_NAME_MAX_LENGTH) {
    return { error: `Office name must be at most ${OFFICE_NAME_MAX_LENGTH} characters.` };
  }

  const latitude = Number(b.latitude);
  const longitude = Number(b.longitude);
  if (b.latitude === "" || b.latitude == null || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    return { error: "Latitude must be a number between -90 and 90." };
  }
  if (b.longitude === "" || b.longitude == null || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return { error: "Longitude must be a number between -180 and 180." };
  }

  const radiusMeters = Number(b.radiusMeters);
  if (
    b.radiusMeters === "" ||
    b.radiusMeters == null ||
    !Number.isFinite(radiusMeters) ||
    radiusMeters < OFFICE_RADIUS_MIN ||
    radiusMeters > OFFICE_RADIUS_MAX
  ) {
    return {
      error: `Radius must be between ${OFFICE_RADIUS_MIN} and ${OFFICE_RADIUS_MAX} meters.`,
    };
  }

  return { values: { name, latitude, longitude, radiusMeters } };
}

export function officeJson(o: {
  _id: { toString(): string };
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  return {
    _id: o._id.toString(),
    name: o.name,
    latitude: o.latitude,
    longitude: o.longitude,
    radiusMeters: o.radiusMeters,
  };
}
