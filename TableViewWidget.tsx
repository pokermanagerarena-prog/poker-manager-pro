import React, { useState, useMemo, DragEvent, useEffect } from 'react';
import { useTournamentStore } from './store';
import { Card, CardHeader, Button, LockClosedIcon, LockOpenIcon, DotsVerticalIcon, PlusIcon, Modal, PencilIcon, TrashIcon, ArrowsRightLeftIcon, PrinterIcon, UserGroupIcon, BanknotesIcon, IdentificationIcon, CloseIcon } from './components';
import { Entry, EntryStatus, Player, Tournament, TournamentStatus, PokerTable, TournamentType, TournamentPhase, EliminationDetails, LiveCoveragePost, Dealer, MoveSlip, PokerCard, DeckCard, FULL_DECK, SUITS, RANKS } from './types';
import { generateEliminationPost } from './aiAgent';


// --- CARD SELECTOR SUB-COMPONENTS ---

const CardDisplay = React.memo(({ card, onClear }: { card: DeckCard | null, onClear: () => void }) => {
    if (!card) return null;
    return (
        <div className={`relative w-12 h-16 rounded-md flex items-center justify-center font-bold text-lg border-2 border-gray-500 ${card.color} bg-gray-800`}>
            {card.rank}{card.symbol}
            <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="absolute -top-2 -right-2 bg-red-600 rounded-full text-white p-0.5 hover:bg-red-500"
                aria-label="Clear card"
            >
                <CloseIcon className="w-3 h-3"/>
            </button>
        </div>
    );
});

const CardSlot = React.memo(({ card, isActive, onClick, onClear }: { card: DeckCard | null, isActive: boolean, onClick: () => void, onClear: () => void }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-12 h-16 rounded-md flex items-center justify-center transition-all duration-200 ${isActive ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-600'} ${card ? '' : 'border-2 border-dashed'}`}
        >
            {card ? <CardDisplay card={card} onClear={onClear} /> : <span className="text-gray-500 text-2xl">+</span>}
        </button>
    );
});

