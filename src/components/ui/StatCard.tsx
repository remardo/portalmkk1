import type { ElementType } from "react";
import { Card } from "./Card";

type StatCardVariant = "teal" | "emerald" | "amber" | "cyan" | "sky" | "rose";

const variantStyles: Record<StatCardVariant, { bg: string; iconBg: string }> = {
  teal: { bg: "bg-teal-50", iconBg: "bg-teal-500" },
  emerald: { bg: "bg-emerald-50", iconBg: "bg-emerald-500" },
  amber: { bg: "bg-amber-50", iconBg: "bg-amber-500" },
  cyan: { bg: "bg-cyan-50", iconBg: "bg-cyan-500" },
  sky: { bg: "bg-sky-50", iconBg: "bg-sky-500" },
  rose: { bg: "bg-rose-50", iconBg: "bg-rose-500" },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  variant = "teal",
  sub,
  trend,
  onClick,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  variant?: StatCardVariant;
  sub?: string;
  trend?: { value: number; positive: boolean };
  onClick?: () => void;
}) {
  const styles = variantStyles[variant];

  return (
    <Card
      className={`p-5 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      hover={!!onClick}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${styles.iconBg} shadow-lg shadow-${variant}-200/50`}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.positive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {trend.positive ? "+" : ""}
                {trend.value}%
              </span>
            )}
          </div>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

export function StatCardCompact({
  icon: Icon,
  label,
  value,
  variant = "teal",
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  variant?: StatCardVariant;
}) {
  const styles = variantStyles[variant];

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.iconBg}`}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

