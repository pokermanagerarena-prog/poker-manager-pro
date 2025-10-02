import React, { useMemo } from 'react';
import { Tournament, Player } from './types';
import { Card, CardHeader, Button, ArrowDownTrayIcon } from './components';
import { useTournamentStore } from './store';

export const FinancesWidget = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
    const { dispatch } = useTournamentStore();
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const { prizepool, totalCommissions, commissionBreakdown, bonuses, paidOut, buyinCount, rebuyCount, addonCount } = useMemo(() => {
        const buyinCount = tournament.transactions.filter(t => t.type === 'buyin').length;
        const rebuyCount = tournament.transactions.filter(t => t.type === 'rebuy').length;
        const addonCount = tournament.transactions.filter(t => t.type === 'addon').length;
        
        const prizepool = ((buyinCount + rebuyCount) * tournament.buyin) + (addonCount * tournament.addonCost);

        const breakdown: { [name: string]: number } = {};
        (tournament.buyinCommissions || []).forEach(c => {
            breakdown[c.name] = (breakdown[c.name] || 0) + ((buyinCount + rebuyCount) * c.amount);
        });
        (tournament.addonCommissions || []).forEach(c => {
            breakdown[c.name] = (breakdown[c.name] || 0) + (addonCount * c.amount);
        });
        const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

        const bonuses = tournament.transactions
            .filter(t => t.type === 'dealer_bonus')
            .reduce((sum, tx) => sum + tx.amount, 0);
        const paidOut = Math.abs(tournament.transactions
            .filter(t => t.type === 'payout')
            .reduce((sum, tx) => sum + tx.amount, 0));
            
        return { prizepool, totalCommissions: total, commissionBreakdown: breakdown, bonuses, paidOut, buyinCount, rebuyCount, addonCount };
    }, [tournament]);
    
    const sortedTransactions = useMemo(() => {
        return [...tournament.transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [tournament.transactions]);

    const getTransactionTypeName = (type: string) => {
        switch(type) {
            case 'buyin': return 'Buy-in';
            case 'rebuy': return 'Rebuy';
            case 'addon': return 'Add-on';
            case 'payout': return 'Payout';
            case 'dealer_bonus': return 'Bonus Croupier';
            default: return 'Unknown';
        }
    };

    const handleExportSummary = () => {
        dispatch({
            type: 'SET_FINANCE_REPORT_TO_PRINT',
            payload: { tournament, players, reportType: 'summary' }
        });
    };

    const handleExportDetailed = () => {
        dispatch({
            type: 'SET_FINANCE_REPORT_TO_PRINT',
            payload: { tournament, players, reportType: 'detailed' }
        });
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-2">
                <CardHeader className="mb-0">Synthèse Financière</CardHeader>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={handleExportSummary} className="flex items-center gap-2">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Résumé
                    </Button>
                    <Button variant="secondary" size="sm" onClick={handleExportDetailed} className="flex items-center gap-2">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Rapport Détaillé
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Prizepool Total</p>
                    <p className="text-2xl font-bold text-green-400">{prizepool.toLocaleString()} MAD</p>
                </div>
                <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Commissions Totales</p>
                    <p className="text-2xl font-bold text-blue-400">{totalCommissions.toLocaleString()} MAD</p>
                    {Object.keys(commissionBreakdown).length > 0 && (
                        <div className="text-xs text-gray-400 mt-2 border-t border-gray-600 pt-2">
                            {Object.entries(commissionBreakdown).map(([name, amount]) => (
                                <div key={name} className="flex justify-between">
                                    <span>{name}:</span>
                                    <span>{amount.toLocaleString()} MAD</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Buy-ins</p>
                    <p className="text-2xl font-bold text-white">{buyinCount}</p>
                </div>
                 <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Rebuys / Re-entries</p>
                    <p className="text-2xl font-bold text-white">{rebuyCount}</p>
                </div>
                 <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Add-ons</p>
                    <p className="text-2xl font-bold text-white">{addonCount}</p>
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Bonus Croupiers (non-prizepool)</p>
                    <p className="text-2xl font-bold text-yellow-400">{bonuses.toLocaleString()} MAD</p>
                </div>
                 <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-400">Total Payé</p>
                    <p className="text-2xl font-bold text-red-400">{paidOut.toLocaleString()} MAD</p>
                </div>
            </div>

            <h3 className="text-lg font-semibold text-white mb-4 mt-8 border-t border-gray-700 pt-4">Historique des Transactions</h3>
            <div className="overflow-y-auto max-h-[30rem] pr-2">
                {/* Desktop Table View */}
                <table className="w-full text-left hidden md:table">
                    <thead className="border-b border-gray-600 text-sm text-gray-400 sticky top-0 bg-gray-800">
                        <tr>
                            <th className="p-2">Heure</th>
                            <th className="p-2">Joueur</th>
                            <th className="p-2">Type</th>
                            <th className="p-2 text-right">Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTransactions.map(tx => {
                            const player = playerMap.get(tx.playerId);
                            const isIncome = tx.amount > 0;
                            return (
                                <tr key={tx.id} className="border-b border-gray-700/50 text-sm">
                                    <td className="p-3 font-mono text-gray-400">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="p-3">
                                        {player ? (
                                            <div className="flex items-center space-x-3">
                                                <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full" />
                                                <span className="font-semibold">{player.nickname}</span>
                                            </div>
                                        ) : (
                                            'N/A'
                                        )}
                                    </td>
                                    <td className="p-3">{getTransactionTypeName(tx.type)}</td>
                                    <td className={`p-3 text-right font-semibold font-mono ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                                        {isIncome ? '+' : ''}{tx.amount.toLocaleString()} MAD
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                 {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {sortedTransactions.map(tx => {
                        const player = playerMap.get(tx.playerId);
                        const isIncome = tx.amount > 0;
                        return (
                            <div key={tx.id} className="bg-gray-700/50 p-3 rounded-lg">
                                <div className="flex justify-between items-start">
                                    <div>
                                         {player ? (
                                            <div className="flex items-center space-x-3 mb-2">
                                                <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full" />
                                                <span className="font-semibold">{player.nickname}</span>
                                            </div>
                                        ) : (
                                            'N/A'
                                        )}
                                        <p className="text-xs text-gray-400 font-mono">
                                            {new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold font-mono text-lg ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                                             {isIncome ? '+' : ''}{tx.amount.toLocaleString()} MAD
                                        </p>
                                        <p className="text-sm text-gray-300">{getTransactionTypeName(tx.type)}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {sortedTransactions.length === 0 && (
                     <p className="text-center p-8 text-gray-400">Aucune transaction enregistrée.</p>
                )}
            </div>
        </Card>
    );
};
