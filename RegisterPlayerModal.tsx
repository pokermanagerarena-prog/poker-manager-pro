import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTournamentStore } from './store';
import { Modal, CardHeader, Button, CameraIcon } from './components';
import { Tournament, TournamentType, TournamentPhase, FlightStatus, EntryStatus } from './types';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const ScannerModal = ({ onScanSuccess, onClose }: { onScanSuccess: (decodedText: string) => void, onClose: () => void }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
        ];
        
        const configForStart = { 
            fps: 10, 
            qrbox: { width: 350, height: 350 },
        };

        const scanner = new Html5Qrcode('qr-reader', { formatsToSupport, verbose: false });
        scannerRef.current = scanner;

        const startScanner = async () => {
            try {
                await scanner.start(
                    { facingMode: "environment" },
                    configForStart,
                    (decodedText, decodedResult) => {
                        // success
                        onScanSuccess(decodedText);
                    },
                    (errorMessage) => {
                        // parse error, ignore
                    }
                );
            } catch (err) {
                console.error("Scanner Error:", err);
                alert("Impossible d'accéder à la caméra. Veuillez vérifier les autorisations de votre navigateur.");
                onClose();
            }
        };
        startScanner();

        return () => {
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(err => console.error("Failed to stop scanner", err));
            }
        };
    }, [onScanSuccess, onClose]);

    return (
        <Modal isOpen={true} onClose={onClose}>
            <CardHeader>Scanner le Code du Joueur</CardHeader>
            <div id="qr-reader" className="w-full h-[400px] bg-gray-900 rounded-lg"></div>
             <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
            </div>
        </Modal>
    );
};

