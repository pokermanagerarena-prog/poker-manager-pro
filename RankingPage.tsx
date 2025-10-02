import React, { useState, useMemo, memo } from 'react';
import { useTournamentStore } from './store';
import { Season, PlayerRanking, Tournament, TournamentStatus, EntryStatus, Player, CashGameSession } from './types';
import { Link } from 'react-router-dom';
import { Card, CardHeader, Button, Modal, TrashIcon, PencilIcon, TrophyIcon, PlusIcon, TabButton, ArrowDownTrayIcon, ClockIcon } from './components';
import { calculatePoints } from './utils';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subDays, format as formatDate, startOfDay, endOfDay } from 'date-fns';


const SeasonManagerModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { state, dispatch } = useTournamentStore();
    const [editingSeason, setEditingSeason] = useState<Partial<Season> | null>(null);

    const handleSave = () => {
        if (!editingSeason || !editingSeason.name || !editingSeason.startDate || !editingSeason.endDate) {
            alert("Veuillez remplir tous les champs.");
            return;
        }

        if (editingSeason.id) {
            dispatch({ type: 'UPDATE_SEASON', payload: editingSeason as Season });
        } else {
            dispatch({ type: 'ADD_SEASON', payload: { name: editingSeason.name, startDate: editingSeason.startDate, endDate: editingSeason.endDate }});
        }
        setEditingSeason(null);
    };
    
    const handleDelete = (seasonId: string) => {
        if(window.confirm("Êtes-vous sûr de vouloir supprimer cette saison ? Cette action est irréversible.")) {
            dispatch({ type: 'DELETE_SEASON', payload: { seasonId } });
        }
    };
    
    const inputClasses = "w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-blue-500 focus:border-blue-500 text-sm [color-scheme:dark]";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
    
    return (
        <Modal isOpen={isOpen} onClose={() => { setEditingSeason(null); onClose(); }}>
            <CardHeader>Gérer les Saisons</CardHeader>
            <div className="space-y-4">
                {state.seasons.map(season => (
                    <div key={season.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md">
                        <div>
                            <p className="font-semibold text-white">{season.name}</p>
                            <p className="text-xs text-gray-400">
                                {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="secondary" className="p-2" onClick={() => setEditingSeason(season)}><PencilIcon className="w-4 h-4" /></Button>
                            <Button variant="danger" className="p-2" onClick={() => handleDelete(season.id)}><TrashIcon className="w-4 h-4" /></Button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-600">
                {editingSeason ? (
                    <div className="space-y-4">
                         <h3 className="text-lg font-semibold text-white">{editingSeason.id ? "Modifier la saison" : "Créer une nouvelle saison"}</h3>
                         <input type="text" placeholder="Nom de la saison" value={editingSeason.name || ''} onChange={e => setEditingSeason({...editingSeason, name: e.target.value})} className={inputClasses} />
                         <div>
                             <label className={labelClasses}>Date de début</label>
                             <input type="date" value={(editingSeason.startDate || '').split('T')[0]} onChange={e => setEditingSeason({...editingSeason, startDate: new Date(e.target.value).toISOString()})} className={inputClasses}/>
                         </div>
                         <div>
                             <label className={labelClasses}>Date de fin</label>
                             <input type="date" value={(editingSeason.endDate || '').split('T')[0]} onChange={e => setEditingSeason({...editingSeason, endDate: new Date(e.target.value).toISOString()})} className={inputClasses}/>
                         </div>
                         <div className="flex gap-2 justify-end">
                            <Button variant="secondary" onClick={() => setEditingSeason(null)}>Annuler</Button>
                            <Button variant="primary" onClick={handleSave}>Sauvegarder la saison</Button>
                         </div>
                    </div>
                ) : (
                    <Button variant="primary" onClick={() => setEditingSeason({})} className="flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Créer une nouvelle saison</Button>
                )}
            </div>
        </Modal>
    );
};

const TournamentRanking = ({ seasons, tournaments, playerMap }: { seasons: Season[], tournaments: Tournament[], playerMap: Map<string, Player> }) => {
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
    
    const rankings = useMemo((): PlayerRanking[] => {
        const completedTournaments = tournaments.filter(t => 
            t.status === TournamentStatus.COMPLETED && (selectedSeasonId === 'all' ? !!t.seasonId : t.seasonId === selectedSeasonId)
        );
        
        const playerStats: { [playerId: string]: { points: number; tournamentsPlayed: number; wins: number; } } = {};
        
        completedTournaments.forEach(tourney => {
            const totalEntrants = tourney.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
            const playersInThisTournament = new Set<string>();

            tourney.entries.forEach(entry => {
                if (entry.eliminationIndex !== null && entry.status !== EntryStatus.MERGE_DISCARDED) {
                    if (!playerStats[entry.playerId]) playerStats[entry.playerId] = { points: 0, tournamentsPlayed: 0, wins: 0 };
                    
                    const finalRank = totalEntrants - entry.eliminationIndex + 1;
                    const points = calculatePoints(tourney.buyin, totalEntrants, finalRank);
                    playerStats[entry.playerId].points += points;

                    if (finalRank === 1) playerStats[entry.playerId].wins += 1;
                    
                    playersInThisTournament.add(entry.playerId);
                }
            });
            
            playersInThisTournament.forEach(playerId => {
                if (playerStats[playerId]) playerStats[playerId].tournamentsPlayed += 1;
            });
        });

        const sortedPlayerIds = Object.keys(playerStats).sort((a, b) => playerStats[b].points - playerStats[a].points);
        
        return sortedPlayerIds.map((playerId, index) => {
            const player = playerMap.get(playerId);
            if (!player) return null;

            return {
                rank: index + 1,
                player: player,
                points: Math.round(playerStats[playerId].points * 100) / 100,
                tournamentsPlayed: playerStats[playerId].tournamentsPlayed,
                wins: playerStats[playerId].wins,
            };
        }).filter((r): r is PlayerRanking => r !== null);

    }, [tournaments, playerMap, selectedSeasonId]);

    const commonSelectClasses = "bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-base text-white focus:ring-blue-500 focus:border-blue-500";

    return (
         <>
            <div className="mb-6 max-w-xs">
                <label className="text-sm font-medium text-gray-300 mb-1 block">Sélectionner une saison</label>
                <select value={selectedSeasonId} onChange={e => setSelectedSeasonId(e.target.value)} className={commonSelectClasses}>
                    <option value="all">Toutes les saisons</option>
                    {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block">
                <div className="flex border-b border-gray-600 text-sm text-gray-400">
                    <div className="p-3 text-center w-24">Rang</div>
                    <div className="p-3 flex-grow">Joueur</div>
                    <div className="p-3 text-right w-48">Total des Points</div>
                    <div className="p-3 text-center w-48">Tournois Joués</div>
                    <div className="p-3 text-center w-36">Victoires</div>
                </div>
                <div className="max-h-[70vh] w-full overflow-y-auto">
                    {rankings.length > 0 ? (
                        rankings.map((p) => (
                             <div key={p.player.id} className={`flex items-center border-b border-gray-700/50 h-[68px] ${p.rank <= 3 ? 'bg-yellow-500/10' : ''}`}>
                                <div className="p-3 text-center w-24">
                                    <span className={`font-bold text-lg ${p.rank <= 3 ? 'text-yellow-400' : 'text-white'}`}>{p.rank}</span>
                                </div>
                                <div className="p-3 flex-grow">
                                    <div className="flex items-center space-x-3">
                                        <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                        <span className="font-semibold">{p.player.nickname}</span>
                                    </div>
                                </div>
                                <div className="p-3 text-right font-bold text-lg text-blue-400 font-mono w-48">{p.points.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                                <div className="p-3 text-center font-semibold text-lg w-48">{p.tournamentsPlayed}</div>
                                <div className="p-3 text-center w-36">
                                    <div className="flex items-center justify-center gap-2 font-semibold text-lg">
                                        {p.wins > 0 && <TrophyIcon className="w-5 h-5 text-yellow-500"/>}
                                        {p.wins}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-8 text-gray-400">Aucun tournoi terminé trouvé pour les filtres sélectionnés.</div>
                    )}
                </div>
            </div>
             {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {rankings.map(p => (
                    <div key={p.player.id} className={`p-4 rounded-lg ${p.rank <= 3 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-700/50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`font-bold text-lg w-8 text-center ${p.rank <= 3 ? 'text-yellow-400' : 'text-white'}`}>{p.rank}</span>
                                 <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                 <span className="font-semibold">{p.player.nickname}</span>
                            </div>
                             <div className="text-right">
                                <p className="font-bold text-lg text-blue-400 font-mono">{p.points.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                <p className="text-xs text-gray-400">points</p>
                            </div>
                        </div>
                         <div className="mt-3 pt-3 border-t border-gray-600/50 grid grid-cols-2 gap-2 text-sm">
                            <div className="text-center">
                                <p className="text-gray-400">Tournois</p>
                                <p className="font-semibold">{p.tournamentsPlayed}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-gray-400">Victoires</p>
                                <p className="font-semibold flex items-center justify-center gap-1">
                                     {p.wins > 0 && <TrophyIcon className="w-4 h-4 text-yellow-500"/>} {p.wins}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

const CashGameRanking = ({ cashGameSessions, playerMap }: { cashGameSessions: CashGameSession[], playerMap: Map<string, Player> }) => {
    const today = new Date();
    const [period, setPeriod] = useState<string>('this_month');
    const [customStart, setCustomStart] = useState(formatDate(subMonths(today, 1), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(formatDate(today, 'yyyy-MM-dd'));

    const rankings = useMemo(() => {
        let dateRange: { start: Date | null, end: Date | null } = { start: null, end: null };
        const now = new Date();
        switch(period) {
            case 'today': dateRange = { start: startOfDay(now), end: endOfDay(now) }; break;
            case 'yesterday': 
                const yesterday = subDays(now, 1);
                dateRange = { start: startOfDay(yesterday), end: endOfDay(yesterday) };
                break;
            case 'this_week': dateRange = { start: startOfDay(subDays(now, now.getDay())), end: endOfDay(now) }; break;
            case 'this_month': dateRange = { start: startOfMonth(now), end: endOfMonth(now) }; break;
            case 'this_year': dateRange = { start: startOfYear(now), end: endOfYear(now) }; break;
            case 'custom':
                dateRange = {
                    start: customStart ? startOfDay(new Date(customStart)) : null,
                    end: customEnd ? endOfDay(new Date(customEnd)) : null,
                };
                break;
        }

        const filteredSessions = cashGameSessions.filter(s => {
            if (period === 'all_time' || !dateRange.start || !dateRange.end) return true;
            const sessionStart = new Date(s.startTime);
            return sessionStart >= dateRange.start && sessionStart <= dateRange.end;
        });

        const playerStats: { [playerId: string]: { totalTimeMs: number } } = {};

        filteredSessions.forEach(session => {
            if (!playerStats[session.playerId]) {
                playerStats[session.playerId] = { totalTimeMs: 0 };
            }

            const endTime = session.endTime ? new Date(session.endTime).getTime() : Date.now();
            const startTime = new Date(session.startTime).getTime();
            let sessionDuration = endTime - startTime;

            session.pauses.forEach(pause => {
                const pauseEnd = pause.end ? new Date(pause.end).getTime() : Date.now();
                const pauseStart = new Date(pause.start).getTime();
                sessionDuration -= (pauseEnd - pauseStart);
            });
            
            playerStats[session.playerId].totalTimeMs += sessionDuration;
        });

        return Object.entries(playerStats)
            .map(([playerId, stats]) => ({
                player: playerMap.get(playerId)!,
                totalTimeMs: stats.totalTimeMs
            }))
            .filter(p => p.player && p.totalTimeMs > 0)
            .sort((a, b) => b.totalTimeMs - a.totalTimeMs);

    }, [cashGameSessions, playerMap, period, customStart, customEnd]);

    const formatHours = (ms: number) => {
        const hours = ms / (1000 * 60 * 60);
        return `${hours.toFixed(2)}h`;
    };

    const commonSelectClasses = "bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-base text-white focus:ring-blue-500 focus:border-blue-500";
    
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-800 rounded-lg">
                <div>
                    <label className="text-sm font-medium text-gray-300 mb-1 block">Période</label>
                    <select value={period} onChange={e => setPeriod(e.target.value)} className={commonSelectClasses}>
                        <option value="all_time">Depuis toujours</option>
                        <option value="today">Aujourd'hui</option>
                        <option value="yesterday">Hier</option>
                        <option value="this_week">Cette semaine</option>
                        <option value="this_month">Ce mois-ci</option>
                        <option value="this_year">Cette année</option>
                        <option value="custom">Période personnalisée</option>
                    </select>
                </div>
                {period === 'custom' && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-1 block">Date de début</label>
                            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={`${commonSelectClasses} [color-scheme:dark]`} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-1 block">Date de fin</label>
                            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={`${commonSelectClasses} [color-scheme:dark]`} />
                        </div>
                    </div>
                )}
            </div>
            {/* Desktop Table */}
             <div className="hidden md:block">
                <div className="flex border-b border-gray-600 text-sm text-gray-400">
                    <div className="p-3 text-center w-24">Rang</div>
                    <div className="p-3 flex-grow">Joueur</div>
                    <div className="p-3 text-right w-48">Temps de Jeu Total</div>
                </div>
                <div className="h-[70vh] w-full overflow-y-auto">
                    {rankings.length > 0 ? (
                        rankings.map((p, index) => (
                             <div key={p.player.id} className={`flex items-center border-b border-gray-700/50 h-[68px] ${index < 3 ? 'bg-yellow-500/10' : ''}`}>
                                <div className="p-3 text-center w-24">
                                    <span className={`font-bold text-lg ${index < 3 ? 'text-yellow-400' : 'text-white'}`}>{index + 1}</span>
                                </div>
                                <div className="p-3 flex-grow">
                                    <div className="flex items-center space-x-3">
                                        <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                        <span className="font-semibold">{p.player.nickname}</span>
                                    </div>
                                </div>
                                <div className="p-3 text-right font-bold text-lg text-blue-400 font-mono w-48">{formatHours(p.totalTimeMs)}</div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center p-8 text-gray-400">Aucune session de jeu trouvée pour la période sélectionnée.</div>
                    )}
                </div>
            </div>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {rankings.map((p, index) => (
                    <div key={p.player.id} className={`p-4 rounded-lg flex items-center justify-between ${index < 3 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-700/50'}`}>
                        <div className="flex items-center gap-3">
                            <span className={`font-bold text-lg w-8 text-center ${index < 3 ? 'text-yellow-400' : 'text-white'}`}>{index + 1}</span>
                            <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                            <span className="font-semibold">{p.player.nickname}</span>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-lg text-blue-400 font-mono">{formatHours(p.totalTimeMs)}</p>
                            <p className="text-xs text-gray-400">de jeu</p>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};


export default function RankingPage() {
    const { state } = useTournamentStore();
    const { tournaments, players, seasons, cashGameSessions } = state;
    
    const [activeTab, setActiveTab] = useState<'tournament' | 'cash_game'>('tournament');
    const [isSeasonModalOpen, setIsSeasonModalOpen] = useState(false);
    
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const handleExport = () => {
        // This is a placeholder as export logic will be inside each tab component now
        alert("Utilisez le bouton d'exportation dans l'onglet actif.");
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <SeasonManagerModal isOpen={isSeasonModalOpen} onClose={() => setIsSeasonModalOpen(false)} />

            <header className="mb-6">
                 <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; Retour à l'accueil</Link>
                <div className="flex justify-between items-center">
                    <h1 className="text-4xl font-bold text-white">Classements</h1>
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={() => { /* Implement export logic based on active tab */ }}>
                            <ArrowDownTrayIcon className="w-5 h-5"/> Exporter en CSV
                        </Button>
                        <Button variant="secondary" onClick={() => setIsSeasonModalOpen(true)}>Gérer les saisons</Button>
                    </div>
                </div>
            </header>

            <div className="flex items-center gap-2 border-b border-gray-700 mb-6">
                <TabButton label="Classement Tournoi" icon={<TrophyIcon className="w-5 h-5"/>} isActive={activeTab === 'tournament'} onClick={() => setActiveTab('tournament')} />
                <TabButton label="Classement Cash Game" icon={<ClockIcon className="w-5 h-5"/>} isActive={activeTab === 'cash_game'} onClick={() => setActiveTab('cash_game')} />
            </div>

            <Card>
                <div className="overflow-x-auto">
                    {activeTab === 'tournament' && <TournamentRanking seasons={seasons} tournaments={tournaments} playerMap={playerMap} />}
                    {activeTab === 'cash_game' && <CashGameRanking cashGameSessions={cashGameSessions} playerMap={playerMap} />}
                </div>
            </Card>
        </div>
    )
}