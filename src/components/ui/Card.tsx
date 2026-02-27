import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  onClick,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[1.75rem] border border-white/60 ring-1 ring-zinc-100/50 bg-white ${onClick || hover
          ? "cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-zinc-100 hover:-translate-y-0.5"
          : "shadow-sm shadow-zinc-200/40"
        } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-zinc-50 px-6 py-5 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-zinc-50 px-6 py-5 ${className}`}>
      {children}
    </div>
  );
}
