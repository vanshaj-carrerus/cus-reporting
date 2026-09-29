// Office geo-fencing and shift configuration.
// Override any of these via environment variables without touching code.

export const OFFICE_LOCATION = {
  latitude: parseFloat(process.env.OFFICE_LATITUDE ?? "28.6139"),
  longitude: parseFloat(process.env.OFFICE_LONGITUDE ?? "77.2090"),
};

// Radius (meters) inside which a check-in counts as "at office".
// 70m default accounts for typical indoor GPS drift.
export const OFFICE_RADIUS_METERS = parseFloat(
  process.env.OFFICE_RADIUS_METERS ?? "70"
);

// Shift cutoff time (24h, server-local time) — check-ins after this are "Late".
export const SHIFT_CUTOFF_HOUR = parseInt(
  process.env.SHIFT_CUTOFF_HOUR ?? "9",
  10
);
export const SHIFT_CUTOFF_MINUTE = parseInt(
  process.env.SHIFT_CUTOFF_MINUTE ?? "15",
  10
);
