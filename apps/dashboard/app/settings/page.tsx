"use client";
// T-109 basic settings: tenant profile (name/GSTIN) + outlet profile (name/address/phone). Currency/timezone read-only for now.
import * as React from "react";
import { Button, Card, CardTitle, Input } from "@billbistro/ui";
import { DashboardShell } from "../../components/shell";
import { useSettings, useSettingsMutations, useOutlet, useOutletMutations } from "../../lib/api";

export default function SettingsPage() {
  return <DashboardShell><SettingsView /></DashboardShell>;
}

function SettingsView() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(null), 2500); };
  const run = async (p: Promise<unknown>, ok: string) => { try { await p; flash(ok); } catch (e) { flash(`Error: ${(e as Error).message}`); } };

  return (
    <div className="flex flex-col gap-5 p-7">
      <header>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Business profile and outlet details</p>
      </header>
      <div className="grid grid-cols-2 gap-4">
        <BusinessProfile run={run} />
        <OutletProfile run={run} />
      </div>
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3">{msg}</div>}
    </div>
  );
}

type Run = (p: Promise<unknown>, ok: string) => Promise<void>;

function BusinessProfile({ run }: { run: Run }) {
  const { settings, loading } = useSettings();
  const m = useSettingsMutations();
  const [name, setName] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  React.useEffect(() => { if (settings) { setName(settings.name); setGstin(settings.gstin ?? ""); } }, [settings]);

  const dirty = !!settings && (name !== settings.name || gstin !== (settings.gstin ?? ""));

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Business profile</CardTitle>
      {loading && <p className="text-sm text-muted">Loading…</p>}
      {!loading && (
        <>
          <Input label="Restaurant name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="29ABCDE1234F1Z5" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-muted">Currency</div><div className="font-medium">{settings?.currency}</div></div>
            <div><div className="text-muted">Timezone</div><div className="font-medium">{settings?.timezone}</div></div>
          </div>
          <div>
            <Button onClick={() => run(m.update.mutateAsync({ name, gstin: gstin || undefined }), "Saved")} disabled={!dirty || !name.trim() || m.update.isPending}>
              {m.update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

function OutletProfile({ run }: { run: Run }) {
  const { outlet, loading } = useOutlet();
  const m = useOutletMutations();
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [phone, setPhone] = React.useState("");
  React.useEffect(() => { if (outlet) { setName(outlet.name); setAddress(outlet.address ?? ""); setPhone(outlet.phone ?? ""); } }, [outlet]);

  const dirty = !!outlet && (name !== outlet.name || address !== (outlet.address ?? "") || phone !== (outlet.phone ?? ""));

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Outlet</CardTitle>
      {loading && <p className="text-sm text-muted">Loading…</p>}
      {!loading && outlet && (
        <>
          <Input label="Outlet name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div>
            <Button
              onClick={() => run(m.update.mutateAsync({ id: outlet.id, input: { name, address: address || undefined, phone: phone || undefined } }), "Saved")}
              disabled={!dirty || !name.trim() || m.update.isPending}
            >
              {m.update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
