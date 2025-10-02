import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { calculatePayouts } from './store';
import { Tournament, Player, Entry, EntryStatus, TournamentStatus, TournamentType, TournamentPhase, FlightStatus, Level, Payout } from './types';
import { Card, CardHeader, TabButton, ClockIcon, UsersIcon, ListBulletIcon, TablesIcon, ScreenIcon, CurrencyDollarIcon, MegaphoneIcon, TrophyIcon, SparklesIcon, ChipIcon } from './components';
import { TournamentScreen } from './TournamentScreen'; // We can reuse this as it's a display component
import { usePublicSync } from './PublicLayout';

// --- MOBILE OVERVIEW ---
const formatTime = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const PublicMobileOverview = ({ tournament }: { tournament: Tournament }) => {
    const clockSource = useMemo(() => {
        if (!tournament) return null;
        const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
        const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
        return activeFlight || tournament;
    }, [tournament]);

    // FIX: Replaced setTick with a time state to fix 'time is not defined' error.
    const [time, setTime] = useState(Date.now());
    const isRunning = clockSource?.status === TournamentStatus.RUNNING;

    useEffect(() => {
        let timer: number | undefined;
        if (isRunning) {
            timer = window.setInterval(() => setTime(Date.now()), 1000);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [isRunning]);

    const displayTime = useMemo(() => {
        if (isRunning && clockSource?.lastClockStartTime && clockSource?.clockTimeRemaining !== undefined) {
            const elapsed = Math.floor((Date.now() - clockSource.lastClockStartTime) / 1000);
            return Math.max(0, clockSource.clockTimeRemaining - elapsed);
        }
        return clockSource?.clockTimeRemaining || 0;
    }, [isRunning, clockSource, time]);

    const { levelInfo, nextLevelInfo, prizePool, activePlayers, totalEntries, avgStack } = useMemo(() => {
        if (!tournament || !clockSource) return {};
        const levelInfo = tournament.levels[clockSource.currentLevel - 1];
        const nextLevelInfo = tournament.levels[clockSource.currentLevel];
        
        const totalBuyins = tournament.entries.reduce((sum, e) => sum + e.buyins, 0);
        const totalAddons = tournament.entries.reduce((sum, e) => sum + e.addons, 0);
        const prizePool = (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);

        const activePlayers = tournament.entries.filter(e => e.status === 'Active').length;
        const totalEntries = tournament.entries.filter(e => e.status !== 'Merge Discarded').length;
        
        const totalDealerBonuses = tournament.entries.reduce((sum, e) => sum + (e.dealerBonuses || 0), 0);
        const totalChips = (totalBuyins * tournament.startingStack) + (totalAddons * tournament.addonChips) + (totalDealerBonuses * tournament.dealerBonusChips);
        const avgStack = activePlayers > 0 ? Math.round(totalChips / activePlayers) : 0;
        
        return { levelInfo, nextLevelInfo, prizePool, activePlayers, totalEntries, avgStack };
    // FIX: Removed unnecessary 'time' dependency for performance. Stats only update when tournament data changes.
    }, [tournament, clockSource]);

    if (!levelInfo) return null;

    return (
        <div className="space-y-4">
            <Card>
                <div className="text-center">
                    <p className="text-sm font-semibold text-gray-400 uppercase">{levelInfo.isBreak ? "PAUSE" : `Niveau ${levelInfo.level}`}</p>
                    <h1 className="text-7xl font-mono font-bold text-white my-2">{formatTime(displayTime)}</h1>
                    <div className="text-2xl font-semibold text-blue-400">
                        {levelInfo.isBreak ? "Tournoi en pause" : `${levelInfo.smallBlind} / ${levelInfo.bigBlind}`}
                        {!levelInfo.isBreak && levelInfo.ante > 0 && <span className="text-lg text-gray-400 ml-2">(ante {levelInfo.ante})</span>}
                    </div>
                </div>
                 {nextLevelInfo && (
                    <div className="border-t border-gray-700 mt-4 pt-4 text-center">
                        <p className="text-gray-400 text-sm">Suivant: {nextLevelInfo.isBreak ? 'Pause' : `${nextLevelInfo.smallBlind}/${nextLevelInfo.bigBlind}`}</p>
                    </div>
                 )}
            </Card>
            <Card>
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p className="text-sm text-gray-400">Joueurs</p>
                        <p className="text-2xl font-bold">{activePlayers} / {totalEntries}</p>
                    </div>
                     <div>
                        <p className="text-sm text-gray-400">Tapis Moyen</p>
                        <p className="text-2xl font-bold">{avgStack?.toLocaleString()}</p>
                    </div>
                </div>
                 <div className="mt-4 pt-4 border-t border-gray-700 text-center">
                     <p className="text-sm text-gray-400">Prizepool</p>
                     <p className="text-2xl font-bold text-green-400">{prizePool?.toLocaleString()} MAD</p>
                </div>
            </Card>
        </div>
    );
};


// Sub-component for Players Tab
const PlayersTab = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
    const activePlayers = useMemo(() => {
        return tournament.entries
            .filter(e => e.status === EntryStatus.ACTIVE)
            .map(entry => ({...entry, player: players.find(p => p.id === entry.playerId)}))
            .filter((e): e is Entry & {player: Player} => !!e.player)
            .sort((a, b) => b.chipCount - a.chipCount);
    }, [tournament.entries, players]);

    return (
        <Card>
            <CardHeader>Joueurs Actifs ({activePlayers.length})</CardHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {activePlayers.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md">
                        <div className="flex items-center space-x-3 min-w-0">
                            <span className="font-bold text-gray-400 w-8 text-center">{index + 1}</span>
                            <img src={entry.player.avatarUrl} alt={entry.player.nickname} className="w-10 h-10 rounded-full flex-shrink-0" />
                            <div className="truncate">
                                <p className="font-semibold text-white truncate">{entry.player.nickname}</p>
                                <p className="text-xs text-gray-400">{entry.table && entry.seat ? `Table ${entry.table}, Siège ${entry.seat}` : 'Non assis'}</p>
                            </div>
                        </div>
                        <p className="font-mono font-bold text-lg text-white flex-shrink-0 ml-2">{entry.chipCount.toLocaleString()}</p>
                    </div>
                ))}
            </div>
        </Card>
    );
};

