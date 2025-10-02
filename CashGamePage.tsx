import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, Button, PlusIcon, TrashIcon, Modal, UsersIcon, ArrowsRightLeftIcon, BanknotesIcon } from './components';
import { CashGameTable, CashGameSession, Player } from './types';
import { useTournamentStore } from './store';
import { Link } from 'react-router-dom';

// --- SUB-COMPONENTS ---

const AddPlayerToWaitlistModal = ({ isOpen, onClose, onSelectPlayer, table, players, cashGameSessions }: { isOpen: boolean, onClose: () => void, onSelectPlayer: (playerId: string) => void, table: CashGameTable, players: Player[], cashGameSessions: CashGameSession[] }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const availablePlayers = useMemo(() => {
        const seatedPlayerIds = new Set(cashGameSessions.filter(s => s.endTime === null).map(s => s.playerId));
        const waitingPlayerIds = new Set(table.waitingList);

        return players
            .filter(p => !seatedPlayerIds.has(p.id) && !waitingPlayerIds.has(p.id))
            .filter(p => p.nickname.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [players, cashGameSessions, table.waitingList, searchTerm]);

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Ajouter un joueur à la liste d'attente de {table.name}</CardHeader>
            <input
                type="text"
                placeholder="Rechercher un joueur..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white mb-4"
            />
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {availablePlayers.map(player => (
                    <div key={player.id} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-md">
                        <span>{player.nickname}</span>
                        <Button size="sm" onClick={() => onSelectPlayer(player.id)}>Ajouter</Button>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

const MovePlayerModal = ({ isOpen, onClose, onMove, sessionToMove, tables, sessions }: { isOpen: boolean, onClose: () => void, onMove: (newTableId: string, newSeat: number) => void, sessionToMove: CashGameSession, tables: CashGameTable[], sessions: CashGameSession[] }) => {
    const availableSeatsByTable = useMemo(() => {
        const occupiedSeats = new Set(sessions.filter(s => s.endTime === null).map(s => `${s.tableId}:${s.seat}`));
        const result: { [tableId: string]: number[] } = {};

        tables.forEach(table => {
            result[table.id] = [];
            for (let i = 1; i <= table.seats; i++) {
                if (!occupiedSeats.has(`${table.id}:${i}`)) {
                    result[table.id].push(i);
                }
            }
        });
        return result;
    }, [tables, sessions]);

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Déplacer le Joueur</CardHeader>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {tables.filter(t => t.id !== sessionToMove.tableId).map(table => (
                    <div key={table.id}>
                        <h3 className="font-semibold text-white">{table.name} ({table.blinds})</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {availableSeatsByTable[table.id].length > 0 ? (
                                availableSeatsByTable[table.id].map(seat => (
                                    <Button key={seat} variant="secondary" onClick={() => onMove(table.id, seat)}>
                                        Siège {seat}
                                    </Button>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">Aucun siège libre.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

const SeatSelectorModal = ({ isOpen, onClose, table, sessions, onSelectSeat }: { isOpen: boolean, onClose: () => void, table: CashGameTable, sessions: CashGameSession[], onSelectSeat: (seat: number) => void }) => {
    const occupiedSeats = useMemo(() => {
        return new Set(
            sessions
                .filter(s => s.tableId === table.id && s.endTime === null)
                .map(s => s.seat)
        );
    }, [sessions, table.id]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
            <CardHeader>Sélectionner un siège sur {table.name}</CardHeader>
            <div className="grid grid-cols-5 gap-4 p-4">
                {Array.from({ length: table.seats }, (_, i) => i + 1).map(seatNum => {
                    const isOccupied = occupiedSeats.has(seatNum);
                    return (
                        <Button
                            key={seatNum}
                            onClick={() => onSelectSeat(seatNum)}
                            disabled={isOccupied}
                            className="aspect-square text-2xl"
                        >
                            {seatNum}
                        </Button>
                    );
                })}
            </div>
             <div className="flex justify-end mt-4">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
            </div>
        </Modal>
    );
};


// --- MAIN PAGE COMPONENT ---

export const CashGamePage = () => {
    const { state, dispatch } = useTournamentStore();
    const { cashGameTables, cashGameSessions, players } = state;
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [isCreateTableModalOpen, setCreateTableModalOpen] = useState(false);
    const [isAddPlayerModalOpen, setAddPlayerModalOpen] = useState(false);
    const [isMovePlayerModalOpen, setMovePlayerModalOpen] = useState(false);
    const [isSeatSelectorModalOpen, setSeatSelectorModalOpen] = useState(false);
    const [actionTarget, setActionTarget] = useState<{ type: 'seat_from_waitlist' | 'move_seat'; payload: string | CashGameSession } | null>(null);
    const [sessionToMove, setSessionToMove] = useState<CashGameSession | null>(null);
    const [newTableData, setNewTableData] = useState({ name: '', variant: 'Texas' as 'Texas' | 'Omaha', blinds: '', seats: 9 });
    const [time, setTime] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    // Auto-select the first table if none is selected
    useEffect(() => {
        if (!selectedTableId && cashGameTables.length > 0) {
            setSelectedTableId(cashGameTables[0].id);
        }
         if (selectedTableId && !cashGameTables.some(t => t.id === selectedTableId)) {
            setSelectedTableId(cashGameTables.length > 0 ? cashGameTables[0].id : null);
        }
    }, [cashGameTables, selectedTableId]);

    const selectedTable = useMemo(() => cashGameTables.find(t => t.id === selectedTableId), [cashGameTables, selectedTableId]);
    
    const seatedPlayers = useMemo(() => {
        if (!selectedTableId) return [];
        return cashGameSessions
            .filter(s => s.tableId === selectedTableId && s.endTime === null)
            .sort((a,b) => a.seat - b.seat);
    }, [cashGameSessions, selectedTableId]);

    const handleCreateTable = (e: React.FormEvent) => {
        e.preventDefault();
        dispatch({ type: 'ADD_CASH_TABLE', payload: newTableData });
        setCreateTableModalOpen(false);
        setNewTableData({ name: '', variant: 'Texas', blinds: '', seats: 9 });
    };

    const handleDeleteTable = (tableId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette table ? Toutes les sessions actives seront terminées.")) {
            dispatch({ type: 'DELETE_CASH_TABLE', payload: { tableId } });
        }
    };
    
    const handleAddToWaitlist = (playerId: string) => {
        if(selectedTableId) {
            dispatch({ type: 'ADD_TO_WAITING_LIST', payload: { tableId: selectedTableId, playerId } });
        }
        setAddPlayerModalOpen(false);
    };

    const handleSelectSeat = (seat: number) => {
        if (!actionTarget || !selectedTable) return;

        if (actionTarget.type === 'seat_from_waitlist') {
            const playerId = actionTarget.payload as string;
            dispatch({ type: 'SEAT_PLAYER', payload: { tableId: selectedTable.id, playerId, seat } });
        } else if (actionTarget.type === 'move_seat') {
            const session = actionTarget.payload as CashGameSession;
            dispatch({ type: 'MOVE_SESSION_PLAYER', payload: { sessionId: session.id, newTableId: session.tableId, newSeat: seat } });
        }
        
        setSeatSelectorModalOpen(false);
        setActionTarget(null);
    };

    const handleCheckOut = (sessionId: string) => dispatch({ type: 'CHECK_OUT_PLAYER', payload: { sessionId } });
    const handleTogglePause = (sessionId: string) => dispatch({ type: 'TOGGLE_SESSION_PAUSE', payload: { sessionId } });
    
    const handleStartMove = (session: CashGameSession) => {
        setSessionToMove(session);
        setMovePlayerModalOpen(true);
    };
    
    const handleConfirmMove = (newTableId: string, newSeat: number) => {
        if (sessionToMove) {
            dispatch({ type: 'MOVE_SESSION_PLAYER', payload: { sessionId: sessionToMove.id, newTableId, newSeat }});
        }
        setMovePlayerModalOpen(false);
        setSessionToMove(null);
    };

    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const calculateSessionTime = (session: CashGameSession) => {
        const startTime = new Date(session.startTime).getTime();
        const endTime = time;
        let pauseDuration = 0;
        session.pauses.forEach(p => {
            const pStart = new Date(p.start).getTime();
            const pEnd = p.end ? new Date(p.end).getTime() : endTime;
            pauseDuration += (pEnd - pStart);
        });
        return formatDuration(endTime - startTime - pauseDuration);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-6">
                <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; Retour à l'accueil</Link>
                <div className="flex justify-between items-center">
                    <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                        <BanknotesIcon className="w-10 h-10"/>
                        Gestion Cash Game
                    </h1>
                </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Tables List */}
                <div className="lg:col-span-1 space-y-4">
                     <Button variant="primary" className="w-full flex items-center justify-center gap-2" onClick={() => setCreateTableModalOpen(true)}>
                        <PlusIcon className="w-5 h-5" /> Créer une table
                    </Button>
                    <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-2">
                        {cashGameTables.map(table => {
                             const playersOnTable = cashGameSessions.filter(s => s.tableId === table.id && s.endTime === null).length;
                             return (
                                <Card key={table.id} onClick={() => setSelectedTableId(table.id)} className={`cursor-pointer transition-all ${selectedTableId === table.id ? 'border-blue-500 ring-2 ring-blue-500' : 'hover:border-blue-500'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg text-white">{table.name}</h3>
                                            <p className="text-sm text-gray-400">{table.variant} - {table.blinds}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                             <span className="text-sm font-semibold bg-gray-700 px-2 py-1 rounded-md">{playersOnTable} / {table.seats}</span>
                                             <Button size="sm" variant="danger" className="p-1" onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }}><TrashIcon className="w-4 h-4" /></Button>
                                        </div>
                                    </div>
                                </Card>
                             );
                        })}
                    </div>
                </div>

                {/* Right Column: Table Details */}
                <div className="lg:col-span-2">
                    {selectedTable ? (
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>Joueurs à la table : {selectedTable.name}</CardHeader>
                                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                    {seatedPlayers.map(session => {
                                        const player = playerMap.get(session.playerId);
                                        if (!player) return null;
                                        const isPaused = session.pauses.length > 0 && session.pauses[session.pauses.length - 1].end === null;
                                        return (
                                            <div key={session.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-xs bg-gray-900/50 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0">{session.seat}</span>
                                                    <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full" />
                                                    <div>
                                                        <p className="font-semibold text-sm">{player.nickname}</p>
                                                        <p className={`text-xs font-mono ${isPaused ? 'text-yellow-400' : 'text-gray-400'}`}>{calculateSessionTime(session)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="secondary" onClick={() => handleTogglePause(session.id)}>{isPaused ? 'Reprendre' : 'Pause'}</Button>
                                                    <Button size="sm" variant="secondary" onClick={() => { setActionTarget({ type: 'move_seat', payload: session }); setSeatSelectorModalOpen(true); }} title="Changer de siège">Siège</Button>
                                                    <Button size="sm" variant="secondary" onClick={() => handleStartMove(session)} title="Changer de table">Table</Button>
                                                    <Button size="sm" variant="danger" onClick={() => handleCheckOut(session.id)}>Check-out</Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {seatedPlayers.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucun joueur assis.</p>}
                                </div>
                            </Card>
                             <Card>
                                <div className="flex justify-between items-center">
                                    <CardHeader className="mb-0">Liste d'attente ({selectedTable.waitingList.length})</CardHeader>
                                    <Button onClick={() => setAddPlayerModalOpen(true)}>Ajouter un joueur</Button>
                                </div>
                                <div className="space-y-2 mt-4 max-h-60 overflow-y-auto pr-2">
                                    {selectedTable.waitingList.map((playerId, index) => {
                                         const player = playerMap.get(playerId);
                                         if (!player) return null;
                                         return (
                                             <div key={playerId} className="flex justify-between items-center bg-gray-700/50 p-2 rounded-md">
                                                <div className="flex items-center gap-3">
                                                     <span className="font-bold text-gray-400 w-6 text-center">{index + 1}</span>
                                                     <img src={player.avatarUrl} alt={player.nickname} className="w-8 h-8 rounded-full" />
                                                     <p className="font-semibold text-sm">{player.nickname}</p>
                                                </div>
                                                <Button size="sm" variant="primary" onClick={() => { setActionTarget({ type: 'seat_from_waitlist', payload: playerId }); setSeatSelectorModalOpen(true); }} disabled={seatedPlayers.length >= selectedTable.seats}>Placer</Button>
                                             </div>
                                         )
                                    })}
                                    {selectedTable.waitingList.length === 0 && <p className="text-sm text-gray-500 text-center py-4">La liste d'attente est vide.</p>}
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <Card>
                            <div className="text-center py-12 text-gray-500">
                                <UsersIcon className="w-16 h-16 mx-auto mb-4" />
                                <p className="text-lg">{cashGameTables.length > 0 ? "Sélectionnez une table pour voir les détails." : "Créez votre première table pour commencer."}</p>
                            </div>
                        </Card>
                    )}
                </div>

                {/* Modals */}
                <Modal isOpen={isCreateTableModalOpen} onClose={() => setCreateTableModalOpen(false)}>
                    <CardHeader>Créer une nouvelle table de Cash Game</CardHeader>
                    <form onSubmit={handleCreateTable} className="space-y-4">
                        <input type="text" placeholder="Nom de la table (ex: Table 1)" value={newTableData.name} onChange={e => setNewTableData({...newTableData, name: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" required />
                        <select value={newTableData.variant} onChange={e => setNewTableData({...newTableData, variant: e.target.value as any})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white">
                            <option value="Texas">Texas Hold'em</option>
                            <option value="Omaha">Pot-Limit Omaha</option>
                        </select>
                        <input type="text" placeholder="Blinds (ex: 5/10)" value={newTableData.blinds} onChange={e => setNewTableData({...newTableData, blinds: e.target.value})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" required />
                        <input type="number" placeholder="Nombre de sièges" value={newTableData.seats} min="2" max="10" onChange={e => setNewTableData({...newTableData, seats: parseInt(e.target.value)})} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" required />
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="secondary" type="button" onClick={() => setCreateTableModalOpen(false)}>Annuler</Button>
                            <Button variant="primary" type="submit">Créer</Button>
                        </div>
                    </form>
                </Modal>
                
                {selectedTable && <AddPlayerToWaitlistModal isOpen={isAddPlayerModalOpen} onClose={() => setAddPlayerModalOpen(false)} onSelectPlayer={handleAddToWaitlist} table={selectedTable} players={players} cashGameSessions={cashGameSessions} />}
                {sessionToMove && <MovePlayerModal isOpen={isMovePlayerModalOpen} onClose={() => { setMovePlayerModalOpen(false); setSessionToMove(null); }} onMove={handleConfirmMove} sessionToMove={sessionToMove} tables={cashGameTables} sessions={cashGameSessions} />}
                {isSeatSelectorModalOpen && selectedTable && <SeatSelectorModal isOpen={isSeatSelectorModalOpen} onClose={() => setSeatSelectorModalOpen(false)} table={selectedTable} sessions={cashGameSessions} onSelectSeat={handleSelectSeat} />}
            </div>
        </div>
    );
};

export default CashGamePage;