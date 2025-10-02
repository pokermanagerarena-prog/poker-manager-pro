import React, { useState, useMemo, useEffect } from 'react';
import { useTournamentStore, calculatePayouts } from './store';
import { Tournament, Player, EntryStatus } from './types';
import { Modal, CardHeader, Button } from './components';

export const SimultaneousEliminationModal = ({ tournament, players, isOpen, onClose }: { tournament: Tournament, players: Player[], isOpen: boolean, onClose: () => void }) => {
    const { dispatch } = useTournamentStore();
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

    const activePlayers = useMemo(() =>
        tournament.entries
        .filter(e => e.status === EntryStatus.ACTIVE)
        .sort((a, b) => (players.find(p => p.id === a.playerId)?.nickname || '').localeCompare(players.find(p => p.id === b.playerId)?.nickname || ''))
    , [tournament.entries, players]);
    
    const calculation = useMemo(() => {
        if (selectedEntryIds.size === 0) {
            return {
                sharedRank: null,
                splitPayout: 0,
                totalPayout: 0,
                ranksToSplit: []
            };
        }
        
        const activeCount = activePlayers.length;
        const eliminatedCount = selectedEntryIds.size;
        
        const ranksToSplit = Array.from({ length: eliminatedCount }, (_, i) => activeCount - i);
        const sharedRank = Math.max(...ranksToSplit);

        const totalBuyins = tournament.entries.reduce((sum, e) => sum + e.buyins, 0);
        const totalAddons = tournament.entries.reduce((sum, e) => sum + e.addons, 0);
        const totalPrizePool = (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);
        const totalEntriesCount = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;

        const allPayouts = tournament.payoutSettings.mode === 'manual' && tournament.payoutSettings.manualPayouts.length > 0
            ? tournament.payoutSettings.manualPayouts
            : calculatePayouts(totalPrizePool, totalEntriesCount);

        const totalPayout = ranksToSplit.reduce((sum, rank) => {
            const payoutForRank = allPayouts.find(p => p.rank === rank);
            return sum + (payoutForRank?.amount || 0);
        }, 0);
        
        const splitPayout = totalPayout > 0 ? totalPayout / eliminatedCount : 0;
        
        return { sharedRank, splitPayout, totalPayout, ranksToSplit };
    }, [selectedEntryIds, activePlayers.length, tournament]);


    const handleTogglePlayer = (entryId: string) => {
        const newSet = new Set(selectedEntryIds);
        if (newSet.has(entryId)) {
            newSet.delete(entryId);
        } else {
            newSet.add(entryId);
        }
        setSelectedEntryIds(newSet);
    };

    const handleConfirm = () => {
        if (selectedEntryIds.size < 2) {
            alert("Veuillez sélectionner au moins deux joueurs.");
            return;
        }
        if (window.confirm(`Confirmez-vous l'élimination de ${selectedEntryIds.size} joueurs ? Ils recevront tous le rang ${calculation.sharedRank} et un paiement de ${calculation.splitPayout.toFixed(2)} MAD chacun.`)) {
            dispatch({ type: 'SIMULTANEOUS_ELIMINATION', payload: { tournamentId: tournament.id, entryIds: Array.from(selectedEntryIds) } });
            onClose();
        }
    };
    
    useEffect(() => {
        if (!isOpen) {
            setSelectedEntryIds(new Set());
        }
    }, [isOpen]);

    if (activePlayers.length < 2) {
        return (
            <Modal isOpen={isOpen} onClose={onClose}>
                <CardHeader>Élimination Simultanée</CardHeader>
                <p className="text-gray-400">Cette fonctionnalité n'est pas disponible car il reste moins de 2 joueurs actifs.</p>
                <div className="flex justify-end mt-4"><Button variant="secondary" onClick={onClose}>Fermer</Button></div>
            </Modal>
        );
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Gérer les Éliminations Simultanées</CardHeader>
            <p className="text-sm text-gray-400 mb-4">Sélectionnez tous les joueurs éliminés lors de la même main. Leurs prix seront combinés et répartis équitablement.</p>
            
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 border-t border-b border-gray-700 py-2">
                {activePlayers.map(entry => {
                    const player = players.find(p => p.id === entry.playerId);
                    const isSelected = selectedEntryIds.has(entry.id);
                    return (
                        <div key={entry.id} onClick={() => handleTogglePlayer(entry.id)} className={`flex items-center gap-4 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/30' : 'hover:bg-gray-700/50'}`}>
                           <input type="checkbox" checked={isSelected} readOnly className="h-5 w-5 rounded border-gray-500 bg-gray-800 text-blue-600 focus:ring-blue-500 pointer-events-none" />
                           <img src={player?.avatarUrl} alt={player?.nickname} className="w-8 h-8 rounded-full" />
                           <div>
                               <p className="font-semibold text-white">{player?.nickname}</p>
                               <p className="text-xs text-gray-400">{entry.chipCount.toLocaleString()} jetons</p>
                           </div>
                        </div>
                    );
                })}
            </div>
            
            {selectedEntryIds.size > 0 && (
                <div className="mt-4 bg-gray-900/50 p-3 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-white">Résumé</h3>
                    <p className="text-gray-300"><strong className="text-white">{selectedEntryIds.size}</strong> joueurs seront éliminés.</p>
                    <p className="text-gray-300">Places partagées : <strong className="text-white">{calculation.ranksToSplit.join(', ')}</strong></p>
                    <p className="text-gray-300">Rang final assigné : <strong className="text-white">{calculation.sharedRank}</strong></p>
                    <p className="text-gray-300">Prix total partagé : <strong className="text-green-400">{calculation.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD</strong></p>
                    <p className="text-gray-300">Paiement par joueur : <strong className="text-green-400">{calculation.splitPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD</strong></p>
                </div>
            )}
            
            <div className="flex justify-end gap-4 mt-6">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="danger" onClick={handleConfirm} disabled={selectedEntryIds.size < 2}>Confirmer Éliminations</Button>
            </div>
        </Modal>
    );
};