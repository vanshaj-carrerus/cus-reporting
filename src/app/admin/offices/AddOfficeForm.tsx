"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle, LocateFixed } from "lucide-react";

const NAME_MAX_LENGTH = 60;

const inputClass =
  "transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function AddOfficeForm() {
  const [name, setName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("70");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const router = useRouter();

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser can't share its location. Type the coordinates instead.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setError("Couldn't read your location. Allow location access or type the coordinates.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/offices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, latitude, longitude, radiusMeters: radius }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to add office (error ${res.status}).`);
        return;
      }
      setName("");
      setLatitude("");
      setLongitude("");
      setRadius("70");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const clear = () => error && setError(null);

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="office-name" className="mb-1 block text-xs font-medium text-muted">
            Office name
          </label>
          <input
            id="office-name"
            value={name}
            maxLength={NAME_MAX_LENGTH}
            placeholder="e.g. Head Office"
            onChange={(e) => {
              setName(e.target.value);
              clear();
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="office-lat" className="mb-1 block text-xs font-medium text-muted">
            Latitude
          </label>
          <input
            id="office-lat"
            inputMode="decimal"
            value={latitude}
            placeholder="28.613900"
            onChange={(e) => {
              setLatitude(e.target.value);
              clear();
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="office-lng" className="mb-1 block text-xs font-medium text-muted">
            Longitude
          </label>
          <input
            id="office-lng"
            inputMode="decimal"
            value={longitude}
            placeholder="77.209000"
            onChange={(e) => {
              setLongitude(e.target.value);
              clear();
            }}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="office-radius" className="mb-1 block text-xs font-medium text-muted">
            Allowed radius (meters)
          </label>
          <input
            id="office-radius"
            inputMode="numeric"
            value={radius}
            onChange={(e) => {
              setRadius(e.target.value);
              clear();
            }}
            className={inputClass}
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="transition-smooth flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-50"
          >
            <LocateFixed size={14} />
            {locating ? "Locating…" : "Use my location"}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="transition-smooth flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={14} />
            {submitting ? "Adding…" : "Add Office"}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="animate-fade-in-up mt-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
