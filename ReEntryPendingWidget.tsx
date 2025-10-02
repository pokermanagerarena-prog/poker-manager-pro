

import React, { useMemo } from 'react';
import { useTournamentStore } from './store';
import { Tournament, EntryStatus, Player } from './types';
import { Card, CardHeader, Button } from './components';

export const ReEntryPendingWidget = ({ tournament }: { tournament: Tournament }) => {
    const { state, dispatch } = useTournamentStore();
    const players = state.players;

    const pendingEntries = useMemo(() => {
        return tournament.entries
            .filter(e => e.status === EntryStatus.RE_ENTRY_PENDING)
            .sort((a, b) => (players.find(p => p.id === a.playerId)?.nickname || '').localeCompare(players.find(p => p.id === b.playerId)?.nickname || ''));
    }, [tournament.entries, players]);

    if (pendingEntries.length === 0) {
        return null;
    }

    const handleConfirmReEntry = (entryId: string) => {
        let addDealerBonus = false;
        if (tournament.dealerBonusCost > 0) {
            if (window.confirm(`Ce joueur effectue une ré-entrée. Voulez-vous ajouter le Bonus Croupier (${tournament.dealerBonusChips} jetons pour ${tournament.dealerBonusCost} MAD) ?`)) {
                addDealerBonus = true;
            }
        }
        const shouldPrintTicket = JSON.parse(sessionStorage.getItem('shouldPrintTicket') || 'false');
        dispatch({ type: 'PLAYER_REBUY', payload: { tournamentId: tournament.id, entryId, addDealerBonus, shouldPrintTicket } });
    };

    const handleEliminatePermanently = (entryId: string) => {
        dispatch({ type: 'ELIMINATE_PENDING_PLAYER', payload: { tournamentId: tournament.id, entryId } });
    };

    return (
        <Card>
            <CardHeader>Décisions de Re-entry ({pendingEntries.length})</CardHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {pendingEntries.map(entry => {
                    const player = players.find(p => p.id === entry.playerId);
                    if (!player) return null;
                    return (
                        <div key={entry.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                            <div className="flex items-center space-x-3 min-w-0">
                                <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full flex-shrink-0" />
                                <p className="font-semibold text-white truncate">{player.nickname}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 ml-2">
                                <Button 
                                    variant="primary" 
                                    className="px-3 py-1 text-xs" 
                                    onClick={() => handleConfirmReEntry(entry.id)}
                                >
                                    Valider Re-entry
                                </Button>
                                <Button 
                                    variant="danger" 
                                    className="px-3 py-1 text-xs" 
                                    onClick={() => handleEliminatePermanently(entry.id)}
                                >
                                    Éliminer
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};