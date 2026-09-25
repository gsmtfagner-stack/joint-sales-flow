import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { requireUnlockedLoader } from "@/lib/gate-loader";
import { listSales, updateSale, deleteSale } from "@/lib/data.functions";
import type { PaymentMethod, SaleItemInput } from "@/lib/data.functions";
import { brl, dateTime, isToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas | Resenha Espetinho" },
      {
        name: "description",
        content: "Histórico de vendas do Resenha Espetinho com edição de valores.",
      },
      { property: "og:title", content: "Vendas | Resenha Espetinho" },
      {
        property: "og:description",
        content: "Histórico de vendas do Resenha Espetinho com edição de valores.",
      },
    ],
  }),
  loader: () => requireUnlockedLoader(),
  component: Vendas,
});

const payments: { id: PaymentMethod; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
];

type EditState = {
  id: string;
  items: SaleItemInput[];
  payment_method: PaymentMethod;
} | null;

function Vendas() {
  const qc = useQueryClient();
  const fetchSales = useServerFn(listSales);
  const saveSale = useServerFn(updateSale);
  const removeSale = useServerFn(deleteSale);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: () => fetchSales(),
  });
  const [edit, setEdit] = useState<EditState>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSale({
        data: {
          id: edit!.id,
          items: edit!.items,
          payment_method: edit!.payment_method,
        },
      }),
    onSuccess: () => {
      toast.success("Venda atualizada!");
      setEdit(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSale({ data: { id } }),
    onSuccess: () => {
      toast.success("Venda excluída");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const todayTotal = sales
    .filter((s) => isToday(s.created_at))
    .reduce((sum, s) => sum + Number(s.total), 0);

  const editTotal = (edit?.items ?? []).reduce(
    (s, i) => s + i.quantity * i.unit_price,
    0,
  );

  return (
    <AppShell title="Vendas">
      <Card className="mb-4 p-4">
        <p className="text-xs uppercase text-muted-foreground">Total de hoje</p>
        <p className="title text-3xl text-accent">{brl(todayTotal)}</p>
      </Card>

      <div className="space-y-3">
        {sales.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma venda registrada ainda.
          </p>
        )}
        {sales.map((sale) => (
          <Card key={sale.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="title text-2xl text-accent">{brl(sale.total)}</p>
                <p className="text-xs text-muted-foreground">
                  {dateTime(sale.created_at)} ·{" "}
                  {payments.find((p) => p.id === sale.payment_method)?.label}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Editar venda"
                  onClick={() =>
                    setEdit({
                      id: sale.id,
                      payment_method: sale.payment_method as PaymentMethod,
                      items: (sale.sale_items ?? []).map((i) => ({
                        product_id: i.product_id,
                        product_name: i.product_name,
                        quantity: i.quantity,
                        unit_price: Number(i.unit_price),
                      })),
                    })
                  }
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir venda"
                  onClick={() => deleteMutation.mutate(sale.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {(sale.sale_items ?? []).map((i) => (
                <li key={i.id}>
                  {i.quantity}x {i.product_name} — {brl(i.unit_price)}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(open) => !open && setEdit(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="title text-2xl">Alterar venda</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              {edit.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{item.product_name}</p>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) =>
                        setEdit((prev) =>
                          prev
                            ? {
                                ...prev,
                                items: prev.items.map((i, idx) =>
                                  idx === index
                                    ? { ...i, unit_price: Number(e.target.value) }
                                    : i,
                                ),
                              }
                            : prev,
                        )
                      }
                      className="mt-1 h-8 w-24"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() =>
                      setEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              items: prev.items
                                .map((i, idx) =>
                                  idx === index ? { ...i, quantity: i.quantity - 1 } : i,
                                )
                                .filter((i) => i.quantity > 0),
                            }
                          : prev,
                      )
                    }
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-6 text-center font-bold">{item.quantity}</span>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() =>
                      setEdit((prev) =>
                        prev
                          ? {
                              ...prev,
                              items: prev.items.map((i, idx) =>
                                idx === index ? { ...i, quantity: i.quantity + 1 } : i,
                              ),
                            }
                          : prev,
                      )
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              ))}

              <div className="grid grid-cols-3 gap-2">
                {payments.map((p) => (
                  <Button
                    key={p.id}
                    variant={edit.payment_method === p.id ? "default" : "secondary"}
                    onClick={() =>
                      setEdit((prev) => (prev ? { ...prev, payment_method: p.id } : prev))
                    }
                  >
                    {p.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Novo total</span>
                <span className="title text-2xl text-accent">{brl(editTotal)}</span>
              </div>

              <Button
                className="h-12 w-full font-bold"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Salvar alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
