import React, { createContext, useReducer, useContext, ReactNode, useState, useEffect } from 'react';
import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppState, Action, Tournament, Player, BlindStructureTemplate, Season, Level, EntryStatus, TournamentStatus, FlightStatus, TournamentType, TournamentPhase, Entry, Payout, Transaction, Announcement, PokerTable, LiveCoveragePost, LiveCoverageSuggestion, Flight, DisplaySettings, WidgetConfig, WidgetType, TickerSettings, Sponsor, DisplayTemplate, Dealer, DealerShift, TournamentTemplate, MoveSlip, CashGameTable, CashGameSession } from './types';
import { generateUUID, calculatePayouts } from './utils';

export { calculatePayouts } from './utils';
export type { Action } from './types';


// --- DEXIE DATABASE SETUP ---
class MyDatabase extends Dexie {
  tournaments!: Table<Tournament>;
  players!: Table<Player>;
  dealers!: Table<Dealer>;
  blindStructureTemplates!: Table<BlindStructureTemplate>;
  displayTemplates!: Table<DisplayTemplate>;
  seasons!: Table<Season>;
  tournamentTemplates!: Table<TournamentTemplate>;
  cashGameTables!: Table<CashGameTable>;
  cashGameSessions!: Table<CashGameSession>;

  constructor() {
    super('pokerTournamentDB');
    this.version(1).stores({
      tournaments: 'id',
      players: 'id, nickname, firstName, lastName, email, phone',
      dealers: 'id, nickname',
      blindStructureTemplates: 'id',
      displayTemplates: 'id',
      seasons: 'id',
      tournamentTemplates: 'id',
      cashGameTables: 'id',
      cashGameSessions: 'id, playerId, tableId',
    });
  }
}

const db = new MyDatabase();


// --- HELPER FUNCTIONS (SHARED ACROSS REDUCERS) ---
const assignSeat = (entries: Entry[], tables: PokerTable[], blockedSeats: { table: number; seat: number; }[], entryId: string): { newEntries: Entry[]; assigned: boolean } => {
    const entryIndex = entries.findIndex((e: Entry) => e.id === entryId);
    if (entryIndex === -1) return { newEntries: entries, assigned: false };

    const tablePlayerCounts = tables.map(table => ({
        id: table.id,
        seats: table.seats,
        players: entries.filter((e: Entry) => e.status === EntryStatus.ACTIVE && e.table === table.id).length,
    }));
    
    const counts = new Map<number, typeof tablePlayerCounts>();
    tablePlayerCounts.forEach(table => {
        if (!counts.has(table.players)) {
            counts.set(table.players, []);
        }
        counts.get(table.players)!.push(table);
    });

    const sortedCounts = Array.from(counts.keys()).sort((a, b) => a - b);

    for (const count of sortedCounts) {
        let candidateTables = counts.get(count)!;
        candidateTables.sort(() => Math.random() - 0.5);

        for (const candidateTable of candidateTables) {
            const tableData = tables.find(t => t.id === candidateTable.id);
            if (!tableData) continue;

            const occupiedSeats = new Set(entries.filter((e: Entry) => e.table === tableData.id && e.seat !== null).map((e: Entry) => e.seat!));
            const blockedSeatNumbers = new Set(blockedSeats.filter(s => s.table === tableData.id).map(s => s.seat));

            const allSeatNumbers = Array.from({ length: tableData.seats }, (_, i) => i + 1);
            let availableSeats = allSeatNumbers.filter(seat => !occupiedSeats.has(seat) && !blockedSeatNumbers.has(seat));

            if (availableSeats.length > 0) {
                const randomSeatIndex = Math.floor(Math.random() * availableSeats.length);
                const assignedSeat = availableSeats[randomSeatIndex];

                const newEntries = entries.map(e => e.id === entryId ? { ...e, table: tableData.id, seat: assignedSeat } : e);
                return { newEntries, assigned: true };
            }
        }
    }
    
    const newEntries = entries.map(e => e.id === entryId ? { ...e, table: null, seat: null } : e);
    return { newEntries, assigned: false };
};


const checkAndCompleteTournament = (tournament: Tournament): Tournament => {
    if (tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS) {
        return tournament;
    }
    
    if (tournament.status === TournamentStatus.COMPLETED) return tournament;
    
    const activePlayers = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE);
    
    if (tournament.entries.length > 1 && activePlayers.length <= 1) {
        let newEntries = [...tournament.entries];
        let newTransactions = [...tournament.transactions];
        
        if (activePlayers.length === 1) {
            const winnerEntry = activePlayers[0];
            const winnerIndex = newEntries.findIndex(e => e.id === winnerEntry.id);
            if (winnerIndex > -1) {
                const eliminatedCount = newEntries.filter(e => e.eliminationIndex !== null).length;
                newEntries[winnerIndex] = { 
                    ...winnerEntry, 
                    status: EntryStatus.ELIMINATED,
                    eliminationRank: null,
                    eliminationIndex: eliminatedCount + 1,
                    table: null, 
                    seat: null 
                };
                
                const finalTotalEntries = newEntries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
                const totalPrizePool = (newEntries.reduce((s, e) => s + e.buyins, 0) * tournament.buyin) + (newEntries.reduce((s, e) => s + e.addons, 0) * tournament.addonCost);
                const payouts = tournament.payoutSettings.mode === 'manual' 
                    ? tournament.payoutSettings.manualPayouts 
                    : calculatePayouts(totalPrizePool, finalTotalEntries);
                
                const winnerPayout = payouts.find(p => p.rank === 1);

                if (winnerPayout && winnerPayout.amount > 0 && !newTransactions.some(tx => tx.entryId === winnerEntry.id && tx.type === 'payout')) {
                    const newTransaction: Transaction = {
                        id: `tx-payout-${winnerEntry.id}`, type: 'payout', entryId: winnerEntry.id, playerId: winnerEntry.playerId,
                        amount: -winnerPayout.amount, timestamp: new Date().toISOString()
                    };
                    newTransactions.push(newTransaction);
                }
            }
        }
        
        return { 
            ...tournament, 
            entries: newEntries,
            transactions: newTransactions,
            status: TournamentStatus.COMPLETED, 
            lastClockStartTime: null 
        };
    }
    
    return tournament;
};

