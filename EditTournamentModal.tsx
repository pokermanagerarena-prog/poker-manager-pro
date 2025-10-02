

import React, { useState, useEffect } from 'react';
import { useTournamentStore } from './store';
import { Tournament, Commission } from './types';
import { Modal, CardHeader, Button, PlusIcon, TrashIcon } from './components';


const CommissionEditor = ({ commissions, setCommissions, title, disabled }: { commissions: Commission[], setCommissions: (commissions: Commission[]) => void, title: string, disabled: boolean }) => {
    const handleCommissionChange = (index: number, field: 'name' | 'amount', value: string) => {
        const newCommissions = [...commissions];
        const commission = { ...newCommissions[index] };
        if (field === 'amount') {
            commission.amount = parseInt(value, 10) || 0;
        } else {
            commission.name = value;
        }
        newCommissions[index] = commission;
        setCommissions(newCommissions);
    };

    const addCommission = () => {
        setCommissions([...commissions, { id: `c${Date.now()}`, name: '', amount: 0 }]);
    };

    const removeCommission = (index: number) => {
        setCommissions(commissions.filter((_, i) => i !== index));
    };
    
    const inputClasses = "w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-900/50 disabled:cursor-not-allowed disabled:text-gray-400";
    
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {commissions.map((commission, index) => (
                <div key={commission.id || index} className="flex items-center gap-2">
                    <input type="text" placeholder="Nom (ex: Frais de salle)" value={commission.name} onChange={e => handleCommissionChange(index, 'name', e.target.value)} className={inputClasses} required disabled={disabled}/>
                    <input type="number" placeholder="Montant (MAD)" value={commission.amount} onChange={e => handleCommissionChange(index, 'amount', e.target.value)} className={`${inputClasses} w-32`} required disabled={disabled}/>
                    <Button type="button" variant="danger" onClick={() => removeCommission(index)} className="h-10" disabled={disabled}><TrashIcon className="w-5 h-5"/></Button>
                </div>
            ))}
             <Button type="button" variant="secondary" onClick={addCommission} className="flex items-center gap-2" disabled={disabled}><PlusIcon className="w-5 h-5"/> Ajouter une commission</Button>
        </div>
    );
};


export const EditTournamentModal = ({ tournament, isOpen, onClose }: { tournament: Tournament, isOpen: boolean, onClose: () => void }) => {
    const { dispatch } = useTournamentStore();
    
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [buyin, setBuyin] = useState('0');
    const [startingStack, setStartingStack] = useState('0');
    const [addonCost, setAddonCost] = useState('0');
    const [buyinCommissions, setBuyinCommissions] = useState<Commission[]>([]);
    const [addonCommissions, setAddonCommissions] = useState<Commission[]>([]);

    useEffect(() => {
        if (tournament) {
            setName(tournament.name);
            setLocation(tournament.location);
            setBuyin(String(tournament.buyin));
            setStartingStack(String(tournament.startingStack));
            setAddonCost(String(tournament.addonCost));
            setBuyinCommissions(JSON.parse(JSON.stringify(tournament.buyinCommissions || [])));
            setAddonCommissions(JSON.parse(JSON.stringify(tournament.addonCommissions || [])));
        }
    }, [tournament, isOpen]);

    if (!tournament) return null;

    const isLocked = tournament.entries.length > 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const updatedData: Partial<Tournament> = {
            name: name,
            location: location,
        };

        if (!isLocked) {
            updatedData.buyin = parseInt(buyin, 10) || 0;
            updatedData.startingStack = parseInt(startingStack, 10) || 0;
            updatedData.addonCost = parseInt(addonCost, 10) || 0;
            updatedData.buyinCommissions = buyinCommissions.filter(c => c.name.trim() && c.amount > 0);
            updatedData.addonCommissions = addonCommissions.filter(c => c.name.trim() && c.amount > 0);
        }

        const updatedTournament: Tournament = {
            ...tournament,
            ...updatedData
        };

        dispatch({ type: 'UPDATE_TOURNAMENT', payload: updatedTournament });
        onClose();
    };

    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-400";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Modifier les informations du tournoi</CardHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
                {isLocked && (
                    <div className="p-3 bg-yellow-500/10 text-yellow-300 text-sm rounded-md">
                        <p>Les inscriptions ont commencé. Les détails financiers (buy-in, tapis, commissions, etc.) sont verrouillés.</p>
                    </div>
                )}

                <div>
                    <label htmlFor="name" className={labelClasses}>Nom du Tournoi</label>
                    <input type="text" name="name" id="name" value={name} required onChange={e => setName(e.target.value)} className={inputClasses} />
                </div>
                <div>
                    <label htmlFor="location" className={labelClasses}>Lieu</label>
                    <input type="text" name="location" id="location" value={location} onChange={e => setLocation(e.target.value)} className={inputClasses} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                    <div>
                        <label htmlFor="buyin" className={labelClasses}>Part Prizepool (MAD)</label>
                        <input type="number" name="buyin" id="buyin" value={buyin} required onChange={e => setBuyin(e.target.value)} className={inputClasses} disabled={isLocked} />
                    </div>
                     <div>
                        <label htmlFor="startingStack" className={labelClasses}>Tapis de départ</label>
                        <input type="number" name="startingStack" id="startingStack" value={startingStack} required onChange={e => setStartingStack(e.target.value)} className={inputClasses} disabled={isLocked} />
                    </div>
                </div>
                
                 <div className="border-t border-gray-600 pt-6 space-y-6">
                    <CommissionEditor commissions={buyinCommissions} setCommissions={setBuyinCommissions} title="Commissions sur Buy-in / Re-entry" disabled={isLocked}/>
                </div>

                <div className="border-t border-gray-600 pt-6 space-y-6">
                    <div>
                        <label htmlFor="addonCost" className={labelClasses}>Part Prizepool Add-on (MAD)</label>
                        <input type="number" name="addonCost" id="addonCost" value={addonCost} onChange={e => setAddonCost(e.target.value)} className={inputClasses} disabled={isLocked} />
                    </div>
                    <CommissionEditor commissions={addonCommissions} setCommissions={setAddonCommissions} title="Commissions sur Add-on" disabled={isLocked}/>
                </div>
                
                <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                    <Button variant="secondary" type="button" onClick={onClose}>Annuler</Button>
                    <Button variant="primary" type="submit">Sauvegarder</Button>
                </div>
            </form>
        </Modal>
    );
};