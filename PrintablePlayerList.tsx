import React from 'react';
import { Entry, Player, Tournament } from './types';

interface PrintablePlayerListProps {
  data: {
    tournament: Tournament;
    players: (Entry & { player: Player })[];
  }
}

const PrintablePlayerList: React.FC<PrintablePlayerListProps> = ({ data }) => {
  const { tournament, players } = data;

  const totalChips = players.reduce((sum, p) => sum + p.chipCount, 0);
  const avgStack = players.length > 0 ? Math.round(totalChips / players.length) : 0;
  
  const pageStyle: React.CSSProperties = {
    fontFamily: `'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif`,
    width: '210mm',
    minHeight: '297mm',
    padding: '10mm',
    color: 'black',
    backgroundColor: 'white',
    boxSizing: 'border-box',
    pageBreakAfter: 'always',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '2px solid #333',
    paddingBottom: '10px',
    marginBottom: '20px',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px',
    fontSize: '12px'
  };

  const thStyle: React.CSSProperties = {
    borderBottom: '1.5px solid #333',
    padding: '10px 8px',
    textAlign: 'left',
    backgroundColor: '#f2f2f2',
  };
  
  const tdStyle: React.CSSProperties = {
    borderBottom: '1px solid #ddd',
    padding: '8px',
    verticalAlign: 'middle',
  };

  // To prevent rows from splitting across pages
  const trStyle: React.CSSProperties = {
      pageBreakInside: 'avoid',
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px' }}>{tournament.name}</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#555' }}>Chip Count - Joueurs Actifs</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px' }}>
          <p style={{ margin: 0 }}>Date: {new Date().toLocaleDateString('fr-FR')}</p>
          <p style={{ margin: '4px 0 0 0' }}>Joueurs: {players.length}</p>
          <p style={{ margin: '4px 0 0 0' }}>Tapis Total: {totalChips.toLocaleString()}</p>
          <p style={{ margin: '4px 0 0 0' }}>Tapis Moyen: {avgStack.toLocaleString()}</p>
        </div>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{...thStyle, width: '50px', textAlign: 'center'}}>Rang</th>
            <th style={thStyle}>Joueur</th>
            <th style={{...thStyle, width: '120px'}}>Table / Siège</th>
            <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Tapis</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, index) => (
            <tr key={p.id} style={trStyle}>
              <td style={{...tdStyle, textAlign: 'center', fontWeight: 'bold'}}>{index + 1}</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <img src={p.player.avatarUrl} alt={p.player.nickname} style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '10px' }} />
                  <span style={{ fontWeight: 500 }}>{p.player.nickname}</span>
                </div>
              </td>
              <td style={tdStyle}>{p.table && p.seat ? `Table ${p.table} / Siège ${p.seat}` : 'Non assis'}</td>
              <td style={{...tdStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '14px', fontWeight: 'bold' }}>{p.chipCount.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PrintablePlayerList;