import React, { useMemo } from 'react';
import { Tournament, Player, Transaction } from './types';

interface PrintableFinanceReportProps {
  data: {
    tournament: Tournament;
    players: Player[];
    reportType: 'summary' | 'detailed';
  }
}

const ReportHeader = ({ tournament }: { tournament: Tournament }) => {
    const headerStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '2px solid #005A9C', // Blue color for header
        paddingBottom: '10px',
        marginBottom: '20px',
    };
    return (
        <header style={headerStyle}>
            <div>
                <h1 style={{ margin: 0, fontSize: '24px', color: '#005A9C' }}>Rapport Financier</h1>
                <h2 style={{ margin: '5px 0 0 0', fontSize: '18px', fontWeight: 'bold' }}>{tournament.name}</h2>
                <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#555' }}>{tournament.location}</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px' }}>
                <p style={{ margin: 0 }}>Généré le: {new Date().toLocaleString('fr-FR')}</p>
            </div>
        </header>
    );
};

const ReportFooter = ({ pageNumber, totalPages }: { pageNumber: number, totalPages: number }) => {
    const footerStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTop: '1px solid #ccc',
        paddingTop: '8px',
        fontSize: '12px',
    };
    return (
        <footer style={footerStyle}>
            <div style={{ flex: 2, borderTop: '1px solid #333', paddingTop: '5px', marginRight: '20px' }}>
                <p style={{ margin: 0 }}>Signature du Directeur de Tournoi :</p>
            </div>
            <p style={{ margin: 0 }}>Page {pageNumber} / {totalPages}</p>
        </footer>
    );
};

const SummaryContent = ({ financialSummary }: { financialSummary: any }) => {
    const cardStyle: React.CSSProperties = {
        border: '1px solid #eee',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        backgroundColor: '#f9f9f9',
    };
    const titleStyle: React.CSSProperties = {
        margin: '0 0 12px 0',
        fontSize: '18px',
        color: '#005A9C',
        borderBottom: '1px solid #005A9C',
        paddingBottom: '8px',
    };
    const rowStyle: React.CSSProperties = {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderBottom: '1px solid #f0f0f0',
    };
    const finalRowStyle: React.CSSProperties = {
        ...rowStyle,
        fontWeight: 'bold',
        fontSize: '16px',
        marginTop: '10px',
        borderTop: '2px solid #333',
        paddingTop: '10px'
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
                <div style={cardStyle}>
                    <h3 style={titleStyle}>Recettes</h3>
                    <div style={rowStyle}><span>Total Buy-ins / Re-entries :</span> <span style={{ color: '#28a745' }}>{financialSummary.totalBuyinValue.toLocaleString()} MAD</span></div>
                    <div style={rowStyle}><span>Total Add-ons :</span> <span style={{ color: '#28a745' }}>{financialSummary.totalAddonValue.toLocaleString()} MAD</span></div>
                    <div style={rowStyle}><span>Total Bonus Croupier :</span> <span style={{ color: '#28a745' }}>{financialSummary.totalBonuses.toLocaleString()} MAD</span></div>
                </div>
                <div style={cardStyle}>
                    <h3 style={titleStyle}>Dépenses</h3>
                    <div style={rowStyle}><span>Total des Gains Payés :</span> <span style={{ color: '#dc3545' }}>{financialSummary.totalPaidOut.toLocaleString()} MAD</span></div>
                </div>
            </div>
            <div>
                 <div style={cardStyle}>
                    <h3 style={titleStyle}>Synthèse</h3>
                    <div style={rowStyle}><span>Total Collecté (Prize pool) :</span> <span style={{ fontWeight: 'bold' }}>{financialSummary.prizepool.toLocaleString()} MAD</span></div>
                    <div style={rowStyle}><span>Total Commissions :</span> <span>{financialSummary.totalCommissions.toLocaleString()} MAD</span></div>
                    {Object.entries(financialSummary.commissionBreakdown).map(([name, amount]) => (
                         <div key={name} style={{...rowStyle, fontSize: '12px', color: '#666', paddingLeft: '20px'}}>
                            <span>{name} :</span>
                            <span>{(amount as number).toLocaleString()} MAD</span>
                        </div>
                    ))}
                    <div style={finalRowStyle}><span>Solde Final (Cash) :</span> <span style={{ color: '#005A9C' }}>{financialSummary.finalBalance.toLocaleString()} MAD</span></div>
                </div>
            </div>
        </div>
    );
}

