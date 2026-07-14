import { useCallback, useRef, type ChangeEvent } from "react";
import { ChevronDown, Database, Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

type Props = {
  // バックアップJSONをダウンロードする。
  onExport: () => void;
  // 選択されたバックアップファイルをインポート確認へ渡す。
  onSelectImportFile: (file: File) => void;
  // 保存データ初期化の確認ダイアログを開く（ダイアログ本体は App 直下にある）。
  onRequestReset: () => void;
  // フォーマット済みの最終更新テキスト（App 側で整形済み）。
  updatedAtLabel: string;
};

// デスクトップヘッダーの「データ」ドロップダウンメニュー。
// エクスポート / インポート / 保存データ初期化の導線と最終更新日時の表示を集約する。
// hidden file input はメニューコンテンツの外（ルート直下）に置く。メニュー項目選択で
// コンテンツがアンマウントされても input が消えず、ファイル選択ダイアログが維持されるため。
export function HeaderDataMenu({ onExport, onSelectImportFile, onRequestReset, updatedAtLabel }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // インポート項目の選択時に非表示 input をクリックしてファイル選択ダイアログを開く。
  // Radix の onSelect（ユーザージェスチャ内）から同期で呼ぶことでブラウザにブロックされない。
  const handleSelectImportItem = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 選択されたファイルを取り出して親ハンドラへ通知する（同一ファイル再選択に備え value をリセットする）。
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      onSelectImportFile(file);
    },
    [onSelectImportFile],
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Database className="size-4" aria-hidden="true" />
            データ
            <ChevronDown className="size-4 opacity-70" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onExport}>
            <Download className="size-4" aria-hidden="true" />
            エクスポート
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleSelectImportItem}>
            <Upload className="size-4" aria-hidden="true" />
            インポート
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="danger" onSelect={onRequestReset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            保存データを初期化
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>最終更新: {updatedAtLabel}</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* メニュー閉鎖でアンマウントされない位置に置く hidden file input（設計方針 2）。 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />
    </>
  );
}
