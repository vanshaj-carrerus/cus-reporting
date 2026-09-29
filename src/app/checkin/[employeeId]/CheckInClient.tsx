"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readTodayCheckIn, saveTodayCheckIn } from "@/lib/checkinStorage";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  RotateCcw,
  MapPin,
  Lock,
} from "lucide-react";

type Stage =
  | "requesting-location"
  | "submitting"
  | "success"
  | "location-denied"
  | "location-timeout"
  | "location-unavailable"
  | "out-of-location"
  | "already-checked-in"
  | "error";

interface ResultData {
  status?: string;
  distanceFromOffice?: number;
  allowedRadius?: number;
  checkInTime?: string;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000, // 15s — generous for indoor GPS lock
  maximumAge: 0, // never reuse a cached/stale position
};

function hasGeolocationSupport(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export default function CheckInClient({ employeeId }: { employeeId: string }) {
  // Always starts in "requesting-location" so the server-rendered markup
  // (no `navigator`) matches the client's first render, avoiding a
  // hydration mismatch. The unsupported-browser case is corrected a tick
  // later, from inside the effect.
  const [stage, setStage] = useState<Stage>("requesting-location");
  const [message, setMessage] = useState<string>("Requesting your location…");
  const [result, setResult] = useState<ResultData | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Already checked in today on this device: never re-prompt for location,
    // and never let this browser act for a different employee.
    const saved = readTodayCheckIn();
    if (saved) {
      if (saved.employeeId !== employeeId) {
        router.replace(`/checkin/${saved.employeeId}`);
        return;
      }
      const timer = setTimeout(() => {
        setStage("already-checked-in");
        setResult({ checkInTime: saved.checkInTime, status: saved.status });
        setMessage("You've already checked in today.");
      }, 0);
      return () => clearTimeout(timer);
    }

    if (!hasGeolocationSupport()) {
      const timer = setTimeout(() => {
        setStage("location-unavailable");
        setMessage("Your browser does not support geolocation.");
      }, 0);
      return () => clearTimeout(timer);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        submitCheckIn(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setStage("location-denied");
            setMessage(
              "Location permission was denied. Please enable location access for this site and try again."
            );
            break;
          case error.TIMEOUT:
            setStage("location-timeout");
            setMessage(
              "Getting your location timed out. Move to an area with better GPS signal and retry."
            );
            break;
          default:
            setStage("location-unavailable");
            setMessage(
              "Could not determine your location. Check that GPS/location services are turned on."
            );
        }
      },
      GEOLOCATION_OPTIONS
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCheckIn(latitude: number, longitude: number) {
    setStage("submitting");
    setMessage("Verifying your location…");

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: employeeId, latitude, longitude }),
      });

      // The body may not be JSON if something upstream failed, so don't assume it.
      const data = await res.json().catch(() => ({}));

      if (res.status === 201) {
        setStage("success");
        setResult(data.attendance);
        saveTodayCheckIn({
          employeeId,
          checkInTime: data.attendance.checkInTime,
          status: data.attendance.status,
        });
        setMessage(
          data.attendance.status === "LATE"
            ? "Checked in — marked Late."
            : "Checked in — On Time!"
        );
      } else if (res.status === 403) {
        setStage("out-of-location");
        setResult(data);
        saveTodayCheckIn({
          employeeId,
          checkInTime: data.attendance?.checkInTime,
          status: "OUT_OF_LOCATION",
        });
        setMessage(
          `You're ${Math.round(
            data.distanceFromOffice
          )}m from the office (allowed: ${data.allowedRadius}m). Check-in rejected.`
        );
      } else if (res.status === 409) {
        setStage("already-checked-in");
        setResult(data.attendance);
        saveTodayCheckIn({
          employeeId,
          checkInTime: data.attendance.checkInTime,
          status: data.attendance.status,
        });
        setMessage("You've already checked in today.");
      } else {
        setStage("error");
        setMessage(
          data.error ?? `Something went wrong (error ${res.status}). Please try again.`
        );
      }
    } catch {
      setStage("error");
      setMessage(
        "Couldn't reach the server. Check your connection and try again."
      );
    }
  }

  function retry() {
    setStage("requesting-location");
    setMessage("Requesting your location…");
    setResult(null);
    // Re-trigger the effect logic manually since deps array is empty.
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => submitCheckIn(position.coords.latitude, position.coords.longitude),
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setStage("location-denied");
            setMessage("Location permission was denied. Please enable it and retry.");
          } else if (error.code === error.TIMEOUT) {
            setStage("location-timeout");
            setMessage("Getting your location timed out. Please retry.");
          } else {
            setStage("location-unavailable");
            setMessage("Could not determine your location.");
          }
        },
        GEOLOCATION_OPTIONS
      );
    }
  }

  const isLoading = stage === "requesting-location" || stage === "submitting";
  const isError = [
    "location-denied",
    "location-timeout",
    "location-unavailable",
    "out-of-location",
    "error",
  ].includes(stage);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="animate-scale-in w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface text-center shadow-2xl shadow-black/40">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4 text-left">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              isError ? "bg-danger" : stage === "success" ? "bg-accent" : "bg-accent-text"
            } ${isLoading ? "animate-pulse" : ""}`}
          />
          <div>
            <h1 className="text-sm font-semibold">Employee Check-In</h1>
            <p className="font-mono text-[11px] text-muted">Geofence verification</p>
          </div>
        </div>

        <div className="p-8">
          {isLoading && (
            <div className="flex flex-col items-center gap-5 py-2">
              <div className="relative flex h-32 w-32 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-accent/30" />
                <div className="absolute inset-4 rounded-full border border-accent/20" />
                <div className="animate-pulse-ring absolute inset-0 rounded-full border border-accent/50" />
                <div className="animate-radar absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,color-mix(in_srgb,var(--accent)_35%,transparent))]" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-accent/40 bg-surface text-accent-text">
                  <MapPin size={20} />
                </div>
              </div>
              <div>
                <p className="text-lg font-semibold">Verifying your location…</p>
                <p className="mt-1 text-sm text-muted">{message}</p>
              </div>
            </div>
          )}

          {stage === "success" && (
            <div className="flex flex-col items-center gap-3">
              <div className="animate-scale-in flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
                <CheckCircle2 size={30} />
              </div>
              <p className="text-lg font-semibold text-success">{message}</p>
              {result?.checkInTime && (
                <p className="font-mono text-xs text-muted">
                  {new Date(result.checkInTime).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {stage === "already-checked-in" && (
            <div className="animate-fade-in-up flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-info-bg text-info">
                <Info size={28} />
              </div>
              <p className="text-lg font-semibold text-info">{message}</p>
              {result?.checkInTime && (
                <p className="font-mono text-xs text-muted">
                  {new Date(result.checkInTime).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {isError && (
            <div className="animate-shake flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg text-danger">
                <AlertTriangle size={28} />
              </div>
              <p className="font-medium text-danger">{message}</p>
              <button
                onClick={retry}
                className="transition-smooth inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98]"
              >
                <RotateCcw size={14} />
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center border-t border-border bg-surface-2 px-6 py-3 font-mono text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={12} />
            Geofence-verified
          </span>
        </div>
      </div>
    </main>
  );
}
