import { useCallback, useRef, type ChangeEvent } from "react";
import { Button } from "./button";

type FileImportButtonProps = {
  label: string;
  accept?: string;
  onSelectFile: (file: File) => void | Promise<void>;
};

// ボタン押下でファイル選択を開き、選択ファイルを親へ渡す。
export function FileImportButton({ label, accept, onSelectFile }: FileImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 非表示inputを開いてファイル選択ダイアログを表示する。
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // 選択されたファイルを取り出して親ハンドラへ通知する。
  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }
      void onSelectFile(file);
    },
    [onSelectFile],
  );

  return (
    <>
      <Button type="button" variant="outline" onClick={openFileDialog}>
        {label}
      </Button>
      <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
    </>
  );
}
