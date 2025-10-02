
import React, { useRef, useEffect } from 'react';
import { Entry, Player, Tournament, TournamentType } from './types';
import QRCode from 'qrcode';

interface PrintableTicketProps {
  data: {
    entry: Entry;
    player: Player;
    tournament: Tournament;
  }
}

// Helper component for sections
const TicketSection: React.FC<{ children: React.ReactNode, noBorder?: boolean }> = ({ children, noBorder }) => (
  <div style={{ borderTop: noBorder ? 'none' : '1.5px dashed #333', paddingTop: '10px', marginTop: '10px' }}>
    {children}
  </div>
);

const PrintableTicket: React.FC<PrintableTicketProps> = ({ data }) => {
  const { entry, player, tournament } = data;
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ticketData = JSON.stringify({
      source: "PokerTournamentManagerPRO+",
      playerId: player.id,
      tournamentId: tournament.id,
      entryId: entry.id
    });

    if (qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, ticketData, {
        width: 220, // Sized for 80mm thermal paper
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      }, (error) => { if (error) console.error(error); });
    }
  }, [entry, player, tournament]);
  
  const ticketStyle: React.CSSProperties = {
    fontFamily: `'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif`,
    width: '80mm',
    padding: '3mm',
    color: 'black',
    backgroundColor: 'white',
    boxSizing: 'border-box',
    fontWeight: 'bold', // General bold style
  };
  
  const flight = tournament.type === TournamentType.MULTI_FLIGHT 
    ? tournament.flights.find(f => f.id === entry.flightId)
    : null;

  const entryType = entry.buyins > 1 ? `Re-entry #${entry.buyins - 1}` : 'Buy-in Initial';
  const bonusChips = entry.chipCount - tournament.startingStack;

  const totalBuyinCost = tournament.buyin + tournament.buyinCommissions.reduce((sum, c) => sum + c.amount, 0);
  const dealerBonusCost = entry.dealerBonuses > 0 ? tournament.dealerBonusCost : 0;
  const totalPaid = totalBuyinCost + dealerBonusCost;
  const fullName = [player.firstName, player.lastName].filter(Boolean).join(' ');

  return (
    <div style={ticketStyle}>
      {/* NEW Festival Header */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', lineHeight: 1.1 }}>Agadir Poker</p>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', lineHeight: 1.1 }}>Festival</p>
      </div>

      {/* Header Section */}
      <div style={{ textAlign: 'center', marginBottom: '10px', borderTop: '1.5px dashed #333', paddingTop: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{tournament.name}</h1>
        {flight && <h2 style={{ margin: '3px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>{flight.name}</h2>}
      </div>

      {/* Player Section */}
      <TicketSection noBorder>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{player.nickname}</p>
          {fullName && <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 'bold' }}>{fullName}</p>}
        </div>
      </TicketSection>

      {/* Seat Section */}
      <TicketSection>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '8px 0' }}>
          <div>
            <p style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', fontWeight: 'bold' }}>Table</p>
            <p style={{ margin: 0, fontSize: '52px', fontWeight: 800, lineHeight: 1 }}>{entry.table}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', fontWeight: 'bold' }}>Siège</p>
            <p style={{ margin: 0, fontSize: '52px', fontWeight: 800, lineHeight: 1 }}>{entry.seat}</p>
          </div>
        </div>
      </TicketSection>

      {/* Stack Section */}
      <TicketSection>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', fontWeight: 'bold' }}>Tapis Total</p>
          <p style={{ margin: '3px 0', fontSize: '28px', fontWeight: 'bold' }}>{entry.chipCount.toLocaleString()}</p>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>
            (Initial: {tournament.startingStack.toLocaleString()}
            {bonusChips > 0 && ` + Bonus: ${bonusChips.toLocaleString()}`})
          </p>
        </div>
      </TicketSection>

      {/* Technical Section */}
      <TicketSection>
        <div style={{ fontSize: '13px', color: '#000', fontWeight: 'bold' }}>
          <p style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>Type d'entrée:</span>
            <span>{entryType}</span>
          </p>
          <p style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
            <span>Date/Heure:</span>
            <span>{new Date(entry.registeredAt).toLocaleString('fr-FR')}</span>
          </p>
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #aaa' }}>
            {dealerBonusCost > 0 && (
                 <p style={{ margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Bonus Croupier:</span>
                    <span>{dealerBonusCost.toLocaleString()} MAD</span>
                 </p>
            )}
            <p style={{ margin: '6px 0 0 0', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '1.5px solid #333', paddingTop: '6px' }}>
              <span>TOTAL PAYÉ:</span>
              <span>{totalPaid.toLocaleString()} MAD</span>
            </p>
          </div>
        </div>
      </TicketSection>

      {/* Footer Section */}
      <TicketSection>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: '12px' }}>
          <canvas ref={qrCanvasRef} />
          <p style={{ fontSize: '11px', textAlign: 'center', color: '#000', margin: '6px 0 0 0', fontWeight: 'bold' }}>
              ID Joueur: {player.id}
          </p>
        </div>
      </TicketSection>
      
      {/* NEW Footer address */}
      <div style={{ textAlign: 'center', marginTop: '15px', paddingTop: '10px', borderTop: '1.5px dashed #333', fontSize: '11px', fontWeight: 'bold' }}>
        <p style={{ margin: 0 }}>Casino Atlantic</p>
        <p style={{ margin: 0 }}>Secteur Balnéaire et Touristique, Agadir, Maroc</p>
      </div>
    </div>
  );
};

export default PrintableTicket;
