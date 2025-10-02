import React, { useMemo, useState, useEffect, useRef, memo } from 'react';
import { useTournamentStore, calculatePayouts } from './store';
import { Tournament, Player, EntryStatus, Entry } from './types';
import { Card, CardHeader, TrophyIcon, Button, BanknotesIcon } from './components';

// FIX: Removed `style` prop and hardcoded height to replace react-window virtualization.
const ResultRow = memo(({ index, data }: { index: number; data: any }) => {
    const { finalStandings, players, tournament, payouts, handlePrintPayout } = data;
    const entry = finalStandings[index];
    const player = players.find((p: Player) => p.id === entry.playerId);

    if (!player) return null;

    let payoutAmount = 0;
    let payoutDescription = "";
    
    const dealPayout = tournament.dealMadePayouts?.find((p: any) => p.playerId === entry.playerId);

    if (dealPayout) {
        payoutAmount = dealPayout.amount;
        payoutDescription = `${dealPayout.amount.toLocaleString()} MAD (Deal)`;
    } else {
        const payout = payouts.find((p: any) => p.rank === entry.finalRank);
        if (payout) {
            payoutAmount = payout.amount;
            payoutDescription = payout.description || `${payout.amount.toLocaleString()} MAD`;
        } else {
            payoutDescription = "0 MAD";
        }
    }

    const isWinner = entry.finalRank === 1;

    return (
        <div className={`flex items-center border-b border-gray-700/50 h-[68px] ${isWinner ? 'bg-yellow-500/10' : ''}`}>
            <div className={`p-3 font-bold flex items-center gap-2 w-32 ${isWinner ? 'text-yellow-400' : 'text-white'}`}>
                {isWinner && <TrophyIcon className="w-5 h-5 text-yellow-400"/>}
                {entry.finalRank}
            </div>
            <div className="p-3 flex-grow">
                <div className="flex items-center space-x-3">
                    <img src={player.avatarUrl} alt={player.nickname} className="w-10 h-10 rounded-full" />
                    <span className="font-semibold">{player.nickname}</span>
                </div>
            </div>
            <div className={`p-3 text-right font-semibold w-48 ${payoutAmount > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                {payoutDescription}
            </div>
            <div className="p-3 text-center w-36">
                {payoutAmount > 0 && (
                    <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex items-center gap-1.5"
                        onClick={() => handlePrintPayout(entry, player, payoutAmount)}
                    >
                        <BanknotesIcon className="w-4 h-4" />
                        Imprimer
                    </Button>
                )}
            </div>
        </div>
    );
});

export const ResultsWidget = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
    const { dispatch } = useTournamentStore();

    const { finalStandings, totalEntries } = useMemo(() => {
        const totalEntries = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
        
        const standings = tournament.entries
            .filter(e => e.eliminationIndex !== null && e.status !== EntryStatus.MERGE_DISCARDED)
            .map(e => ({
                ...e,
                finalRank: totalEntries - e.eliminationIndex! + 1
            }))
            .sort((a,b) => (a.finalRank) - (b.finalRank));
            
        return { finalStandings: standings, totalEntries };
    }, [tournament.entries]);

    const payouts = useMemo(() => {
        if (tournament.payoutSettings.mode === 'manual' && tournament.payoutSettings.manualPayouts.length > 0) {
            return tournament.payoutSettings.manualPayouts;
        }
        const totalPrizePool = (tournament.entries.reduce((sum, entry) => sum + entry.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((sum, entry) => sum + entry.addons, 0) * tournament.addonCost);
        return calculatePayouts(totalPrizePool, totalEntries);
    }, [tournament.payoutSettings, tournament.entries, tournament.buyin, tournament.addonCost, totalEntries]);
    
    const handlePrintPayout = (entry: Entry, player: Player, payoutAmount: number) => {
        if (payoutAmount > 0) {
            dispatch({
                type: 'SET_PAYOUT_TO_PRINT',
                payload: {
                    tournament,
                    player,
                    entry,
                    payoutAmount
                }
            });
        }
    };

    return (
        <Card>
            <CardHeader>Final Results</CardHeader>
            <div className="overflow-x-auto">
                <div className="flex border-b border-gray-600 text-sm text-gray-400">
                    <div className="p-2 w-32">Rank</div>
                    <div className="p-2 flex-grow">Player</div>
                    <div className="p-2 text-right w-48">Payout</div>
                    <div className="p-2 text-center w-36">Action</div>
                </div>

                {/* FIX: Replaced FixedSizeList with a standard map to resolve import issue. */}
                <div className="h-[70vh] w-full overflow-y-auto">
                   {finalStandings.length > 0 ? (
                        finalStandings.map((entry, index) => (
                            <ResultRow
                                key={entry.id}
                                index={index}
                                data={{
                                    finalStandings,
                                    players,
                                    tournament,
                                    payouts,
                                    handlePrintPayout,
                                }}
                            />
                        ))
                   ) : (
                    <div className="text-center p-8 text-gray-400">Aucun résultat à afficher.</div>
                   )}
                </div>
            </div>
        </Card>
    );
};