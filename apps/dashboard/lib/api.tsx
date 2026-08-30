"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPosApi, type CategoryInput, type ItemInput, type PosApi } from "@billbistro/sdk";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  const [qc] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <ApiContext.Provider value={api}><QueryClientProvider client={qc}>{children}</QueryClientProvider></ApiContext.Provider>;
}

export function useMenu() {
  const api = useApi();
  const categories = useQuery({ queryKey: ["menu", "categories"], queryFn: api.menu.categories });
  const items = useQuery({ queryKey: ["menu", "items"], queryFn: api.menu.items });
  return { categories: categories.data ?? [], items: items.data ?? [], loading: categories.isPending || items.isPending, error: categories.error ?? items.error };
}

/** Mutations invalidate the menu queries; errors bubble to the caller for toasts. */
export function useMenuMutations() {
  const api = useApi(); const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["menu"] });
  return {
    createCategory: useMutation({ mutationFn: (i: CategoryInput) => api.menu.createCategory(i), onSuccess: inv }),
    updateCategory: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) => api.menu.updateCategory(id, input), onSuccess: inv }),
    deleteCategory: useMutation({ mutationFn: (id: string) => api.menu.deleteCategory(id), onSuccess: inv }),
    createItem: useMutation({ mutationFn: (i: ItemInput) => api.menu.createItem(i), onSuccess: inv }),
    updateItem: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<ItemInput> }) => api.menu.updateItem(id, input), onSuccess: inv }),
    deleteItem: useMutation({ mutationFn: (id: string) => api.menu.deleteItem(id), onSuccess: inv }),
  };
}
