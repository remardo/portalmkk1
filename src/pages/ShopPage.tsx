import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { useAuth } from "../contexts/useAuth";
import { useCreateShopOrderMutation, usePortalData } from "../hooks/usePortalData";

const statusLabels: Record<"new" | "processing" | "shipped" | "delivered" | "cancelled", string> = {
  new: "Новый",
  processing: "В обработке",
  shipped: "Отгружен",
  delivered: "Доставлен",
  cancelled: "Отменен",
};

export function ShopPage() {
  const { user } = useAuth();
  const { data } = usePortalData();
  const createOrder = useCreateShopOrderMutation();

  const [cart, setCart] = useState<Record<number, number>>({});
  const [deliveryInfo, setDeliveryInfo] = useState("");
  const [comment, setComment] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const productsByCategory = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof data>["shopProducts"]>();
    for (const product of data?.shopProducts ?? []) {
      const key = product.category || "Разное";
      const current = grouped.get(key) ?? [];
      current.push(product);
      grouped.set(key, current);
    }
    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru"));
  }, [data?.shopProducts]);

  if (!user || !data) {
    return null;
  }

  const productById = new Map(data.shopProducts.map((product) => [product.id, product]));
  const cartRows = Object.entries(cart)
    .map(([productId, quantity]) => ({ product: productById.get(Number(productId)), quantity }))
    .filter((row): row is { product: (typeof data.shopProducts)[number]; quantity: number } => Boolean(row.product) && row.quantity > 0);

  const totalPoints = cartRows.reduce((sum, row) => sum + row.product.pricePoints * row.quantity, 0);

  const myOrders = data.shopOrders.filter((order) => String(order.buyerUserId) === String(user.id));

  function increment(productId: number) {
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
  }

  function decrement(productId: number) {
    setCart((prev) => {
      const nextQty = (prev[productId] ?? 0) - 1;
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[productId];
      } else {
        next[productId] = nextQty;
      }
      return next;
    });
  }

  async function checkout() {
    if (cartRows.length === 0) {
      return;
    }
    await createOrder.mutateAsync({
      items: cartRows.map((row) => ({ productId: row.product.id, quantity: row.quantity })),
      deliveryInfo: deliveryInfo.trim() || undefined,
      comment: comment.trim() || undefined,
    });
    setCart({});
    setDeliveryInfo("");
    setComment("");
    setSuccessMessage("Заказ успешно оформлен.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Внутренний магазин</h1>
          <p className="text-sm text-gray-500">Покупайте товары и привилегии за баллы.</p>
        </div>
        <Card className="px-4 py-3">
          <p className="text-xs uppercase text-gray-500">Ваш баланс</p>
          <p className="text-xl font-bold text-indigo-700">{user.points} баллов</p>
        </Card>
      </div>

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {productsByCategory.map(([category, products]) => (
            <Card key={category} className="p-4">
              <h2 className="mb-3 text-base font-semibold text-gray-900">{category}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <div key={product.id} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {product.imageEmoji ? `${product.imageEmoji} ` : ""}
                      {product.name}
                    </p>
                    {product.imageDataBase64 || product.imageUrl ? (
                      <div
                        className="mt-2 flex w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-2"
                        style={{ aspectRatio: "1 / 1" }}
                      >
                        <img
                          src={
                            product.imageDataBase64
                              ? `data:${product.imageMimeType ?? "image/png"};base64,${product.imageDataBase64}`
                              : (product.imageUrl ?? "")
                          }
                          alt={product.name}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">{product.description ?? "Без описания"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{product.isMaterial ? "Материальный" : "Нематериальный"}</span>
                      <span>{product.stockQty === null ? "Без лимита" : `Остаток: ${product.stockQty}`}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm font-bold text-indigo-700">{product.pricePoints} баллов</p>
                      <button
                        onClick={() => increment(product.id)}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Купить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card className="h-fit p-4">
          <h2 className="text-base font-semibold text-gray-900">Корзина</h2>
          <div className="mt-3 space-y-2">
            {cartRows.map((row) => (
              <div key={row.product.id} className="rounded-lg border border-gray-200 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{row.product.name}</p>
                    <p className="text-xs text-gray-500">
                      {row.quantity} × {row.product.pricePoints} = {row.quantity * row.product.pricePoints} баллов
                    </p>
                  </div>
                  <button
                    onClick={() => decrement(row.product.id)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                  >
                    -1
                  </button>
                </div>
              </div>
            ))}
            {cartRows.length === 0 ? (
              <p className="text-sm text-gray-500">Корзина пуста.</p>
            ) : null}
          </div>
          <p className="mt-3 text-sm font-semibold text-gray-900">Итого: {totalPoints} баллов</p>
          <textarea
            value={deliveryInfo}
            onChange={(event) => setDeliveryInfo(event.target.value)}
            rows={2}
            placeholder="Информация по доставке (необязательно)"
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            placeholder="Комментарий к заказу (необязательно)"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={() => void checkout()}
            disabled={cartRows.length === 0 || createOrder.isPending}
            className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createOrder.isPending ? "Оформление..." : "Оформить заказ"}
          </button>
          {createOrder.isError ? (
            <p className="mt-2 text-xs text-rose-600">{createOrder.error instanceof Error ? createOrder.error.message : "Ошибка оформления"}</p>
          ) : null}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold text-gray-900">Мои заказы</h2>
        <div className="space-y-2">
          {myOrders.map((order) => {
            const items = data.shopOrderItems.filter((item) => item.orderId === order.id);
            return (
              <div key={order.id} className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">
                  Заказ #{order.id} · {statusLabels[order.status]}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleString()} · {order.totalPoints} баллов
                </p>
                {order.deliveryInfo ? (
                  <p className="mt-1 text-xs text-gray-600">Доставка: {order.deliveryInfo}</p>
                ) : null}
                <div className="mt-2 text-xs text-gray-600">
                  {items.map((item) => (
                    <p key={item.id}>
                      {item.productName} × {item.quantity}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
          {myOrders.length === 0 ? <p className="text-sm text-gray-500">Заказов пока нет.</p> : null}
        </div>
      </Card>
    </div>
  );
}
