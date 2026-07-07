import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";

type InputFilterSheetProps = {
  // シートの開閉状態（永続化しないローカル state を親が持つ）。
  open: boolean;
  // シートの開閉通知。
  onOpenChange: (open: boolean) => void;
  // 配線済みのフィルタ・表示設定 UI（InputFilters / InputMemoryCalcSettings）を親から受け取る。
  children: ReactNode;
};

// モバイル向けの絞り込み・表示設定ボトムシート。
// props の再宣言を避けるため、フィルタ UI は配線済みの children として受け取る薄いラッパーに徹する。
export function InputFilterSheet({ open, onOpenChange, children }: InputFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* iOS の safe-area（ホームバー）を padding で回避しつつ、はみ出す分は縦スクロールで閲覧する */}
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <SheetHeader>
          <SheetTitle>絞り込みと表示設定</SheetTitle>
          <SheetDescription className="sr-only">
            キャラ一覧の絞り込み・ソート・必要メモピ計算の設定を行うシートです。
          </SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
