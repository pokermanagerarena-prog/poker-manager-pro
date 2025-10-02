export interface Player {
  id: string;
  nickname: string; // The display name for tournaments, formerly 'name'
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | 'unspecified';
  notes: string; // Private notes for director
  avatarUrl: string;
  // NEW FIELDS FOR AI KNOWLEDGE
  styleOfPlay?: string; // e.g., "TAG (Tight-Aggressive)", "Bluffer", "Calling Station"
  achievements?: string; // e.g., "Winner of 2023 Main Event", "3 final tables this season"
  publicNotes?: string; // Anecdotes or fun facts for public commentary
  hendonMobUrl?: string; // URL to the player's Hendon Mob profile
}

export interface Dealer {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  notes: string;
}

export enum EntryStatus {
  ACTIVE = "Active",
  ELIMINATED = "Eliminated",
  QUALIFIED_DAY2 = "Qualified for Day 2",
  MERGE_DISCARDED = "Merge Discarded", // For multi-stack players where only the best stack is kept
  RE_ENTRY_PENDING = "Re-entry Pending",
}

export interface Entry {
  id: string;
  playerId: string;
  tournamentId: string;
  flightId: string;
  status: EntryStatus;
  chipCount: number;
  buyins: number; // Includes initial buy-in and rebuys
  addons: number;
  dealerBonuses: number;
  table: number | null; // Corresponds to PokerTable id
  seat: number | null;
  eliminationIndex: number | null;
  eliminationRank: number | null;
  registeredAt: string; // ISO string, for waiting list priority
  bustoutTimestamp: string | null;
}

export interface Level {
  level: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  duration: number; // in minutes
  isBreak: boolean;
  phase?: 'DAY1' | 'DAY2' | 'FINAL';
}

export interface BlindStructureTemplate {
  id: string;
  name: string;
  levels: Level[];
}

export enum FlightStatus {
    SCHEDULED = "Scheduled",
    RUNNING = "Running",
    COMPLETED = "Completed",
}

export interface Flight {
  id: string;
  name: string; // e.g., "Day 1A"
  startDate: string; // ISO string
  status: FlightStatus;
  // --- Flight-specific clock state ---
  currentLevel: number;
  clockTimeRemaining: number; // in seconds
  lastClockStartTime: number | null; // timestamp
  lateRegistrationClosed: boolean;
}

export enum TournamentType {
    STANDARD = "Standard",
    MULTI_FLIGHT = "Multi-Flight",
}

export enum TournamentPhase {
    FLIGHTS = "Flights",
    DAY2 = "Day 2",
    FINAL = "Final",
    COMPLETE = "Complete",
}

export enum TournamentStatus {
    SCHEDULED = "Scheduled",
    RUNNING = "Running",
    PAUSED = "Paused",
    COMPLETED = "Completed"
}

export interface PokerTable {
  id: number;
  name: string;
  room: string;
  seats: number;
  dealerId: string | null;
  dealerAssignmentTimestamp: number | null;
}

export interface Payout {
  rank: number;
  amount: number;
  description?: string;
}

export interface Announcement {
  id: string;
  text: string;
  createdAt: string; // ISO string
}

export interface Sponsor {
    id: string;
    name: string;
    imageUrl: string; // Base64
    duration: number; // in seconds
}

export enum WidgetType {
    CLOCK = "Horloge",
    BLINDS = "Blinds",
    STATS = "Statistiques",
    PAYOUTS = "Payouts",
    CHIP_LEADERS = "Chip Leaders",
    TEXT = "Texte Personnalisé",
    IMAGE = "Image",
    SPONSORS = "Bannière Sponsors",
    LOGO_PPMC = "Logo PPMC",
}

