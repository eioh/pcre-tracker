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
    <section className="rounded-[20px] border border-white/30 bg-linear-to-br from-section-from to-section-to p-6">
      <Tabs defaultValue="dungeon_coin">
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
              <div className="grid grid-cols-4 gap-2">
                {names.map((name) => (
                  <div
                    key={name}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-center text-sm"
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
