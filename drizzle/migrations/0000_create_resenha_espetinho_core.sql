CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('espetinho','bebida','outro')),
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('dinheiro','pix','cartao')),
  operator text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0
);
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX sale_items_sale_id_idx ON public.sale_items(sale_id);

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('entrada','saida','venda','ajuste')),
  quantity integer NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('entrada','saida')),
  amount numeric(10,2) NOT NULL,
  description text NOT NULL,
  payment_method text CHECK (payment_method IN ('dinheiro','pix','cartao')),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.cash_entries TO service_role;
ALTER TABLE public.cash_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX cash_entries_created_at_idx ON public.cash_entries(created_at);

INSERT INTO public.products (name, category, price, cost, stock) VALUES
  ('Espetinho de Carne', 'espetinho', 10.00, 5.00, 50),
  ('Espetinho de Frango', 'espetinho', 9.00, 4.50, 50),
  ('Espetinho de Linguiça', 'espetinho', 9.00, 4.00, 40),
  ('Espetinho de Coração', 'espetinho', 11.00, 6.00, 30),
  ('Pão de Alho', 'espetinho', 7.00, 3.00, 25),
  ('Cerveja Lata', 'bebida', 8.00, 4.00, 60),
  ('Refrigerante Lata', 'bebida', 6.00, 3.00, 40),
  ('Água Mineral', 'bebida', 4.00, 1.50, 30);