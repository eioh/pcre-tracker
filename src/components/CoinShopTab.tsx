import coinShopData from "../data/coinShopMemoryPiece.json";
import { memorySourceLabelMap } from "./input/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import type { MemoryPieceSource } from "../domain/types";

const COIN_TYPES: MemoryPieceSource[] = [
  "dungeon_coin",
  "arena_coin",
  "p_arena_coin",
  "clan_coin",
  "master_coin",
];

// コインショップで交換可能なメモリーピース一覧を表示するタブ。
export function CoinShopTab() {
  return (
    <section className="grid min-w-0 gap-5">
      {/* タブ列の最小内容幅でgrid項目が膨張しないよう、親幅まで縮小可能にする。 */}
      <Tabs defaultValue="dungeon_coin" className="min-w-0">
        <TabsList className="mb-5">
          {COIN_TYPES.map((coinType) => (
            <TabsTrigger key={coinType} value={coinType}>
              {memorySourceLabelMap[coinType]}
            </TabsTrigger>
          ))}
        </TabsList>

        {COIN_TYPES.map((coinType) => {
          const names = (coinShopData as Record<string, string[]>)[coinType] ?? [];
          return (
            <TabsContent key={coinType} value={coinType}>
              {/* モバイル(md 未満)では2列、デスクトップでは従来どおり4列で表示する */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {names.map((name) => (
                  <div
                    key={name}
                    className="min-w-0 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-sm [overflow-wrap:anywhere]"
                  >
                    {name}
                  </div>
                ))}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
