import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { unlockSite } from "@/lib/gate.functions";
import logo from "@/assets/logo-resenha.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/entrar")({
  head: () => ({
    meta: [
      { title: "Entrar | Resenha Espetinho" },
      {
        name: "description",
        content: "Acesso ao painel de vendas, caixa e estoque do Resenha Espetinho.",
      },
      { property: "og:title", content: "Entrar | Resenha Espetinho" },
      {
        property: "og:description",
        content: "Acesso ao painel de vendas, caixa e estoque do Resenha Espetinho.",
      },
    ],
  }),
  component: Entrar,
});

function Entrar() {
  const router = useRouter();
  const unlock = useServerFn(unlockSite);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await unlock({ data: { password } });
    setLoading(false);
    if (res.ok) router.navigate({ to: "/" });
    else setError(true);
  }

  return (
    <div className="flex min-h-screen smoke-bg items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 text-center">
        <img src={logo.url} alt="Resenha Espetinho" className="mx-auto w-48" />
        <div>
          <h1 className="title text-3xl text-foreground">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Digite a senha da equipe para acessar o controle.
          </p>
        </div>
        <Input
          type="password"
          inputMode="text"
          autoComplete="current-password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 text-center text-lg"
        />
        {error && <p className="text-sm text-destructive">Senha incorreta.</p>}
        <Button type="submit" disabled={loading} className="h-12 w-full text-base font-bold">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
