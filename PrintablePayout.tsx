import React from 'react';
import { Entry, Player, Tournament } from './types';

interface PrintablePayoutProps {
  data: {
    tournament: Tournament;
    player: Player;
    entry: Entry;
    payoutAmount: number;
  }
}

const PrintablePayout: React.FC<PrintablePayoutProps> = ({ data }) => {
  const { tournament, player, entry, payoutAmount } = data;

  const ticketStyle: React.CSSProperties = {
    fontFamily: `'Courier New', Courier, monospace`,
    width: '80mm',
    padding: '4mm',
    color: 'black',
    backgroundColor: 'white',
    boxSizing: 'border-box',
    fontSize: '12px',
    lineHeight: '1.4',
  };

  const hrStyle: React.CSSProperties = {
    border: 'none',
    borderTop: '1px dashed #333',
    margin: '8px 0',
  };

  const signatureBoxStyle: React.CSSProperties = {
    marginTop: '15px',
    paddingTop: '5px',
    borderTop: '1px solid #ccc',
    fontSize: '10px',
    color: '#555',
    textAlign: 'center',
  }

  const fullName = [player.firstName, player.lastName].filter(Boolean).join(' ');

  return (
    <div style={ticketStyle}>
      <h3 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
        BON DE PAIEMENT
      </h3>
      <h4 style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'normal' }}>
        {tournament.name}
      </h4>
      <hr style={hrStyle} />
      <p style={{ margin: '2px 0' }}><strong>Date :</strong> {new Date().toLocaleString('fr-FR')}</p>
      <p style={{ margin: '2px 0' }}><strong>ID Paiement :</strong> {`PAY-${entry.id}`}</p>
      <hr style={hrStyle} />
      <p style={{ margin: '2px 0' }}><strong>Joueur :</strong> {player.nickname}</p>
      {fullName && <p style={{ margin: '2px 0' }}><strong>Nom :</strong> {fullName}</p>}
      <p style={{ margin: '2px 0' }}><strong>Rang Final :</strong> {entry.eliminationRank}</p>
      <hr style={hrStyle} />
      <div style={{ textAlign: 'center', margin: '10px 0' }}>
        <p style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase' }}>Montant du Gain</p>
        <p style={{ margin: '2px 0', fontSize: '24px', fontWeight: 'bold' }}>
            {payoutAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
        </p>
      </div>
      <hr style={hrStyle} />
      <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
         <div style={signatureBoxStyle}>
            Signature du Joueur
        </div>
         <div style={signatureBoxStyle}>
            Signature du Directeur
        </div>
        <div style={signatureBoxStyle}>
            Signature de la Caisse
        </div>
      </div>
    </div>
  );
};

export default PrintablePayout;