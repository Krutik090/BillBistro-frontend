"use client";
// KDS is its own realtime app (usually a separate kitchen screen) — this just launches it.
// Fixes the dead "KDS" nav link (T-110).
import Link from "next/link";
import { ChefHat, ExternalLink } from "lucide-react";
import { AppShell, Button, Card } from "@billbistro/ui";
import { ApiProvider } from "../../lib/api";
import { posNav } from "../../lib/nav";

const KDS_URL = process.env.NEXT_PUBLIC_KDS_URL || "http://localhost:3002";

export default function KdsLauncherPage() {
  return (
    <ApiProvider>
      <AppShell app="POS" nav={posNav} activeHref="/kds" variant="rail" Link={Link}>
        <div className="flex h-full items-center justify-center p-6">
          <Card className="flex max-w-sm flex-col items-center gap-4 text-center">
            <ChefHat size={40} className="text-primary" />
            <div>
              <h1 className="font-display text-xl font-semibold">Kitchen Display</h1>
              <p className="mt-1 text-sm text-muted">KDS runs as its own live board, usually on a separate kitchen screen.</p>
            </div>
            <Button asChild size="lg">
              <a href={KDS_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} /> Open Kitchen Display
              </a>
            </Button>
          </Card>
        </div>
      </AppShell>
    </ApiProvider>
  );
}
