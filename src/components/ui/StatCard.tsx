import type { ElementType } from "react";
import { Card } from "./Card";

export function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900 sm:text-2xl">{value}</p>
          {sub ? <p className="truncate text-xs text-gray-400">{sub}</p> : null}
        </div>
      </div>
    </Card>
  );
}