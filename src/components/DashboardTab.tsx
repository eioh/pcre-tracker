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
          <p className="kpi-value">{summary.ue1Sp.equipped}</p>
          <small>実装済み {summary.ue1Sp.implemented}</small>
        </article>

        <article className="kpi-card">
          <h3>専用1SP未装備</h3>
          <p className="kpi-value">{summary.ue1Sp.unequipped}</p>
          <small>未実装 {summary.ue1Sp.unimplemented}</small>
        </article>
      </div>

      <div className="distribution-grid">
        <Distribution title="専用1レベル分布" items={summary.ue1Distribution} />
        <Distribution title="専用2レベル分布" items={summary.ue2Distribution} />
      </div>
    </section>
  );
}
