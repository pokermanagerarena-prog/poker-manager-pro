
import React, { useState } from 'react';
import { useTournamentStore } from './store';
import { Tournament, TournamentStatus } from './types';
import { Card, CardHeader, Button, TrashIcon } from './components';

export const AnnouncementsManager = ({ tournament }: { tournament: Tournament }) => {
    const { dispatch } = useTournamentStore();
    const [newAnnouncement, setNewAnnouncement] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAnnouncement.trim() && tournament) {
            dispatch({ type: 'ADD_ANNOUNCEMENT', payload: { tournamentId: tournament.id, text: newAnnouncement.trim() } });
            setNewAnnouncement('');
        }
    };
    
    const handleRemove = (id: string) => {
        if (tournament) {
            dispatch({ type: 'REMOVE_ANNOUNCEMENT', payload: { tournamentId: tournament.id, announcementId: id } });
        }
    }

    return (
        <Card>
            <CardHeader>Gestion des annonces</CardHeader>
            {tournament && tournament.status !== TournamentStatus.COMPLETED && (
                 <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        value={newAnnouncement}
                        onChange={e => setNewAnnouncement(e.target.value)}
                        placeholder="Tapez votre annonce ici..."
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Button type="submit" variant="primary">Ajouter</Button>
                </form>
            )}
           
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {tournament && [...tournament.announcements].reverse().map(ann => (
                    <div key={ann.id} className="flex justify-between items-start bg-gray-700/50 p-2 rounded-md">
                        <p className="text-sm text-gray-200">{ann.text}</p>
                        {tournament.status !== TournamentStatus.COMPLETED && (
                             <button onClick={() => handleRemove(ann.id)} className="text-gray-500 hover:text-red-400 flex-shrink-0 ml-2">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
                 {tournament && tournament.announcements.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-2">Aucune annonce active.</p>
                )}
            </div>
        </Card>
    );
};
