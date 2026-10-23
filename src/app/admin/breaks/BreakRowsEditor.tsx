"use client";

import { Plus, X } from "lucide-react";

export interface BreakRow {
  name: string;
  startTime: string;
  endTime: string;
}

const input =
  "rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

/** Editable list of fixed break windows (IST). Used when adding and editing a plan. */
export default function BreakRowsEditor({
  rows,
  onChange,
}: {
  rows: BreakRow[];
  onChange: (rows: BreakRow[]) => void;
}) {
  function update(index: number, patch: Partial<BreakRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-muted">No breaks yet — employees on this plan get none.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <input
            value={row.name}
            maxLength={40}
            placeholder="e.g. Lunch"
            aria-label={`Break ${i + 1} name`}
            onChange={(e) => update(i, { name: e.target.value })}
            className={`${input} w-36`}
          />
          <input
            type="time"
            value={row.startTime}
            aria-label={`Break ${i + 1} start (IST)`}
            onChange={(e) => update(i, { startTime: e.target.value })}
            className={input}
          />
          <span className="text-muted">to</span>
          <input
            type="time"
            value={row.endTime}
            aria-label={`Break ${i + 1} end (IST)`}
            onChange={(e) => update(i, { endTime: e.target.value })}
            className={input}
          />
          <button
            type="button"
            aria-label={`Remove break ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="transition-smooth flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-danger"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { name: "", startTime: "", endTime: "" }])}
        className="transition-smooth inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <Plus size={12} /> Add break
      </button>
    </div>
  );
}

/** Client-side check before sending; the server validates again. */
export function checkRows(rows: BreakRow[]): string | null {
  for (const r of rows) {
    if (!r.name.trim()) return "Every break needs a name.";
    if (!r.startTime || !r.endTime) return `"${r.name.trim()}": choose a start and end time.`;
  }
  return null;
}
