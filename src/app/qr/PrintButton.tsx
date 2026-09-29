"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="transition-smooth inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-accent/40 active:scale-[0.98]"
    >
      <Printer size={15} />
      Print this page
    </button>
  );
}