const createPayoutTransactionIfNeeded = (
    tournament: Tournament,
    entryToEliminate: Entry,
    eliminatedCount: number
): Transaction | null => {
    if (tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS) {
        return null;
    }

    const existingTx = tournament.transactions.find(tx => tx.entryId === entryToEliminate.id && tx.type === 'payout');
    if (existingTx) {
        return null;
    }

    const finalTotalEntries = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
    const totalPrizePool = (tournament.entries.reduce((s, e) => s + e.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((s, e) => s + e.addons, 0) * tournament.addonCost);
    const payouts = tournament.payoutSettings.mode === 'manual' 
        ? tournament.payoutSettings.manualPayouts 
        : calculatePayouts(totalPrizePool, finalTotalEntries);

    const newEliminationIndex = eliminatedCount + 1;
    const finalRank = finalTotalEntries - newEliminationIndex + 1;
    const payout = payouts.find(p => p.rank === finalRank);

    if (payout && payout.amount > 0) {
        const newTransaction: Transaction = {
            id: `tx-payout-${entryToEliminate.id}`,
            type: 'payout',
            entryId: entryToEliminate.id,
            playerId: entryToEliminate.playerId,
            amount: -payout.amount,
            timestamp: new Date().toISOString()
        };
        return newTransaction;
    }
    
    return null;
};


// --- TEMPLATE DEFINITIONS ---
const createClassicTemplate = (tournamentName: string): DisplaySettings => {
    const w_title: WidgetConfig = { id: `w${Date.now()}-title`, type: WidgetType.TEXT, content: tournamentName, fontSize: '2.5rem', fontWeight: '700', textAlign: 'center'};
    const w_players_in: WidgetConfig = { id: `w${Date.now()}-players`, type: WidgetType.TEXT, content: 'PLAYERS IN\n<joueurs_restants>', fontSize: '1.5rem', fontWeight: '700', textAlign: 'center' };
    const w_entries: WidgetConfig = { id: `w${Date.now()}-entries`, type: WidgetType.TEXT, content: 'ENTRIES\n<joueurs_total>', fontSize: '1.5rem', fontWeight: '700', textAlign: 'center' };
    const w_pot: WidgetConfig = { id: `w${Date.now()}-pot`, type: WidgetType.TEXT, content: 'TOTAL POT\n<prizepool_total>', fontSize: '1.5rem', fontWeight: '700', textAlign: 'center' };
    const w_avg: WidgetConfig = { id: `w${Date.now()}-avg`, type: WidgetType.TEXT, content: 'Avg Stack\n<avg_stack> (<avg_stack_bb>)', fontSize: '1.5rem', fontWeight: '700', textAlign: 'center' };
    const w_total_chips: WidgetConfig = { id: `w${Date.now()}-totalchips`, type: WidgetType.TEXT, content: 'Total Chips\n<total_chips>', fontSize: '1.5rem', fontWeight: '700', textAlign: 'center' };
    const w_leaders: WidgetConfig = { id: `w${Date.now()}-leaders`, type: WidgetType.CHIP_LEADERS, leaderCount: 10, fontSize: '1.1rem' };
    const w_clock: WidgetConfig = { id: `w${Date.now()}-clock`, type: WidgetType.CLOCK, fontSize: '10rem', fontWeight: '800' };
    
    return {
        gridTemplateColumns: '1.5fr 4fr 1.75fr',
        gridTemplateRows: 'auto 1fr 1fr 2fr',
        gap: 12,
        backgroundColor: '#072F5F',
        backgroundImage: null,
        cells: [
            { id: `c${Date.now()}-title`, col: '1 / 4', row: '1 / 2', widgetId: w_title.id },
            { id: `c${Date.now()}-clock`, col: '2 / 3', row: '2 / 5', widgetId: w_clock.id },
            { id: `c${Date.now()}-players`, col: '1 / 2', row: '2 / 3', widgetId: w_players_in.id },
            { id: `c${Date.now()}-entries`, col: '1 / 2', row: '3 / 4', widgetId: w_entries.id },
            { id: `c${Date.now()}-pot`, col: '1 / 2', row: '4 / 5', widgetId: w_pot.id },
            { id: `c${Date.now()}-avg`, col: '3 / 4', row: '2 / 3', widgetId: w_avg.id },
            { id: `c${Date.now()}-totalchips`, col: '3 / 4', row: '3 / 4', widgetId: w_total_chips.id },
            { id: `c${Date.now()}-leaders`, col: '3 / 4', row: '4 / 5', widgetId: w_leaders.id },
        ],
        widgets: [ w_title, w_players_in, w_entries, w_pot, w_avg, w_total_chips, w_leaders, w_clock ],
        sponsors: [],
        topTicker: { enabled: true, content: 'announcements', speed: 'normal' },
        bottomTicker: { enabled: true, content: 'players', speed: 'normal' },
        dynamicBackgroundColorEnabled: false,
    };
};

const createCompactTemplate = (tournamentName: string): DisplaySettings => {
    const w_clock: WidgetConfig = { id: `w${Date.now()}-clock`, type: WidgetType.CLOCK, fontSize: '15rem', color: '#ffffff' };
    const w_blinds: WidgetConfig = { id: `w${Date.now()}-blinds`, type: WidgetType.BLINDS, fontSize: '3rem', textAlign: 'center', color: '#60a5fa' };
    return {
        gridTemplateColumns: '1fr',
        gridTemplateRows: '3fr 1fr',
        gap: 16,
        backgroundColor: '#0D1117',
        backgroundImage: null,
        cells: [
            { id: `c${Date.now()}-1`, col: '1 / 2', row: '1 / 2', widgetId: w_clock.id },
            { id: `c${Date.now()}-2`, col: '1 / 2', row: '2 / 3', widgetId: w_blinds.id },
        ],
        widgets: [w_clock, w_blinds],
        sponsors: [],
        topTicker: { enabled: false, content: 'announcements', speed: 'normal' },
        bottomTicker: { enabled: true, content: 'players', speed: 'normal' },
        dynamicBackgroundColorEnabled: false,
    };
};

const createInformativeTemplate = (tournamentName: string): DisplaySettings => {
    const w_title: WidgetConfig = { id: `w${Date.now()}-title`, type: WidgetType.TEXT, content: tournamentName, fontSize: '2rem', fontWeight: '700' };
    const w_clock: WidgetConfig = { id: `w${Date.now()}-clock`, type: WidgetType.CLOCK, fontSize: '8rem' };
    const w_blinds: WidgetConfig = { id: `w${Date.now()}-blinds`, type: WidgetType.BLINDS, fontSize: '2rem' };
    const w_stats: WidgetConfig = { id: `w${Date.now()}-stats`, type: WidgetType.TEXT, content: 'Joueurs: <joueurs_restants>/<joueurs_total> | Moyenne: <avg_stack> | Prizepool: <prizepool_total>', fontSize: '1.2rem'};
    const w_payouts: WidgetConfig = { id: `w${Date.now()}-payouts`, type: WidgetType.PAYOUTS, payoutCount: 12, fontSize: '1rem' };
    const w_leaders: WidgetConfig = { id: `w${Date.now()}-leaders`, type: WidgetType.CHIP_LEADERS, leaderCount: 12, fontSize: '1rem' };
    
    return {
        gridTemplateColumns: '3fr 2fr 2fr',
        gridTemplateRows: 'auto 3fr auto auto',
        gap: 16,
        backgroundColor: '#0D1117',
        backgroundImage: null,
        cells: [
            { id: `c${Date.now()}-title`, col: '1 / 4', row: '1 / 2', widgetId: w_title.id },
            { id: `c${Date.now()}-clock`, col: '1 / 2', row: '2 / 3', widgetId: w_clock.id },
            { id: `c${Date.now()}-blinds`, col: '1 / 2', row: '3 / 4', widgetId: w_blinds.id },
            { id: `c${Date.now()}-stats`, col: '1 / 2', row: '4 / 5', widgetId: w_stats.id },
            { id: `c${Date.now()}-leaders`, col: '2 / 3', row: '2 / 5', widgetId: w_leaders.id },
            { id: `c${Date.now()}-payouts`, col: '3 / 4', row: '2 / 5', widgetId: w_payouts.id },
        ],
        widgets: [w_title, w_clock, w_blinds, w_stats, w_payouts, w_leaders],
        sponsors: [],
        topTicker: { enabled: false, content: 'announcements', speed: 'normal' },
        bottomTicker: { enabled: true, content: 'payouts', speed: 'normal' },
        dynamicBackgroundColorEnabled: false,
    };
};
export const createDefaultDisplaySettings = createClassicTemplate;

export const templates = {
    classic: { name: 'Classique (Recommandé)', description: 'Basé sur un affichage de tournoi classique, clair et professionnel.', generator: createClassicTemplate },
    informative: { name: 'Informatif', description: 'Optimisé pour afficher le maximum de données (chip leaders, payouts...).', generator: createInformativeTemplate },
    compact: { name: 'Compact', description: 'Une grande horloge et les blinds. Idéal pour un affichage épuré.', generator: createCompactTemplate },
};


// --- INITIAL STATE ---
const initialState: AppState = {
  version: 1, // Using Dexie
  tournaments: [],
  players: [],
  dealers: [],
  blindStructureTemplates: [],
  displayTemplates: [],
  seasons: [],
  tournamentTemplates: [],
  cashGameTables: [],
  cashGameSessions: [],
  entryToPrint: null,
  tableToPrint: null,
  playerListToPrint: null,
  seatDrawToPrint: null,
  payoutToPrint: null,
  financeReportToPrint: null,
  moveSlipsToPrint: null,
};

// --- SYNC LOGIC ---
// This function will be set by the App component to broadcast actions.
let broadcastAction: ((action: Action) => void) | null = null;
let broadcastPublicState: ((state: AppState) => void) | null = null; // New broadcaster for public view
let isSyncClient = false;

export const setBroadcaster = (broadcaster: ((action: Action) => void) | null) => {
    broadcastAction = broadcaster;
};

export const setPublicStateBroadcaster = (broadcaster: ((state: AppState) => void) | null) => {
    broadcastPublicState = broadcaster;
};

export const setSyncClientStatus = (isClient: boolean) => {
    isSyncClient = isClient;
};


// --- CONTEXT & PROVIDER ---
interface TournamentContextType {
  state: AppState;
  dispatch: (action: Action) => Promise<void>;
  loading: boolean;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);


export const TournamentProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [localState, baseDispatch] = useReducer(uiReducer, initialState);
  const [loading, setLoading] = useState(true);

  // useLiveQuery hooks for reactive data fetching from Dexie
  const tournaments = useLiveQuery(() => db.tournaments.toArray(), []);
  const players = useLiveQuery(() => db.players.toArray(), []);
  const dealers = useLiveQuery(() => db.dealers.toArray(), []);
  const blindStructureTemplates = useLiveQuery(() => db.blindStructureTemplates.toArray(), []);
  const displayTemplates = useLiveQuery(() => db.displayTemplates.toArray(), []);
  const seasons = useLiveQuery(() => db.seasons.toArray(), []);
  const tournamentTemplates = useLiveQuery(() => db.tournamentTemplates.toArray(), []);
  const cashGameTables = useLiveQuery(() => db.cashGameTables.toArray(), []);
  const cashGameSessions = useLiveQuery(() => db.cashGameSessions.toArray(), []);
  
  // Combine local state with Dexie state
  const state: AppState = {
      ...localState,
      tournaments: tournaments || [],
      players: players || [],
      dealers: dealers || [],
      blindStructureTemplates: blindStructureTemplates || [],
      displayTemplates: displayTemplates || [],
      seasons: seasons || [],
      tournamentTemplates: tournamentTemplates || [],
      cashGameTables: cashGameTables || [],
      cashGameSessions: cashGameSessions || [],
  };

    // New Effect: Trigger public broadcast whenever the state changes.
    useEffect(() => {
        if (broadcastPublicState) {
            broadcastPublicState(state);
        }
    }, [state]);

  // Check if initial data load is complete
  useState(() => {
      const checkLoading = async () => {
          await db.open();
          setLoading(false);
      };
      checkLoading();
  });


  const dispatch = async (action: Action) => {
    // If the action is NOT from a sync message, broadcast it to other clients.
    if (!(action as any).fromSync && broadcastAction) {
        broadcastAction(action);
        // If we are a client, don't process the action locally. Wait for host confirmation.
        if (isSyncClient) {
            return;
        }
    }

    try {
        switch (action.type) {
            // --- Global Data Actions ---
            case 'ADD_TOURNAMENT': await db.tournaments.put(action.payload); break;
            case 'UPDATE_TOURNAMENT': await db.tournaments.put(action.payload); break;
            case 'ARCHIVE_TOURNAMENT': await db.tournaments.update(action.payload.tournamentId, { isArchived: true }); break;
            case 'UNARCHIVE_TOURNAMENT': await db.tournaments.update(action.payload.tournamentId, { isArchived: false }); break;
            case 'DELETE_TOURNAMENT': await db.tournaments.delete(action.payload.tournamentId); break;
            case 'IMPORT_TOURNAMENT': {
                await db.transaction('rw', db.tournaments, db.players, async () => {
                    await db.tournaments.put(action.payload.tournament);
                    await db.players.bulkPut(action.payload.players);
                });
                break;
            }
            case 'REPLACE_STATE': {
                 await db.transaction('rw', db.tables, async () => {
                    await Promise.all(db.tables.map(table => table.clear()));
                    await db.tournaments.bulkPut(action.payload.tournaments);
                    await db.players.bulkPut(action.payload.players);
                    await db.dealers.bulkPut(action.payload.dealers);
                    await db.seasons.bulkPut(action.payload.seasons);
                    await db.blindStructureTemplates.bulkPut(action.payload.blindStructureTemplates);
                    await db.displayTemplates.bulkPut(action.payload.displayTemplates);
                    await db.tournamentTemplates.bulkPut(action.payload.tournamentTemplates);
                    await db.cashGameTables.bulkPut(action.payload.cashGameTables || []);
                    await db.cashGameSessions.bulkPut(action.payload.cashGameSessions || []);
                 });
                 break;
            }
            case 'ADD_PLAYER': await db.players.put(action.payload); break;
            case 'UPDATE_PLAYER': await db.players.put(action.payload); break;
            case 'DELETE_PLAYER': await db.players.delete(action.payload.playerId); break;
            case 'MERGE_PLAYERS': await db.players.bulkPut(action.payload.players); break;
            case 'MERGE_PLAYERS_FROM_CSV': {
                 await db.transaction('rw', db.players, async () => {
                    for(const p of action.payload.players) {
                        const existingByNickname = await db.players.where('nickname').equalsIgnoreCase(p.nickname!).first();
                        const existingByPhone = p.phone ? await db.players.where('phone').equals(p.phone).first() : undefined;
                        
                        const existing = existingByNickname || existingByPhone;

                        if (existing) {
                             await db.players.update(existing.id, {
                                nickname: p.nickname || existing.nickname,
                                firstName: p.firstName || existing.firstName,
                                lastName: p.lastName || existing.lastName,
                                phone: p.phone || existing.phone,
                             });
                        } else {
                            const newId = p.id || `${Date.now()}${Math.floor(Math.random() * 100)}`;
                            const newPlayer: Player = {
                                id: String(newId), nickname: p.nickname!, firstName: p.firstName || '', lastName: p.lastName || '',
                                email: '', phone: p.phone || '', gender: 'unspecified', notes: '',
                                avatarUrl: `https://i.pravatar.cc/40?u=${newId}`,
                            };
                            await db.players.add(newPlayer);
                        }
                    }
                 });
                 break;
            }
            case 'ADD_DEALER': await db.dealers.put(action.payload); break;
            case 'UPDATE_DEALER': await db.dealers.put(action.payload); break;
            case 'DELETE_DEALER': await db.dealers.delete(action.payload.dealerId); break;
            case 'MERGE_DEALERS_FROM_CSV': {
                await db.transaction('rw', db.dealers, async () => {
                     for(const d of action.payload.dealers) {
                         const existing = await db.dealers.where('nickname').equalsIgnoreCase(d.nickname!).first();
                         if (existing) {
                              await db.dealers.update(existing.id, { firstName: d.firstName, lastName: d.lastName });
                         } else {
                             const newId = d.id || `${Date.now()}${Math.floor(Math.random() * 100)}`;
                             const newDealer: Dealer = {
                                 id: String(newId), nickname: d.nickname!, firstName: d.firstName || '', lastName: d.lastName || '', notes: '',
                                 avatarUrl: `https://i.pravatar.cc/40?u=${newId}`
                             };
                             await db.dealers.add(newDealer);
                         }
                     }
                });
                break;
            }
            case 'SAVE_BLIND_TEMPLATE': {
                 const newTemplate = { id: generateUUID(), ...action.payload };
                 await db.blindStructureTemplates.put(newTemplate);
                 break;
            }
            case 'DELETE_BLIND_TEMPLATE': await db.blindStructureTemplates.delete(action.payload.templateId); break;
            case 'SAVE_DISPLAY_TEMPLATE': {
                const newTemplate = { id: generateUUID(), ...action.payload };
                await db.displayTemplates.put(newTemplate);
                break;
            }
            case 'DELETE_DISPLAY_TEMPLATE': await db.displayTemplates.delete(action.payload.templateId); break;
            case 'SAVE_TOURNAMENT_TEMPLATE': await db.tournamentTemplates.put(action.payload); break;
            case 'DELETE_TOURNAMENT_TEMPLATE': await db.tournamentTemplates.delete(action.payload.templateId); break;
            case 'ADD_SEASON': {
                const newSeason = { id: generateUUID(), ...action.payload };
                await db.seasons.put(newSeason);
                break;
            }
            case 'UPDATE_SEASON': await db.seasons.put(action.payload); break;
            case 'DELETE_SEASON': await db.seasons.delete(action.payload.seasonId); break;
            
            // --- Cash Game Actions ---
            case 'ADD_CASH_TABLE': {
                const newTable = { ...action.payload, id: generateUUID(), waitingList: [] };
                await db.cashGameTables.put(newTable);
                break;
            }
            case 'DELETE_CASH_TABLE': {
                await db.transaction('rw', db.cashGameTables, db.cashGameSessions, async () => {
                     await db.cashGameTables.delete(action.payload.tableId);
                     const activeSessions = await db.cashGameSessions.where({ tableId: action.payload.tableId, endTime: null }).toArray();
                     await db.cashGameSessions.bulkUpdate(activeSessions.map(s => ({ key: s.id, changes: { endTime: new Date().toISOString() } })));
                });
                break;
            }
            // FIX: Dexie's `modify` callback must return `void` or `boolean`. `Array.prototype.push` returns the new array length (a number), causing a type error.
            // Wrapping the push operation in curly braces ensures the callback implicitly returns `void`.
            case 'ADD_TO_WAITING_LIST': await db.cashGameTables.where('id').equals(action.payload.tableId).modify(t => { t.waitingList.push(action.payload.playerId); }); break;
            case 'SEAT_PLAYER': {
                await db.transaction('rw', db.cashGameTables, db.cashGameSessions, async () => {
                     const newSession: CashGameSession = {
                        id: generateUUID(), playerId: action.payload.playerId, tableId: action.payload.tableId,
                        seat: action.payload.seat, startTime: new Date().toISOString(), endTime: null, pauses: [],
                    };
                    await db.cashGameSessions.put(newSession);
                    await db.cashGameTables.where('id').equals(action.payload.tableId).modify(t => {
                        t.waitingList = t.waitingList.filter(pid => pid !== action.payload.playerId);
                    });
                });
                break;
            }
            case 'CHECK_OUT_PLAYER': await db.cashGameSessions.update(action.payload.sessionId, { endTime: new Date().toISOString() }); break;
            case 'TOGGLE_SESSION_PAUSE': await db.cashGameSessions.where('id').equals(action.payload.sessionId).modify(s => {
                const lastPause = s.pauses[s.pauses.length - 1];
                if (lastPause && lastPause.end === null) {
                    lastPause.end = new Date().toISOString();
                } else {
                    s.pauses.push({ start: new Date().toISOString(), end: null });
                }
            }); break;
            case 'MOVE_SESSION_PLAYER': await db.cashGameSessions.update(action.payload.sessionId, { tableId: action.payload.newTableId, seat: action.payload.newSeat }); break;


            // --- Tournament-Specific Actions ---
            default: {
                if ('payload' in action && action.payload && 'tournamentId' in (action.payload as any)) {
                    const { tournamentId } = (action as any).payload;
                    if (!tournamentId) break;
                    
                    await db.transaction('rw', db.tournaments, db.players, async () => {
                        const currentTournament = await db.tournaments.get(tournamentId);
                        if (!currentTournament) return;
                        const currentPlayers = await db.players.toArray();

                        let updatedTournament: Tournament;

                        if (PLAYER_ACTION_TYPES.has(action.type)) {
                            const result = playerActionsReducer(currentTournament, currentPlayers, action);
                            updatedTournament = result.updatedTournament;
                            
                            // If players were created, add them
                            if(result.updatedPlayers.length > currentPlayers.length) {
                                await db.players.bulkPut(result.updatedPlayers);
                            }
                             
                            if (result.entryToPrint) baseDispatch({ type: 'SET_ENTRY_TO_PRINT', payload: result.entryToPrint });
                            if (result.moveSlipsToPrint) baseDispatch({ type: 'SET_MOVE_SLIPS_TO_PRINT', payload: result.moveSlipsToPrint });

                        } else {
                            updatedTournament = tournamentReducer(currentTournament, action);
                        }

                        await db.tournaments.put(updatedTournament);
                    });
                } else {
                    if (UI_ACTION_TYPES.has(action.type)) {
                        baseDispatch(action);
                    }
                }
                break;
            }
        }
    } catch (error) {
        console.error("Dexie write error:", error);
    }
  };

  return React.createElement(TournamentContext.Provider, { value: { state, dispatch, loading } }, children);
};

