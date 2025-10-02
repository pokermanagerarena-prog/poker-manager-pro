
import React, { useMemo, useState, useEffect } from 'react';
import { useTournamentStore, calculatePayouts } from './store';
import { Tournament, Player, EntryStatus } from './types';
import { Modal, CardHeader, Button } from './components';

// Memoization cache for ICM calculations to avoid re-computing for the same state.
const icmMemo: { [key: string]: number[] } = {};

const calculateIcmEquity = (chipCounts: number[], payouts: number[]): number[] => {
    const key = `${chipCounts.join('-')}:${payouts.join('-')}`;
    if (key in icmMemo) return icmMemo[key];
    if (chipCounts.length === 0 || payouts.length === 0) return [];
    if (chipCounts.length === 1) return [payouts.reduce((a, b) => a + b, 0)];

    const totalChips = chipCounts.reduce((a, b) => a + b, 0);
    if (totalChips === 0) {
        const equalShare = payouts.reduce((a, b) => a + b, 0) / chipCounts.length;
        return Array(chipCounts.length).fill(equalShare);
    }
    
    const equities = Array(chipCounts.length).fill(0);
    for (let i = 0; i < chipCounts.length; i++) {
        const probFinishFirst = chipCounts[i] / totalChips;
        const remainingChips = [...chipCounts.slice(0, i), ...chipCounts.slice(i + 1)];
        const remainingPayouts = payouts.slice(1);
        const subEquities = calculateIcmEquity(remainingChips, remainingPayouts);
        
        equities[i] += probFinishFirst * payouts[0];
        
        let subIndex = 0;
        for (let j = 0; j < chipCounts.length; j++) {
            if (i === j) continue;
            equities[j] += probFinishFirst * (subEquities[subIndex] || 0);
            subIndex++;
        }
    }
    icmMemo[key] = equities;
    return equities;
};

