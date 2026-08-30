"use client";
import Link from "next/link";
import { AppShell } from "@billbistro/ui";
import { posNav } from "../../lib/nav";
import { ApiProvider } from "../../lib/api";
import { Floor } from "../../components/floor";
import { Toast } from "../../components/toast";

export default function TablesPage() {
  return (
    <ApiProvider>
      <AppShell app="POS" nav={posNav} activeHref="/tables" variant="rail" Link={Link}>
        <Floor />
        <Toast />
      </AppShell>
    </ApiProvider>
  );
}