export const useTournamentStore = () => {
  const context = useContext(TournamentContext);
  if (context === undefined) {
    throw new Error('useTournamentStore must be used within a TournamentProvider');
  }
  return context;
};

// --- SUB-REDUCERS (PURE FUNCTIONS) ---

const uiReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'REPLACE_STATE':
             return { ...state, ...action.payload }; // Only for UI-managed state now
        case 'SET_STATE':
             return { ...state, ...action.payload };
        case 'SET_ENTRY_TO_PRINT': return { ...state, entryToPrint: action.payload };
        case 'CLEAR_ENTRY_TO_PRINT': return { ...state, entryToPrint: null };
        case 'SET_TABLE_TO_PRINT': return { ...state, tableToPrint: action.payload };
        case 'CLEAR_TABLE_TO_PRINT': return { ...state, tableToPrint: null };
        case 'SET_PLAYER_LIST_TO_PRINT': return { ...state, playerListToPrint: action.payload };
        case 'CLEAR_PLAYER_LIST_TO_PRINT': return { ...state, playerListToPrint: null };
        case 'SET_SEAT_DRAW_TO_PRINT': return { ...state, seatDrawToPrint: action.payload };
        case 'CLEAR_SEAT_DRAW_TO_PRINT': return { ...state, seatDrawToPrint: null };
        case 'SET_PAYOUT_TO_PRINT': return { ...state, payoutToPrint: action.payload };
        case 'CLEAR_PAYOUT_TO_PRINT': return { ...state, payoutToPrint: null };
        case 'SET_FINANCE_REPORT_TO_PRINT': return { ...state, financeReportToPrint: action.payload };
        case 'CLEAR_FINANCE_REPORT_TO_PRINT': return { ...state, financeReportToPrint: null };
        case 'SET_MOVE_SLIPS_TO_PRINT': return { ...state, moveSlipsToPrint: action.payload };
        case 'CLEAR_MOVE_SLIPS_TO_PRINT': return { ...state, moveSlipsToPrint: null };
        default: return state;
    }
};

