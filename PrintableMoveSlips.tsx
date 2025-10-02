import React from 'react';
import { MoveSlip } from './types';

interface PrintableMoveSlipsProps {
  data: {
    slips: MoveSlip[];
    tournamentName: string;
  }
}

const PrintableMoveSlips: React.FC<PrintableMoveSlipsProps> = ({ data }) => {
  const { slips, tournamentName } = data;

  const pageStyle: React.CSSProperties = {
    fontFamily: `'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif`,
    width: '210mm',
    minHeight: '297mm',
    padding: '5mm',
    color: 'black',
    backgroundColor: 'white',
    boxSizing: 'border-box',
  };

  const slipContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '5mm',
  };

  const slipStyle: React.CSSProperties = {
    border: '2px solid black',
    padding: '10px',
    width: 'calc(33.333% - 4mm)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    pageBreakInside: 'avoid',
    height: '60mm',
  };

  const headerStyle: React.CSSProperties = {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: '5px'
  };

  const playerNameStyle: React.CSSProperties = {
      fontSize: '22px',
      fontWeight: 'bold',
      margin: '10px 0',
  };

  const seatInfoStyle: React.CSSProperties = {
      fontSize: '16px'
  };

  const arrowStyle: React.CSSProperties = {
      fontSize: '24px',
      margin: '8px 0'
  };

  const newSeatStyle: React.CSSProperties = {
      border: '2px solid #333',
      borderRadius: '8px',
      padding: '8px',
      marginTop: '10px',
      backgroundColor: '#f2f2f2',
      width: '100%',
  };

  return (
    <div style={pageStyle}>
        <div style={slipContainerStyle}>
            {slips.map((slip, index) => (
                <div key={index} style={slipStyle}>
                    <div style={headerStyle}>{tournamentName}</div>
                    <p style={{ margin: '2px 0', fontSize: '10px', color: '#555' }}>TICKET DE DÉPLACEMENT</p>
                    
                    <p style={playerNameStyle}>{slip.player.nickname}</p>

                    <div style={{ flexGrow: 1 }}></div>

                    <div style={newSeatStyle}>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>NOUVEAU SIÈGE</p>
                        <p style={{ margin: '5px 0 0 0', fontSize: '28px', fontWeight: 'bold' }}>
                            TABLE {slip.newTable} / SIÈGE {slip.newSeat}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default PrintableMoveSlips;
