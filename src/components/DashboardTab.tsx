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

function Distribution({ title, items }: DistributionProps) {
  const visibleItems = items.filter((item) => item.count > 0);
  const maxCount = visibleItems.length === 0 ? 1 : Math.max(...visibleItems.map((item) => item.count));

  return (
    <section className="panel-section">
      <h3>{title}</h3>
      <ul className="distribution-list">
        {visibleItems.length === 0 ? (
          <li className="distribution-row empty">データがありません</li>
        ) : (
          visibleItems.map((item) => (
            <li key={item.label} className="distribution-row">
              <span className="distribution-label">{item.label}</span>
              <div className="distribution-bar-wrap">
                <div className="distribution-bar" style={{ width: `${(item.count / maxCount) * 100}%` }} />
              </div>
              <strong className="distribution-value">{item.count}</strong>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function DashboardTab({ masterCharacters, state }: DashboardTabProps) {
  const summary = useMemo(() => buildDashboardSummary(masterCharacters, state), [masterCharacters, state]);
  const ownedRate = summary.totalCharacters === 0 ? 0 : (summary.ownedCharacters / summary.totalCharacters) * 100;
  const star6Rate = summary.star6.implemented === 0 ? 0 : (summary.star6.promoted / summary.star6.implemented) * 100;

  return (
    <section className="panel dashboard">
      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>所持キャラ数</h3>
          <p className="kpi-value">
            {summary.ownedCharacters} / {summary.totalCharacters}
          </p>
          <small>所持率 {ownedRate.toFixed(1)}%</small>
        </article>

        <article className="kpi-card">
          <h3>専用1SP装備数</h3>
          <p className="kpi-value">
            {summary.ue1Sp.equipped} / {summary.ue1Sp.implemented}
          </p>
          <small>未装備 {summary.ue1Sp.unequipped}</small>
        </article>

        <article className="kpi-card">
          <h3>☆6進捗</h3>
          <p className="kpi-value">
            {summary.star6.promoted} / {summary.star6.implemented}
          </p>
          <small>達成率 {star6Rate.toFixed(1)}%</small>
        </article>
      </div>

      <div className="distribution-grid">
        <Distribution title="☆分布" items={summary.starDistribution} />
        <Distribution title="専用1レベル分布" items={summary.ue1Distribution} />
        <Distribution title="専用2レベル分布" items={summary.ue2Distribution} />
      </div>
    </section>
  );
}
