
import React, { useState } from 'react';
import { useTournamentStore } from './store';
import { Tournament, FlightStatus } from './types';
import { Button, Modal, CardHeader } from './components';

export const MultiFlightControls = ({ tournament }: { tournament: Tournament }) => {
    const { dispatch } = useTournamentStore();
    const [isMergeModalOpen, setMergeModalOpen] = useState(false);

    const handleUpdateStatus = (flightId: string, status: FlightStatus) => {
        dispatch({ type: 'UPDATE_FLIGHT_STATUS', payload: { tournamentId: tournament.id, flightId, status } });
    };

    const handleConfirmMerge = () => {
        dispatch({ type: 'PERFORM_MERGE', payload: { tournamentId: tournament.id } });
        setMergeModalOpen(false);
    };

    const allFlightsComplete = tournament.flights.every(f => f.status === FlightStatus.COMPLETED);
    const flightStatusColor: Record<FlightStatus, string> = {
        [FlightStatus.SCHEDULED]: 'bg-gray-500',
        [FlightStatus.RUNNING]: 'bg-green-500 animate-pulse',
        [FlightStatus.COMPLETED]: 'bg-blue-500',
    };

    return (
        <>
            <div className="space-y-3">
                {tournament.flights.map(flight => {
                    const totalFlightEntries = tournament.entries.filter(e => e.flightId === flight.id).length;
                    const activeFlightEntries = tournament.entries.filter(e => e.flightId === flight.id && e.status === 'Active').length;
                    
                    const qualificationPercentage = tournament.day2Settings?.flightQualificationPercentage ?? 20;
                    const targetPlayerCount = totalFlightEntries > 0 ? Math.ceil(totalFlightEntries * (qualificationPercentage / 100)) : 0;
                    
                    const canComplete = activeFlightEntries <= targetPlayerCount && totalFlightEntries > 0;

                    return (
                        <div key={flight.id} className="bg-gray-700/50 p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white">{flight.name}</p>
                                <div className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${flightStatusColor[flight.status]}`}></span>
                                    <span>{flight.status}</span>
                                </div>
                                {totalFlightEntries > 0 && (
                                    <p className="text-xs text-gray-300 mt-1">
                                        {activeFlightEntries} / {totalFlightEntries} restants (Objectif: ≤{targetPlayerCount})
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {flight.status === FlightStatus.SCHEDULED && <Button variant="secondary" className="text-xs px-2 py-1" onClick={() => handleUpdateStatus(flight.id, FlightStatus.RUNNING)}>Start</Button>}
                                {flight.status === FlightStatus.RUNNING && 
                                    <Button 
                                        variant="secondary" 
                                        className="text-xs px-2 py-1" 
                                        onClick={() => handleUpdateStatus(flight.id, FlightStatus.COMPLETED)}
                                        disabled={!canComplete}
                                        title={!canComplete ? `Ne peut être complété que lorsque ${targetPlayerCount} joueurs ou moins restent` : 'Marquer ce vol comme terminé'}
                                    >
                                        Mark Complete
                                    </Button>
                                }
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="mt-6 border-t border-gray-600 pt-4">
                <Button variant="primary" className="w-full" disabled={!allFlightsComplete} onClick={() => setMergeModalOpen(true)}>
                    Perform Merge for Day 2
                </Button>
            </div>
             <Modal isOpen={isMergeModalOpen} onClose={() => setMergeModalOpen(false)}>
                <CardHeader>Confirm Day 2 Merge</CardHeader>
                <p className="text-gray-300">This will end all Day 1 flights, apply the 'best stack per player' rule, and generate seatings for Day 2. This action will create a snapshot in case you need to undo it.</p>
                <p className="text-yellow-400 font-semibold mt-4">Are you sure you want to proceed?</p>
                <div className="flex justify-end gap-4 mt-6">
                    <Button variant="secondary" onClick={() => setMergeModalOpen(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleConfirmMerge}>Yes, Perform Merge</Button>
                </div>
            </Modal>
        </>
    )
}
