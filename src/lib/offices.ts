import { Office, OFFICE_COLLATION } from "@/models/Office";
import { OFFICE_LOCATION, OFFICE_RADIUS_METERS } from "./config";
import { haversineDistanceMeters } from "./geo";

export interface OfficeArea {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface OfficeMatch {
  /** The office the position is inside of, or the closest one if it's outside all. */
  office: OfficeArea;
  /** Meters from that office's centre. */
  distance: number;
  /** Inside that office's radius. */
  inside: boolean;
}

/**
 * Every place employees may check in from. Falls back to the single office in
 * the environment until the admin adds one. Call after connecting.
 */
export async function loadOffices(): Promise<OfficeArea[]> {
  const docs = await Office.find().sort({ name: 1 }).collation(OFFICE_COLLATION).lean();
  if (docs.length === 0) {
    return [
      {
        id: "default",
        name: "Office",
        latitude: OFFICE_LOCATION.latitude,
        longitude: OFFICE_LOCATION.longitude,
        radius: OFFICE_RADIUS_METERS,
      },
    ];
  }
  return docs.map((o) => ({
    id: o._id.toString(),
    name: o.name,
    latitude: o.latitude,
    longitude: o.longitude,
    radius: o.radiusMeters,
  }));
}

/**
 * Where a position stands against the offices: the first office it is inside of
 * (the nearest one if several overlap), otherwise the closest office.
 */
export function matchOffice(offices: OfficeArea[], latitude: number, longitude: number): OfficeMatch {
  let best: OfficeMatch | null = null;
  for (const office of offices) {
    const distance = haversineDistanceMeters(latitude, longitude, office.latitude, office.longitude);
    const inside = distance <= office.radius;
    if (
      !best ||
      (inside && !best.inside) ||
      (inside === best.inside && distance < best.distance)
    ) {
      best = { office, distance, inside };
    }
  }
  return best as OfficeMatch;
}
