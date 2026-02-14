import { Bell, CheckCheck } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { usePortalData, useReadAllNotificationsMutation, useReadNotificationMutation } from "../hooks/usePortalData";

export function NotificationsPage() {
  const { data } = usePortalData();
  const readOne = useReadNotificationMutation();
  const readAll = useReadAllNotificationsMutation();

  if (!data) {
    return null;
  }

  const notifications = data.notifications;
  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Уведомления</h1>
        <button
          onClick={() => readAll.mutate()}
          disabled={unreadCount === 0 || readAll.isPending}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Отметить всё прочитанным
        </button>
      </div>

      <Card className="p-4">
        <p className="text-sm text-gray-600">Непрочитанные: {unreadCount}</p>
      </Card>

      <div className="space-y-2">
        {notifications.map((item) => (
          <Card key={item.id} className={`p-4 ${item.isRead ? "opacity-70" : ""}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge
                className={
                  item.level === "critical"
                    ? "bg-red-100 text-red-700"
                    : item.level === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                }
              >
                {item.level}
              </Badge>
              {!item.isRead ? <Badge className="bg-slate-100 text-slate-700">new</Badge> : null}
              <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <p className="font-medium text-gray-900">{item.title}</p>
            <p className="mt-1 text-sm text-gray-600">{item.body}</p>

            {!item.isRead ? (
              <button
                onClick={() => readOne.mutate(item.id)}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Прочитано
              </button>
            ) : null}
          </Card>
        ))}

        {notifications.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <Bell className="mx-auto mb-2 h-5 w-5" />
            Уведомлений пока нет.
          </Card>
        ) : null}
      </div>
    </div>
  );
}