const TransactionsTable = ({ title, transactions, playerMap }: { title: string, transactions: Transaction[], playerMap: Map<string, Player> }) => {
    const getTransactionTypeName = (type: string) => ({ buyin: 'Buy-in', rebuy: 'Rebuy', addon: 'Add-on', payout: 'Payout', dealer_bonus: 'Bonus Croupier' }[type] || 'Inconnu');
    const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '12px' };
    const thStyle: React.CSSProperties = { borderBottom: '1.5px solid #333', padding: '10px 8px', textAlign: 'left', backgroundColor: '#f2f2f2' };
    const tdStyle: React.CSSProperties = { borderBottom: '1px solid #ddd', padding: '8px', verticalAlign: 'middle' };

    return (
        <div style={{marginBottom: '20px'}}>
            <h3 style={{ fontSize: '18px', color: '#005A9C', borderBottom: '1px solid #005A9C', paddingBottom: '8px' }}>{title}</h3>
            <table style={tableStyle}>
                <thead>
                    <tr>
                        <th style={{...thStyle, width: '120px'}}>Heure</th>
                        <th style={thStyle}>Joueur</th>
                        <th style={{...thStyle, width: '120px'}}>Type</th>
                        <th style={{...thStyle, width: '150px', textAlign: 'right'}}>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map(tx => {
                        const player = playerMap.get(tx.playerId);
                        const playerName = player ? `${player.firstName} ${player.lastName} (${player.nickname})` : 'Joueur inconnu';
                        const isIncome = tx.amount > 0;
                        return (
                             <tr key={tx.id} style={{ pageBreakInside: 'avoid' }}>
                                <td style={tdStyle}>{new Date(tx.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                <td style={tdStyle}>{playerName}</td>
                                <td style={tdStyle}>{getTransactionTypeName(tx.type)}</td>
                                <td style={{...tdStyle, textAlign: 'right', fontWeight: 'bold', color: isIncome ? '#28a745' : '#dc3545'}}>
                                    {isIncome ? '+' : ''}{tx.amount.toLocaleString()} MAD
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

const PrintableFinanceReport: React.FC<PrintableFinanceReportProps> = ({ data }) => {
    const { tournament, players, reportType } = data;

    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const financialSummary = useMemo(() => {
        const buyinCount = tournament.transactions.filter(t => t.type === 'buyin').length;
        const rebuyCount = tournament.transactions.filter(t => t.type === 'rebuy').length;
        const addonCount = tournament.transactions.filter(t => t.type === 'addon').length;
        
        const totalBuyinValue = (buyinCount + rebuyCount) * tournament.buyin;
        const totalAddonValue = addonCount * tournament.addonCost;
        const prizepool = totalBuyinValue + totalAddonValue;
        
        const breakdown: { [name: string]: number } = {};
        (tournament.buyinCommissions || []).forEach(c => {
            breakdown[c.name] = (breakdown[c.name] || 0) + ((buyinCount + rebuyCount) * c.amount);
        });
        (tournament.addonCommissions || []).forEach(c => {
            breakdown[c.name] = (breakdown[c.name] || 0) + (addonCount * c.amount);
        });
        const totalCommissions = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

        const totalBonuses = tournament.transactions
            .filter(t => t.type === 'dealer_bonus')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const totalPaidOut = Math.abs(tournament.transactions
            .filter(t => t.type === 'payout')
            .reduce((sum, tx) => sum + tx.amount, 0));
            
        const finalBalance = prizepool + totalCommissions + totalBonuses - totalPaidOut;

        return { prizepool, totalCommissions, commissionBreakdown: breakdown, totalBonuses, totalPaidOut, finalBalance, totalBuyinValue, totalAddonValue };
    }, [tournament]);

    const transactionsByType = useMemo(() => {
        const sorted = [...tournament.transactions].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const income = sorted.filter(tx => tx.type === 'buyin' || tx.type === 'rebuy' || tx.type === 'addon' || tx.type === 'dealer_bonus');
        const expenses = sorted.filter(tx => tx.type === 'payout');
        return { income, expenses };
    }, [tournament.transactions]);

    const pageStyle: React.CSSProperties = {
        fontFamily: `'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif`,
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm',
        color: 'black',
        backgroundColor: 'white',
        boxSizing: 'border-box',
        position: 'relative',
    };
    
    // Simple pagination for detailed report
    const ITEMS_PER_PAGE = 35;
    const incomePages = Math.ceil(transactionsByType.income.length / ITEMS_PER_PAGE);
    const expensePages = Math.ceil(transactionsByType.expenses.length / ITEMS_PER_PAGE);
    const totalPages = reportType === 'detailed' ? 1 + incomePages + expensePages : 1;

    return (
        <div>
            <style>
                {`@media print { .page-container { page-break-after: always; } }`}
            </style>

            {/* Page 1: Summary */}
            <div className="page-container" style={pageStyle}>
                <ReportHeader tournament={tournament} />
                <main>
                    <SummaryContent financialSummary={financialSummary} />
                </main>
                <ReportFooter pageNumber={1} totalPages={totalPages} />
            </div>

            {/* Detailed Report Pages */}
            {reportType === 'detailed' && (
                <>
                    {/* Income Pages */}
                    {Array.from({ length: incomePages }).map((_, i) => (
                        <div key={`income-page-${i}`} className="page-container" style={pageStyle}>
                             <ReportHeader tournament={tournament} />
                             <main>
                                 <TransactionsTable 
                                     title="Détail des Recettes" 
                                     transactions={transactionsByType.income.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE)} 
                                     playerMap={playerMap}
                                 />
                             </main>
                             <ReportFooter pageNumber={2 + i} totalPages={totalPages} />
                        </div>
                    ))}
                     {/* Expense Pages */}
                     {Array.from({ length: expensePages }).map((_, i) => (
                        <div key={`expense-page-${i}`} className="page-container" style={pageStyle}>
                             <ReportHeader tournament={tournament} />
                             <main>
                                 <TransactionsTable 
                                     title="Détail des Dépenses" 
                                     transactions={transactionsByType.expenses.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE)} 
                                     playerMap={playerMap}
                                 />
                             </main>
                             <ReportFooter pageNumber={2 + incomePages + i} totalPages={totalPages} />
                        </div>
                    ))}
                </>
            )}
        </div>
    );
};

export default PrintableFinanceReport;
