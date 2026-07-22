import React, { memo } from 'react';

const SectorList = ({ title, sectors, type }) => {
  const titleColor = type === 'gainer' ? 'green' : 'red';

  return (
    <div className="card" style={{ flex: '1 1 300px', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '1rem', maxWidth: '100%' }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {sectors?.map((sector) => (
          <li key={sector.index} style={{ padding: '0.25rem 0', borderBottom: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{sector.index}</strong>
              <span style={{ color: titleColor }}>{type === 'gainer' ? '+' : ''}{sector.percentChange}%</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default memo(SectorList);