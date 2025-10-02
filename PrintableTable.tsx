
import React from 'react';
import { Entry, Player, PokerTable } from './types';

interface PrintableTableProps {
  data: {
    table: PokerTable;
    entries: (Entry & { player: Player })[];
    tournamentName: string;
  }
}

const PrintableTable: React.FC<PrintableTableProps> = ({ data }) => {
  const { table, entries, tournamentName } = data;

  const tablePageStyle: React.CSSProperties = {
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
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px'
  };

  const thStyle: React.CSSProperties = {
    border: '1px solid #333',
    padding: '8px',
    textAlign: 'left',
    backgroundColor: '#f2f2f2',
  };
  
  const tdStyle: React.CSSProperties = {
    border: '1px solid #333',
    padding: '8px',
    verticalAlign: 'middle',
  };
  
  const emptyBoxStyle: React.CSSProperties = {
      height: '40px',
      minWidth: '150px',
      border: '1px solid #ccc',
      backgroundColor: '#fafafa',
  };

  return (
    <div style={tablePageStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>{tournamentName}</h1>
        <h2 style={{ margin: '5px 0', fontSize: '20px' }}>Feuille de Table - {table.name}</h2>
        <p style={{ margin: 0, fontSize: '14px' }}>{new Date().toLocaleString('fr-FR')}</p>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{...thStyle, width: '50px'}}>Siège</th>
            <th style={thStyle}>Joueur</th>
            <th style={{...thStyle, width: '160px'}}>Jetons (Fin de journée)</th>
            <th style={{...thStyle, width: '160px'}}>Signature</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: table.seats }, (_, i) => i + 1).map(seatNum => {
            const entry = entries.find(e => e.seat === seatNum);
            const player = entry?.player;

            return (
              <tr key={seatNum}>
                <td style={{...tdStyle, textAlign: 'center', fontWeight: 'bold'}}>{seatNum}</td>
                <td style={tdStyle}>{player ? player.nickname : <em>Siège vide</em>}</td>
                <td style={tdStyle}><div style={emptyBoxStyle}></div></td>
                <td style={tdStyle}><div style={emptyBoxStyle}></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PrintableTable;
