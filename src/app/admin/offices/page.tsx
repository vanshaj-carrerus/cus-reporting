import { requireAdmin } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { Office, OFFICE_COLLATION } from "@/models/Office";
import AddOfficeForm from "./AddOfficeForm";
import OfficeRow from "./OfficeRow";
import { MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOfficesPage() {
  await requireAdmin();
  await connectToDatabase();

  const offices = await Office.find().sort({ name: 1 }).collation(OFFICE_COLLATION).lean();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Offices</h1>
        <p className="text-sm text-muted">
          The places employees can check in and out from. Anywhere inside the radius of any office
          below is allowed; anywhere else is rejected. Add as many places as you need.
        </p>
        {offices.length === 0 && (
          <p className="mt-2 text-xs text-warning">
            No office added yet — until you add one, the single office from the server settings
            (OFFICE_LATITUDE / OFFICE_LONGITUDE / OFFICE_RADIUS_METERS) is used.
          </p>
        )}
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <AddOfficeForm />
      </div>

      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        style={{ animationDelay: "120ms" }}
      >
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Office
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {offices.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center text-muted">
                    <MapPin size={20} />
                    No offices yet. Add one above.
                  </div>
                </td>
              </tr>
            )}
            {offices.map((o, i) => (
              <OfficeRow
                key={o._id.toString()}
                id={o._id.toString()}
                name={o.name}
                latitude={o.latitude}
                longitude={o.longitude}
                radiusMeters={o.radiusMeters}
                delay={i * 30}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
