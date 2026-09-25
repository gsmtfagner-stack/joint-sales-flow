import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Minus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, SectionTitle } from "@/components/AppShell";
import { ensureUnlocked } from "@/lib/gate.functions";
import {
  listProducts,
  saveProduct,
  deleteProduct,
  registerMovement,
  listMovements,
} from "@/lib/data.functions";
import type { Category } from "@/lib/data.functions";
import { brl, dateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque | Resenha Espetinho" },
      {
        name: "description",
        content: "Entrada e saída de bebidas e espetinhos com controle de estoque.",
      },
      { property: "og:title", content: "Estoque | Resenha Espetinho" },
      {
        property: "og:description",
        content: "Entrada e saída de bebidas e espetinhos com controle de estoque.",
      },
    ],
  }),
  loader: () => ensureUnlocked(),
  component: Estoque,
});

const categories: { id: Category; label: string }[] = [
  { id: "espetinho", label: "Espetinho" },
  { id: "bebida", label: "Bebida" },
  { id: "outro", label: "Outro" },
];

type Form = {
  id?: string;
  name: string;
  category: Category;
  price: string;
  cost: string;
  stock: string;
};

const emptyForm: Form = {
  name: "",
  category: "espetinho",
  price: "",
  cost: "",
  stock: "0",
};

function Estoque() {
  const qc = useQueryClient();
  const fetchProducts = useServerFn(listProducts);
  const fetchMovements = useServerFn(listMovements);
  const save = useServerFn(saveProduct);
  const remove = useServerFn(deleteProduct);
  const move = useServerFn(registerMovement);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: () => fetchMovements(),
  });

  const [form, setForm] = useState<Form | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form!.id ? { id: form!.id } : {}),
          name: form!.name,
          category: form!.category,
          price: Number(form!.price || 0),
          cost: Number(form!.cost || 0),
          stock: Number(form!.stock || 0),
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Produto salvo");
      setForm(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: (v: { id: string; kind: "entrada" | "saida"; quantity: number }) =>
      move({ data: { product_id: v.id, kind: v.kind, quantity: v.quantity } }),
    onSuccess: () => {
      toast.success("Estoque atualizado");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Estoque">
      <Button className="mb-4 w-full font-bold" onClick={() => setForm(emptyForm)}>
        <Plus className="size-4" /> Novo produto
      </Button>

      <div className="space-y-2">
        {products.map((p) => {
          const value = qty[p.id] ?? "1";
          return (
            <Card key={p.id} className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {categories.find((c) => c.id === p.category)?.label} ·{" "}
                    {brl(p.price)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={
                      p.stock <= 5
                        ? "title text-2xl text-destructive"
                        : "title text-2xl text-accent"
                    }
                  >
                    {p.stock}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar produto"
                    onClick={() =>
                      setForm({
                        id: p.id,
                        name: p.name,
                        category: p.category as Category,
                        price: String(p.price),
                        cost: String(p.cost),
                        stock: String(p.stock),
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir produto"
                    onClick={() =>
                      remove({ data: { id: p.id } }).then(() => qc.invalidateQueries())
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => setQty((q) => ({ ...q, [p.id]: e.target.value }))}
                  className="h-9 w-20"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    moveMutation.mutate({
                      id: p.id,
                      kind: "entrada",
                      quantity: Number(value || 0),
                    })
                  }
                >
                  <Plus className="size-4" /> Entrada
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    moveMutation.mutate({
                      id: p.id,
                      kind: "saida",
                      quantity: Number(value || 0),
                    })
                  }
                >
                  <Minus className="size-4" /> Saída
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 space-y-2">
        <SectionTitle>Movimentações recentes</SectionTitle>
        {movements.slice(0, 20).map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between border-b border-border py-2 text-sm"
          >
            <span>
              {m.products?.name ?? "Produto"}{" "}
              <span className="text-muted-foreground">({m.kind})</span>
            </span>
            <span className={m.quantity < 0 ? "text-destructive" : "text-success"}>
              {m.quantity > 0 ? "+" : ""}
              {m.quantity} · {dateTime(m.created_at)}
            </span>
          </div>
        ))}
      </div>

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="title text-2xl">
              {form?.id ? "Editar produto" : "Novo produto"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <Input
                placeholder="Nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                {categories.map((c) => (
                  <Button
                    key={c.id}
                    variant={form.category === c.id ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setForm({ ...form, category: c.id })}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                step="0.01"
                placeholder="Preço de venda (R$)"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Custo (R$)"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Estoque"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
              <Button
                className="w-full font-bold"
                disabled={!form.name || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Salvar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