const CardSelector = React.memo(({ usedCards, onCardSelect }: { usedCards: Set<string>, onCardSelect: (card: DeckCard) => void }) => {
    return (
        <div className="bg-gray-900/50 p-2 rounded-lg">
            {SUITS.map(suit => (
                <div key={suit.name} className="flex justify-start gap-1 mb-1 last:mb-0">
                    {RANKS.map(rank => {
                        const cardKey = `${rank}${suit.name}`;
                        const card = FULL_DECK.find(c => c.rank === rank && c.suit === suit.name)!;
                        const isUsed = usedCards.has(cardKey);
                        return (
                            <button
                                key={cardKey}
                                type="button"
                                onClick={() => onCardSelect(card)}
                                disabled={isUsed}
                                className={`w-10 h-14 flex-shrink-0 rounded border border-gray-600 font-bold text-lg text-center transition-colors ${card.color} ${isUsed ? 'bg-gray-700 opacity-30 cursor-not-allowed' : 'bg-gray-800 hover:bg-blue-600 hover:border-blue-400'}`}
                            >
                                {card.rank}{card.symbol}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
});


export const EliminationModal = ({ isOpen, onClose, tournament, players, entriesToEliminate }: { isOpen: boolean, onClose: () => void, tournament: Tournament, players: Player[], entriesToEliminate: (Entry & { player: Player })[] }) => {
    const { dispatch } = useTournamentStore();
    const [isLoading, setIsLoading] = useState(false);
    const [street, setStreet] = useState<EliminationDetails['street']>();

    const isMultiElimination = entriesToEliminate.length > 1;

    // State for the new card selector
    interface SelectedCards {
        eliminator: (DeckCard | null)[];
        eliminated: (DeckCard | null)[];
        board: (DeckCard | null)[];
    }
    const [selectedCards, setSelectedCards] = useState<SelectedCards>({
        eliminator: [null, null],
        eliminated: [null, null],
        board: [null, null, null, null, null],
    });
    const [activeSlot, setActiveSlot] = useState<{ zone: keyof SelectedCards, index: number } | null>(null);
    
    useEffect(() => {
        if (isOpen) {
            // Reset all state when modal opens
            setIsLoading(false);
            setStreet(undefined);
            setSelectedCards({ eliminator: [null, null], eliminated: [null, null], board: [null, null, null, null, null] });
            setActiveSlot(null);
        }
    }, [isOpen]);

    const usedCards = useMemo(() => {
        const used = new Set<string>();
        Object.values(selectedCards).flat().forEach(card => {
            if (card) {
                used.add(`${card.rank}${card.suit}`);
            }
        });
        return used;
    }, [selectedCards]);

    const handleSlotClick = (zone: keyof SelectedCards, index: number) => {
        setActiveSlot({ zone, index });
    };

    const handleCardSelect = (card: DeckCard) => {
        if (activeSlot) {
            const { zone, index } = activeSlot;
            setSelectedCards(prev => {
                const newZone = [...prev[zone]];
                newZone[index] = card;
                return { ...prev, [zone]: newZone };
            });
            setActiveSlot(null); // Deselect slot after picking a card
        }
    };
    
    const handleClearCard = (zone: keyof SelectedCards, index: number) => {
        setSelectedCards(prev => {
            const newZone = [...prev[zone]];
            newZone[index] = null;
            return { ...prev, [zone]: newZone };
        });
    };

    const possibleEliminators = useMemo(() => {
        if (!isOpen || entriesToEliminate.length === 0) return [];
        const firstEliminated = entriesToEliminate[0];
        const tableId = firstEliminated.table;
        if (tableId === null) return [];

        const eliminatedIds = new Set(entriesToEliminate.map(e => e.playerId));

        return tournament.entries
            .filter(e => e.status === EntryStatus.ACTIVE && e.table === tableId && !eliminatedIds.has(e.playerId))
            .map(e => players.find(p => p.id === e.playerId))
            .filter((p): p is Player => !!p);
    }, [isOpen, entriesToEliminate, tournament.entries, players]);
    
    const [eliminatorId, setEliminatorId] = useState<string | undefined>();
    useEffect(() => { setEliminatorId(undefined); }, [isOpen]);

    const handleEliminate = async () => {
        if (entriesToEliminate.length === 0) return;
        setIsLoading(true);

        const cardsToString = (cards: (PokerCard | null)[]) => {
            return cards
                .filter((c): c is PokerCard => c !== null)
                .map(c => `${c.rank}${c.suit}`)
                .join(' ');
        };

        const details: EliminationDetails = {
            eliminatorId,
            street,
            eliminatorCards: cardsToString(selectedCards.eliminator),
            eliminatedPlayerCards: cardsToString(selectedCards.eliminated),
            boardCards: cardsToString(selectedCards.board),
        };

        let liveCoveragePost: Omit<LiveCoveragePost, 'id' | 'timestamp' | 'level'> | undefined = undefined;
        const hasDetails = details.eliminatorId || details.eliminatorCards || details.eliminatedPlayerCards || details.boardCards || details.street;

        if (hasDetails) {
            const generatedPost = await generateEliminationPost(tournament, players, entriesToEliminate, details);
            if(generatedPost) {
                liveCoveragePost = {
                    content: generatedPost.content,
                    imageUrl: generatedPost.imageUrl,
                    author: 'ai'
                };
            }
        } else {
            const eliminatedNames = entriesToEliminate.map(e => e.player.nickname).join(', ');
            const content = entriesToEliminate.length > 1
                ? `Les joueurs ${eliminatedNames} ont été éliminés du tournoi.`
                : `${eliminatedNames} a été éliminé(e) du tournoi.`;

            liveCoveragePost = { content, imageUrl: null, author: 'director' };
        }

        if (tournament.rebuysAllowed && !tournament.lateRegistrationClosed) {
            entriesToEliminate.forEach((entry, index) => {
                const postForThisAction = (index === entriesToEliminate.length - 1) ? liveCoveragePost : undefined;
                dispatch({ type: 'SET_RE_ENTRY_PENDING', payload: { tournamentId: tournament.id, entryId: entry.id, liveCoveragePost: postForThisAction } });
            });
        } else {
            entriesToEliminate.forEach((entry, index) => {
                 const postForThisAction = (index === entriesToEliminate.length - 1) ? liveCoveragePost : undefined;
                 dispatch({ type: 'ELIMINATE_PLAYER', payload: { tournamentId: tournament.id, entryId: entry.id, liveCoveragePost: postForThisAction } });
            });
        }
        
        setIsLoading(false);
        setTimeout(() => { onClose(); }, 100);
    };
    
    const labelClasses = "block text-sm font-semibold text-gray-300 mb-2 text-center";
    const eliminatedNames = entriesToEliminate.map(e => e.player.nickname).join(', ');
    const buttonText = (tournament.rebuysAllowed && !tournament.lateRegistrationClosed) ? 'Confirmer le Bust-out' : 'Confirmer l\'élimination';
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
            <CardHeader>Élimination de {eliminatedNames}</CardHeader>
            <p className="text-gray-400 text-sm mb-6">Saisissez les détails de la main pour enrichir le live coverage (optionnel).</p>
            
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4">
                {/* Eliminator Select */}
                <div>
                    <label htmlFor="eliminator" className="block text-sm font-medium text-gray-300 mb-1">Éliminé par</label>
                    <select id="eliminator" value={eliminatorId || ''} onChange={e => setEliminatorId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- Sélectionner un joueur --</option>
                        {possibleEliminators.map(p => <option key={p.id} value={p.id}>{p.nickname}</option>)}
                    </select>
                </div>
                {/* Street Buttons */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">À quel moment de l'action (All-in)</label>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-1">
                        <Button type="button" variant={street === 'pre-flop' ? 'primary' : 'secondary'} onClick={() => setStreet('pre-flop')}>Pré-flop</Button>
                        <Button type="button" variant={street === 'flop' ? 'primary' : 'secondary'} onClick={() => setStreet('flop')}>Flop</Button>
                        <Button type="button" variant={street === 'turn' ? 'primary' : 'secondary'} onClick={() => setStreet('turn')}>Turn</Button>
                        <Button type="button" variant={street === 'river' ? 'primary' : 'secondary'} onClick={() => setStreet('river')}>River</Button>
                    </div>
                </div>
                
                {/* Player Hands side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-700/50">
                    <div>
                        <label className={labelClasses}>Main du Vainqueur</label>
                        <div className="flex justify-center gap-2 mt-2">
                            {selectedCards.eliminator.map((card, i) => <CardSlot key={i} card={card} isActive={activeSlot?.zone === 'eliminator' && activeSlot.index === i} onClick={() => handleSlotClick('eliminator', i)} onClear={() => handleClearCard('eliminator', i)} />)}
                        </div>
                    </div>
                    {!isMultiElimination && (
                        <div>
                            <label className={labelClasses}>Main de {eliminatedNames}</label>
                            <div className="flex justify-center gap-2 mt-2">
                                {selectedCards.eliminated.map((card, i) => <CardSlot key={i} card={card} isActive={activeSlot?.zone === 'eliminated' && activeSlot.index === i} onClick={() => handleSlotClick('eliminated', i)} onClear={() => handleClearCard('eliminated', i)} />)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Board */}
                <div className="pt-4 border-t border-gray-700/50">
                    <label className={labelClasses}>Board</label>
                    <div className="flex justify-center gap-2 flex-wrap mt-2">
                        {selectedCards.board.map((card, i) => <CardSlot key={i} card={card} isActive={activeSlot?.zone === 'board' && activeSlot.index === i} onClick={() => handleSlotClick('board', i)} onClear={() => handleClearCard('board', i)} />)}
                    </div>
                </div>
                
                {/* Card Selector */}
                <div className="pt-4 border-t border-gray-700/50">
                     <CardSelector usedCards={usedCards} onCardSelect={handleCardSelect} />
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onClose} disabled={isLoading}>Annuler</Button>
                <Button variant="danger" onClick={handleEliminate} disabled={isLoading}>
                    {isLoading ? 'Génération en cours...' : buttonText}
                </Button>
            </div>
        </Modal>
    );
};

const TableDetailModal = ({ table, tournament, players, dealers, onClose, onInitiateElimination, onInitiateMove }: { table: PokerTable, tournament: Tournament, players: Player[], dealers: Dealer[], onClose: () => void, onInitiateElimination: (entries: (Entry & { player: Player })[]) => void, onInitiateMove: (sourceEntryId: string) => void }) => {
    const { dispatch } = useTournamentStore();
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

    const tableEntries = useMemo(() => 
        tournament.entries
            .filter(e => e.table === table.id && e.status === EntryStatus.ACTIVE)
            .map(e => ({...e, player: players.find(p => p.id === e.playerId)}))
            .filter((e): e is Entry & { player: Player } => !!e.player)
            .sort((a,b) => (a.seat || 0) - (b.seat || 0)), 
        [tournament.entries, players, table.id]
    );

    const isSeatBlocked = (seat: number) => tournament.blockedSeats.some(s => s.table === table.id && s.seat === seat);

    const handleSeatToggle = (seat: number) => {
        const actionType = isSeatBlocked(seat) ? 'UNBLOCK_SEAT' : 'BLOCK_SEAT';
        dispatch({ type: actionType, payload: { tournamentId: tournament.id, table: table.id, seat } });
    };

    const handlePlayerSelectToggle = (entryId: string) => {
        setSelectedPlayerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(entryId)) newSet.delete(entryId);
            else newSet.add(entryId);
            return newSet;
        });
    };

    const handleMultiElimination = () => {
        const entriesToEliminate = tableEntries.filter(e => selectedPlayerIds.has(e.id));
        if (entriesToEliminate.length > 0) {
            onInitiateElimination(entriesToEliminate);
            setSelectedPlayerIds(new Set()); // Clear selection
        }
    };
    
    const assignedDealer = dealers.find(d => d.id === table.dealerId);

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="flex justify-between items-start">
                <CardHeader>Détails de {table.name}</CardHeader>
            </div>
            {assignedDealer && (
                <div className="flex items-center gap-2 mb-4 p-2 bg-gray-900/50 rounded-md">
                    <img src={assignedDealer.avatarUrl} alt={assignedDealer.nickname} className="w-8 h-8 rounded-full" />
                    <div>
                        <p className="text-xs text-gray-400">Croupier en poste</p>
                        <p className="font-semibold text-white">{assignedDealer.nickname}</p>
                    </div>
                </div>
            )}
            <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-2">
                {Array.from({ length: table.seats }, (_, i) => i + 1).map(seatNum => {
                    const entry = tableEntries.find(e => e.seat === seatNum);
                    const blocked = isSeatBlocked(seatNum);
                    const isSelected = entry ? selectedPlayerIds.has(entry.id) : false;

                    return (
                        <div key={seatNum} className={`flex items-center justify-between p-2 rounded-md ${isSelected ? 'bg-blue-500/20' : ''} ${blocked && !entry ? 'bg-gray-700/50' : ''}`}>
                            <div className="flex items-center gap-4">
                                {entry && (
                                    <input type="checkbox" checked={isSelected} onChange={() => handlePlayerSelectToggle(entry.id)} className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-blue-600 focus:ring-blue-500" />
                                )}
                                <div className="font-bold text-lg w-8 text-center">{seatNum}</div>
                                {entry?.player ? (
                                    <div className="flex items-center gap-3">
                                        <img src={entry.player.avatarUrl} alt={entry.player.nickname} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-white">{entry.player.nickname}</p>
                                            <p className="text-sm text-gray-400">{entry.chipCount.toLocaleString()} jetons</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic">Siège vide</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {entry ? (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={() => onInitiateMove(entry.id)} title="Déplacer le joueur"><ArrowsRightLeftIcon className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="danger" onClick={() => onInitiateElimination([entry])}>Éliminer</Button>
                                    </>
                                ) : (
                                    <Button size="sm" variant="secondary" onClick={() => handleSeatToggle(seatNum)} title={blocked ? "Débloquer ce siège" : "Bloquer ce siège"}>
                                        {blocked ? <LockClosedIcon className="w-5 h-5"/> : <LockOpenIcon className="w-5 h-5" />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end gap-2">
                 <Button variant="secondary" onClick={handleMultiElimination} disabled={selectedPlayerIds.size === 0} className="flex items-center gap-2">
                    <UserGroupIcon className="w-5 h-5"/> Gérer Élimination Multiple ({selectedPlayerIds.size})
                </Button>
                <Button onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    );
};

const AssignDealerModal = ({ isOpen, onClose, tournament, table, dealers }: { isOpen: boolean, onClose: () => void, tournament: Tournament, table: PokerTable, dealers: Dealer[] }) => {
    const { dispatch } = useTournamentStore();

    const dealersOnShift = useMemo(() => {
        const onShiftIds = new Set(tournament.dealerShifts.filter(ds => ds.shiftEndTime === null).map(ds => ds.dealerId));
        return dealers.filter(d => onShiftIds.has(d.id));
    }, [tournament.dealerShifts, dealers]);

    const assignedTableMap = useMemo(() => {
        const map = new Map<string, string>(); // dealerId -> tableName
        tournament.tables.forEach(t => {
            if (t.dealerId) {
                map.set(t.dealerId, t.name);
            }
        });
        return map;
    }, [tournament.tables]);

    const handleAssign = (dealerId: string | null) => {
        dispatch({
            type: 'ASSIGN_DEALER_TO_TABLE',
            payload: {
                tournamentId: tournament.id,
                tableId: table.id,
                dealerId: dealerId,
            }
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Assigner un Croupier à {table.name}</CardHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {dealersOnShift.map(dealer => {
                    const assignedTo = assignedTableMap.get(dealer.id);
                    const isAssignedToCurrentTable = assignedTo === table.name;
                    const isAssignedElsewhere = assignedTo && !isAssignedToCurrentTable;

                    return (
                        <div key={dealer.id} className={`flex items-center justify-between p-2 rounded-md ${isAssignedToCurrentTable ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
                            <div className="flex items-center space-x-3">
                                <img src={dealer.avatarUrl} alt={dealer.nickname} className="w-10 h-10 rounded-full" />
                                <div>
                                    <p className="font-semibold text-white">{dealer.nickname}</p>
                                    {isAssignedElsewhere && <p className="text-xs text-yellow-400">Assigné à {assignedTo}</p>}
                                </div>
                            </div>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleAssign(dealer.id)}
                                disabled={isAssignedToCurrentTable}
                            >
                                {isAssignedToCurrentTable ? 'Assigné' : 'Assigner'}
                            </Button>
                        </div>
                    );
                })}
                 {dealersOnShift.length === 0 && (
                    <p className="text-gray-400 text-center py-4">Aucun croupier n'est en service. Allez à l'onglet "Croupiers" pour commencer un service.</p>
                )}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-700 flex justify-between">
                <Button variant="danger" onClick={() => handleAssign(null)}>
                    Retirer le croupier
                </Button>
                <Button variant="secondary" onClick={onClose}>
                    Annuler
                </Button>
            </div>
        </Modal>
    );
};

const BreakTableModal = ({ isOpen, onClose, tournament, players, tableToBreak }: { isOpen: boolean, onClose: () => void, tournament: Tournament, players: Player[], tableToBreak: PokerTable | null }) => {
    const { dispatch } = useTournamentStore();

    const assignments = useMemo(() => {
        if (!tableToBreak) return [];

        // 1. Get players to move
        const playersToMove = tournament.entries.filter(e => e.table === tableToBreak.id && e.status === EntryStatus.ACTIVE);
        if (playersToMove.length === 0) return [];

        // 2. Get other tables
        const otherTables = tournament.tables.filter(t => t.id !== tableToBreak.id);

        // 3. Calculate player counts for each table to find the least populated ones.
        const tablePlayerCounts = otherTables.map(table => ({
            id: table.id,
            players: tournament.entries.filter(e => e.status === EntryStatus.ACTIVE && e.table === table.id).length,
        }));

        // 4. Sort tables by player count (ascending) to prioritize balancing.
        const sortedTablesByPlayerCount = tablePlayerCounts.sort((a, b) => a.players - b.players);

        // 5. Collect available seats, prioritizing emptier tables, until we have enough.
        const availableSeatsForBalancing: { table: number; seat: number }[] = [];
        for (const table of sortedTablesByPlayerCount) {
            if (availableSeatsForBalancing.length >= playersToMove.length) break;

            const tableData = tournament.tables.find(t => t.id === table.id)!;
            const occupiedSeats = new Set(tournament.entries.filter(e => e.table === tableData.id && e.status === EntryStatus.ACTIVE).map(e => e.seat));
            const blockedSeatNumbers = new Set(tournament.blockedSeats.filter(s => s.table === tableData.id).map(s => s.seat));

            const allSeatNumbers = Array.from({ length: tableData.seats }, (_, i) => i + 1);
            let availableSeatsOnTable = allSeatNumbers.filter(seat => !occupiedSeats.has(seat) && !blockedSeatNumbers.has(seat));

            for (const seat of availableSeatsOnTable) {
                if (availableSeatsForBalancing.length < playersToMove.length) {
                    availableSeatsForBalancing.push({ table: table.id, seat });
                } else {
                    break;
                }
            }
        }

        // 6. Shuffle the collected (balanced) seats for random assignment.
        for (let i = availableSeatsForBalancing.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [availableSeatsForBalancing[i], availableSeatsForBalancing[j]] = [availableSeatsForBalancing[j], availableSeatsForBalancing[i]];
        }
        
        // 7. Assign players to the shuffled (balanced) seats.
        return playersToMove.map((entry, index) => ({
            entryId: entry.id,
            newTable: availableSeatsForBalancing[index].table,
            newSeat: availableSeatsForBalancing[index].seat
        }));

    }, [tableToBreak, tournament, players]);

    const handleConfirm = (shouldPrintSlips: boolean) => {
        if (!tableToBreak) return;
        dispatch({
            type: 'BREAK_TABLE',
            payload: { tournamentId: tournament.id, tableId: tableToBreak.id, assignments, shouldPrintSlips }
        });
        onClose();
    };

    if (!tableToBreak) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Assistant de cassage de table: {tableToBreak.name}</CardHeader>
            <p className="text-gray-400 mb-4">
                L'application a calculé la répartition optimale pour équilibrer les tables. Veuillez vérifier les déplacements proposés ci-dessous.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 bg-gray-900/50 p-3 rounded-md">
                {assignments.map(a => {
                    const entry = tournament.entries.find(e => e.id === a.entryId)!;
                    const player = players.find(p => p.id === entry.playerId)!;
                    return (
                        <div key={a.entryId} className="flex items-center justify-between text-sm">
                             <span className="font-semibold text-white">{player.nickname}</span>
                             <span className="text-gray-400">T{entry.table}/S{entry.seat} &rarr; <strong className="text-blue-400">T{a.newTable}/S{a.newSeat}</strong></span>
                        </div>
                    );
                })}
            </div>
             <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="secondary" onClick={() => handleConfirm(true)} className="flex items-center gap-2"><PrinterIcon className="w-5 h-5"/> Imprimer & Confirmer</Button>
                <Button variant="primary" onClick={() => handleConfirm(false)}>Confirmer</Button>
            </div>
        </Modal>
    );
};


const TableCard = ({ table, tournament, players, dealers, onSelectTable, onAssignDealer, onBreakTable }: { table: PokerTable, tournament: Tournament, players: Player[], dealers: Dealer[], onSelectTable: (table: PokerTable) => void, onAssignDealer: (table: PokerTable) => void, onBreakTable: (table: PokerTable) => void }) => {
    const entriesOnTable = useMemo(() => 
        tournament.entries
            .filter(e => e.table === table.id && e.status === EntryStatus.ACTIVE)
            .map(e => ({...e, player: players.find(p => p.id === e.playerId)}))
            .filter((e): e is Entry & { player: Player } => !!e.player)
            .sort((a,b) => (a.seat || 0) - (b.seat || 0)),
        [tournament.entries, players, table.id]
    );
    const dealer = dealers.find(d => d.id === table.dealerId);

    const canBreakTable = useMemo(() => {
        const playersOnThisTable = entriesOnTable.length;
        if (playersOnThisTable === 0) return false;

        const otherTables = tournament.tables.filter(t => t.id !== table.id);
        const totalSeatsOnOtherTables = otherTables.reduce((sum, t) => sum + t.seats, 0);
        const playersOnOtherTables = tournament.entries.filter(e => e.table !== table.id && e.status === EntryStatus.ACTIVE).length;
        const blockedOnOtherTables = tournament.blockedSeats.filter(s => s.table !== table.id).length;
        const emptySeats = totalSeatsOnOtherTables - playersOnOtherTables - blockedOnOtherTables;
        
        return playersOnThisTable <= emptySeats;
    }, [tournament, table.id, entriesOnTable.length]);

    return (
        <Card className="flex flex-col cursor-pointer hover:border-blue-500 transition-colors h-full" onClick={() => onSelectTable(table)}>
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">{table.name}</h3>
                <span className="text-sm font-semibold bg-gray-700 px-2 py-1 rounded-md">{entriesOnTable.length} / {table.seats}</span>
            </div>
            
            <div 
                className={`flex items-center gap-2 mb-2 p-1.5 rounded-md transition-colors ${dealer ? 'bg-blue-900/50 hover:bg-blue-800/50 cursor-pointer' : 'bg-gray-700/50 hover:bg-gray-700 cursor-pointer'}`}
                onClick={(e) => { e.stopPropagation(); onAssignDealer(table); }}
                title="Assigner/Changer de croupier"
            >
                <IdentificationIcon className={`w-5 h-5 flex-shrink-0 ${dealer ? 'text-blue-400' : 'text-gray-400'}`} />
                {dealer ? (
                     <span className="text-sm font-semibold text-white truncate">Croupier: {dealer.nickname}</span>
                ) : (
                    <span className="text-sm text-gray-400">Aucun croupier</span>
                )}
            </div>

            <div className="space-y-1 overflow-y-auto pr-2 flex-grow border-t border-gray-700 pt-2" style={{maxHeight: '300px'}}>
                {entriesOnTable.length > 0 ? entriesOnTable.map(entry => (
                    <div key={entry.id} className="flex justify-between items-center text-sm p-1 rounded hover:bg-gray-700/50">
                        <div className="flex items-center gap-2 truncate">
                           <span className="font-mono text-xs bg-gray-900/50 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0">{entry.seat}</span>
                           <span className="font-semibold truncate">{entry.player.nickname}</span>
                        </div>
                        <span className="font-mono text-gray-300 flex-shrink-0">{entry.chipCount.toLocaleString()}</span>
                    </div>
                )) : (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-gray-500 text-center py-4">Table Vide</p>
                    </div>
                )}
            </div>
        </Card>
    );
};

const MoveModeOverlay = ({ tournament, players, movingPlayerId, onCompleteMove, onCancelMove }: { tournament: Tournament, players: Player[], movingPlayerId: string, onCompleteMove: (targetTable: number, targetSeat: number) => void, onCancelMove: () => void }) => {
    const movingPlayerEntry = tournament.entries.find(e => e.id === movingPlayerId);
    const movingPlayer = players.find(p => p.id === movingPlayerEntry?.playerId);

    const tableStats = useMemo(() => {
        const stats = tournament.tables.map(table => ({
            id: table.id,
            playerCount: tournament.entries.filter(e => e.table === table.id && e.status === EntryStatus.ACTIVE).length
        }));
        const minPlayers = Math.min(...stats.map(s => s.playerCount));
        return { stats, minPlayers };
    }, [tournament]);

    const isSeatAvailable = (tableId: number, seatNumber: number): boolean => {
        const isOccupied = tournament.entries.some(e => e.table === tableId && e.seat === seatNumber && e.status === EntryStatus.ACTIVE);
        const isBlocked = tournament.blockedSeats.some(s => s.table === tableId && s.seat === seatNumber);
        return !isOccupied && !isBlocked;
    };

    return (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-95 z-20 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6 p-4 bg-blue-900/50 border border-blue-700 rounded-lg flex-shrink-0">
                <h2 className="text-xl font-bold text-white">
                    Mode Déplacement : <span className="text-blue-400">{movingPlayer?.nickname || 'Joueur'}</span>
                </h2>
                <Button variant="danger" onClick={onCancelMove}>Annuler le Déplacement</Button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {tournament.tables.map(table => {
                    const stats = tableStats.stats.find(s => s.id === table.id);
                    const isRecommended = stats ? stats.playerCount === tableStats.minPlayers : false;
                    
                    return (
                        <div key={table.id} className={`bg-gray-800 p-4 rounded-lg border-2 transition-all ${isRecommended ? 'border-green-500 shadow-lg shadow-green-500/20' : 'border-gray-700'}`}>
                            <h3 className="text-lg font-semibold mb-3">{table.name} ({stats?.playerCount}/{table.seats})</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {Array.from({ length: table.seats }, (_, i) => i + 1).map(seatNum => {
                                    if (isSeatAvailable(table.id, seatNum)) {
                                        return (
                                            <button 
                                                key={seatNum}
                                                onClick={() => onCompleteMove(table.id, seatNum)}
                                                className="aspect-square bg-green-600/20 text-green-300 border border-green-500 rounded-md flex items-center justify-center font-bold hover:bg-green-500 hover:text-white transition-colors text-lg"
                                            >
                                                {seatNum}
                                            </button>
                                        );
                                    } else {
                                        const playerEntry = tournament.entries.find(e => e.table === table.id && e.seat === seatNum && e.status === EntryStatus.ACTIVE);
                                        const playerName = players.find(p => p.id === playerEntry?.playerId)?.nickname;
                                        const isBlocked = tournament.blockedSeats.some(s => s.table === table.id && s.seat === seatNum);

                                        return (
                                            <div key={seatNum} className="aspect-square bg-gray-700/50 border border-gray-600 rounded-md flex items-center justify-center text-gray-500 relative overflow-hidden p-1 text-center" title={isBlocked ? "Siège bloqué" : playerName}>
                                                {isBlocked ? <LockClosedIcon className="w-6 h-6"/> : <span className="text-xs truncate">{playerName?.split(' ')[0]}</span>}
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const TableViewWidget = ({ tournament, displayFlightId }: { tournament: Tournament, displayFlightId: string }) => {
    const { state, dispatch } = useTournamentStore();
    const [selectedTable, setSelectedTable] = useState<PokerTable | null>(null);
    const [editingTable, setEditingTable] = useState<Partial<PokerTable> | null>(null);
    const [sortOrder, setSortOrder] = useState<'number' | 'playerCount' | 'chipLead'>('number');
    const [assigningDealerToTable, setAssigningDealerToTable] = useState<PokerTable | null>(null);
    const [breakingTable, setBreakingTable] = useState<PokerTable | null>(null);
    const [currentAssignments, setCurrentAssignments] = useState<Record<string, string | null>>({});
    
    // Move Mode State
    const [movingPlayerId, setMovingPlayerId] = useState<string | null>(null);
    
    // Elimination Modal State
    const [eliminationModalOpen, setEliminationModalOpen] = useState(false);
    const [entriesToEliminate, setEntriesToEliminate] = useState<(Entry & { player: Player })[]>([]);

    const isMultiFlightMode = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
    
     useEffect(() => {
        const updateAssignments = () => {
            if (!tournament.dealerSchedule) {
                setCurrentAssignments({});
                return;
            }
            const timestamps = Object.keys(tournament.dealerSchedule).sort();
            const now = new Date().getTime();
            let activeSlot = null;
            for (const ts of timestamps) {
                if (new Date(ts).getTime() <= now) {
                    activeSlot = ts;
                } else {
                    break;
                }
            }
            if (activeSlot) {
                setCurrentAssignments(tournament.dealerSchedule[activeSlot]);
            } else {
                setCurrentAssignments({});
            }
        };

        updateAssignments();
        const intervalId = setInterval(updateAssignments, 15000); // Check every 15 seconds

        return () => clearInterval(intervalId);
    }, [tournament.dealerSchedule]);

    const tablesInView = useMemo(() => {
        let tables = [...tournament.tables];

        if (isMultiFlightMode && displayFlightId !== 'all') {
            const tablesWithPlayersInFlight = new Set(
                tournament.entries
                    .filter(e => e.flightId === displayFlightId && e.table !== null)
                    .map(e => e.table!)
            );
            tables = tables.filter(t => tablesWithPlayersInFlight.has(t.id));
        }
        
        const getPlayerCount = (tableId: number) => tournament.entries.filter(e => e.table === tableId && e.status === EntryStatus.ACTIVE).length;
        const getChipLead = (tableId: number) => {
            const chips = tournament.entries
                .filter(e => e.table === tableId && e.status === EntryStatus.ACTIVE)
                .map(e => e.chipCount);
            return chips.length > 0 ? Math.max(...chips) : 0;
        };

        const sortedTables = tables.sort((a, b) => {
            switch (sortOrder) {
                case 'playerCount':
                    return getPlayerCount(b.id) - getPlayerCount(a.id);
                case 'chipLead':
                    return getChipLead(b.id) - getChipLead(a.id);
                case 'number':
                default:
                    return a.id - b.id;
            }
        });

        // Inject scheduled dealer assignments
        return sortedTables.map(table => {
            const scheduledDealerId = currentAssignments[`T${table.id}`];
            // If scheduledDealerId is defined (even if null), it overrides. Otherwise, use manual assignment.
            const finalDealerId = scheduledDealerId !== undefined ? scheduledDealerId : table.dealerId;
            return { ...table, dealerId: finalDealerId };
        });

    }, [tournament, displayFlightId, isMultiFlightMode, sortOrder, currentAssignments]);

    const handleSaveTable = () => {
        if (!editingTable) return;
        const actionType = editingTable.id ? 'UPDATE_TABLE' : 'ADD_TABLE';
        dispatch({ type: actionType, payload: { tournamentId: tournament.id, tableData: editingTable } as any });
        setEditingTable(null);
    };

    const handleDeleteTable = (tableId: number) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette table ? Les joueurs assis seront placés en liste d'attente.")) {
            dispatch({ type: 'DELETE_TABLE', payload: { tournamentId: tournament.id, tableId } });
        }
    };
    
    const handleInitiateMove = (entryId: string) => {
        setMovingPlayerId(entryId);
        setSelectedTable(null); // Close the detail modal
    };

    const handleCancelMove = () => {
        setMovingPlayerId(null);
    };

    const handleCompleteMove = (targetTable: number, targetSeat: number) => {
        if (movingPlayerId) {
            dispatch({
                type: 'MOVE_PLAYER',
                payload: {
                    tournamentId: tournament.id,
                    sourceEntryId: movingPlayerId,
                    targetTable,
                    targetSeat
                }
            });
            setMovingPlayerId(null);
        }
    };

    const handleInitiateElimination = (entries: (Entry & { player: Player })[]) => {
        setEntriesToEliminate(entries);
        setEliminationModalOpen(true);
        setSelectedTable(null); // Close detail modal
    };
    
    const handlePrintTable = (table: PokerTable) => {
        const entriesOnTable = tournament.entries
            .filter(e => e.table === table.id && e.status === EntryStatus.ACTIVE)
            .map(e => ({...e, player: state.players.find(p => p.id === e.playerId)}))
            .filter((e): e is Entry & { player: Player } => !!e.player);
            
        dispatch({ type: 'SET_TABLE_TO_PRINT', payload: { table, entries: entriesOnTable, tournamentName: tournament.name } });
    };

    const handlePrintAllSeatDraws = () => {
         const playersWithDetails = tournament.entries
            .filter(e => e.status === EntryStatus.ACTIVE && e.table !== null)
            .map(entry => {
                const player = state.players.find(p => p.id === entry.playerId);
                return player ? { ...entry, player } : null;
            }).filter((p): p is Entry & { player: Player } => p !== null);
        
        dispatch({
            type: 'SET_SEAT_DRAW_TO_PRINT',
            payload: {
                tournament: tournament,
                players: playersWithDetails,
            }
        });
    }

    const SortButton = ({ sortKey, children }: { sortKey: typeof sortOrder, children: React.ReactNode }) => (
        <Button
            variant={sortOrder === sortKey ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setSortOrder(sortKey)}
        >
            {children}
        </Button>
    );

    return (
        <Card className="relative">
            {movingPlayerId && (
                <MoveModeOverlay
                    tournament={tournament}
                    players={state.players}
                    movingPlayerId={movingPlayerId}
                    onCompleteMove={handleCompleteMove}
                    onCancelMove={handleCancelMove}
                />
            )}
            
            {assigningDealerToTable && (
                <AssignDealerModal
                    isOpen={!!assigningDealerToTable}
                    onClose={() => setAssigningDealerToTable(null)}
                    tournament={tournament}
                    table={assigningDealerToTable}
                    dealers={state.dealers}
                />
            )}

            {breakingTable && (
                 <BreakTableModal
                    isOpen={!!breakingTable}
                    onClose={() => setBreakingTable(null)}
                    tournament={tournament}
                    players={state.players}
                    tableToBreak={breakingTable}
                />
            )}
            
            <EliminationModal isOpen={eliminationModalOpen} onClose={() => setEliminationModalOpen(false)} tournament={tournament} players={state.players} entriesToEliminate={entriesToEliminate} />
            {selectedTable && <TableDetailModal table={selectedTable} tournament={tournament} players={state.players} dealers={state.dealers} onClose={() => setSelectedTable(null)} onInitiateElimination={handleInitiateElimination} onInitiateMove={handleInitiateMove} />}
            
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                <CardHeader className="mb-0">Tables ({tablesInView.length})</CardHeader>
                <div className="flex items-center flex-wrap gap-4">
                     <div className="flex items-center gap-2 border-r border-gray-600 pr-4">
                        <span className="text-sm text-gray-400">Trier par:</span>
                        <SortButton sortKey="number">Numéro</SortButton>
                        <SortButton sortKey="playerCount">Joueurs</SortButton>
                        <SortButton sortKey="chipLead">Chip Lead</SortButton>
                    </div>
                    <Button variant="secondary" onClick={handlePrintAllSeatDraws} className="flex items-center gap-2"><PrinterIcon className="w-5 h-5"/> Seat Draw Complet</Button>
                    <Button variant="secondary" onClick={() => setEditingTable({ name: '', room: '', seats: 9 })} className="flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Ajouter une table</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {tablesInView.map(table => {
                     const playersOnThisTable = tournament.entries.filter(e => e.table === table.id && e.status === EntryStatus.ACTIVE).length;
                     const otherTables = tournament.tables.filter(t => t.id !== table.id);
                     const totalSeatsOnOtherTables = otherTables.reduce((sum, t) => sum + t.seats, 0);
                     const playersOnOtherTables = tournament.entries.filter(e => e.table !== table.id && e.status === EntryStatus.ACTIVE).length;
                     const blockedOnOtherTables = tournament.blockedSeats.filter(s => s.table !== table.id).length;
                     const emptySeats = totalSeatsOnOtherTables - playersOnOtherTables - blockedOnOtherTables;
                     const canBreakTable = playersOnThisTable > 0 && playersOnThisTable <= emptySeats;
                    return (
                        <div key={table.id} className="relative group">
                            <TableCard table={table} tournament={tournament} players={state.players} dealers={state.dealers} onSelectTable={setSelectedTable} onAssignDealer={setAssigningDealerToTable} onBreakTable={setBreakingTable} />
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-gray-900/50 p-1 rounded-md">
                                <Button size="sm" variant="secondary" className="p-1" disabled={!canBreakTable} onClick={(e) => { e.stopPropagation(); setBreakingTable(table); }} title={canBreakTable ? "Casser cette table" : `Pas assez de sièges libres (${emptySeats}) pour ${playersOnThisTable} joueur(s)`}><ArrowsRightLeftIcon className="w-4 h-4"/></Button>
                                <Button size="sm" variant="secondary" className="p-1" onClick={(e) => { e.stopPropagation(); handlePrintTable(table); }} title="Imprimer la feuille de table"><PrinterIcon className="w-4 h-4"/></Button>
                                <Button size="sm" variant="secondary" className="p-1" onClick={(e) => { e.stopPropagation(); setEditingTable(table); }} title="Modifier la table"><PencilIcon className="w-4 h-4"/></Button>
                                <Button size="sm" variant="danger" className="p-1" onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }} title="Supprimer la table"><TrashIcon className="w-4 h-4"/></Button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {editingTable && (
                 <Modal isOpen={true} onClose={() => setEditingTable(null)}>
                    <CardHeader>{editingTable.id ? 'Modifier la Table' : 'Ajouter une Table'}</CardHeader>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nom de la table" value={editingTable.name || ''} onChange={e => setEditingTable({ ...editingTable, name: e.target.value })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                        <input type="number" placeholder="Nombre de sièges" value={editingTable.seats || ''} onChange={e => setEditingTable({ ...editingTable, seats: parseInt(e.target.value) })} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="secondary" onClick={() => setEditingTable(null)}>Annuler</Button>
                        <Button variant="primary" onClick={handleSaveTable}>Sauvegarder</Button>
                    </div>
                </Modal>
            )}
        </Card>
    );
};