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
      className={`rounded-2xl border border-gray-100 bg-white ${
        onClick || hover
          ? "cursor-pointer transition-all duration-200 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50"
          : "shadow-sm"
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
    <div className={`border-b border-gray-100 px-5 py-4 ${className}`}>
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
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-gray-100 px-5 py-4 ${className}`}>
      {children}
    </div>
  );
}
