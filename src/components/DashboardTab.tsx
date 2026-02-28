import { useMemo, useState } from "react";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { buildDashboardSummary, buildGachaPullChartItems } from "../utils/dashboard";
import { DistributionChart } from "./ui/distribution-chart";
import { GachaPullChart } from "./ui/gacha-pull-chart";
import { Input } from "./ui/input";
import { StatCard } from "./ui/stat-card";

type DashboardTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
};

// パーセンテージを小数1桁で表示する文字列へ変換する。
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// 指定日付を YYYY-MM-DD 形式へ整形する。
function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 今年1月1日の YYYY-MM-DD 文字列を返す。
function getCurrentYearStartDateOnlyString(today: Date): string {
  return `${today.getFullYear()}-01-01`;
}

// 表示範囲内のガチャ回数平均を算出し、小数1桁へ丸める。
function calculateAveragePullCount(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

// 全体の育成進捗サマリーをカードと分布で表示する。
export function DashboardTab({ masterCharacters, state }: DashboardTabProps) {
  const today = useMemo(() => new Date(), []);
  const [fromDate, setFromDate] = useState(() => getCurrentYearStartDateOnlyString(today));
  const [toDate, setToDate] = useState(() => toDateOnlyString(today));
  const summary = useMemo(() => buildDashboardSummary(masterCharacters, state), [masterCharacters, state]);
  const gachaPullChartItems = useMemo(
    () => buildGachaPullChartItems(masterCharacters, state, fromDate, toDate),
    [masterCharacters, state, fromDate, toDate],
  );
  const averagePullCount = useMemo(
    () => calculateAveragePullCount(gachaPullChartItems.map((item) => item.gachaPullCount)),
    [gachaPullChartItems],
  );
  const ownedRate = summary.totalCharacters === 0 ? 0 : (summary.ownedCharacters / summary.totalCharacters) * 100;
  const limitBreakRate =
    summary.totalCharacters === 0 ? 0 : (summary.limitBreakCharacters / summary.totalCharacters) * 100;
  const star6Rate = summary.star6.implemented === 0 ? 0 : (summary.star6.promoted / summary.star6.implemented) * 100;

  return (
    <section className="grid gap-5 rounded-[20px] border border-white/30 bg-linear-to-br from-section-from to-section-to p-5 shadow-panel">
      <header className="grid gap-1">
        <h2 className="m-0 text-[0.95rem] font-semibold tracking-[0.1em] text-sub">PROGRESS DASHBOARD</h2>
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

      <section className="grid gap-3 rounded-2xl border border-panel-border bg-linear-to-br from-panel-from to-panel-to p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="mb-1 mt-0 text-sm font-semibold tracking-[0.06em]">ガチャ回数推移</h3>
            <p className="m-0 mt-1 text-xs text-sub">
              表示範囲の平均: {gachaPullChartItems.length === 0 ? "-" : `${averagePullCount.toFixed(1)}回`}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-muted">
              開始日
              <Input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted">
              終了日
              <Input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </div>
        </div>
        {fromDate > toDate ? (
          <p className="m-0 text-sm text-muted">開始日が終了日より後です。範囲を見直してください。</p>
        ) : (
          <GachaPullChart items={gachaPullChartItems} averagePullCount={averagePullCount} />
        )}
      </section>
    </section>
  );
}
