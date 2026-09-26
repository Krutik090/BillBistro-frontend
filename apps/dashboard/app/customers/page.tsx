"use client";
// T-109 basic CRM: a phone book — name/phone/email/notes, search, no loyalty/points/order-linking.
import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button, Card, Drawer, Input, Table, THead, TBody, TR, TH, TD } from "@billbistro/ui";
import type { Customer, CustomerInput } from "@billbistro/sdk";
import { DashboardShell } from "../../components/shell";
import { useCustomers, useCustomerMutations } from "../../lib/api";

export default function CustomersPage() {
  return <DashboardShell><CustomersManager /></DashboardShell>;
}

function CustomersManager() {
  const [q, setQ] = React.useState("");
  const { customers, loading, error } = useCustomers(q);
  const m = useCustomerMutations();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(null), 2500); };
  const run = async (p: Promise<unknown>, ok: string) => { try { await p; flash(ok); } catch (e) { flash(`Error: ${(e as Error).message}`); } };

  const remove = async (c: Customer) => {
    if (!window.confirm(`Remove ${c.name}?`)) return;
    await run(m.delete.mutateAsync(c.id), "Removed");
  };

  return (
    <div className="flex flex-col gap-5 p-7">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-muted">{customers.length} saved</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={16} /> New customer</Button>
      </header>

      <Card className="flex flex-col gap-4">
        <Input label="" placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        {error && <p className="text-sm text-danger">Failed to load customers: {String(error)}</p>}
        <Table>
          <THead><TR><TH>Name</TH><TH>Phone</TH><TH>Email</TH><TH>Notes</TH><TH></TH></TR></THead>
          <TBody>
            {loading && <TR><TD colSpan={5} className="text-center text-muted">Loading…</TD></TR>}
            {!loading && !customers.length && <TR><TD colSpan={5} className="text-center text-muted">No customers yet.</TD></TR>}
            {customers.map((c) => (
              <TR key={c.id} className="hover:bg-surface-overlay/40">
                <TD className="font-medium">{c.name}</TD>
                <TD className="font-mono text-muted">{c.phone}</TD>
                <TD className="text-muted">{c.email ?? "—"}</TD>
                <TD className="max-w-64 truncate text-muted">{c.notes ?? "—"}</TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <IconBtn title="Edit" onClick={() => setEditing(c)}><Pencil size={14} /></IconBtn>
                    <IconBtn title="Remove" onClick={() => remove(c)}><Trash2 size={14} /></IconBtn>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <CustomerDrawer open={creating} onClose={() => setCreating(false)} onSave={async (input) => { await run(m.create.mutateAsync(input), `Added ${input.name}`); setCreating(false); }} />
      <CustomerDrawer open={!!editing} customer={editing} onClose={() => setEditing(null)} onSave={async (input) => { await run(m.update.mutateAsync({ id: editing!.id, input }), "Saved"); setEditing(null); }} />
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3">{msg}</div>}
    </div>
  );
}

function CustomerDrawer({ open, customer, onClose, onSave }: { open: boolean; customer?: Customer | null; onClose: () => void; onSave: (input: CustomerInput) => void }) {
  const isEdit = !!customer;
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? ""); setPhone(customer?.phone ?? ""); setEmail(customer?.email ?? ""); setNotes(customer?.notes ?? "");
  }, [open, customer]);

  const save = () => onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, notes: notes.trim() || undefined });

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={isEdit ? "Edit customer" : "New customer"}
      footer={<Button size="lg" onClick={save} disabled={!name.trim() || !phone.trim()}>{isEdit ? "Save" : "Add customer"}</Button>}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
        <Input label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Prefers a window table" />
      </div>
    </Drawer>
  );
}

const IconBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
  <button title={title} aria-label={title} onClick={onClick} className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-overlay hover:text-foreground">{children}</button>
);
