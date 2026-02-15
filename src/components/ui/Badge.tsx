import type { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "purple";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-sky-100 text-sky-700",
  purple: "bg-purple-100 text-purple-700",
};

export function Badge({
  children,
  className = "",
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: "draft" | "published" | "archived" | "pending" | "done" | "overdue" | "review";
}) {
  const config = {
    draft: { variant: "warning" as const, label: "Черновик" },
    published: { variant: "success" as const, label: "Опубликован" },
    archived: { variant: "default" as const, label: "Архив" },
    pending: { variant: "info" as const, label: "В процессе" },
    done: { variant: "success" as const, label: "Выполнено" },
    overdue: { variant: "danger" as const, label: "Просрочено" },
    review: { variant: "purple" as const, label: "На проверке" },
  };
  const c = config[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
