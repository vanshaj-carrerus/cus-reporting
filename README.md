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

- **Employee accounts**: the admin adds each employee's name **and email** on
  `/admin/employees` and is shown a one-time **setup code** to give that
  employee. The employee needs their email *and* the code to set their own
  password the first time (`POST /api/auth/activate`, from the mobile app) —
  knowing the email alone isn't enough, so nobody can claim someone else's
  account. They sign in with email + password afterwards. A forgotten password
  is reset by the admin (key icon), which signs the employee out everywhere and
  issues a new code. Check-in and check-out are only available to a signed-in
  employee, for themselves. The mobile app (`cus-shift`) is the employee client.
  **The old web `/checkin` pages and the `/qr` page no longer work** — they send
  an employee id with no sign-in, which the API now rejects.
- **Admin dashboard**: `/admin` — lists the day's check-ins, color-coded by
  status, with a Google Maps link on each set of coordinates for auditing
  flagged (Out of Location) entries. Use the date picker to view other days.

## Data model

- **Employee** (`src/models/Employee.ts`): `name` (unique, case-insensitive), `email` (unique, lowercase; the login), `passwordHash` (scrypt, never returned by the API), `passwordSetAt` (unset = invited, not yet active), `setupCodeHash` / `setupCodeExpiresAt` (one-time code, 7 days, cleared once used), `createdAt`
- **Attendance** (`src/models/Attendance.ts`): `userId` (ref → Employee), `checkInTime`, `latitude`, `longitude`, `status` (`ON_TIME` / `LATE` / `OUT_OF_LOCATION`), `distanceFromOffice`, and once checked out `checkOutTime`, `checkOutLatitude`, `checkOutLongitude`, `checkOutDistance`

Browse the raw data with a MongoDB GUI (MongoDB Compass, or Atlas's own UI
if you're hosting there).

## API

- `POST /api/auth/activate` — body `{ email, code, password }`. First-time setup
  (or after an admin reset): `code` is the setup code the admin gave the employee.
  Sets the password (8+ chars) and signs in. `404` if the email/code don't match,
  `410` if the code expired, `409` if the account already has a password.
- `POST /api/employees` (admin) — body `{ name, email }`; responds with the
  employee and a one-time `setupCode`. `POST /api/employees/:id/reset-password`
  (admin) removes the password, ends the employee's sessions and returns a new `setupCode`.
- `POST /api/auth/login` — body `{ email, password }`. Sets the
  `employee_session` cookie. Rate-limited (5 failures / 15 min per client + email).
- `POST /api/auth/logout`, `GET /api/auth/me` (profile + today's attendance).
- `POST /api/check-in` — **requires an employee session**; body
  `{ latitude, longitude }` (the employee is taken from the session, never the
  body). Returns `201` on success (`ON_TIME`/`LATE`), `403` if outside the
  geo-fence (`OUT_OF_LOCATION`, still logged for HR), `401` if not signed in,
  and `409` if the employee already checked in today.
- `POST /api/check-out` — same auth and body. Returns `200`, `403` if outside
  the geo-fence, `409` (`NOT_CHECKED_IN` / `ALREADY_CHECKED_OUT`).
- `POST /api/employees` — admin. Body `{ name, email }`; `PATCH /api/employees/:id`
  accepts `name` and/or `email`.
- `GET /api/attendance?date=YYYY-MM-DD` — attendance records for a day
  (defaults to today).

## Notes

- Distance is computed server-side with the Haversine formula
  ([src/lib/geo.ts](src/lib/geo.ts)) — the client only ever sends raw coordinates.
- Geolocation is requested with `enableHighAccuracy: true` and a 15s
  timeout; permission-denied, timeout, and unsupported-browser states each
  show a distinct, retryable error screen.
