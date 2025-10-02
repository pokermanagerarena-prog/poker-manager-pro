

import React, { useState, useMemo, useEffect } from 'react';
import { useTournamentStore, calculatePayouts } from './store';
import { Tournament, Payout, TournamentStatus, TournamentType, TournamentPhase } from './types';
import { Card, CardHeader, Button, Modal, TrashIcon, PlusIcon } from './components';

const PayoutManagerModal = ({ tournament, isOpen, onClose }: { tournament: Tournament; isOpen: boolean; onClose: () => void; }) => {
    const { dispatch } = useTournamentStore();
    const [mode, setMode] = useState(tournament.payoutSettings.mode);
    const [manualPayouts, setManualPayouts] = useState<Payout[]>([]);

    useEffect(() => {
        if (isOpen) {
            setMode(tournament.payoutSettings.mode);
            setManualPayouts(JSON.parse(JSON.stringify(tournament.payoutSettings.manualPayouts)));
        }
    }, [isOpen, tournament]);

    const totalPrizePool = useMemo(() => {
        const totalBuyins = tournament.entries.reduce((sum, entry) => sum + entry.buyins, 0);
        const totalAddons = tournament.entries.reduce((sum, entry) => sum + entry.addons, 0);
        return (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);
    }, [tournament]);

    const totalManualPayouts = useMemo(() => {
        return manualPayouts.reduce((sum, p) => sum + (p.amount || 0), 0);
    }, [manualPayouts]);

    const remainder = totalPrizePool - totalManualPayouts;

    const handleAddPayout = () => {
        const nextRank = manualPayouts.length > 0 ? Math.max(...manualPayouts.map(p => p.rank)) + 1 : 1;
        setManualPayouts([...manualPayouts, { rank: nextRank, amount: 0, description: '' }]);
    };
    
    const handleRemovePayout = (index: number) => {
        setManualPayouts(manualPayouts.filter((_, i) => i !== index));
    };
    
    const handlePayoutChange = (index: number, field: keyof Payout, value: string) => {
        const newPayouts = [...manualPayouts];
        const targetPayout = { ...newPayouts[index] };

        if (field === 'rank' || field === 'amount') {
            // @ts-ignore
            targetPayout[field] = parseInt(value, 10) || 0;
        } else {
            // @ts-ignore
            targetPayout[field] = value;
        }
        newPayouts[index] = targetPayout;
        setManualPayouts(newPayouts);
    };

    const handleSave = () => {
        dispatch({
            type: 'UPDATE_PAYOUT_SETTINGS',
            payload: {
                tournamentId: tournament.id,
                settings: {
                    mode: mode,
                    manualPayouts: manualPayouts
                }
            }
        });
        onClose();
    };

    const inputClasses = "w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-blue-500 focus:border-blue-500 text-sm";
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Manage Payout Structure</CardHeader>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Payout Mode</label>
                    <div className="flex gap-2 rounded-lg bg-gray-700 p-1">
                        <Button type="button" onClick={() => setMode('auto')} className={`w-full ${mode === 'auto' ? 'bg-blue-600' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}>Automatic</Button>
                        <Button type="button" onClick={() => setMode('manual')} className={`w-full ${mode === 'manual' ? 'bg-blue-600' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}>Manual</Button>
                    </div>
                </div>

                {mode === 'manual' && (
                    <div className="space-y-4 border-t border-gray-700 pt-4">
                        <div className="grid grid-cols-3 gap-4 text-center bg-gray-900/50 p-3 rounded-lg">
                            <div>
                                <p className="text-xs text-gray-400">Total Prizepool</p>
                                <p className="text-lg font-bold text-green-400">{totalPrizePool.toLocaleString()} MAD</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Assigned Payouts</p>
                                <p className="text-lg font-bold text-blue-400">{totalManualPayouts.toLocaleString()} MAD</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Remainder</p>
                                <p className={`text-lg font-bold ${remainder === 0 ? 'text-white' : 'text-yellow-400'}`}>{remainder.toLocaleString()} MAD</p>
                            </div>
                        </div>

                        {remainder !== 0 && (
                            <p className="text-center text-yellow-400 text-sm bg-yellow-500/10 p-2 rounded-md">Warning: The sum of manual payouts does not match the total prizepool.</p>
                        )}

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                            {manualPayouts.map((payout, index) => (
                                <div key={index} className="flex items-center gap-2 bg-gray-700/50 p-2 rounded-md">
                                    <input type="number" placeholder="Rank" value={payout.rank} onChange={e => handlePayoutChange(index, 'rank', e.target.value)} className={`${inputClasses} w-16 text-center`} />
                                    <input type="text" placeholder="Description (e.g., Ticket)" value={payout.description} onChange={e => handlePayoutChange(index, 'description', e.target.value)} className={`${inputClasses} flex-grow`} />
                                    <input type="number" placeholder="Amount" value={payout.amount} onChange={e => handlePayoutChange(index, 'amount', e.target.value)} className={`${inputClasses} w-24 text-right`} />
                                    <Button variant="danger" onClick={() => handleRemovePayout(index)} className="p-2"><TrashIcon className="w-4 h-4" /></Button>
                                </div>
                            ))}
                        </div>

                        <Button variant="secondary" onClick={handleAddPayout} className="flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Add Prize</Button>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-4 mt-8 border-t border-gray-700 pt-4">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Save Changes</Button>
            </div>
        </Modal>
    )
}

export const PayoutsWidget = ({ tournament }: { tournament: Tournament }) => {
    const { state } = useTournamentStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const totalBuyins = tournament.entries.reduce((sum, entry) => sum + entry.buyins, 0);
    const totalAddons = tournament.entries.reduce((sum, entry) => sum + entry.addons, 0);
    const totalPrizePool = (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);
    const totalEntries = tournament.entries.filter(e => e.status !== 'Merge Discarded').length;

    const isMultiFlightDay1 = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;

    const payouts = useMemo(() => {
        if (tournament.payoutSettings.mode === 'manual' && tournament.payoutSettings.manualPayouts.length > 0) {
            return [...tournament.payoutSettings.manualPayouts].sort((a,b) => a.rank - b.rank);
        }
        return calculatePayouts(totalPrizePool, totalEntries);
    }, [tournament.payoutSettings, totalPrizePool, totalEntries]);
    
    return (
        <Card>
            <PayoutManagerModal tournament={tournament} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            <div className="flex justify-between items-center mb-4">
                <CardHeader className="mb-0">Payout Structure</CardHeader>
                {/* FIX: Use '!==' for enum comparison instead of 'includes'. */}
                {tournament.status !== TournamentStatus.COMPLETED && !tournament.dealMadePayouts && (
                    <Button variant="secondary" onClick={() => setIsModalOpen(true)}>Manage</Button>
                )}
            </div>
            {isMultiFlightDay1 ? (
                <div className="text-center p-4">
                    <p className="text-sm text-gray-400">Prizepool Actuel</p>
                    <p className="text-3xl font-bold text-green-400 mt-2">{totalPrizePool.toLocaleString()} MAD</p>
                    <p className="text-xs text-gray-500 mt-4">La structure détaillée des paiements sera disponible au Day 2.</p>
                </div>
            ) : tournament.dealMadePayouts && tournament.dealMadePayouts.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    <p className="text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded-md">Un accord a été conclu. Les paiements suivants sont garantis.</p>
                    {tournament.dealMadePayouts.sort((a,b) => b.amount - a.amount).map(deal => {
                        const player = state.players.find(p => p.id === deal.playerId);
                        return (
                            <div key={deal.playerId} className="flex justify-between text-sm bg-gray-700/50 p-2 rounded-md">
                                <span className="font-semibold text-gray-300">{player?.nickname}</span>
                                <span className="font-bold text-green-400">{deal.amount.toLocaleString()} MAD</span>
                            </div>
                        );
                    })}
                </div>
            ) : payouts.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {payouts.map(p => (
                        <div key={p.rank} className="flex justify-between text-sm bg-gray-700/50 p-2 rounded-md">
                            <span className="font-semibold text-gray-300">#{p.rank}</span>
                            <span className="font-bold text-green-400">{p.description || `${p.amount.toLocaleString()} MAD`}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-400 text-sm">Aucune structure de paiement générée. Des joueurs doivent s'inscrire.</p>
            )}
        </Card>
    );
};