# Employee Attendance System

Employees check in from the mobile app (`cus-shift`),
their location is captured, and the server validates it against a
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
   | `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | SMTP account (nodemailer) that emails employees their verification code. For Gmail you can instead set just `EMAIL_USER` + `EMAIL_PASS` (an app password). Without email configured, setting or resetting a password is unavailable. Set these on Vercel too. |

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
  `/admin/employees` — nothing is handed to the employee. In the mobile app they
  tap *First time? Set your password* (or *Forgot your password?*), and we email a
  6-digit code to the registered address (`POST /api/auth/request-code`). Entering
  the code with a new password (`POST /api/auth/activate`) proves they own that
  inbox, sets the password and signs them in — so nobody can claim a colleague's
  account just by knowing their email. Afterwards they sign in with email +
  password. Check-in and check-out are only available to a signed-in employee, for
  themselves. The mobile app (`cus-shift`) is the employee client.
  The web has no employee check-in pages; the old `/checkin` and `/qr` pages were removed.
- **Admin dashboard**: `/admin` — lists the day's check-ins, color-coded by
  status, with a Google Maps link on each set of coordinates for auditing
  flagged (Out of Location) entries. Use the date picker to view other days, and
  the department dropdown to show a single department (or "Unassigned").
- **Departments**: `/admin/departments` — create, rename and delete departments.
  Assign each employee to one when adding them or by editing them on
  `/admin/employees`. Deleting a department leaves its employees unassigned; no
  attendance is removed. Employees that existed before departments have none until
  you assign one.

- **Shifts** (`/admin/shifts`): day or night shifts in IST (`HH:mm`; a shift that ends at or before its start runs past midnight). A check-in belongs to the IST date its shift *started* (`shiftDate`), so a night shift checked in after midnight still counts for the evening it began. "Late" is measured against the shift start + the shift's grace minutes; employees with no shift keep the old `SHIFT_CUTOFF_*` rule. Check-in opens `earlyCheckInMinutes` (default 120) before the shift.
- **Breaks** (`/admin/breaks`): a *break plan* is a list of fixed IST windows (several allowed, any times, overlaps allowed). Assign a shift and a break plan per employee on `/admin/employees`, or to a whole department with the clock button on `/admin/departments`. Employees can't start or end a break.
- **Outside the office**: while checked in, the app reports its location (`POST /api/presence`). The dashboard's **Outside right now** panel (refreshes every 30 s) shows who is *Outside* (not on a break), *On break*, *Break over - still outside*, or *No signal*. The rules live in one function, `classifyPresence` in `src/lib/shifts.ts` (tests: `npx tsx scripts/test-shifts.ts`). Rules for all shifts (alarm repeat interval, rings before it can be silenced, no-signal threshold, early check-in window) are on the Shifts page.

## Data model

- **Employee** (`src/models/Employee.ts`): `name` (unique, case-insensitive), `email` (unique, lowercase; the login), `passwordHash` (scrypt, never returned by the API), `passwordSetAt` (unset = invited, not yet active), `verifyCodeHash` / `verifyCodeExpiresAt` / `verifyCodeSentAt` / `verifyCodeAttempts` (emailed code: hashed, 10 min, 5 guesses, cleared once used), `department` (optional ref → Department), `createdAt`
- **Department** (`src/models/Department.ts`): `name` (unique, case-insensitive), `createdAt`
- **Shift** (`src/models/Shift.ts`): `name`, `startTime`, `endTime` (IST HH:mm), `lateGraceMinutes`. **BreakPlan** (`src/models/BreakPlan.ts`): `name`, `breaks[{ name, startTime, endTime }]`. **ShiftSettings**: one document of shared rules. Employees reference one `shift` and one `breakPlan`; attendance freezes `shiftDate/shiftName/shiftStart/shiftEnd` at check-in and tracks `lastSeenAt`, `outsideSince`, `outsideMinutes`, `breakOverrunMinutes`.
- **Attendance** (`src/models/Attendance.ts`): `userId` (ref → Employee), `checkInTime`, `latitude`, `longitude`, `status` (`ON_TIME` / `LATE` / `OUT_OF_LOCATION`), `distanceFromOffice`, and once checked out `checkOutTime`, `checkOutLatitude`, `checkOutLongitude`, `checkOutDistance`

Browse the raw data with a MongoDB GUI (MongoDB Compass, or Atlas's own UI
if you're hosting there).

## API

- `POST /api/auth/request-code` — body `{ email }`. Emails a 6-digit code (valid 10
  minutes) to a registered employee. Always answers the same, so it can't be used to
  find out who is registered; one code per minute per employee, rate-limited per client.
- `POST /api/auth/activate` — body `{ email, code, password }`. Sets (first time) or
  resets (forgotten) the password with the emailed code (8+ chars) and signs in. The
  code allows 5 wrong guesses, works once, and a new password signs the employee out
  everywhere else. `400` if the code is wrong or expired.
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
- `GET|POST /api/departments`, `PATCH|DELETE /api/departments/:id` — admin. Body `{ name }`.
- `POST /api/employees` — admin. Body `{ name, email, departmentId? }`; `PATCH /api/employees/:id`
  accepts `name`, `email` and/or `departmentId` (`null` unassigns). Changing an email clears that employee's password and sessions, so the new address is verified by a fresh emailed code.
- `GET|POST /api/shifts`, `PATCH|DELETE /api/shifts/:id`, `GET|POST /api/break-plans`, `PATCH|DELETE /api/break-plans/:id`, `GET|PATCH /api/shift-settings`, `POST /api/departments/:id/assign` (shift/break plan for a whole department), `GET /api/presence/live` — admin.
- `POST /api/presence` — employee session; body `{ latitude, longitude }`. `GET /api/auth/me` also returns `schedule` (shift, today's break windows, office area, alarm rules).
- `GET /api/attendance?date=YYYY-MM-DD&department=<id|none>` — attendance records for a day
  (defaults to today), optionally for one department only (`none` = unassigned).

## Notes

- Distance is computed server-side with the Haversine formula
  ([src/lib/geo.ts](src/lib/geo.ts)) — the client only ever sends raw coordinates.
- Geolocation is requested with `enableHighAccuracy: true` and a 15s
  timeout; permission-denied, timeout, and unsupported-browser states each
  show a distinct, retryable error screen.
