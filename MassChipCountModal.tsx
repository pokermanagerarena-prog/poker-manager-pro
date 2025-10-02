import React, { useState, useMemo, useEffect } from 'react';
import { useTournamentStore } from './store';
import { Tournament, Player, EntryStatus } from './types';
import { Modal, CardHeader, Button } from './components';

export const MassChipCountModal = ({ tournament, players, isOpen, onClose }: { tournament: Tournament, players: Player[], isOpen: boolean, onClose: () => void }) => {
    const { dispatch } = useTournamentStore();
    const [chipCounts, setChipCounts] = useState<Record<string, string>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTable, setSelectedTable] = useState('all'); // 'all' or table.id as a string
    const [sortBy, setSortBy] = useState<'seat' | 'name'>('seat'); // 'seat' or 'name'

    const activeEntries = useMemo(() =>
        tournament.entries
        .filter(e => e.status === EntryStatus.ACTIVE && e.table !== null && e.seat !== null)
    , [tournament.entries]);

    useEffect(() => {
        if (isOpen) {
            const initialCounts = activeEntries.reduce((acc, entry) => {
                acc[entry.id] = entry.chipCount.toString();
                return acc;
            }, {} as Record<string, string>);
            setChipCounts(initialCounts);
            setSearchTerm('');
            setSelectedTable('all');
            setSortBy('seat');
        }
    }, [isOpen, activeEntries]);

    const filteredAndSortedEntries = useMemo(() => {
        let entries = [...activeEntries];

        // 1. Filter by table
        if (selectedTable !== 'all') {
            entries = entries.filter(entry => entry.table === parseInt(selectedTable, 10));
        }

        // 2. Filter by search term
        if (searchTerm.trim() !== '') {
            const lowercasedSearch = searchTerm.toLowerCase();
            entries = entries.filter(entry => {
                const player = players.find(p => p.id === entry.playerId);
                return player && player.nickname.toLowerCase().includes(lowercasedSearch);
            });
        }

        // 3. Sort
        entries.sort((a, b) => {
            if (sortBy === 'name') {
                const playerA = players.find(p => p.id === a.playerId)?.nickname || '';
                const playerB = players.find(p => p.id === b.playerId)?.nickname || '';
                return playerA.localeCompare(playerB);
            }
            // Default to sorting by seat ('seat')
            if (a.table === b.table) {
                return (a.seat || 0) - (b.seat || 0);
            }
            return (a.table || 0) - (b.table || 0);
        });

        return entries;
    }, [activeEntries, searchTerm, players, selectedTable, sortBy]);

    const handleCountChange = (entryId: string, value: string) => {
        setChipCounts(prev => ({ ...prev, [entryId]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updates = Object.entries(chipCounts)
            .filter(([entryId, count]) => {
                const originalEntry = tournament.entries.find(e => e.id === entryId);
                return originalEntry && originalEntry.chipCount.toString() !== count;
            })
            .map(([entryId, count]) => ({
                entryId,
                newChipCount: parseInt(count, 10) || 0
            }));

        if (updates.length > 0) {
            dispatch({
                type: 'BULK_UPDATE_CHIP_COUNTS',
                payload: {
                    tournamentId: tournament.id,
                    updates
                }
            });
        }

        onClose();
    };

    const inputClasses = "w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-blue-500 focus:border-blue-500 text-sm text-right font-mono";
    const controlInputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Saisie Groupée des Tapis</CardHeader>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input
                        type="text"
                        placeholder="Filtrer par nom..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={`${controlInputClasses} md:col-span-1`}
                    />
                    <select
                        value={selectedTable}
                        onChange={e => setSelectedTable(e.target.value)}
                        className={`${controlInputClasses} md:col-span-1`}
                    >
                        <option value="all">Toutes les tables</option>
                        {tournament.tables.sort((a, b) => a.id - b.id).map(table => (
                            <option key={table.id} value={table.id.toString()}>{table.name}</option>
                        ))}
                    </select>
                    <div className="flex gap-2 bg-gray-800 p-1 rounded-md md:col-span-1">
                         <Button
                            type="button"
                            variant={sortBy === 'seat' ? 'primary' : 'secondary'}
                            onClick={() => setSortBy('seat')}
                            className="w-full text-xs"
                        >
                            Trier par Siège
                        </Button>
                         <Button
                            type="button"
                            variant={sortBy === 'name' ? 'primary' : 'secondary'}
                            onClick={() => setSortBy('name')}
                            className="w-full text-xs"
                        >
                            Trier par Nom
                        </Button>
                    </div>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {filteredAndSortedEntries.map(entry => {
                        const player = players.find(p => p.id === entry.playerId);
                        return (
                            <div key={entry.id} className="flex items-center gap-4 bg-gray-700/50 p-2 rounded-md">
                                <img src={player?.avatarUrl} alt={player?.nickname} className="w-8 h-8 rounded-full" />
                                <div className="font-semibold text-white flex-grow">
                                    <p>{player?.nickname}</p>
                                    <p className="text-xs text-gray-400 font-normal">T{entry.table} / S{entry.seat}</p>
                                </div>
                                <div className="w-32">
                                    <input
                                        type="number"
                                        value={chipCounts[entry.id] || ''}
                                        onChange={e => handleCountChange(entry.id, e.target.value)}
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                    <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
                    <Button variant="primary" type="submit">Sauvegarder les Tapis</Button>
                </div>
            </form>
        </Modal>
    );
};