export const RegisterPlayerModal = ({ tournament, isOpen, onClose, defaultFlightId }: { tournament: Tournament | undefined, isOpen: boolean, onClose: () => void, defaultFlightId?: string }) => {
    const { state, dispatch } = useTournamentStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [newPlayerNickname, setNewPlayerNickname] = useState('');
    const [selectedFlightId, setSelectedFlightId] = useState('');
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [shouldPrintTicket, setShouldPrintTicket] = useState(() => {
        const saved = sessionStorage.getItem('shouldPrintTicket');
        return saved !== null ? JSON.parse(saved) : false;
    });
    const prevIsOpen = useRef(isOpen);

    useEffect(() => {
        sessionStorage.setItem('shouldPrintTicket', JSON.stringify(shouldPrintTicket));
    }, [shouldPrintTicket]);

    const isMultiFlightMode = tournament?.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;

    useEffect(() => {
        // Only reset text inputs and scanner state when the modal transitions from closed to open.
        // This prevents wiping user input on re-renders caused by tournament object updates (e.g., clock ticks).
        if (isOpen && !prevIsOpen.current) {
            setSearchTerm('');
            setNewPlayerNickname('');
            setScannerOpen(false);
        }
        prevIsOpen.current = isOpen;
    }, [isOpen]);

    useEffect(() => {
        // Handle flight selection logic. This can safely re-run if the tournament state changes.
        if (isOpen && tournament) {
            if (isMultiFlightMode && tournament.flights.length > 0) {
                // Prioritize the defaultFlightId from the dashboard if it's valid
                if (defaultFlightId && defaultFlightId !== 'all' && tournament.flights.some(f => f.id === defaultFlightId)) {
                    setSelectedFlightId(defaultFlightId);
                } else {
                    // Fallback logic: prefer running, then scheduled, then first available
                    const runningFlight = tournament.flights.find(f => f.status === FlightStatus.RUNNING);
                    const firstScheduled = tournament.flights.find(f => f.status === FlightStatus.SCHEDULED);
                    if (runningFlight) {
                        setSelectedFlightId(runningFlight.id);
                    } else if (firstScheduled) {
                        setSelectedFlightId(firstScheduled.id);
                    } else {
                        setSelectedFlightId(tournament.flights[0].id);
                    }
                }
            } else if (tournament) {
                // Standard tournament, there's only one flight object.
                setSelectedFlightId(tournament.flights[0].id);
            }
        }
    }, [isOpen, tournament, isMultiFlightMode, defaultFlightId]);
    
    const filteredPlayers = useMemo(() => {
        if (!searchTerm) return [];
    
        const lowercasedSearchTerm = searchTerm.toLowerCase();
        const playersMatchingSearch = state.players.filter(p => 
            p.nickname.toLowerCase().includes(lowercasedSearchTerm) ||
            p.firstName.toLowerCase().includes(lowercasedSearchTerm) ||
            p.lastName.toLowerCase().includes(lowercasedSearchTerm) ||
            `${p.firstName.toLowerCase()} ${p.lastName.toLowerCase()}`.includes(lowercasedSearchTerm)
        );
    
        if (!tournament) return playersMatchingSearch;
    
        if (tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS) {
            // For multi-flight, allow re-entry if not currently active/pending in the selected flight.
            const playerIdsInThisFlight = new Set(
                tournament.entries
                    .filter(e => e.flightId === selectedFlightId && (e.status === EntryStatus.ACTIVE || e.status === EntryStatus.RE_ENTRY_PENDING))
                    .map(e => e.playerId)
            );
            return playersMatchingSearch.filter(p => !playerIdsInThisFlight.has(p.id));
        } else {
            // For standard tournaments, only filter out players who are currently active or pending re-entry.
            // This allows eliminated players to re-enter if rebuys are allowed.
            const activePlayerIds = new Set(
                tournament.entries
                    .filter(e => e.status === EntryStatus.ACTIVE || e.status === EntryStatus.RE_ENTRY_PENDING)
                    .map(e => e.playerId)
            );
            return playersMatchingSearch.filter(p => !activePlayerIds.has(p.id));
        }
    
    }, [searchTerm, state.players, tournament, selectedFlightId]);
    
    const handleRegister = (identifier: { nickname?: string, playerId?: string }) => {
        if (!tournament || (!identifier.playerId && !identifier.nickname?.trim())) return;

        if (isMultiFlightMode && !selectedFlightId) {
            alert('Veuillez sélectionner un vol.');
            return;
        }
        
        let addDealerBonus = false;
        if (tournament.dealerBonusCost > 0) {
            if (window.confirm(`Voulez-vous ajouter le Bonus Croupier (${tournament.dealerBonusChips} jetons pour ${tournament.dealerBonusCost} MAD) pour ce joueur ?`)) {
                addDealerBonus = true;
            }
        }

        dispatch({
            type: 'REGISTER_PLAYER',
            payload: {
                tournamentId: tournament.id,
                flightId: selectedFlightId,
                ...identifier,
                addDealerBonus,
                shouldPrintTicket
            }
        });
        
        // Clear inputs to allow for next registration without closing the modal
        setSearchTerm('');
        setNewPlayerNickname('');
    };
    
    const handleCreateAndRegister = (e: React.FormEvent) => {
        e.preventDefault();
        handleRegister({ nickname: newPlayerNickname });
    }
    
    const handleScanSuccess = (decodedText: string) => {
        setScannerOpen(false);
        try {
            const data = JSON.parse(decodedText);
            if (data && data.source === 'PokerTournamentManagerPRO+' && data.playerId) {
                handleRegister({ playerId: data.playerId });
            } else {
                alert('Code invalide ou ne provenant pas de cette application.');
            }
        } catch (e) {
            console.log("Could not parse scanned code as JSON, attempting legacy scan.", decodedText);
            if (decodedText && decodedText.length > 5) { 
                 handleRegister({ playerId: decodedText });
            } else {
                 alert("Code illisible ou d'un format ancien non reconnu.");
            }
        }
    };


    if (!tournament) return null;
    
    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
    
    return (
        <>
            <Modal isOpen={isOpen && !isScannerOpen} onClose={onClose}>
                <CardHeader>Register Player for {tournament.name}</CardHeader>
                <div className="space-y-6">
                    {isMultiFlightMode && (
                        <div>
                            <label htmlFor="flight-select" className={labelClasses}>Select Flight</label>
                            <select 
                                id="flight-select" 
                                value={selectedFlightId} 
                                onChange={e => setSelectedFlightId(e.target.value)} 
                                className={inputClasses}
                            >
                                {tournament.flights.map(flight => (
                                    <option key={flight.id} value={flight.id}>{flight.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <Button type="button" onClick={() => setScannerOpen(true)} className="w-full flex justify-center items-center gap-2">
                            <CameraIcon className="w-5 h-5"/>
                            Scanner le Code
                        </Button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-600" /></div>
                        <div className="relative flex justify-center"><span className="bg-gray-800 px-2 text-sm text-gray-400">OU</span></div>
                    </div>
                    
                    <div>
                        <label htmlFor="search-player" className={labelClasses}>Search Existing Player</label>
                        <input 
                            type="text" 
                            id="search-player"
                            placeholder="Start typing a nickname..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={inputClasses}
                        />
                        {searchTerm && (
                            <div className="mt-2 bg-gray-900/50 rounded-md max-h-48 overflow-y-auto">
                               {filteredPlayers.length > 0 ? filteredPlayers.map(player => (
                                   <div key={player.id} className="flex items-center justify-between p-2 border-b border-gray-700 last:border-0">
                                       <div className="flex items-center space-x-3">
                                           <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full" />
                                           <span>{player.nickname}</span>
                                       </div>
                                       <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => handleRegister({ playerId: player.id })}>Register</Button>
                                   </div>
                               )) : (
                                   <p className="p-3 text-sm text-gray-400">No matching unregistered players found.</p>
                               )}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-600" /></div>
                        <div className="relative flex justify-center"><span className="bg-gray-800 px-2 text-sm text-gray-400">OU</span></div>
                    </div>


                    <form onSubmit={handleCreateAndRegister}>
                        <label htmlFor="new-player" className={labelClasses}>Create and Register New Player</label>
                        <div className="flex space-x-2">
                            <input 
                                type="text" 
                                id="new-player"
                                placeholder="New player's nickname"
                                value={newPlayerNickname}
                                onChange={e => setNewPlayerNickname(e.target.value)}
                                required
                                className={inputClasses}
                            />
                            <Button type="submit" variant="primary" className="whitespace-nowrap">Create & Register</Button>
                        </div>
                    </form>
                     <div className="mt-6 pt-4 border-t border-gray-600">
                        <div className="flex items-center">
                            <input
                                id="print-ticket-checkbox"
                                type="checkbox"
                                checked={shouldPrintTicket}
                                onChange={(e) => setShouldPrintTicket(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="print-ticket-checkbox" className="ml-3 block text-sm text-gray-200">
                                Imprimer le ticket d'inscription
                            </label>
                        </div>
                    </div>
                </div>
            </Modal>
            {isScannerOpen && <ScannerModal onScanSuccess={handleScanSuccess} onClose={() => setScannerOpen(false)} />}
        </>
    )
}