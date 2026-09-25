import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Flame, ShoppingCart, Receipt, Boxes, Wallet, LogOut } from "lucide-react";
import type { ReactNode } from "react";

import { lockSite } from "@/lib/gate.functions";
import logo from "@/assets/logo-resenha.png.asset.json";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Vender", icon: ShoppingCart },
  { to: "/vendas", label: "Vendas", icon: Receipt },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/caixa", label: "Caixa", icon: Wallet },
] as const;

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const lock = useServerFn(lockSite);

  return (
    <div className="min-h-screen smoke-bg pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <img src={logo.url} alt="Resenha Espetinho" className="h-10 w-10 object-contain" />
          <div className="flex-1">
            <p className="title text-2xl text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">Resenha Espetinho</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sair"
            onClick={async () => {
              await lock();
              router.navigate({ to: "/entrar", replace: true });
            }}
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-1 px-2 py-3 text-xs text-muted-foreground transition-colors"
              activeProps={{ className: "text-accent" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="title flex items-center gap-2 text-xl text-foreground">
      <Flame className="size-4 text-primary" />
      {children}
    </h2>
  );
}