type PlayerActionResult = {
    updatedTournament: Tournament;
    updatedPlayers: Player[];
    entryToPrint?: { entry: Entry; player: Player; tournament: Tournament } | null;
    moveSlipsToPrint?: { slips: MoveSlip[]; tournamentName: string } | null;
};
const playerActionsReducer = (originalTournament: Tournament, originalPlayers: Player[], action: Action): PlayerActionResult => {
    let tournament = { ...originalTournament };
    let players = [...originalPlayers];
    let entryToPrint: PlayerActionResult['entryToPrint'] = null;
    let moveSlipsToPrint: PlayerActionResult['moveSlipsToPrint'] = null;

    switch(action.type) {
        case 'SET_RE_ENTRY_PENDING': {
            const { entryId, liveCoveragePost } = action.payload;
            const entryToUpdate = tournament.entries.find(e => e.id === entryId);
            if (!entryToUpdate) break;

            const lastEliminationSnapshot = { entry: entryToUpdate, timestamp: new Date().toISOString() };
            
            let newLiveCoveragePosts = tournament.liveCoveragePosts;
            if (liveCoveragePost) {
                const newPost: LiveCoveragePost = {
                    id: `post-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    level: tournament.currentLevel,
                    ...liveCoveragePost
                };
                newLiveCoveragePosts = [newPost, ...newLiveCoveragePosts];
            }
            tournament = {
                ...tournament,
                liveCoveragePosts: newLiveCoveragePosts,
                entries: tournament.entries.map(e =>
                    e.id === entryId
                        ? { ...e, status: EntryStatus.RE_ENTRY_PENDING, table: null, seat: null, bustoutTimestamp: new Date().toISOString() }
                        : e
                ),
                lastEliminationSnapshot,
            };
            break;
        }
        case 'ELIMINATE_PLAYER': {
            const { entryId, liveCoveragePost } = action.payload;
            const entry = tournament.entries.find(e => e.id === entryId);
            if (!entry) break;

            const lastEliminationSnapshot = { entry, timestamp: new Date().toISOString() };

            const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
            const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
            const flightForEntry = activeFlight && activeFlight.id === entry.flightId ? activeFlight : null;
            
            const isRegistrationOpen = tournament.rebuysAllowed && (
                isMultiFlightPhase
                    ? (flightForEntry ? !flightForEntry.lateRegistrationClosed : false)
                    : !tournament.lateRegistrationClosed
            );

            if (isRegistrationOpen) {
                let newLiveCoveragePosts = tournament.liveCoveragePosts;
                if (liveCoveragePost) {
                        const newPost: LiveCoveragePost = {
                        id: `post-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        level: tournament.currentLevel,
                        ...liveCoveragePost
                    };
                    newLiveCoveragePosts = [newPost, ...newLiveCoveragePosts];
                }
                tournament = {
                    ...tournament,
                    liveCoveragePosts: newLiveCoveragePosts,
                    entries: tournament.entries.map(e =>
                        e.id === entryId
                            ? { ...e, status: EntryStatus.RE_ENTRY_PENDING, table: null, seat: null, bustoutTimestamp: new Date().toISOString() }
                            : e
                    ),
                    lastEliminationSnapshot,
                };
            } else {
                let newLiveCoveragePosts = tournament.liveCoveragePosts;
                if (liveCoveragePost) {
                        const newPost: LiveCoveragePost = {
                        id: `post-${Date.now()}`,
                        timestamp: new Date().toISOString(),
                        level: tournament.currentLevel,
                        ...liveCoveragePost
                    };
                    newLiveCoveragePosts = [newPost, ...tournament.liveCoveragePosts];
                }

                const eliminatedCount = tournament.entries.filter(e => e.eliminationIndex !== null).length;
                const newEntries = tournament.entries.map(e => e.id === entryId
                    ? { ...e, status: EntryStatus.ELIMINATED, eliminationRank: null, eliminationIndex: eliminatedCount + 1, table: null, seat: null }
                    : e
                );
                
                let newTransactions = tournament.transactions;
                const payoutTx = createPayoutTransactionIfNeeded(tournament, entry, eliminatedCount);
                if (payoutTx) {
                    newTransactions = [...newTransactions, payoutTx];
                }

                tournament = checkAndCompleteTournament({ ...tournament, entries: newEntries, liveCoveragePosts: newLiveCoveragePosts, transactions: newTransactions });
                tournament.lastEliminationSnapshot = lastEliminationSnapshot;
            }
            break;
        }
        case 'ELIMINATE_PENDING_PLAYER': {
            const { entryId } = action.payload;
            const entryIndex = tournament.entries.findIndex(e => e.id === entryId && e.status === EntryStatus.RE_ENTRY_PENDING);
            if (entryIndex === -1) break;
            const entry = tournament.entries[entryIndex];

            const lastEliminationSnapshot = { entry, timestamp: new Date().toISOString() };

            const eliminatedCount = tournament.entries.filter(e => e.eliminationIndex !== null).length;
            const newEntries = tournament.entries.map(e => e.id === entryId
                ? { ...e, status: EntryStatus.ELIMINATED, eliminationRank: null, eliminationIndex: eliminatedCount + 1, table: null, seat: null }
                : e
            );
            
            let newTransactions = tournament.transactions;
            const payoutTx = createPayoutTransactionIfNeeded(tournament, entry, eliminatedCount);
            if (payoutTx) {
                newTransactions = [...newTransactions, payoutTx];
            }

            tournament = checkAndCompleteTournament({ ...tournament, entries: newEntries, transactions: newTransactions });
            tournament.lastEliminationSnapshot = lastEliminationSnapshot;
            break;
        }
        case 'REGISTER_PLAYER': {
            const { flightId, nickname, playerId, addDealerBonus, shouldPrintTicket } = action.payload;
            let existingPlayer = playerId ? players.find(p => p.id === playerId) : players.find(p => p.nickname.toLowerCase() === nickname?.toLowerCase());
            
            if (!existingPlayer && nickname) {
                const newId = `${Date.now()}`;
                existingPlayer = {
                    id: newId, nickname, firstName: '', lastName: '', email: '', phone: '',
                    gender: 'unspecified', notes: '', avatarUrl: `https://i.pravatar.cc/40?u=${newId}`
                };
                players = [...players, existingPlayer];
            }

            if (existingPlayer) {
                const { tournamentId } = action.payload;
                const newEntry: Entry = {
                    id: `e${Date.now()}`, playerId: existingPlayer.id, tournamentId, flightId,
                    status: EntryStatus.ACTIVE, chipCount: tournament.startingStack + (addDealerBonus ? tournament.dealerBonusChips : 0),
                    buyins: 1, addons: 0, dealerBonuses: addDealerBonus ? 1 : 0, table: null, seat: null, eliminationRank: null, eliminationIndex: null,
                    registeredAt: new Date().toISOString(), bustoutTimestamp: null,
                };

                const tempEntries = [...tournament.entries, newEntry];
                const { newEntries } = assignSeat(tempEntries, tournament.tables, tournament.blockedSeats, newEntry.id);
                
                let newTransactions: Transaction[] = [...tournament.transactions, {
                    id: `tx-buyin-${newEntry.id}`, type: 'buyin', entryId: newEntry.id, playerId: existingPlayer.id,
                    amount: tournament.buyin, timestamp: new Date().toISOString()
                }];
                
                if(addDealerBonus) {
                    newTransactions = [...newTransactions, {
                        id: `tx-dbonus-${newEntry.id}`, type: 'dealer_bonus', entryId: newEntry.id, playerId: existingPlayer.id,
                        amount: tournament.dealerBonusCost, timestamp: new Date().toISOString()
                    }];
                }
                
                tournament = { ...tournament, entries: newEntries, transactions: newTransactions };
                
                const finalEntryForPrint = tournament.entries.find(e => e.id === newEntry.id);
                if (shouldPrintTicket && finalEntryForPrint) {
                    entryToPrint = { entry: finalEntryForPrint, player: existingPlayer, tournament };
                }
            }
            break;
        }
        case 'UPDATE_CHIP_COUNT':
        case 'BULK_UPDATE_CHIP_COUNTS': {
            const updates = action.type === 'BULK_UPDATE_CHIP_COUNTS' ? action.payload.updates : [{ entryId: action.payload.entryId, newChipCount: action.payload.newChipCount }];
            const updatesMap = new Map(updates.map((u: any) => [u.entryId, u.newChipCount]));
            tournament = { ...tournament, entries: tournament.entries.map(e => updatesMap.has(e.id) ? { ...e, chipCount: updatesMap.get(e.id)! } : e) };
            break;
        }
        case 'PLAYER_REBUY': {
            const { entryId, addDealerBonus, shouldPrintTicket } = action.payload;
            const entryIndex = tournament.entries.findIndex(e => e.id === entryId);
            if (entryIndex === -1) break;

            const originalEntry = tournament.entries[entryIndex];

            const updatedEntry = {
                ...originalEntry,
                status: EntryStatus.ACTIVE,
                buyins: originalEntry.buyins + 1,
                chipCount: tournament.startingStack + (addDealerBonus ? tournament.dealerBonusChips : 0),
                dealerBonuses: originalEntry.dealerBonuses + (addDealerBonus ? 1 : 0),
                eliminationIndex: null,
                eliminationRank: null,
                bustoutTimestamp: null,
            };

            const tempEntries = tournament.entries.map(e => e.id === entryId ? updatedEntry : e);
            const { newEntries } = assignSeat(tempEntries, tournament.tables, tournament.blockedSeats, entryId);

            const newTxToAdd: Transaction[] = [{
                id: `tx-rebuy-${entryId}-${Date.now()}`, type: 'rebuy', entryId, playerId: originalEntry.playerId,
                amount: tournament.buyin, timestamp: new Date().toISOString()
            }];
            if(addDealerBonus) {
                newTxToAdd.push({
                    id: `tx-dbonus-${entryId}-${Date.now()}`, type: 'dealer_bonus', entryId, playerId: originalEntry.playerId,
                    amount: tournament.dealerBonusCost, timestamp: new Date().toISOString()
                });
            }

            tournament = { ...tournament, entries: newEntries, transactions: [...tournament.transactions, ...newTxToAdd] };
            
            const player = players.find(p => p.id === originalEntry.playerId);
            const finalEntryForPrint = tournament.entries.find(e => e.id === entryId);
            
            if (shouldPrintTicket && player && finalEntryForPrint) {
                entryToPrint = { entry: finalEntryForPrint, player, tournament };
            }
            break;
        }
        case 'PLAYER_ADDON': {
            const { entryId } = action.payload;
            const entryIndex = tournament.entries.findIndex(e => e.id === entryId);
            if (entryIndex === -1 || tournament.entries[entryIndex].addons > 0) break;
            
            const entry = tournament.entries[entryIndex];
            const newTransaction: Transaction = {
                id: `tx-addon-${entryId}`, type: 'addon', entryId, playerId: entry.playerId,
                amount: tournament.addonCost, timestamp: new Date().toISOString()
            };
            tournament = {
                ...tournament,
                entries: tournament.entries.map(e => e.id === entryId ? {
                    ...e,
                    addons: e.addons + 1,
                    chipCount: e.chipCount + tournament.addonChips,
                } : e),
                transactions: [...tournament.transactions, newTransaction]
            };
            break;
        }
        case 'SIMULTANEOUS_ELIMINATION': {
            const { entryIds } = action.payload;
            if(entryIds.length < 2) break;

            const entriesToEliminate = tournament.entries.filter(e => entryIds.includes(e.id));
            if (entriesToEliminate.length !== entryIds.length) break;

            const activeCount = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE).length;
            const ranksToSplit = Array.from({ length: entryIds.length }, (_, i) => activeCount - i);
            
            const totalPrizePool = (tournament.entries.reduce((s, e) => s + e.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((s, e) => s + e.addons, 0) * tournament.addonCost);
            const totalEntriesCount = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
            const allPayouts = tournament.payoutSettings.mode === 'manual' ? tournament.payoutSettings.manualPayouts : calculatePayouts(totalPrizePool, totalEntriesCount);

            const totalPayout = ranksToSplit.reduce((sum, rank) => sum + (allPayouts.find(p => p.rank === rank)?.amount || 0), 0);
            const splitPayout = totalPayout > 0 ? totalPayout / entryIds.length : 0;
            
            let eliminatedCount = tournament.entries.filter(e => e.eliminationIndex !== null).length;
            const entryIdsSet = new Set(entryIds);
            
            const newEntries = tournament.entries.map(e => {
                if (entryIdsSet.has(e.id)) {
                    eliminatedCount++;
                    return { ...e, status: EntryStatus.ELIMINATED, eliminationRank: null, eliminationIndex: eliminatedCount, table: null, seat: null };
                }
                return e;
            });
                
            let newTransactions = tournament.transactions;
            if (splitPayout > 0) {
                const newTxToAdd: Transaction[] = entriesToEliminate.map(entry => ({
                    id: `tx-payout-${entry.id}`, type: 'payout', entryId: entry.id, playerId: entry.playerId,
                    amount: -splitPayout, timestamp: new Date().toISOString()
                }));
                newTransactions = [...newTransactions, ...newTxToAdd];
            }
            tournament = checkAndCompleteTournament({ ...tournament, entries: newEntries, transactions: newTransactions });
            break;
        }
        case 'UNDO_LAST_ELIMINATION': {
            const { lastEliminationSnapshot } = tournament;
            if (!lastEliminationSnapshot) break;

            const snapshotEntry = lastEliminationSnapshot.entry;

            const newEntries = tournament.entries.map(e =>
                e.id === snapshotEntry.id ? snapshotEntry : e
            );

            const newTransactions = tournament.transactions.filter(
                tx => !(tx.type === 'payout' && tx.entryId === snapshotEntry.id)
            );

            let newStatus = tournament.status;
            const activePlayersAfterUndo = newEntries.filter(e => e.status === EntryStatus.ACTIVE).length;
            if (tournament.status === TournamentStatus.COMPLETED && activePlayersAfterUndo > 1) {
                newStatus = TournamentStatus.RUNNING;
            }

            tournament = {
                ...tournament,
                entries: newEntries,
                transactions: newTransactions,
                status: newStatus,
                lastEliminationSnapshot: null,
            };
            break;
        }
        case 'MOVE_PLAYER': {
            const { sourceEntryId, targetTable, targetSeat } = action.payload;
            const newEntries = tournament.entries.map(e =>
                e.id === sourceEntryId
                ? { ...e, table: targetTable, seat: targetSeat }
                : e
            );
            tournament = { ...tournament, entries: newEntries };
            
            const movedEntry = newEntries.find(e => e.id === sourceEntryId);
            const player = players.find(p => p.id === movedEntry?.playerId);

            if (movedEntry && player) {
                entryToPrint = { entry: movedEntry, player, tournament };
            }
            break;
        }
        case 'ASSIGN_SEAT': {
            const { entryId } = action.payload;
            const { newEntries } = assignSeat(tournament.entries, tournament.tables, tournament.blockedSeats, entryId);
            tournament = { ...tournament, entries: newEntries };
            break;
        }
        case 'BREAK_TABLE': {
            const { tableId, assignments, shouldPrintSlips } = action.payload;
            const assignmentMap = new Map(assignments.map(a => [a.entryId, { newTable: a.newTable, newSeat: a.newSeat }]));
            
            const newEntries = tournament.entries.map(entry => {
                if (assignmentMap.has(entry.id)) {
                    const { newTable, newSeat } = assignmentMap.get(entry.id)!;
                    return { ...entry, table: newTable, seat: newSeat };
                }
                return entry;
            });
            
            const newTables = tournament.tables.filter(t => t.id !== tableId);
            
            tournament = { ...tournament, entries: newEntries, tables: newTables };

            if (shouldPrintSlips) {
                const slips: MoveSlip[] = assignments.map(a => {
                    const entry = tournament.entries.find(e => e.id === a.entryId)!;
                    const player = players.find(p => p.id === entry.playerId)!;
                    return {
                        player,
                        newTable: a.newTable,
                        newSeat: a.newSeat,
                    };
                });
                moveSlipsToPrint = { slips, tournamentName: tournament.name };
            }
            break;
        }
        default: break;
    }
    return { updatedTournament: tournament, updatedPlayers: players, entryToPrint, moveSlipsToPrint };
};

