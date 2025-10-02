import React, { useMemo } from 'react';
import { Entry, Player, Tournament } from './types';

interface PrintableSeatDrawProps {
  data: {
    tournament: Tournament;
    players: (Entry & { player: Player })[];
  }
}

const PrintableSeatDraw: React.FC<PrintableSeatDrawProps> = ({ data }) => {
  const { tournament, players } = data;

  const byTableData = useMemo(() => {
    return tournament.tables
      .map(table => ({
        ...table,
        players: players
          .filter(p => p.table === table.id)
          .sort((a, b) => (a.seat || 0) - (b.seat || 0)),
      }))
      .filter(table => table.players.length > 0)
      .sort((a,b) => a.id - b.id);
  }, [tournament.tables, players]);

  const alphabeticalData = useMemo(() => {
    return [...players].sort((a, b) => a.player.nickname.localeCompare(b.player.nickname));
  }, [players]);

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
    textAlign: 'center',
    marginBottom: '20px',
    borderBottom: '2px solid #333',
    paddingBottom: '10px'
  };

  const contentStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '20mm',
      fontSize: '10px',
  };
  
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '5px'
  };

  const thStyle: React.CSSProperties = {
    borderBottom: '1.5px solid #333',
    padding: '6px 4px',
    textAlign: 'left',
  };
  
  const tdStyle: React.CSSProperties = {
    borderBottom: '1px solid #ddd',
    padding: '5px 4px',
    verticalAlign: 'middle',
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>{tournament.name}</h1>
        <h2 style={{ margin: '5px 0', fontSize: '20px' }}>Répartition des Joueurs (Seat Draw)</h2>
        <p style={{ margin: 0, fontSize: '14px' }}>{new Date().toLocaleString('fr-FR')}</p>
      </div>

      <div style={contentStyle}>
        <div>
          <h3 style={{fontSize: '14px', marginBottom: '10px'}}>Répartition par Table</h3>
          {byTableData.map(table => (
            <div key={table.id} style={{ marginBottom: '15px', pageBreakInside: 'avoid' }}>
              <h4 style={{fontSize: '12px', margin: '0 0 5px 0', fontWeight: 'bold', borderBottom: '1px solid #ccc'}}>{table.name}</h4>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{...thStyle, width: '30px'}}>S.</th>
                    <th style={thStyle}>Joueur</th>
                    <th style={{...thStyle, textAlign: 'right', width: '70px'}}>Tapis</th>
                  </tr>
                </thead>
                <tbody>
                  {table.players.map(p => (
                    <tr key={p.id}>
                      <td style={{...tdStyle, textAlign: 'center'}}>{p.seat}</td>
                      <td style={tdStyle}>{p.player.nickname}</td>
                      <td style={{...tdStyle, textAlign: 'right', fontFamily: 'monospace'}}>{p.chipCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div>
           <h3 style={{fontSize: '14px', marginBottom: '10px'}}>Liste Alphabétique</h3>
           <table style={tableStyle}>
             <thead>
               <tr>
                 <th style={thStyle}>Joueur</th>
                 <th style={{...thStyle, width: '30px'}}>T.</th>
                 <th style={{...thStyle, width: '30px'}}>S.</th>
               </tr>
             </thead>
             <tbody>
               {alphabeticalData.map(p => (
                 <tr key={p.id}>
                   <td style={tdStyle}>{p.player.nickname}</td>
                   <td style={{...tdStyle, textAlign: 'center'}}>{p.table}</td>
                   <td style={{...tdStyle, textAlign: 'center'}}>{p.seat}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default PrintableSeatDraw;
