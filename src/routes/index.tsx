import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, SectionTitle } from "@/components/AppShell";
import { requireUnlockedLoader } from "@/lib/gate-loader";
import { createSale, listProducts, listCash } from "@/lib/data.functions";
import type { PaymentMethod, SaleItemInput } from "@/lib/data.functions";
import { brl, isToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vender | Resenha Espetinho" },
      {
        name: "description",
        content: "Registre vendas de espetinhos e bebidas em poucos toques.",
      },
      { property: "og:title", content: "Vender | Resenha Espetinho" },
      {
        property: "og:description",
        content: "Registre vendas de espetinhos e bebidas em poucos toques.",
      },
    ],
  }),
  loader: () => requireUnlockedLoader(),
  component: Vender,
});

const payments: { id: PaymentMethod; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
];

function Vender() {
  const qc = useQueryClient();
  const fetchProducts = useServerFn(listProducts);
  const fetchCash = useServerFn(listCash);
  const submitSale = useServerFn(createSale);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts(),
  });
  const { data: cash = [] } = useQuery({ queryKey: ["cash"], queryFn: () => fetchCash() });

  const [cart, setCart] = useState<SaleItemInput[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("dinheiro");

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const todayIn = cash
    .filter((c) => c.kind === "entrada" && isToday(c.created_at))
    .reduce((s, c) => s + Number(c.amount), 0);

  const mutation = useMutation({
    mutationFn: () => submitSale({ data: { items: cart, payment_method: payment } }),
    onSuccess: () => {
      toast.success("Venda registrada!");
      setCart([]);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addProduct(p: (typeof products)[number]) {
    setCart((prev) => {
      const found = prev.find((i) => i.product_id === p.id);
      if (found)
        return prev.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i,
        );
      return [
        ...prev,
        {
          product_id: p.id,
          product_name: p.name,
          quantity: 1,
          unit_price: Number(p.price),
        },
      ];
    });
  }

  function changeQty(index: number, delta: number) {
    setCart((prev) =>
      prev
        .map((i, idx) => (idx === index ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );
  }

  const groups = [
    { key: "espetinho", label: "Espetinhos" },
    { key: "bebida", label: "Bebidas" },
    { key: "outro", label: "Outros" },
  ];

  return (
    <AppShell title="Nova venda">
      <Card className="mb-4 flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Vendido hoje</p>
          <p className="title text-3xl text-accent">{brl(todayIn)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase text-muted-foreground">Itens no carrinho</p>
          <p className="title text-3xl">{cart.reduce((s, i) => s + i.quantity, 0)}</p>
        </div>
      </Card>

      {groups.map((g) => {
        const list = products.filter((p) => p.category === g.key && p.active);
        if (!list.length) return null;
        return (
          <div key={g.key} className="mb-5 space-y-2">
            <SectionTitle>{g.label}</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {list.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-secondary"
                >
                  <p className="font-semibold leading-tight">{p.name}</p>
                  <p className="text-sm text-accent">{brl(p.price)}</p>
                  <p className="text-xs text-muted-foreground">Estoque: {p.stock}</p>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {cart.length > 0 && (
        <Card className="space-y-3 p-4">
          <SectionTitle>Carrinho</SectionTitle>
          {cart.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-sm font-semibold">{item.product_name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      setCart((prev) =>
                        prev.map((i, idx) =>
                          idx === index
                            ? { ...i, unit_price: Number(e.target.value) }
                            : i,
                        ),
                      )
                    }
                    className="h-8 w-24"
                  />
                </div>
              </div>
              <Button variant="secondary" size="icon" onClick={() => changeQty(index, -1)}>
                <Minus className="size-4" />
              </Button>
              <span className="w-6 text-center font-bold">{item.quantity}</span>
              <Button variant="secondary" size="icon" onClick={() => changeQty(index, 1)}>
                <Plus className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCart((prev) => prev.filter((_, idx) => idx !== index))}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2 pt-2">
            {payments.map((p) => (
              <Button
                key={p.id}
                variant={payment === p.id ? "default" : "secondary"}
                onClick={() => setPayment(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="title text-3xl text-accent">{brl(total)}</span>
          </div>

          <Button
            className="h-12 w-full text-base font-bold"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Registrando..." : "Finalizar venda"}
          </Button>
        </Card>
      )}
    </AppShell>
  );
}
