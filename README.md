# QR-Based Employee Attendance System

Employees scan a personalized QR code (linking to `/checkin/[employeeId]`),
their browser location is captured, and the server validates it against a
geo-fence around the office using the Haversine formula. HR reviews results
on `/admin`.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- MongoDB via Mongoose

## Setup

1. Copy the environment template and fill in your database + office details:

   ```bash
   cp .env.example .env
   ```

   | Variable | Purpose |
   | --- | --- |
   | `MONGODB_URI` | MongoDB connection string (local or Atlas) |
   | `OFFICE_LATITUDE` / `OFFICE_LONGITUDE` | Office coordinates for geo-fencing |
   | `OFFICE_RADIUS_METERS` | Allowed radius in meters (default 70) |
   | `SHIFT_CUTOFF_HOUR` / `SHIFT_CUTOFF_MINUTE` | Shift start cutoff for "Late" status (default 09:15) |

2. Install dependencies and seed a few sample employees:

   ```bash
   npm install
   npm run seed
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

## Usage

- **Employee check-in**: `/checkin/<employeeId>` — the seed script prints
  each employee's URL (their MongoDB `_id`). In production, encode this URL
  as a QR code per employee (e.g. a printed badge) so scanning it opens
  their personalized check-in page directly. `/checkin` is a fallback entry
  point where an employee can type their ID manually.
- **Admin dashboard**: `/admin` — lists the day's check-ins, color-coded by
  status, with a Google Maps link on each set of coordinates for auditing
  flagged (Out of Location) entries. Use the date picker to view other days.

## Data model

- **Employee** (`src/models/Employee.ts`): `name` (unique, case-insensitive), `createdAt`
- **Attendance** (`src/models/Attendance.ts`): `userId` (ref → Employee), `checkInTime`, `latitude`, `longitude`, `status` (`ON_TIME` / `LATE` / `OUT_OF_LOCATION`), `distanceFromOffice`

Browse the raw data with a MongoDB GUI (MongoDB Compass, or Atlas's own UI
if you're hosting there).

## API

- `POST /api/check-in` — body `{ userId, latitude, longitude }`. Returns
  `201` on success (`ON_TIME`/`LATE`), `403` if outside the geo-fence
  (`OUT_OF_LOCATION`, still logged for HR), `404` for an unknown employee,
  and `409` if the employee already checked in today.
- `GET /api/attendance?date=YYYY-MM-DD` — attendance records for a day
  (defaults to today).

## Notes

- Distance is computed server-side with the Haversine formula
  ([src/lib/geo.ts](src/lib/geo.ts)) — the client only ever sends raw coordinates.
- Geolocation is requested with `enableHighAccuracy: true` and a 15s
  timeout; permission-denied, timeout, and unsupported-browser states each
  show a distinct, retryable error screen.