// Sub-component for Payouts Tab
const PayoutsTab = ({ tournament }: { tournament: Tournament }) => {
    const totalPrizePool = (tournament.entries.reduce((sum, e) => sum + e.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((sum, e) => sum + e.addons, 0) * tournament.addonCost);
    const totalEntries = tournament.entries.filter(e => e.status !== 'Merge Discarded').length;

    const payouts = useMemo(() => {
        if (tournament.payoutSettings.mode === 'manual' && tournament.payoutSettings.manualPayouts.length > 0) {
            return [...tournament.payoutSettings.manualPayouts].sort((a,b) => a.rank - b.rank);
        }
        return calculatePayouts(totalPrizePool, totalEntries);
    }, [tournament.payoutSettings, totalPrizePool, totalEntries]);

    return (
        <Card>
            <CardHeader>Structure des Payouts</CardHeader>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                {payouts.map(p => (
                    <div key={p.rank} className="flex justify-between text-lg bg-gray-700/50 p-3 rounded-md">
                        <span className="font-semibold text-gray-300">#{p.rank}</span>
                        <span className="font-bold text-green-400">{p.description || `${p.amount.toLocaleString()} MAD`}</span>
                    </div>
                ))}
                {payouts.length === 0 && <p className="text-gray-400">La structure des prix sera bientôt disponible.</p>}
            </div>
        </Card>
    );
};

// Sub-component for Tables Tab
const TablesTab = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
     const tablesWithPlayers = useMemo(() => {
        return tournament.tables
            .map(table => ({
                ...table,
                players: tournament.entries
                    .filter(e => e.table === table.id && e.status === EntryStatus.ACTIVE)
                    .map(entry => ({ ...entry, player: players.find(p => p.id === entry.playerId) }))
                    .filter((e): e is Entry & { player: Player } => !!e.player)
                    .sort((a,b) => (a.seat || 0) - (b.seat || 0))
            }))
            .filter(table => table.players.length > 0)
            .sort((a, b) => a.id - b.id);
    }, [tournament, players]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {tablesWithPlayers.map(table => (
                 <Card key={table.id}>
                    <CardHeader>
                         <div className="flex justify-between items-center">
                            <span>{table.name}</span>
                            <span className="text-sm font-semibold bg-gray-700 px-2 py-1 rounded-md">{table.players.length} / {table.seats}</span>
                        </div>
                    </CardHeader>
                    <div className="space-y-2">
                        {table.players.map(entry => (
                            <div key={entry.id} className="flex justify-between items-center text-sm p-1.5 rounded bg-gray-700/50">
                                <div className="flex items-center gap-2 truncate">
                                   <span className="font-mono text-xs bg-gray-900/50 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0">{entry.seat}</span>
                                   <span className="font-semibold truncate">{entry.player.nickname}</span>
                                </div>
                                <span className="font-mono text-gray-300 flex-shrink-0">{entry.chipCount.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            ))}
        </div>
    );
};

// Sub-component for Live Coverage Tab
const LiveCoverageTab = ({ tournament }: { tournament: Tournament }) => {
    return (
        <Card>
            <CardHeader>Fil d'actualité</CardHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {tournament.liveCoveragePosts.map(post => (
                    <div key={post.id} className="bg-gray-700/50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                            {post.author === 'ai' && <SparklesIcon className="w-4 h-4 text-yellow-500" />}
                            <span>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>&bull;</span>
                            <span>Niveau {post.level}</span>
                        </div>
                        {post.imageUrl && <img src={post.imageUrl} alt="Image de publication" className="my-3 rounded-lg object-cover w-full h-auto max-h-80" />}
                        <p className="text-gray-100 whitespace-pre-wrap">{post.content}</p>
                    </div>
                ))}
                {tournament.liveCoveragePosts.length === 0 && (
                    <p className="text-center text-gray-500 py-8">Aucune publication pour le moment.</p>
                )}
            </div>
        </Card>
    );
};

const PublicTournamentView = () => {
    const { id } = useParams<{ id: string }>();
    const { syncedState: data } = usePublicSync();
    const [activeTab, setActiveTab] = useState('overview');

    const tournament = data?.tournaments.find(t => t.id === id);

    if (!tournament) {
        return (
            <div className="p-8 text-center text-2xl text-gray-400">
                <div className="spinner h-8 w-8 mx-auto mb-4" style={{borderWidth: '4px'}}></div>
                <p>Connexion au serveur du directeur...</p>
            </div>
        );
    }
    
    const { players } = data;

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview': return (
                <>
                    <div className="hidden md:block h-[80vh] w-full">
                        <TournamentScreen tournament={tournament} players={players} />
                    </div>
                    <div className="md:hidden">
                        <PublicMobileOverview tournament={tournament} />
                    </div>
                </>
            );
            case 'players': return <PlayersTab tournament={tournament} players={players} />;
            case 'payouts': return <PayoutsTab tournament={tournament} />;
            case 'tables': return <TablesTab tournament={tournament} players={players} />;
            case 'live': return <LiveCoverageTab tournament={tournament} />;
            default: return null;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-white truncate">{tournament.name}</h1>
                <p className="text-gray-400">{tournament.location}</p>
            </header>
            
            <div className="mb-6">
                <div className="flex border-b border-gray-700 overflow-x-auto">
                    <TabButton label="Overview" icon={<ScreenIcon className="w-5 h-5"/>} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <TabButton label="Joueurs" icon={<UsersIcon className="w-5 h-5"/>} isActive={activeTab === 'players'} onClick={() => setActiveTab('players')} />
                    <TabButton label="Tables" icon={<TablesIcon className="w-5 h-5"/>} isActive={activeTab === 'tables'} onClick={() => setActiveTab('tables')} />
                    <TabButton label="Payouts" icon={<CurrencyDollarIcon className="w-5 h-5"/>} isActive={activeTab === 'payouts'} onClick={() => setActiveTab('payouts')} />
                    <TabButton label="Live Coverage" icon={<MegaphoneIcon className="w-5 h-5"/>} isActive={activeTab === 'live'} onClick={() => setActiveTab('live')} />
                </div>
            </div>

            <div>
                {renderTabContent()}
            </div>
        </div>
    );
};

export default PublicTournamentView;