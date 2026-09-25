import { createServerFn } from "@tanstack/react-start";

export type Category = "espetinho" | "bebida" | "outro";
export type PaymentMethod = "dinheiro" | "pix" | "cartao";

export type SaleItemInput = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
};

async function ctx() {
  const { requireUnlocked, getAdmin } = await import("./gate.server");
  await requireUnlocked();
  return await getAdmin();
}

/* ---------------------------- produtos ---------------------------- */

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const db = await ctx();
  const { data, error } = await db
    .from("products")
    .select("*")
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const saveProduct = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      category: Category;
      price: number;
      cost: number;
      stock: number;
      active: boolean;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await ctx();
    if (data.id) {
      const { error } = await db
        .from("products")
        .update({
          name: data.name,
          category: data.category,
          price: data.price,
          cost: data.cost,
          stock: data.stock,
          active: data.active,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await db.from("products").insert({
      name: data.name,
      category: data.category,
      price: data.price,
      cost: data.cost,
      stock: data.stock,
      active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await ctx();
    const { error } = await db.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- estoque ---------------------------- */

async function shiftStock(
  db: Awaited<ReturnType<typeof ctx>>,
  productId: string,
  delta: number,
) {
  const { data, error } = await db
    .from("products")
    .select("stock")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return;
  const next = (data.stock ?? 0) + delta;
  const { error: upErr } = await db
    .from("products")
    .update({ stock: next })
    .eq("id", productId);
  if (upErr) throw new Error(upErr.message);
}

export const listMovements = createServerFn({ method: "GET" }).handler(async () => {
  const db = await ctx();
  const { data, error } = await db
    .from("stock_movements")
    .select("*, products(name, category)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const registerMovement = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      product_id: string;
      kind: "entrada" | "saida" | "ajuste";
      quantity: number;
      note?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await ctx();
    const qty = Math.abs(data.quantity);
    const delta = data.kind === "entrada" ? qty : data.kind === "saida" ? -qty : qty;
    if (data.kind === "ajuste") {
      const { error } = await db
        .from("products")
        .update({ stock: qty })
        .eq("id", data.product_id);
      if (error) throw new Error(error.message);
    } else {
      await shiftStock(db, data.product_id, delta);
    }
    const { error } = await db.from("stock_movements").insert({
      product_id: data.product_id,
      kind: data.kind,
      quantity: data.kind === "saida" ? -qty : qty,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- vendas ---------------------------- */

export const listSales = createServerFn({ method: "GET" }).handler(async () => {
  const db = await ctx();
  const { data, error } = await db
    .from("sales")
    .select("*, sale_items(*)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
});

async function applySaleStock(
  db: Awaited<ReturnType<typeof ctx>>,
  items: SaleItemInput[],
  sign: 1 | -1,
) {
  for (const item of items) {
    if (!item.product_id) continue;
    await shiftStock(db, item.product_id, sign * item.quantity);
  }
}

export const createSale = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      items: SaleItemInput[];
      payment_method: PaymentMethod;
      operator?: string;
      note?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await ctx();
    if (!data.items.length) throw new Error("Adicione pelo menos um item");
    const total = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const { data: sale, error } = await db
      .from("sales")
      .insert({
        total,
        payment_method: data.payment_method,
        operator: data.operator ?? null,
        note: data.note ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsErr } = await db.from("sale_items").insert(
      data.items.map((i) => ({
        sale_id: sale.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    );
    if (itemsErr) throw new Error(itemsErr.message);

    await applySaleStock(db, data.items, -1);
    for (const i of data.items) {
      if (!i.product_id) continue;
      await db.from("stock_movements").insert({
        product_id: i.product_id,
        kind: "venda",
        quantity: -i.quantity,
        note: "Venda",
      });
    }

    await db.from("cash_entries").insert({
      kind: "entrada",
      amount: total,
      description: "Venda",
      payment_method: data.payment_method,
      sale_id: sale.id,
    });

    return { ok: true, id: sale.id };
  });

export const updateSale = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      items: SaleItemInput[];
      payment_method: PaymentMethod;
      note?: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await ctx();
    const { data: oldItems, error: oldErr } = await db
      .from("sale_items")
      .select("*")
      .eq("sale_id", data.id);
    if (oldErr) throw new Error(oldErr.message);

    await applySaleStock(
      db,
      (oldItems ?? []).map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
      })),
      1,
    );

    await db.from("sale_items").delete().eq("sale_id", data.id);

    const total = data.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    if (data.items.length) {
      const { error: insErr } = await db.from("sale_items").insert(
        data.items.map((i) => ({
          sale_id: data.id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      );
      if (insErr) throw new Error(insErr.message);
      await applySaleStock(db, data.items, -1);
    }

    const { error: upErr } = await db
      .from("sales")
      .update({
        total,
        payment_method: data.payment_method,
        note: data.note ?? null,
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    await db
      .from("cash_entries")
      .update({ amount: total, payment_method: data.payment_method })
      .eq("sale_id", data.id);

    return { ok: true };
  });

export const deleteSale = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await ctx();
    const { data: items } = await db.from("sale_items").select("*").eq("sale_id", data.id);
    await applySaleStock(
      db,
      (items ?? []).map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
      })),
      1,
    );
    const { error } = await db.from("sales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- caixa ---------------------------- */

export const listCash = createServerFn({ method: "GET" }).handler(async () => {
  const db = await ctx();
  const { data, error } = await db
    .from("cash_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const addCashEntry = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      kind: "entrada" | "saida";
      amount: number;
      description: string;
      payment_method?: PaymentMethod;
    }) => d,
  )
  .handler(async ({ data }) => {
    const db = await ctx();
    const { error } = await db.from("cash_entries").insert({
      kind: data.kind,
      amount: Math.abs(data.amount),
      description: data.description,
      payment_method: data.payment_method ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCashEntry = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = await ctx();
    const { error } = await db.from("cash_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
