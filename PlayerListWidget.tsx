import React, { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { useTournamentStore } from './store';
import { Tournament, Player, Entry, EntryStatus, TournamentStatus, TournamentType, TournamentPhase } from './types';
import { Card, CardHeader, Button, PrinterIcon } from './components';
import { EliminationModal } from './TableViewWidget';

const PlayerControls = memo(({ entry, player, tournamentId, onEliminate }: { entry: Entry, player: Player, tournamentId: string, onEliminate: (entry: Entry & { player: Player }) => void }) => {
    const { state, dispatch } = useTournamentStore();
    const tournament = state.tournaments.find(t => t.id === tournamentId);
    const [isEditingChips, setIsEditingChips] = useState(false);
    const [chipValue, setChipValue] = useState(entry.chipCount.toString());

    useEffect(() => {
        // This effect synchronizes the local state with the prop from the global store.
        // It runs when the chip count from the parent changes.
        // We only update the local state if the user is NOT currently editing the input,
        // to avoid overwriting their changes as they type.
        if (!isEditingChips) {
            setChipValue(entry.chipCount.toString());
        }
    }, [entry.chipCount, isEditingChips]);

    if (!tournament) return null;
    const isCompleted = tournament.status === TournamentStatus.COMPLETED;

    const handlePlayerOut = () => {
        onEliminate({ ...entry, player });
    }

    const handleRebuy = () => {
         if (!tournament.rebuysAllowed || isCompleted) return;
        let addDealerBonus = false;
        if (tournament.dealerBonusCost > 0) {
            if (window.confirm(`Ce joueur effectue une ré-entrée. Voulez-vous ajouter le Bonus Croupier (${tournament.dealerBonusChips} jetons pour ${tournament.dealerBonusCost} MAD) ?`)) {
                addDealerBonus = true;
            }
        }
        const shouldPrintTicket = JSON.parse(sessionStorage.getItem('shouldPrintTicket') || 'false');
        dispatch({ type: 'PLAYER_REBUY', payload: { tournamentId, entryId: entry.id, addDealerBonus, shouldPrintTicket } });
    };
    const handleAddon = () => dispatch({ type: 'PLAYER_ADDON', payload: { tournamentId, entryId: entry.id } });

    const handleChipUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        const newChipCount = parseInt(chipValue, 10);
        if (!isNaN(newChipCount)) {
            dispatch({ type: 'UPDATE_CHIP_COUNT', payload: { tournamentId, entryId: entry.id, newChipCount } });
        }
        setIsEditingChips(false);
    };

    return (
        <div className="bg-gray-700/50 p-3 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <img src={player?.avatarUrl} alt={player?.nickname} className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-white truncate">{player?.nickname}</p>
                      <p className="text-xs text-gray-400">{entry.table && entry.seat ? `T${entry.table} / S${entry.seat}` : 'Waiting for seat'}</p>
                    </div>
                </div>

                <div className="w-full sm:w-auto flex items-center justify-end space-x-2 sm:space-x-4 pl-2">
                  {isEditingChips ? (
                    <form onSubmit={handleChipUpdate} className="flex-grow sm:flex-grow-0">
                      <input 
                        type="number" 
                        value={chipValue}
                        onChange={(e) => setChipValue(e.target.value)}
                        onBlur={handleChipUpdate}
                        autoFocus
                        className="bg-gray-900 w-full sm:w-28 text-right font-mono text-lg p-1 rounded-md border border-blue-500"
                      />
                    </form>
                  ) : (
                    <div className="text-right w-28 cursor-pointer flex-grow sm:flex-grow-0" onClick={() => !isCompleted && setIsEditingChips(true)}>
                      <p className="text-lg font-bold text-white">{entry.chipCount.toLocaleString()}</p>
                    </div>
                  )}

                  <div className="flex flex-col space-y-1">
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={handleRebuy} disabled={!tournament.rebuysAllowed || isCompleted}>Rebuy</Button>
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={handleAddon} disabled={!tournament.rebuysAllowed || tournament.addonCost === 0 || isCompleted}>Add-on</Button>
                  </div>
                  <Button variant="danger" className="px-3 py-1 text-xs" onClick={handlePlayerOut} disabled={isCompleted}>Player Out</Button>
                </div>
            </div>
        </div>
    );
});

// FIX: Removed `style` prop and hardcoded height to replace react-window virtualization.
const PlayerRow = memo(({ index, data }: { index: number, data: any }) => {
    const { sortedEntries, players, tournamentId, onEliminate } = data;
    const entry = sortedEntries[index];
    const player = players.find((p: Player) => p.id === entry.playerId);
    
    if (!player) return null;

    return (
        <div className="px-1 py-1">
            <PlayerControls entry={entry} player={player} tournamentId={tournamentId} onEliminate={onEliminate} />
        </div>
    );
});