export interface WidgetConfig {
    id: string;
    type: WidgetType;
    isHidden?: boolean;
    // --- Style Properties ---
    textAlign?: 'left' | 'center' | 'right';
    justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between';
    alignItems?: 'flex-start' | 'center' | 'flex-end';
    flexDirection?: 'row' | 'column';
    fontSize?: string; // e.g., '2rem', '16px'
    fontWeight?: '300' | '400' | '500' | '600' | '700' | '800';
    color?: string;
    // --- Widget Specific ---
    // For TEXT widget
    content?: string; 
    // For IMAGE widget
    imageUrl?: string; // Base64
    // For STATS widget
    statType?: 'players_remaining' | 'players_total' | 'avg_stack' | 'avg_stack_bb' | 'prizepool' | 'chip_leader_stack' | 'chip_leader_name';
    label?: string; // Custom label for STATS widget
    // For CHIP_LEADERS widget
    leaderCount?: number;
    // For PAYOUTS widget
    payoutCount?: number;
}

export interface GridCell {
    id: string;
    col: string; // e.g., '1 / 3'
    row: string; // e.g., '2 / 4'
    widgetId: string | null;
}

export interface TickerSettings {
    enabled: boolean;
    content: 'players' | 'payouts' | 'announcements';
    speed: 'slow' | 'normal' | 'fast';
}

export interface DisplaySettings {
    gridTemplateColumns: string;
    gridTemplateRows: string;
    gap: number;
    backgroundColor: string;
    backgroundImage: string | null;
    cells: GridCell[];
    widgets: WidgetConfig[];
    sponsors: Sponsor[];
    topTicker: TickerSettings;
    bottomTicker: TickerSettings;
    dynamicBackgroundColorEnabled?: boolean;
}


export interface Season {
    id: string;
    name: string;
    startDate: string; // ISO string
    endDate: string; // ISO string
}

export interface PlayerRanking {
    rank: number;
    player: Player;
    points: number;
    tournamentsPlayed: number;
    wins: number;
}

export interface Transaction {
    id:string;
    type: 'buyin' | 'rebuy' | 'addon' | 'payout' | 'dealer_bonus';
    entryId: string;
    playerId: string;
    amount: number; // positive for income, negative for payout
    timestamp: string; // ISO string
}

export interface LiveCoveragePost {
  id: string;
  timestamp: string; // ISO string
  content: string;
  imageUrl?: string | null; // Base64 string
  level: number;
  author: 'director' | 'ai';
}

export interface LiveCoverageSuggestion {
  id: string;
  timestamp: string; // ISO string
  content: string;
  imageUrl?: string | null;
  triggerEvent: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Data structure for transient elimination details, passed to the AI agent
export interface EliminationDetails {
    eliminatorId?: string;
    eliminatorCards?: string;
    eliminatedPlayerCards?: string; // Only for single eliminations
    boardCards?: string;
    street?: 'pre-flop' | 'flop' | 'turn' | 'river';
}

// FIX: Added missing DealerShift type to support dealer rotation logic.
export interface DealerShift {
  dealerId: string;
  status: 'assigned' | 'working' | 'on_break' | 'off_duty';
  shiftStartTime: number | null;
  shiftEndTime: number | null;
  breakStartTime: number | null;
  lastTableAssignmentTime: number | null;
}


export interface Commission {
  id: string;
  name: string;
  amount: number;
}

export type DealerSchedule = Record<string, Record<string, string | null>>;

export interface AiKnowledgeBase {
    sponsors: string;
    lastMinuteInfo: string;
    buffetMenu: string;
    anecdotes: string;
}

export interface Tournament {
  id: string;
  name: string;
  location: string;
  status: TournamentStatus;
  startDate: string; // ISO string for the very first flight/day
  scheduledStartTime?: string | null;
  buyin: number;
  startingStack: number;
  rebuysAllowed: boolean;
  addonCost: number;
  addonChips: number;
  dealerBonusCost: number;
  dealerBonusChips: number;
  buyinCommissions: Commission[];
  addonCommissions: Commission[];
  entries: Entry[];
  levels: Level[];
  tables: PokerTable[];
  dealerShifts: DealerShift[];
  dealerSchedule: DealerSchedule | null;
  currentLevel: number; // Main clock for Day 2 / Standard tournaments
  clockTimeRemaining: number; // in seconds
  lastClockStartTime: number | null; // timestamp
  blockedSeats: { table: number; seat: number; }[];
  payoutSettings: {
    mode: 'auto' | 'manual';
    manualPayouts: Payout[];
  };
  dealMadePayouts?: { playerId: string; amount: number }[];
  displaySettings: DisplaySettings;
  announcements: Announcement[];
  transactions: Transaction[];
  displayAlert: {
      id: string;
      message: string;
      duration: number; // in seconds
  } | null;
  isArchived?: boolean;
  liveCoveragePosts: LiveCoveragePost[];
  liveCoverageSuggestions: LiveCoverageSuggestion[];
  liveCoverageSettings: {
      autopilotEnabled: boolean;
      systemInstruction: string;
      isGenerating: boolean;
  };
  aiKnowledgeBase: AiKnowledgeBase;
  lateRegistrationClosed: boolean;
  
