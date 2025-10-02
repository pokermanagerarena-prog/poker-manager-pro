
import React, { useMemo } from 'react';
import { useTournamentStore } from './store';
import { Tournament, EntryStatus, Player } from './types';
import { Card, CardHeader, Button } from './components';

export const WaitingListWidget = ({ tournament }: { tournament: Tournament }) => {
    const { state, dispatch } = useTournamentStore();
    const players = state.players;

    const waitingList = useMemo(() => {
        return tournament.entries
            .filter(e => e.status === EntryStatus.ACTIVE && e.table === null)
            .sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime());
    }, [tournament.entries]);

    const availableSeats = useMemo(() => {
        const availableSeatSet = new Set<string>();
        
        for (const table of tournament.tables) {
            for (let i = 1; i <= table.seats; i++) {
                availableSeatSet.add(`${table.id}:${i}`);
            }
        }
        
        for (const blocked of tournament.blockedSeats) {
            availableSeatSet.delete(`${blocked.table}:${blocked.seat}`);
        }
        
        for (const entry of tournament.entries) {
            if (entry.status === EntryStatus.ACTIVE && entry.table !== null && entry.seat !== null) {
                availableSeatSet.delete(`${entry.table}:${entry.seat}`);
            }
        }
        
        return availableSeatSet.size;
    }, [tournament.tables, tournament.entries, tournament.blockedSeats]);
    
    const handleAssignSeat = (entryId: string) => {
        dispatch({ type: 'ASSIGN_SEAT', payload: { tournamentId: tournament.id, entryId } });
    };
    
    if (waitingList.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <span>Liste d'Attente ({waitingList.length})</span>
                    <span className={`text-sm font-normal px-2 py-0.5 rounded-full ${availableSeats > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {availableSeats > 0 ? `${availableSeats} sièges libres` : 'Aucun siège libre'}
                    </span>
                </div>
            </CardHeader>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {waitingList.map(entry => {
                    const player = players.find(p => p.id === entry.playerId);
                    if (!player) return null;
                    return (
                        <div key={entry.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                            <div className="flex items-center space-x-3 min-w-0">
                                <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full flex-shrink-0" />
                                <div className="truncate">
                                    <p className="font-semibold text-white truncate">{player.nickname}</p>
                                    <p className="text-xs text-gray-400">
                                        Inscrit à {new Date(entry.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="primary" 
                                className="px-3 py-1 text-xs flex-shrink-0 ml-2" 
                                onClick={() => handleAssignSeat(entry.id)}
                                disabled={availableSeats <= 0}
                                title={availableSeats <= 0 ? "Aucun siège disponible" : "Assigner un siège au joueur"}
                            >
                                Assigner
                            </Button>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};
