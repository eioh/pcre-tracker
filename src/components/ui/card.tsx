import * as React from "react";
import { cn } from "../../lib/utils";

// カードコンテナを描画する。
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("rounded-xl border bg-card text-card-foreground shadow", className)} {...props} />;
});
Card.displayName = "Card";

// カードのヘッダー領域を描画する。
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardHeader(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
});
CardHeader.displayName = "CardHeader";

// カードのタイトルを描画する。
const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardTitle(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
});
CardTitle.displayName = "CardTitle";

// カードの説明テキストを描画する。
const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardDescription({ className, ...props }, ref) {
    return <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
  },
);
CardDescription.displayName = "CardDescription";

// カードのコンテンツ領域を描画する。
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardContent(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />;
});
CardContent.displayName = "CardContent";

// カードのフッター領域を描画する。
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function CardFooter(
  { className, ...props },
  ref,
) {
  return <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />;
});
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