export const DealMakingModal = ({ tournament, players, isOpen, onClose }: { tournament: Tournament, players: Player[], isOpen: boolean, onClose: () => void }) => {
    const { dispatch } = useTournamentStore();
    const [method, setMethod] = useState<'chipChop' | 'icm'>('icm');
    const [adjustedPayouts, setAdjustedPayouts] = useState<Record<string, number>>({});

    const { remainingPlayers, remainingPrizePool, remainingPayoutsArray } = useMemo(() => {
        const activePlayers = tournament.entries
            .filter(e => e.status === EntryStatus.ACTIVE)
            .sort((a, b) => b.chipCount - a.chipCount);
        
        const totalBuyins = tournament.entries.reduce((sum, entry) => sum + entry.buyins, 0);
        const totalAddons = tournament.entries.reduce((sum, entry) => sum + entry.addons, 0);
        const totalPrizePool = (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);
        const totalEntries = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;

        const fullPayouts = tournament.payoutSettings.mode === 'manual' && tournament.payoutSettings.manualPayouts.length > 0
            ? [...tournament.payoutSettings.manualPayouts].sort((a,b) => a.rank - b.rank)
            : calculatePayouts(totalPrizePool, totalEntries);

        // --- BUG FIX ---
        // Original logic was flawed as it relied on `eliminationRank`, which isn't consistently set.
        // Correct logic is to consider the prizes for the remaining places, which corresponds
        // to the number of active players.
        const numActivePlayers = activePlayers.length;
        const remainingPayouts = fullPayouts.slice(0, numActivePlayers);
        const prizePool = remainingPayouts.reduce((sum, p) => sum + p.amount, 0);
        
        return { 
            remainingPlayers: activePlayers, 
            remainingPrizePool: prizePool,
            remainingPayoutsArray: remainingPayouts.map(p => p.amount)
        };
    }, [tournament]);

    const calculatedPayouts = useMemo(() => {
        if (remainingPlayers.length === 0) return {};

        const totalChips = remainingPlayers.reduce((sum, p) => sum + p.chipCount, 0);
        const rawPayouts: Record<string, number> = {};

        if (method === 'chipChop') {
            remainingPlayers.forEach(player => {
                const share = totalChips > 0 ? player.chipCount / totalChips : 1 / remainingPlayers.length;
                rawPayouts[player.playerId] = share * remainingPrizePool;
            });
        } else { // ICM
            const chipCounts = remainingPlayers.map(p => p.chipCount);
            const icmEquities = calculateIcmEquity(chipCounts, remainingPayoutsArray);
            remainingPlayers.forEach((player, index) => {
                rawPayouts[player.playerId] = icmEquities[index];
            });
        }
        
        // Round payouts to the nearest 100
        const roundedPayouts: Record<string, number> = {};
        for (const playerId in rawPayouts) {
            roundedPayouts[playerId] = Math.round(rawPayouts[playerId] / 100) * 100;
        }

        // Distribute remainder to ensure total matches prize pool
        const totalRounded = Object.values(roundedPayouts).reduce((sum, val) => sum + val, 0);
        const remainder = remainingPrizePool - totalRounded;

        if (remainder !== 0 && remainingPlayers.length > 0) {
            // Give the remainder to the chip leader
            const chipLeaderId = remainingPlayers[0].playerId;
            roundedPayouts[chipLeaderId] += remainder;
        }

        return roundedPayouts;
    }, [method, remainingPlayers, remainingPrizePool, remainingPayoutsArray]);
    
    useEffect(() => {
        setAdjustedPayouts(calculatedPayouts);
    }, [calculatedPayouts]);
    
    const totalAdjusted = Object.values(adjustedPayouts).reduce((sum, val) => sum + (val || 0), 0);
    const remainder = remainingPrizePool - totalAdjusted;
    const isDealValid = Math.abs(remainder) < 0.01;

    const handleFinalize = () => {
        if (!isDealValid) {
            alert("Le total des paiements ajustés ne correspond pas au prizepool restant.");
            return;
        }
        const finalPayouts = Object.entries(adjustedPayouts).map(([playerId, amount]) => ({ playerId, amount }));
        dispatch({ type: 'FINALIZE_DEAL', payload: { tournamentId: tournament.id, payouts: finalPayouts } });
        onClose();
    };
    
    const handlePayoutChange = (playerId: string, value: string) => {
        setAdjustedPayouts(prev => ({...prev, [playerId]: parseFloat(value) || 0}));
    };

    const inputClasses = "w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-blue-500 focus:border-blue-500 text-sm text-right font-mono";
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Calculateur de Deal - Table Finale</CardHeader>
            <div className="space-y-4">
                <div className="flex gap-2 rounded-lg bg-gray-700 p-1">
                    <Button type="button" onClick={() => setMethod('icm')} className={`w-full ${method === 'icm' ? 'bg-blue-600' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}>ICM (Recommandé)</Button>
                    <Button type="button" onClick={() => setMethod('chipChop')} className={`w-full ${method === 'chipChop' ? 'bg-blue-600' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}>Chip Chop</Button>
                </div>
                
                 <div className="grid grid-cols-3 gap-4 text-center bg-gray-900/50 p-3 rounded-lg">
                    <div> <p className="text-xs text-gray-400">Prizepool restant</p> <p className="text-lg font-bold text-green-400">{remainingPrizePool.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</p> </div>
                    <div> <p className="text-xs text-gray-400">Total Proposé</p> <p className="text-lg font-bold text-blue-400">{totalAdjusted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</p> </div>
                    <div> <p className="text-xs text-gray-400">Différence</p> <p className={`text-lg font-bold ${isDealValid ? 'text-white' : 'text-yellow-400'}`}>{remainder.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</p> </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {remainingPlayers.map(entry => {
                        const player = players.find(p => p.id === entry.playerId);
                        return (
                            <div key={entry.id} className="flex items-center gap-4 bg-gray-700/50 p-2 rounded-md">
                                <img src={player?.avatarUrl} alt={player?.nickname} className="w-10 h-10 rounded-full" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-white">{player?.nickname}</p>
                                    <p className="text-sm text-gray-400">{entry.chipCount.toLocaleString()} jetons</p>
                                </div>
                                <div className="w-32">
                                    <input type="number" step="0.01" value={adjustedPayouts[entry.playerId]?.toFixed(2) || '0.00'} onChange={e => handlePayoutChange(entry.playerId, e.target.value)} className={inputClasses} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-8 border-t border-gray-700 pt-4">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="primary" onClick={handleFinalize} disabled={!isDealValid} title={!isDealValid ? "Le total doit correspondre au prizepool" : "Verrouiller les paiements et continuer à jouer"}>
                    Finaliser le Deal
                </Button>
            </div>
        </Modal>
    );
};
