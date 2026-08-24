import React, { memo, useMemo } from 'react';

const SectorList = ({ title, sectors, type }) => {
  const maxAbsChange = useMemo(() => {
    if (!sectors?.length) return 1;
    return Math.max(...sectors.map(s => Math.abs(parseFloat(s.percentChange) || 0)), 0.01);
  }, [sectors]);

  return (
    <div className="card list-card">
      <div className="card-header">
        <h3 className="card-title">
          <span className={`card-title-dot card-title-dot--${type === 'gainer' ? 'gain' : 'loss'}`} />
          {title}
        </h3>
        <span className="card-count">{sectors?.length ?? 0} sectors</span>
      </div>

      <ul className="list-items">
        {sectors?.map((sector) => {
          const change = parseFloat(sector.percentChange) || 0;
          const barWidth = Math.min((Math.abs(change) / maxAbsChange) * 100, 100);

          return (
            <li key={sector.index} className="sector-item">
              <div className="sector-row">
                <strong className="sector-name">{sector.index}</strong>
                <span className={`change-badge change-badge--${type === 'gainer' ? 'gain' : 'loss'}`}>
                  {type === 'gainer' ? '+' : ''}{sector.percentChange}%
                </span>
              </div>
              <div className="sector-bar-track">
                <div
                  className={`sector-bar-fill sector-bar-fill--${type === 'gainer' ? 'gain' : 'loss'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default memo(SectorList);