const tournamentReducer = (originalTournament: Tournament, action: Action): Tournament => {
    let tournament = { ...originalTournament };

    switch(action.type) {
        case 'SET_SCHEDULED_START_TIME': {
            const { time } = action.payload;
            tournament = { ...tournament, scheduledStartTime: time };
            break;
        }
        case 'TOGGLE_CLOCK': {
            const { running } = action.payload;
            const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
            const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
            const clockSource = activeFlight || tournament;
            const targetFlightIndex = activeFlight ? tournament.flights.findIndex(f => f.id === activeFlight.id) : -1;

            const scheduledTimeMs = tournament.scheduledStartTime ? new Date(tournament.scheduledStartTime).getTime() : 0;
            const shouldUseScheduledTime = running && tournament.status === TournamentStatus.SCHEDULED && scheduledTimeMs > 0 && scheduledTimeMs <= Date.now();
            const newStartTime = shouldUseScheduledTime ? scheduledTimeMs : Date.now();

            let updatedTournament = { ...tournament, status: running ? TournamentStatus.RUNNING : TournamentStatus.PAUSED, scheduledStartTime: null };

            if (running) {
                if (targetFlightIndex !== -1) {
                    updatedTournament.flights[targetFlightIndex].lastClockStartTime = newStartTime;
                } else {
                    updatedTournament.lastClockStartTime = newStartTime;
                }
            } else {
                let newTimeRemaining = clockSource.clockTimeRemaining;
                if (clockSource.lastClockStartTime) {
                    const elapsed = Math.floor((Date.now() - clockSource.lastClockStartTime) / 1000);
                    newTimeRemaining = Math.max(0, clockSource.clockTimeRemaining - elapsed);
                }
                if (targetFlightIndex !== -1) {
                    updatedTournament.flights[targetFlightIndex].lastClockStartTime = null;
                    updatedTournament.flights[targetFlightIndex].clockTimeRemaining = newTimeRemaining;
                } else {
                    updatedTournament.lastClockStartTime = null;
                    updatedTournament.clockTimeRemaining = newTimeRemaining;
                }
            }
            tournament = updatedTournament;
            break;
        }
        case 'NEXT_LEVEL': {
            const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
            const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
            const clockSource = activeFlight || tournament;
            const levelIndex = clockSource.currentLevel - 1;

            if (levelIndex < 0 || levelIndex >= tournament.levels.length) break;
            const expiredLevel = tournament.levels[levelIndex];

            let newLevelIndex = levelIndex + 1;
            if (newLevelIndex >= tournament.levels.length) break;

            const newLevel = tournament.levels[newLevelIndex];
            const targetFlightIndex = activeFlight ? tournament.flights.findIndex(f => f.id === activeFlight.id) : -1;
            
            const newLastClockStartTime = clockSource.lastClockStartTime
                ? clockSource.lastClockStartTime + (expiredLevel.duration * 60 * 1000)
                : Date.now();

            if (targetFlightIndex !== -1) {
                tournament.flights[targetFlightIndex] = {
                    ...tournament.flights[targetFlightIndex],
                    currentLevel: newLevel.level,
                    clockTimeRemaining: newLevel.duration * 60,
                    lastClockStartTime: newLastClockStartTime,
                };
            } else {
                tournament = {
                    ...tournament,
                    currentLevel: newLevel.level,
                    clockTimeRemaining: newLevel.duration * 60,
                    lastClockStartTime: newLastClockStartTime,
                };
            }
            break;
        }
        case 'PREVIOUS_LEVEL': {
            const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
            const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
            const clockSource = activeFlight || tournament;
            const levelIndex = clockSource.currentLevel - 1;
            
            let newLevelIndex = levelIndex - 1;
            if (newLevelIndex < 0) break;

            const newLevel = tournament.levels[newLevelIndex];
            const targetFlightIndex = activeFlight ? tournament.flights.findIndex(f => f.id === activeFlight.id) : -1;
            
            if (targetFlightIndex !== -1) {
                tournament.flights[targetFlightIndex] = {
                    ...tournament.flights[targetFlightIndex],
                    currentLevel: newLevel.level,
                    clockTimeRemaining: newLevel.duration * 60,
                    lastClockStartTime: Date.now(),
                };
            } else {
                tournament = {
                    ...tournament,
                    currentLevel: newLevel.level,
                    clockTimeRemaining: newLevel.duration * 60,
                    lastClockStartTime: Date.now(),
                };
            }
            break;
        }
        case 'CLOSE_LATE_REGISTRATION': {
            const { flightId } = action.payload;
            let newEntries = [...tournament.entries];

            const pendingPlayersToEliminate = flightId 
                ? newEntries.filter(e => e.status === EntryStatus.RE_ENTRY_PENDING && e.flightId === flightId)
                : newEntries.filter(e => e.status === EntryStatus.RE_ENTRY_PENDING);

            if (pendingPlayersToEliminate.length > 0) {
                pendingPlayersToEliminate.sort((a, b) => new Date(a.bustoutTimestamp!).getTime() - new Date(b.bustoutTimestamp!).getTime());
                let currentEliminatedCount = newEntries.filter(e => e.eliminationIndex !== null).length;
                
                pendingPlayersToEliminate.forEach(pendingPlayer => {
                    const indexInArray = newEntries.findIndex(e => e.id === pendingPlayer.id);
                    if (indexInArray !== -1) {
                        currentEliminatedCount++;
                        newEntries[indexInArray] = {
                            ...newEntries[indexInArray],
                            status: EntryStatus.ELIMINATED,
                            eliminationIndex: currentEliminatedCount,
                            eliminationRank: null,
                        };
                    }
                });
            }
            
            tournament.entries = newEntries;

            if (flightId) {
                const flightIndex = tournament.flights.findIndex(f => f.id === flightId);
                if (flightIndex > -1) tournament.flights[flightIndex].lateRegistrationClosed = true;
            } else {
                tournament.lateRegistrationClosed = true;
                
                const finalTotalEntries = newEntries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
                const totalPrizePool = (newEntries.reduce((s, e) => s + e.buyins, 0) * tournament.buyin) + (newEntries.reduce((s, e) => s + e.addons, 0) * tournament.addonCost);
                const payouts = tournament.payoutSettings.mode === 'manual' ? tournament.payoutSettings.manualPayouts : calculatePayouts(totalPrizePool, finalTotalEntries);
                
                const newTransactions: Transaction[] = [];
                newEntries.forEach(entry => {
                    if (entry.status === EntryStatus.ELIMINATED && entry.eliminationIndex !== null) {
                        const existingTx = tournament.transactions.find(tx => tx.entryId === entry.id && tx.type === 'payout');
                        if (existingTx) return;

                        const finalRank = finalTotalEntries - entry.eliminationIndex + 1;
                        const payout = payouts.find(p => p.rank === finalRank);

                        if (payout && payout.amount > 0) {
                            newTransactions.push({
                                id: `tx-payout-${entry.id}`, type: 'payout', entryId: entry.id, playerId: entry.playerId,
                                amount: -payout.amount, timestamp: new Date().toISOString()
                            });
                        }
                    }
                });
                 tournament.transactions = [...tournament.transactions, ...newTransactions];
            }
            break;
        }
        case 'REBALANCE_TABLES': {
            let activeEntries = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE);
            let tables = tournament.tables;
            if(tables.length === 0) break;

            const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0);
            const blockedSeatsCount = tournament.blockedSeats.length;
            if(activeEntries.length > totalSeats - blockedSeatsCount) {
                alert("Pas assez de sièges pour rééquilibrer les tables. Ajoutez des tables ou débloquez des sièges.");
                break;
            }
            
            let updatedEntries = tournament.entries.map(e => e.status === EntryStatus.ACTIVE ? { ...e, table: null, seat: null } : e);
            
            activeEntries.sort((a,b) => b.chipCount - a.chipCount);
            
            for (const entry of activeEntries) {
                const result = assignSeat(updatedEntries, tables, tournament.blockedSeats, entry.id);
                updatedEntries = result.newEntries;
            }
            tournament = { ...tournament, entries: updatedEntries };
            break;
        }
        case 'BLOCK_SEAT': {
            const { table, seat } = action.payload;
            if (!tournament.blockedSeats.some(s => s.table === table && s.seat === seat)) {
                tournament = { ...tournament, blockedSeats: [...tournament.blockedSeats, { table, seat }]};
            }
            break;
        }
        case 'UNBLOCK_SEAT': {
                const { table, seat } = action.payload;
                tournament = { ...tournament, blockedSeats: tournament.blockedSeats.filter(s => s.table !== table || s.seat !== seat) };
                break;
        }
        case 'ADD_TABLE': {
            const { tableData } = action.payload;
            const newId = tournament.tables.length > 0 ? Math.max(...tournament.tables.map(t => t.id)) + 1 : 1;
            const newTable: PokerTable = { 
                id: newId, 
                name: tableData.name || `Table ${newId}`, 
                room: tableData.room || '', 
                seats: tableData.seats || 9,
                dealerId: null,
                dealerAssignmentTimestamp: null,
            };
            tournament = { ...tournament, tables: [...tournament.tables, newTable] };
            break;
            }
        case 'UPDATE_TABLE': {
                const { tableData } = action.payload;
                tournament = { ...tournament, tables: tournament.tables.map(t => t.id === tableData.id ? tableData : t) };
                break;
        }
        case 'DELETE_TABLE': {
            const { tableId } = action.payload;
            tournament = {
                ...tournament,
                tables: tournament.tables.filter(t => t.id !== tableId),
                entries: tournament.entries.map(e => e.table === tableId ? { ...e, table: null, seat: null } : e)
            };
            break;
        }
        case 'ASSIGN_DEALER_TO_TABLE': {
            const { tableId, dealerId } = action.payload;
            const now = Date.now();
            tournament.tables = tournament.tables.map(t => t.id === tableId ? { ...t, dealerId, dealerAssignmentTimestamp: now } : t);
            tournament.dealerShifts = tournament.dealerShifts.map(ds => ds.dealerId === dealerId ? { ...ds, lastTableAssignmentTime: now } : ds);
            break;
        }
        case 'PERFORM_DEALER_ROTATION': {
            const { assignments } = action.payload;
            const now = Date.now();
            const newTables = [...tournament.tables];
            const newDealerShifts = [...tournament.dealerShifts];
        
            assignments.forEach(({ tableId, dealerId }) => {
                const tableIndex = newTables.findIndex(t => t.id === tableId);
                if (tableIndex !== -1) {
                    newTables[tableIndex].dealerId = dealerId;
                    newTables[tableIndex].dealerAssignmentTimestamp = now;
                }
                if (dealerId) {
                    const shiftIndex = newDealerShifts.findIndex(ds => ds.dealerId === dealerId);
                    if (shiftIndex !== -1) {
                        newDealerShifts[shiftIndex].lastTableAssignmentTime = now;
                    }
                }
            });
        
            tournament = { ...tournament, tables: newTables, dealerShifts: newDealerShifts };
            break;
        }
        case 'ASSIGN_DEALER_TO_TOURNAMENT': {
            const { dealerId } = action.payload;
            if (tournament.dealerShifts.some(ds => ds.dealerId === dealerId && ds.status !== 'off_duty')) break;
            const newShift: DealerShift = { dealerId, status: 'assigned', shiftStartTime: null, shiftEndTime: null, breakStartTime: null, lastTableAssignmentTime: null };
            tournament.dealerShifts = [...tournament.dealerShifts, newShift];
            break;
        }
        case 'UNASSIGN_DEALER': {
            tournament.dealerShifts = tournament.dealerShifts.filter(ds => !(ds.dealerId === action.payload.dealerId && ds.status === 'assigned'));
            break;
        }
        case 'START_DEALER_SERVICE': {
            tournament.dealerShifts = tournament.dealerShifts.map(ds => (ds.dealerId === action.payload.dealerId && ds.status === 'assigned') ? { ...ds, status: 'working', shiftStartTime: Date.now() } : ds);
            break;
        }
        case 'START_ALL_ASSIGNED_DEALERS_SERVICE': {
            const now = Date.now();
            tournament.dealerShifts = tournament.dealerShifts.map(ds => ds.status === 'assigned' ? { ...ds, status: 'working', shiftStartTime: now } : ds);
            break;
        }
        case 'END_DEALER_SHIFT': {
            const now = Date.now();
            tournament.dealerShifts = tournament.dealerShifts.map(ds => ds.dealerId === action.payload.dealerId && ds.status !== 'off_duty' ? { ...ds, shiftEndTime: now, status: 'off_duty' } : ds);
            tournament.tables = tournament.tables.map(t => t.dealerId === action.payload.dealerId ? { ...t, dealerId: null, dealerAssignmentTimestamp: null } : t);
            break;
        }
        case 'TOGGLE_DEALER_BREAK': {
            const now = Date.now();
            tournament.dealerShifts = tournament.dealerShifts.map(ds => {
                if (ds.dealerId === action.payload.dealerId) {
                    if (ds.status === 'working') return { ...ds, status: 'on_break', breakStartTime: now };
                    if (ds.status === 'on_break') return { ...ds, status: 'working', breakStartTime: null };
                }
                return ds;
            });
            break;
        }
        case 'GENERATE_DEALER_SCHEDULE': tournament.dealerSchedule = action.payload.schedule; break;
        case 'UPDATE_FLIGHT_STATUS': {
            const { flightId, status } = action.payload;
            if (status === FlightStatus.COMPLETED) {
                tournament.entries = tournament.entries.map(e => (e.flightId === flightId && e.status === EntryStatus.ACTIVE) ? { ...e, status: EntryStatus.QUALIFIED_DAY2, table: null, seat: null } : e);
            }
            tournament.flights = tournament.flights.map(f => {
                if (f.id === flightId) return { ...f, status };
                if (status === FlightStatus.RUNNING && f.status === FlightStatus.RUNNING) return { ...f, status: FlightStatus.SCHEDULED };
                return f;
            });
            break;
        }
        case 'PERFORM_MERGE': {
            if (tournament.type !== TournamentType.MULTI_FLIGHT || tournament.phase !== TournamentPhase.FLIGHTS) break;
            
            const snapshot = { ...tournament };
            const qualifiedEntries = tournament.entries.filter(e => e.status === EntryStatus.QUALIFIED_DAY2);
            
            const playerEntriesMap = new Map<string, Entry[]>();
            qualifiedEntries.forEach(entry => {
                if (!playerEntriesMap.has(entry.playerId)) playerEntriesMap.set(entry.playerId, []);
                playerEntriesMap.get(entry.playerId)!.push(entry);
            });

            const bestStackEntryIds = new Set<string>();
            playerEntriesMap.forEach((entries) => {
                if (entries.length > 0) {
                    const bestStack = entries.reduce((best, current) => current.chipCount > best.chipCount ? current : best);
                    bestStackEntryIds.add(bestStack.id);
                }
            });

            const newEntries = tournament.entries.map(e => {
                if (bestStackEntryIds.has(e.id)) return { ...e, status: EntryStatus.ACTIVE };
                if (e.status === EntryStatus.QUALIFIED_DAY2 && !bestStackEntryIds.has(e.id)) return { ...e, status: EntryStatus.MERGE_DISCARDED, table: null, seat: null };
                return e;
            });
            
            let rebalancedEntries = newEntries.map(e => e.status === EntryStatus.ACTIVE ? {...e, table: null, seat: null} : e);
            newEntries.filter(e => e.status === EntryStatus.ACTIVE).forEach(entry => {
                const result = assignSeat(rebalancedEntries, tournament.tables, tournament.blockedSeats, entry.id);
                rebalancedEntries = result.newEntries;
            });

            tournament = { ...tournament, phase: TournamentPhase.DAY2, status: TournamentStatus.PAUSED, lastClockStartTime: null, entries: rebalancedEntries, preMergeStateSnapshot: snapshot };
            break;
        }
        case 'UNDO_MERGE': if (tournament.preMergeStateSnapshot) tournament = tournament.preMergeStateSnapshot; break;
        case 'GENERATE_DAY2_SEAT_DRAW': {
            if (tournament.type !== TournamentType.MULTI_FLIGHT || tournament.phase !== TournamentPhase.DAY2) break;
            tournament.preDay2DrawStateSnapshot = [...tournament.entries];
            let activeEntries = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE).sort((a, b) => b.chipCount - a.chipCount);
            
            if (tournament.tables.length === 0) { alert("Cannot generate seat draw: No tables configured."); break; }

            const updatedEntries = tournament.entries.map(e => e.status === EntryStatus.ACTIVE ? { ...e, table: null, seat: null } : e);

            let tableIdx = 0, direction = 1;
            for (const entry of activeEntries) {
                const entryToUpdate = updatedEntries.find(e => e.id === entry.id);
                if (entryToUpdate) entryToUpdate.table = tournament.tables[tableIdx].id;
                tableIdx += direction;
                if (tableIdx < 0 || tableIdx >= tournament.tables.length) { direction *= -1; tableIdx += direction; }
            }

            for (const table of tournament.tables) {
                const playersOnTable = updatedEntries.filter(e => e.table === table.id);
                const blocked = tournament.blockedSeats.filter(s => s.table === table.id).map(s => s.seat);
                let availableSeats = Array.from({ length: table.seats }, (_, i) => i + 1).filter(s => !blocked.includes(s));
                
                if (playersOnTable.length > availableSeats.length) {
                    alert(`Error on Table ${table.id}: Not enough seats.`);
                    return tournament.preDay2DrawStateSnapshot ? { ...tournament, entries: tournament.preDay2DrawStateSnapshot, preDay2DrawStateSnapshot: null } : tournament;
                }

                availableSeats.sort(() => Math.random() - 0.5);
                playersOnTable.forEach((p, i) => p.seat = availableSeats[i]);
            }
            tournament.entries = updatedEntries;
            break;
        }
        case 'UNDO_DAY2_SEAT_DRAW': if (tournament.preDay2DrawStateSnapshot) tournament = { ...tournament, entries: tournament.preDay2DrawStateSnapshot, preDay2DrawStateSnapshot: null }; break;
        case 'UPDATE_LEVEL_STRUCTURE': tournament.levels = action.payload.newLevels; break;
        case 'UPDATE_PAYOUT_SETTINGS': tournament.payoutSettings = action.payload.settings; break;
        case 'UPDATE_DISPLAY_SETTINGS': tournament.displaySettings = action.payload.settings; break;
        case 'ADD_ANNOUNCEMENT': {
            const newAnnouncement: Announcement = { id: `ann-${Date.now()}`, text: action.payload.text, createdAt: new Date().toISOString() };
            tournament.announcements = [...tournament.announcements, newAnnouncement];
            break;
        }
        case 'REMOVE_ANNOUNCEMENT': tournament.announcements = tournament.announcements.filter(a => a.id !== action.payload.announcementId); break;
        case 'FINALIZE_DEAL': tournament.dealMadePayouts = action.payload.payouts; break;
        case 'ADD_LIVE_COVERAGE_POST': {
            const newPost: LiveCoveragePost = { id: `post-${Date.now()}`, timestamp: new Date().toISOString(), content: action.payload.content, imageUrl: action.payload.imageUrl, author: action.payload.author, level: tournament.currentLevel };
            tournament.liveCoveragePosts = [newPost, ...tournament.liveCoveragePosts];
            break;
        }
        case 'DELETE_LIVE_COVERAGE_POST': tournament.liveCoveragePosts = tournament.liveCoveragePosts.filter(p => p.id !== action.payload.postId); break;
        case 'ADD_AI_SUGGESTION': {
            const newSuggestion: LiveCoverageSuggestion = { id: `sugg-${Date.now()}`, timestamp: new Date().toISOString(), status: 'pending', ...action.payload.suggestion };
            tournament.liveCoverageSuggestions = [newSuggestion, ...tournament.liveCoverageSuggestions];
            break;
        }
        case 'UPDATE_AI_SUGGESTION_STATUS': {
            const { suggestionId, status, updatedContent } = action.payload;
            const suggestion = tournament.liveCoverageSuggestions.find(s => s.id === suggestionId);
            if (suggestion && status === 'approved') {
                const newPost: LiveCoveragePost = { id: `post-${Date.now()}`, timestamp: new Date().toISOString(), content: updatedContent || suggestion.content, imageUrl: suggestion.imageUrl, author: 'ai', level: tournament.currentLevel };
                tournament.liveCoveragePosts = [newPost, ...tournament.liveCoveragePosts];
                tournament.liveCoverageSuggestions = tournament.liveCoverageSuggestions.map(s => s.id === suggestionId ? { ...s, status: 'approved' } : s);
            } else {
                tournament.liveCoverageSuggestions = tournament.liveCoverageSuggestions.map(s => s.id === suggestionId ? { ...s, status: status } : s);
            }
            break;
        }
        case 'CLEAR_DISPLAY_ALERT': if (tournament.displayAlert && tournament.displayAlert.id === action.payload.alertId) tournament.displayAlert = null; break;
        case 'SET_AI_GENERATING': tournament.liveCoverageSettings.isGenerating = action.payload.isGenerating; break;
        case 'ASSIGN_TOURNAMENT_SEASON': tournament.seasonId = action.payload.seasonId; break;
        default: break;
    }

    return tournament;
};

