"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePos } from "../lib/store";

export function Toast() {
  const toast = usePos((s) => s.toast);
  const notify = usePos((s) => s.notify);
  React.useEffect(() => { if (!toast) return; const id = setTimeout(() => notify(null), 2600); return () => clearTimeout(id); }, [toast, notify]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3 print:hidden">
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
