import { useMemo } from "react";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { buildDashboardSummary } from "../utils/dashboard";
import { DistributionChart } from "./ui/distribution-chart";
import { StatCard } from "./ui/stat-card";

type DashboardTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
};

// パーセンテージを小数1桁で表示する文字列へ変換する。
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// 全体の育成進捗サマリーをカードと分布で表示する。
export function DashboardTab({ masterCharacters, state }: DashboardTabProps) {
  const summary = useMemo(() => buildDashboardSummary(masterCharacters, state), [masterCharacters, state]);
  const ownedRate = summary.totalCharacters === 0 ? 0 : (summary.ownedCharacters / summary.totalCharacters) * 100;
  const limitBreakRate =
    summary.totalCharacters === 0 ? 0 : (summary.limitBreakCharacters / summary.totalCharacters) * 100;
  const star6Rate = summary.star6.implemented === 0 ? 0 : (summary.star6.promoted / summary.star6.implemented) * 100;

  return (
    <section className="grid gap-5 rounded-[20px] border border-white/30 bg-linear-to-br from-[#131a27cc] to-[#0d1421f2] p-5 shadow-panel">
      <header className="grid gap-1">
        <h2 className="m-0 text-[0.95rem] font-semibold tracking-[0.1em] text-[#c8d8f6]">PROGRESS DASHBOARD</h2>
        <p className="m-0 text-sm text-muted">育成状態を主要指標と分布で確認できます</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="所持キャラ数"
          value={
            <>
              {summary.ownedCharacters} / {summary.totalCharacters}
            </>
          }
          subText={<>所持率 {formatPercent(ownedRate)}</>}
        />

        <StatCard
          title="限界突破数"
          value={
            <>
              {summary.limitBreakCharacters} / {summary.totalCharacters}
            </>
          }
          subText={<>全体比 {formatPercent(limitBreakRate)}</>}
        />

        <StatCard
          title="専用1SP装備数"
          value={
            <>
              {summary.ue1Sp.equipped} / {summary.ue1Sp.implemented}
            </>
          }
          subText={<>未装備 {summary.ue1Sp.unequipped}</>}
        />

        <StatCard
          title="☆6進捗"
          value={
            <>
              {summary.star6.promoted} / {summary.star6.implemented}
            </>
          }
          subText={<>達成率 {formatPercent(star6Rate)}</>}
        />

        <StatCard
          title="専用1必要ハート欠片"
          value={
            <>
              {summary.ue1HeartFragmentNeededImplementedTotal} / {summary.ue1HeartFragmentNeededAssumedMaxTotal}
            </>
          }
          subText={<>実装キャラ分 / 未実装も含む想定</>}
          className="xl:col-span-2"
        />

        <StatCard
          title="必要メモピ合計"
          value={summary.memoryPieceNeeded.total}
          subText={
            <>
              ☆{summary.memoryPieceNeeded.star} / CR{summary.memoryPieceNeeded.connectRank} / 専1{summary.memoryPieceNeeded.ue1}
              {" / "}限凸{summary.memoryPieceNeeded.limitBreak}
            </>
          }
          className="xl:col-span-2"
        />

        <StatCard
          title="コネクトRANK必要素材"
          value={
            <>
              {summary.connectRankMaterialNeeded.arts} / {summary.connectRankMaterialNeeded.soul} /{" "}
              {summary.connectRankMaterialNeeded.guard}
            </>
          }
          subText={<>アーツ / ソウル / ガード</>}
          className="xl:col-span-2"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <DistributionChart title="☆分布" items={summary.starDistribution} />
        <DistributionChart title="専用1レベル分布" items={summary.ue1Distribution} />
        <DistributionChart title="専用2レベル分布" items={summary.ue2Distribution} />
      </div>
    </section>
  );
}
