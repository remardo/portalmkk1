export const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-700",
  review: "bg-orange-100 text-orange-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
};

export const statusLabels: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  overdue: "Просрочена",
  draft: "Черновик",
  review: "На согласовании",
  approved: "Утверждён",
  rejected: "Отклонён",
};

export const priorityColors: Record<string, string> = {
  low: "text-gray-400",
  medium: "text-yellow-500",
  high: "text-red-500",
};

export const typeLabels: Record<string, string> = {
  order: "Поручение",
  checklist: "Чеклист",
  auto: "Автоматическая",
  incoming: "Входящий",
  outgoing: "Исходящий",
  internal: "Внутренний",
};