  // --- Multi-Flight Specific ---
  type: TournamentType;
  phase: TournamentPhase;
  flights: Flight[];
  mergePolicy?: 'best_stack_per_player';
  day2Settings?: {
    qualifiedPlayerCount: 'all';
    flightQualificationPercentage?: number; // e.g. 20 for 20%
  };
  preMergeStateSnapshot: Tournament | null;
  preDay2DrawStateSnapshot: Entry[] | null;
  seasonId?: string | null;
  lastEliminationSnapshot?: { entry: Entry; timestamp: string } | null;
}

export interface DisplayTemplate {
    id: string;
    name: string;
    settings: DisplaySettings;
}

export interface TournamentTemplate {
  id: string;
  name: string;
  tournamentType: TournamentType;
  buyin: string;
  startingStack: string;
  rebuysAllowed: boolean;
  addonCost: string;
  addonChips: string;
  dealerBonusCost: string;
  dealerBonusChips: string;
  flightQualificationPercentage: string;
  buyinCommissions: Commission[];
  addonCommissions: Commission[];
  blindTemplateId: string;
}

export interface MoveSlip {
  player: Player;
  newTable: number;
  newSeat: number;
}

export interface PokerCard {
    rank: string;
    suit: string;
}

export const SUITS = [
  { symbol: '♠', name: 's', color: 'text-gray-200' },
  { symbol: '♥', name: 'h', color: 'text-red-400' },
  { symbol: '♦', name: 'd', color: 'text-red-400' },
  { symbol: '♣', name: 'c', color: 'text-gray-200' },
];
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export interface DeckCard extends PokerCard {
    symbol: string;
    color: string;
}

export const FULL_DECK: DeckCard[] = SUITS.flatMap(suit => 
  RANKS.map(rank => ({ rank, suit: suit.name, symbol: suit.symbol, color: suit.color }))
);

// --- CASH GAME TYPES ---
export interface CashGameTable {
  id: string;
  name: string;
  variant: 'Texas' | 'Omaha';
  blinds: string;
  seats: number;
  waitingList: string[]; // array of playerIds
}

export interface CashGameSession {
  id: string;
  playerId: string;
  tableId: string;
  seat: number;
  startTime: string; // ISO string
  endTime: string | null; // ISO string
  pauses: {
    start: string; // ISO string
    end: string | null; // ISO string
  }[];
}


export interface AppState {
  version: number;
  tournaments: Tournament[];
  players: Player[];
  dealers: Dealer[];
  blindStructureTemplates: BlindStructureTemplate[];
  displayTemplates: DisplayTemplate[];
  seasons: Season[];
  tournamentTemplates: TournamentTemplate[];
  cashGameTables: CashGameTable[];
  cashGameSessions: CashGameSession[];
  entryToPrint: { entry: Entry; player: Player; tournament: Tournament } | null;
  tableToPrint: { table: PokerTable; entries: (Entry & { player: Player })[]; tournamentName: string } | null;
  playerListToPrint: { tournament: Tournament; players: (Entry & { player: Player })[] } | null;
  seatDrawToPrint: { tournament: Tournament; players: (Entry & { player: Player })[] } | null;
  payoutToPrint: { tournament: Tournament; player: Player; entry: Entry; payoutAmount: number } | null;
  financeReportToPrint: { tournament: Tournament, players: Player[], reportType: 'summary' | 'detailed' } | null;
  moveSlipsToPrint: { slips: MoveSlip[]; tournamentName: string } | null;
}

export type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'REPLACE_STATE'; payload: AppState }
  | { type: 'ADD_TOURNAMENT'; payload: Tournament }
  | { type: 'UPDATE_TOURNAMENT'; payload: Tournament }
  | { type: 'ARCHIVE_TOURNAMENT'; payload: { tournamentId: string } }
  | { type: 'UNARCHIVE_TOURNAMENT'; payload: { tournamentId: string } }
  | { type: 'DELETE_TOURNAMENT'; payload: { tournamentId: string } }
  | { type: 'IMPORT_TOURNAMENT'; payload: { tournament: Tournament, players: Player[] } }
  | { type: 'ADD_PLAYER'; payload: Player }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'DELETE_PLAYER'; payload: { playerId: string } }
  | { type: 'MERGE_PLAYERS'; payload: { players: Player[] } }
  | { type: 'MERGE_PLAYERS_FROM_CSV'; payload: { players: Partial<Player>[] } }
  | { type: 'ADD_DEALER'; payload: Dealer }
  | { type: 'UPDATE_DEALER'; payload: Dealer }
  | { type: 'DELETE_DEALER'; payload: { dealerId: string } }
  | { type: 'MERGE_DEALERS_FROM_CSV'; payload: { dealers: Partial<Dealer>[] } }
  | { type: 'SAVE_BLIND_TEMPLATE'; payload: { name: string; levels: Level[] } }
  | { type: 'DELETE_BLIND_TEMPLATE'; payload: { templateId: string } }
  | { type: 'SAVE_DISPLAY_TEMPLATE'; payload: { name: string; settings: DisplaySettings } }
  | { type: 'DELETE_DISPLAY_TEMPLATE'; payload: { templateId: string } }
  | { type: 'SAVE_TOURNAMENT_TEMPLATE'; payload: TournamentTemplate }
  | { type: 'DELETE_TOURNAMENT_TEMPLATE'; payload: { templateId: string } }
  | { type: 'ADD_SEASON'; payload: { name: string; startDate: string; endDate: string } }
  | { type: 'UPDATE_SEASON'; payload: Season }
  | { type: 'DELETE_SEASON'; payload: { seasonId: string } }
  // Tournament specific actions
  | { type: 'TOGGLE_CLOCK'; payload: { tournamentId: string; running: boolean } }
  | { type: 'SET_CLOCK_TIME'; payload: { tournamentId: string; time: number } }
  | { type: 'NEXT_LEVEL'; payload: { tournamentId: string } }
  | { type: 'PREVIOUS_LEVEL'; payload: { tournamentId: string } }
  | { type: 'ELIMINATE_PLAYER'; payload: { tournamentId: string; entryId: string; liveCoveragePost?: Omit<LiveCoveragePost, 'id' | 'timestamp' | 'level'> } }
  | { type: 'ELIMINATE_PENDING_PLAYER'; payload: { tournamentId: string; entryId: string } }
  | { type: 'SET_RE_ENTRY_PENDING'; payload: { tournamentId: string; entryId: string; liveCoveragePost?: Omit<LiveCoveragePost, 'id' | 'timestamp' | 'level'> } }
  | { type: 'REBALANCE_TABLES'; payload: { tournamentId: string } }
  | { type: 'BREAK_TABLE', payload: { tournamentId: string, tableId: number, assignments: { entryId: string, newTable: number, newSeat: number }[], shouldPrintSlips?: boolean } }
  | { type: 'REGISTER_PLAYER'; payload: { tournamentId: string; flightId: string; nickname?: string; playerId?: string; addDealerBonus?: boolean; shouldPrintTicket?: boolean; } }
  | { type: 'UPDATE_CHIP_COUNT'; payload: { tournamentId: string; entryId: string; newChipCount: number } }
  | { type: 'PLAYER_REBUY'; payload: { tournamentId: string; entryId: string; addDealerBonus?: boolean; shouldPrintTicket?: boolean; } }
  | { type: 'PLAYER_ADDON'; payload: { tournamentId: string; entryId: string } }
  | { type: 'UPDATE_LEVEL_STRUCTURE'; payload: { tournamentId: string; newLevels: Level[] } }
  | { type: 'BLOCK_SEAT'; payload: { tournamentId: string; table: number; seat: number } }
  | { type: 'UNBLOCK_SEAT'; payload: { tournamentId: string; table: number; seat: number } }
  | { type: 'MOVE_PLAYER'; payload: { tournamentId: string; sourceEntryId: string; targetTable: number; targetSeat: number } }
  | { type: 'ADD_TABLE'; payload: { tournamentId: string; tableData: Partial<PokerTable> } }
  | { type: 'UPDATE_TABLE'; payload: { tournamentId: string; tableData: PokerTable } }
  | { type: 'DELETE_TABLE'; payload: { tournamentId: string; tableId: number } }
  | { type: 'ASSIGN_DEALER_TO_TOURNAMENT'; payload: { tournamentId: string; dealerId: string } }
  | { type: 'UNASSIGN_DEALER'; payload: { tournamentId: string; dealerId: string } }
  | { type: 'START_DEALER_SERVICE'; payload: { tournamentId: string; dealerId: string } }
  | { type: 'START_ALL_ASSIGNED_DEALERS_SERVICE'; payload: { tournamentId: string } }
  | { type: 'END_DEALER_SHIFT'; payload: { tournamentId: string; dealerId: string } }
  | { type: 'ASSIGN_DEALER_TO_TABLE'; payload: { tournamentId: string; tableId: number; dealerId: string | null } }
  | { type: 'PERFORM_DEALER_ROTATION'; payload: { tournamentId: string; assignments: { tableId: number; dealerId: string | null }[] } }
  | { type: 'TOGGLE_DEALER_BREAK'; payload: { tournamentId: string; dealerId: string } }
  | { type: 'GENERATE_DEALER_SCHEDULE'; payload: { tournamentId: string; schedule: DealerSchedule } }
  | { type: 'UPDATE_FLIGHT_STATUS'; payload: { tournamentId: string; flightId: string; status: FlightStatus } }
  | { type: 'PERFORM_MERGE'; payload: { tournamentId: string } }
  | { type: 'UNDO_MERGE'; payload: { tournamentId: string } }
  | { type: 'UPDATE_PAYOUT_SETTINGS'; payload: { tournamentId: string; settings: { mode: 'auto' | 'manual'; manualPayouts: Payout[] } } }
  | { type: 'UPDATE_DISPLAY_SETTINGS'; payload: { tournamentId: string; settings: DisplaySettings } }
  | { type: 'ADD_ANNOUNCEMENT'; payload: { tournamentId: string; text: string } }
  | { type: 'REMOVE_ANNOUNCEMENT'; payload: { tournamentId: string; announcementId: string } }
  | { type: 'ASSIGN_SEAT'; payload: { tournamentId: string; entryId: string } }
  | { type: 'FINALIZE_DEAL'; payload: { tournamentId: string; payouts: { playerId: string; amount: number }[] } }
  | { type: 'ADD_LIVE_COVERAGE_POST'; payload: { tournamentId: string; content: string; imageUrl?: string; author: 'director' | 'ai' } }
  | { type: 'DELETE_LIVE_COVERAGE_POST'; payload: { tournamentId: string; postId: string } }
  | { type: 'ADD_AI_SUGGESTION'; payload: { tournamentId: string; suggestion: { content: string; imageUrl?: string; triggerEvent: string } } }
  | { type: 'UPDATE_AI_SUGGESTION_STATUS'; payload: { tournamentId: string; suggestionId: string; status: 'approved' | 'rejected'; updatedContent?: string } }
  | { type: 'CLEAR_DISPLAY_ALERT'; payload: { tournamentId: string; alertId: string } }
  | { type: 'SIMULTANEOUS_ELIMINATION'; payload: { tournamentId: string; entryIds: string[] } }
  | { type: 'UNDO_LAST_ELIMINATION'; payload: { tournamentId: string } }
  | { type: 'BULK_UPDATE_CHIP_COUNTS'; payload: { tournamentId: string; updates: { entryId: string; newChipCount: number }[] } }
  | { type: 'GENERATE_DAY2_SEAT_DRAW'; payload: { tournamentId: string } }
  | { type: 'UNDO_DAY2_SEAT_DRAW'; payload: { tournamentId: string } }
  | { type: 'SET_AI_GENERATING'; payload: { tournamentId: string; isGenerating: boolean } }
  | { type: 'CLOSE_LATE_REGISTRATION'; payload: { tournamentId: string, flightId?: string } }
  | { type: 'SET_SCHEDULED_START_TIME'; payload: { tournamentId: string; time: string | null } }
  | { type: 'ASSIGN_TOURNAMENT_SEASON'; payload: { tournamentId: string; seasonId: string | null } }
  // Print actions
  | { type: 'SET_ENTRY_TO_PRINT'; payload: { entry: Entry; player: Player; tournament: Tournament } }
  | { type: 'CLEAR_ENTRY_TO_PRINT' }
  | { type: 'SET_TABLE_TO_PRINT'; payload: { table: PokerTable; entries: (Entry & { player: Player })[]; tournamentName: string } }
  | { type: 'CLEAR_TABLE_TO_PRINT' }
  | { type: 'SET_PLAYER_LIST_TO_PRINT'; payload: { tournament: Tournament; players: (Entry & { player: Player })[] } }
  | { type: 'CLEAR_PLAYER_LIST_TO_PRINT' }
  | { type: 'SET_SEAT_DRAW_TO_PRINT'; payload: { tournament: Tournament; players: (Entry & { player: Player })[] } }
  | { type: 'CLEAR_SEAT_DRAW_TO_PRINT' }
  | { type: 'SET_PAYOUT_TO_PRINT'; payload: { tournament: Tournament; player: Player; entry: Entry; payoutAmount: number } }
  | { type: 'CLEAR_PAYOUT_TO_PRINT' }
  | { type: 'SET_FINANCE_REPORT_TO_PRINT'; payload: { tournament: Tournament, players: Player[], reportType: 'summary' | 'detailed' } }
  | { type: 'CLEAR_FINANCE_REPORT_TO_PRINT' }
  | { type: 'SET_MOVE_SLIPS_TO_PRINT'; payload: { slips: MoveSlip[]; tournamentName: string } }
  | { type: 'CLEAR_MOVE_SLIPS_TO_PRINT' }
  // Cash Game Actions
  | { type: 'ADD_CASH_TABLE'; payload: Omit<CashGameTable, 'id' | 'waitingList'> }
  | { type: 'DELETE_CASH_TABLE'; payload: { tableId: string } }
  | { type: 'ADD_TO_WAITING_LIST'; payload: { tableId: string; playerId: string } }
  | { type: 'SEAT_PLAYER'; payload: { tableId: string; playerId: string; seat: number } }
  | { type: 'CHECK_OUT_PLAYER'; payload: { sessionId: string } }
  | { type: 'TOGGLE_SESSION_PAUSE'; payload: { sessionId: string } }
  | { type: 'MOVE_SESSION_PLAYER'; payload: { sessionId: string; newTableId: string; newSeat: number } };
  
