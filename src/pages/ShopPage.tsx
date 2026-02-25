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
        <Card className="rounded-2xl border border-gray-200 px-5 py-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-gray-500">Ваш баланс</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{user.points} <span className="text-base font-medium text-teal-600">баллов</span></p>
        </Card>
      </div>

      {successMessage ? (
        <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{successMessage}</Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {productsByCategory.map(([category, products]) => (
            <Card key={category} className="rounded-2xl border border-gray-200 p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-gray-900">{category}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((product) => (
                  <div key={product.id} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-1 hover:border-teal-300 hover:shadow-md">
                    <div>
                      <p className="text-base font-semibold text-gray-900">
                        {product.imageEmoji ? <span className="mr-1 inline-block">{product.imageEmoji}</span> : ""}
                        {product.name}
                      </p>
                      {product.imageDataBase64 || product.imageUrl ? (
                        <div
                          className="mt-3 flex w-full items-center justify-center overflow-hidden rounded-xl bg-gray-50/50 p-4 transition-colors group-hover:bg-gray-50"
                          style={{ aspectRatio: "1 / 1" }}
                        >
                          <img
                            src={
                              product.imageDataBase64
                                ? `data:${product.imageMimeType ?? "image/png"};base64,${product.imageDataBase64}`
                                : (product.imageUrl ?? "")
                            }
                            alt={product.name}
                            className="max-h-full max-w-full object-contain mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      ) : null}
                      <p className="mt-3 line-clamp-2 text-sm text-gray-600">{product.description ?? "Без описания"}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium">{product.isMaterial ? "Материальный" : "Нематериальный"}</span>
                        <span className="font-medium">{product.stockQty === null ? "Без лимита" : `Остаток: ${product.stockQty}`}</span>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
                      <p className="text-lg font-bold text-teal-700">{product.pricePoints} <span className="text-sm font-medium text-teal-600">баллов</span></p>
                      <button
                        onClick={() => increment(product.id)}
                        className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
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

        <Card className="h-fit rounded-2xl border border-gray-200 p-5 shadow-sm transition hover:shadow-md">
          <h2 className="text-lg font-bold text-gray-900">Корзина</h2>
          <div className="mt-4 space-y-3">
            {cartRows.map((row) => (
              <div key={row.product.id} className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{row.product.name}</p>
                    <p className="mt-1 text-xs text-teal-700">
                      <span className="font-bold">{row.quantity}</span> шт. × {row.product.pricePoints} = <span className="font-bold">{row.quantity * row.product.pricePoints}</span> баллов
                    </p>
                  </div>
                  <button
                    onClick={() => decrement(row.product.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    title="Убрать 1 шт."
                  >
                    -
                  </button>
                </div>
              </div>
            ))}
            {cartRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                Ваша корзина пока пуста.
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600">Итого к списанию:</p>
              <p className="text-lg font-bold text-teal-700">{totalPoints} баллов</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <textarea
              value={deliveryInfo}
              onChange={(event) => setDeliveryInfo(event.target.value)}
              rows={2}
              placeholder="Адрес офиса или информация по доставке"
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={2}
              placeholder="Комментарий к заказу (размер, пожелания)"
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-400 focus:bg-white focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <button
            onClick={() => void checkout()}
            disabled={cartRows.length === 0 || createOrder.isPending}
            className="mt-6 w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            {createOrder.isPending ? "Оформление..." : "Оформить заказ"}
          </button>
          {createOrder.isError ? (
            <p className="mt-3 text-center text-sm font-medium text-rose-600">{createOrder.error instanceof Error ? createOrder.error.message : "Произошла ошибка при оформлении"}</p>
          ) : null}
        </Card>
      </div>

      <Card className="rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-gray-900">История заказов</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myOrders.map((order) => {
            const items = data.shopOrderItems.filter((item) => item.orderId === order.id);
            return (
              <div key={order.id} className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4 transition-colors hover:border-gray-200 hover:bg-white hover:shadow-sm">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">Заказ #{order.id}</p>
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                            'bg-gray-200 text-gray-800'
                      }`}>
                      {statusLabels[order.status]}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>

                  <div className="mt-3 border-t border-gray-200 pt-3">
                    <ul className="space-y-1">
                      {items.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700 truncate mr-2" title={item.productName}>{item.productName}</span>
                          <span className="font-semibold text-gray-900">{item.quantity} шт.</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-4 border-t border-dashed border-gray-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">Сумма:</span>
                    <span className="text-sm font-bold text-teal-700">{order.totalPoints} баллов</span>
                  </div>
                  {order.deliveryInfo ? (
                    <p className="mt-2 rounded bg-white p-2 text-xs italic text-gray-600 shadow-sm border border-gray-100">
                      «{order.deliveryInfo}»
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
          {myOrders.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
              <p className="text-sm font-medium text-gray-500">Вы пока не совершали покупок.</p>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

