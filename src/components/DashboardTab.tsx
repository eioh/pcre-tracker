import { useMemo } from "react";
import type { MasterCharacter, StoredStateV1 } from "../domain/types";
import { buildDashboardSummary } from "../utils/dashboard";

type DashboardTabProps = {
  masterCharacters: MasterCharacter[];
  state: StoredStateV1;
};

type DistributionProps = {
  title: string;
  items: { label: string; count: number }[];
};

// レベル分布データを棒グラフ風のリストで表示する。
function Distribution({ title, items }: DistributionProps) {
  const visibleItems = items.filter((item) => item.count > 0);
  const maxCount = visibleItems.length === 0 ? 1 : Math.max(...visibleItems.map((item) => item.count));

  return (
    <section className="rounded-2xl border border-[#6180b359] bg-[#090f19cc] p-4">
      <h3 className="mb-2.5 mt-0 text-base font-semibold">{title}</h3>
      <ul className="m-0 grid list-none gap-2 pr-1.5">
        {visibleItems.length === 0 ? (
          <li className="grid grid-cols-[80px_minmax(0,1fr)_4ch] items-center gap-2 text-sm text-muted">データがありません</li>
        ) : (
          visibleItems.map((item) => (
            <li key={item.label} className="grid grid-cols-[80px_minmax(0,1fr)_4ch] items-center gap-2">
              <span className="text-xs text-[#ccd9f5]">{item.label}</span>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-linear-to-r from-accent to-[#45e6ff]"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
              <strong className="w-[4ch] text-right font-orbitron text-sm tabular-nums">{item.count}</strong>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

// 全体の育成進捗サマリーをカードと分布で表示する。
export function DashboardTab({ masterCharacters, state }: DashboardTabProps) {
  const summary = useMemo(() => buildDashboardSummary(masterCharacters, state), [masterCharacters, state]);
  const ownedRate = summary.totalCharacters === 0 ? 0 : (summary.ownedCharacters / summary.totalCharacters) * 100;
  const limitBreakRate =
    summary.totalCharacters === 0 ? 0 : (summary.limitBreakCharacters / summary.totalCharacters) * 100;
  const star6Rate = summary.star6.implemented === 0 ? 0 : (summary.star6.promoted / summary.star6.implemented) * 100;

  return (
    <section className="grid gap-[18px] rounded-[18px] border border-white/30 bg-linear-to-br from-[#131a27cc] to-[#0d1421f2] p-5 shadow-panel">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[#6180b359] bg-[#090f19cc] p-4">
          <h3 className="m-0 text-sm text-muted">所持キャラ数</h3>
          <p className="mb-1.5 mt-2.5 font-orbitron text-[clamp(1.4rem,3vw,2rem)]">
            {summary.ownedCharacters} / {summary.totalCharacters}
          </p>
          <small className="text-sm text-muted">所持率 {ownedRate.toFixed(1)}%</small>
        </article>

        <article className="rounded-2xl border border-[#6180b359] bg-[#090f19cc] p-4">
          <h3 className="m-0 text-sm text-muted">限界突破数</h3>
          <p className="mb-1.5 mt-2.5 font-orbitron text-[clamp(1.4rem,3vw,2rem)]">
            {summary.limitBreakCharacters} / {summary.totalCharacters}
          </p>
          <small className="text-sm text-muted">全体比 {limitBreakRate.toFixed(1)}%</small>
        </article>

        <article className="rounded-2xl border border-[#6180b359] bg-[#090f19cc] p-4">
          <h3 className="m-0 text-sm text-muted">専用1SP装備数</h3>
          <p className="mb-1.5 mt-2.5 font-orbitron text-[clamp(1.4rem,3vw,2rem)]">
            {summary.ue1Sp.equipped} / {summary.ue1Sp.implemented}
          </p>
          <small className="text-sm text-muted">未装備 {summary.ue1Sp.unequipped}</small>
        </article>

        <article className="rounded-2xl border border-[#6180b359] bg-[#090f19cc] p-4">
          <h3 className="m-0 text-sm text-muted">☆6進捗</h3>
          <p className="mb-1.5 mt-2.5 font-orbitron text-[clamp(1.4rem,3vw,2rem)]">
            {summary.star6.promoted} / {summary.star6.implemented}
          </p>
          <small className="text-sm text-muted">達成率 {star6Rate.toFixed(1)}%</small>
        </article>

        <article className="rounded-2xl border border-[#6180b359] bg-[#090f19cc] p-4">
          <h3 className="m-0 text-sm text-muted">専用1必要ハート欠片</h3>
          <p className="mb-1.5 mt-2.5 font-orbitron text-[clamp(1.1rem,2.4vw,1.6rem)]">
            {summary.ue1HeartFragmentNeededImplementedTotal} / {summary.ue1HeartFragmentNeededAssumedMaxTotal}
          </p>
          <small className="block text-sm text-muted">実装キャラ分 / 未実装も含む想定</small>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Distribution title="☆分布" items={summary.starDistribution} />
        <Distribution title="専用1レベル分布" items={summary.ue1Distribution} />
        <Distribution title="専用2レベル分布" items={summary.ue2Distribution} />
      </div>
    </section>
  );
}