const EliminatedPlayerListWidget = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
    const totalEntries = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
    
    const eliminatedEntries = tournament.entries
        .filter(e => e.status === EntryStatus.ELIMINATED && e.eliminationIndex !== null)
        .map(e => ({
            ...e,
            finalRank: totalEntries - e.eliminationIndex! + 1
        }))
        .sort((a,b) => (b.finalRank) - (a.finalRank));
        
    if (eliminatedEntries.length === 0 || eliminatedEntries.every(e => e.finalRank === 1)) return null;


    return (
        <details className="mt-6">
            <summary className="cursor-pointer text-gray-400 hover:text-white">
                Show Eliminated Players ({eliminatedEntries.filter(e => e.finalRank !== 1).length})
            </summary>
            <div className="mt-2 space-y-2 pr-2 max-h-60 overflow-y-auto">
                {eliminatedEntries.filter(e => e.finalRank !== 1).map(entry => {
                    const player = players.find(p => p.id === entry.playerId);
                    return (
                        <div key={entry.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md text-sm">
                             <div className="flex items-center space-x-3">
                                <img src={player?.avatarUrl} alt={player?.nickname} className="w-8 h-8 rounded-full opacity-50" />
                                <span className="text-gray-400">{player?.nickname}</span>
                            </div>
                            <span className="font-mono text-red-400">Finished #{entry.finalRank}</span>
                        </div>
                    );
                })}
            </div>
        </details>
    )
}

export const PlayerListWidget = ({ tournament, displayFlightId }: { tournament: Tournament, displayFlightId: string }) => {
    const { state, dispatch } = useTournamentStore();
    const [playerSearchTerm, setPlayerSearchTerm] = useState('');
    const [eliminationModalOpen, setEliminationModalOpen] = useState(false);
    const [entriesToEliminate, setEntriesToEliminate] = useState<(Entry & { player: Player })[]>([]);
    
    const handleInitiateElimination = useCallback((entry: Entry & { player: Player }) => {
        setEntriesToEliminate([entry]);
        setEliminationModalOpen(true);
    }, []);

    const filteredEntries = useMemo(() => {
        // Only show seated players in this list
        let active = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE && e.table !== null);
        
        if (tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS && displayFlightId !== 'all') {
            active = active.filter(e => e.flightId === displayFlightId);
        }

        if (playerSearchTerm.trim() !== '') {
            const lowercasedSearch = playerSearchTerm.toLowerCase();
            active = active.filter(entry => {
                const player = state.players.find(p => p.id === entry.playerId);
                return player && player.nickname.toLowerCase().includes(lowercasedSearch);
            });
        }
        
        return active;
    }, [tournament, displayFlightId, playerSearchTerm, state.players]);
    
    const totalPlayers = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;

    const handlePrint = () => {
        const playersWithDetails = filteredEntries.map(entry => {
            const player = state.players.find(p => p.id === entry.playerId);
            return player ? { ...entry, player } : null;
        }).filter((p): p is Entry & { player: Player } => p !== null)
          .sort((a,b) => b.chipCount - a.chipCount);
        
        dispatch({
            type: 'SET_PLAYER_LIST_TO_PRINT',
            payload: {
                tournament: tournament,
                players: playersWithDetails,
            }
        });
    };

    const sortedEntries = useMemo(() => {
        return [...filteredEntries].sort((a, b) => b.chipCount - a.chipCount);
    }, [filteredEntries]);

    return (
        <>
            <EliminationModal
                isOpen={eliminationModalOpen}
                onClose={() => setEliminationModalOpen(false)}
                tournament={tournament}
                players={state.players}
                entriesToEliminate={entriesToEliminate}
            />
            <Card>
                <div className="flex justify-between items-start mb-4">
                    <CardHeader className="mb-0">Players ({filteredEntries.length} / {totalPlayers})</CardHeader>
                    <Button variant="secondary" onClick={handlePrint} className="flex items-center gap-2">
                        <PrinterIcon className="w-5 h-5"/>
                        Imprimer / Exporter PDF
                    </Button>
                </div>
                 <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher un joueur..."
                        value={playerSearchTerm}
                        onChange={e => setPlayerSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                {/* FIX: Replaced FixedSizeList with a standard map to resolve import issue. */}
                <div className="max-h-[45rem] w-full overflow-y-auto pr-1">
                    {sortedEntries.map((entry, index) => {
                        const player = state.players.find(p => p.id === entry.playerId);
                        if (!player) return null;
                        return (
                            <PlayerRow
                                key={entry.id}
                                index={index}
                                data={{
                                    sortedEntries,
                                    players: state.players,
                                    tournamentId: tournament.id,
                                    onEliminate: handleInitiateElimination
                                }}
                            />
                        );
                    })}
                </div>
                <EliminatedPlayerListWidget tournament={tournament} players={state.players}/>
            </Card>
        </>
    );
}
