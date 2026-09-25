import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell, SectionTitle } from "@/components/AppShell";
import { requireUnlockedLoader } from "@/lib/gate-loader";
import { listCash, addCashEntry, deleteCashEntry } from "@/lib/data.functions";
import type { PaymentMethod } from "@/lib/data.functions";
import { brl, dateTime, isToday } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa | Resenha Espetinho" },
      {
        name: "description",
        content: "Fluxo de caixa com entradas, saídas e saldo do Resenha Espetinho.",
      },
      { property: "og:title", content: "Caixa | Resenha Espetinho" },
      {
        property: "og:description",
        content: "Fluxo de caixa com entradas, saídas e saldo do Resenha Espetinho.",
      },
    ],
  }),
  loader: () => requireUnlockedLoader(),
  component: Caixa,
});

const methods: { id: PaymentMethod; label: string }[] = [
  { id: "dinheiro", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "cartao", label: "Cartão" },
];

function Caixa() {
  const qc = useQueryClient();
  const fetchCash = useServerFn(listCash);
  const add = useServerFn(addCashEntry);
  const remove = useServerFn(deleteCashEntry);

  const { data: entries = [] } = useQuery({
    queryKey: ["cash"],
    queryFn: () => fetchCash(),
  });

  const [kind, setKind] = useState<"entrada" | "saida">("saida");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("dinheiro");
  const [onlyToday, setOnlyToday] = useState(true);

  const visible = entries.filter((e) => (onlyToday ? isToday(e.created_at) : true));
  const sum = (k: string, m?: PaymentMethod) =>
    visible
      .filter((e) => e.kind === k && (!m || e.payment_method === m))
      .reduce((s, e) => s + Number(e.amount), 0);

  const inTotal = sum("entrada");
  const outTotal = sum("saida");

  const addMutation = useMutation({
    mutationFn: () =>
      add({
        data: {
          kind,
          amount: Number(amount),
          description: description || (kind === "saida" ? "Saída" : "Entrada"),
          payment_method: method,
        },
      }),
    onSuccess: () => {
      toast.success("Lançamento salvo");
      setAmount("");
      setDescription("");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Caixa">
      <div className="mb-3 flex gap-2">
        <Button
          variant={onlyToday ? "default" : "secondary"}
          size="sm"
          onClick={() => setOnlyToday(true)}
        >
          Hoje
        </Button>
        <Button
          variant={!onlyToday ? "default" : "secondary"}
          size="sm"
          onClick={() => setOnlyToday(false)}
        >
          Tudo
        </Button>
      </div>

      <Card className="mb-4 grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Entradas</p>
          <p className="title text-xl text-success">{brl(inTotal)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Saídas</p>
          <p className="title text-xl text-destructive">{brl(outTotal)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Saldo</p>
          <p className="title text-xl text-accent">{brl(inTotal - outTotal)}</p>
        </div>
      </Card>

      <Card className="mb-4 grid grid-cols-3 gap-2 p-4 text-center">
        {methods.map((m) => (
          <div key={m.id}>
            <p className="text-[11px] uppercase text-muted-foreground">{m.label}</p>
            <p className="font-bold">{brl(sum("entrada", m.id))}</p>
          </div>
        ))}
      </Card>

      <Card className="mb-4 space-y-3 p-4">
        <SectionTitle>Novo lançamento</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={kind === "entrada" ? "default" : "secondary"}
            onClick={() => setKind("entrada")}
          >
            Entrada
          </Button>
          <Button
            variant={kind === "saida" ? "default" : "secondary"}
            onClick={() => setKind("saida")}
          >
            Saída
          </Button>
        </div>
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="Valor (R$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          placeholder="Descrição (ex: compra de carvão)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => (
            <Button
              key={m.id}
              variant={method === m.id ? "default" : "secondary"}
              size="sm"
              onClick={() => setMethod(m.id)}
            >
              {m.label}
            </Button>
          ))}
        </div>
        <Button
          className="w-full font-bold"
          disabled={!amount || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          Salvar lançamento
        </Button>
      </Card>

      <div className="space-y-2">
        {visible.map((e) => (
          <Card key={e.id} className="flex items-center justify-between gap-2 p-3">
            <div>
              <p className="text-sm font-semibold">{e.description}</p>
              <p className="text-xs text-muted-foreground">
                {dateTime(e.created_at)}
                {e.payment_method ? ` · ${e.payment_method}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={
                  e.kind === "entrada"
                    ? "font-bold text-success"
                    : "font-bold text-destructive"
                }
              >
                {e.kind === "entrada" ? "+" : "−"} {brl(e.amount)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir lançamento"
                onClick={() =>
                  remove({ data: { id: e.id } }).then(() => qc.invalidateQueries())
                }
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