const PLAYER_ACTION_TYPES = new Set<string>([
    'SET_RE_ENTRY_PENDING', 'ELIMINATE_PLAYER', 'ELIMINATE_PENDING_PLAYER',
    'REGISTER_PLAYER', 'UPDATE_CHIP_COUNT', 'BULK_UPDATE_CHIP_COUNTS',
    'PLAYER_REBUY', 'PLAYER_ADDON', 'SIMULTANEOUS_ELIMINATION',
    'UNDO_LAST_ELIMINATION', 'MOVE_PLAYER', 'ASSIGN_SEAT', 'BREAK_TABLE'
]);

const UI_ACTION_TYPES = new Set<string>([
    'SET_ENTRY_TO_PRINT', 'CLEAR_ENTRY_TO_PRINT', 'SET_TABLE_TO_PRINT', 
    'CLEAR_TABLE_TO_PRINT', 'SET_PLAYER_LIST_TO_PRINT', 'CLEAR_PLAYER_LIST_TO_PRINT', 
    'SET_SEAT_DRAW_TO_PRINT', 'CLEAR_SEAT_DRAW_TO_PRINT', 'SET_PAYOUT_TO_PRINT', 
    'CLEAR_PAYOUT_TO_PRINT', 'SET_FINANCE_REPORT_TO_PRINT', 'CLEAR_FINANCE_REPORT_TO_PRINT',
    'SET_MOVE_SLIPS_TO_PRINT', 'CLEAR_MOVE_SLIPS_TO_PRINT'
]);