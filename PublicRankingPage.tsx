import React, { useState, useMemo } from 'react';
import { PlayerRanking, TournamentStatus, EntryStatus, Player, Tournament, CashGameSession } from './types';
import { Card, CardHeader, TrophyIcon, Button, ArrowDownTrayIcon, TabButton, ClockIcon } from './components';
import { calculatePoints } from './utils';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subDays, format as formatDate, startOfDay, endOfDay } from 'date-fns';
import { usePublicSync } from './PublicLayout';

const TournamentRanking = ({ tournaments, playerMap }: { tournaments: Tournament[], playerMap: Map<string, Player> }) => {
    const [selectedPeriod, setSelectedPeriod] = useState<string>('all_time');

     const rankings = useMemo((): PlayerRanking[] => {
        let dateRange: { start: Date | null, end: Date | null } = { start: null, end: null };

        if (selectedPeriod !== 'all_time') {
            const now = new Date();
            switch(selectedPeriod) {
                case 'last_30_days': dateRange = { start: subDays(now, 30), end: now }; break;
                case 'last_6_months': dateRange = { start: subMonths(now, 6), end: now }; break;
                case 'this_year': dateRange = { start: startOfYear(now), end: endOfYear(now) }; break;
            }
        }
        
        const completedTournaments = tournaments.filter(t => {
            if (t.status !== TournamentStatus.COMPLETED) return false;
            if (selectedPeriod === 'all_time') return true;
            if (!dateRange.start || !dateRange.end) return true;

            const tournamentDate = new Date(t.startDate);
            return tournamentDate >= dateRange.start && tournamentDate <= dateRange.end;
        });
        
        const playerStats: { [playerId: string]: { points: number; tournamentsPlayed: number; wins: number; } } = {};
        
        completedTournaments.forEach(tourney => {
            const totalEntrants = tourney.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
            const playersInThisTournament = new Set<string>();

            tourney.entries.forEach(entry => {
                if (entry.eliminationIndex !== null && entry.status !== EntryStatus.MERGE_DISCARDED) {
                    
                    if (!playerStats[entry.playerId]) {
                        playerStats[entry.playerId] = { points: 0, tournamentsPlayed: 0, wins: 0 };
                    }
                    
                    const finalRank = totalEntrants - entry.eliminationIndex + 1;
                    const points = calculatePoints(tourney.buyin, totalEntrants, finalRank);
                    playerStats[entry.playerId].points += points;

                    if (finalRank === 1) {
                        playerStats[entry.playerId].wins += 1;
                    }
                    
                    playersInThisTournament.add(entry.playerId);
                }
            });
            
            playersInThisTournament.forEach(playerId => {
                if (playerStats[playerId]) {
                    playerStats[playerId].tournamentsPlayed += 1;
                }
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

    }, [tournaments, playerMap, selectedPeriod]);
    
    return (
        <>
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-white">Classement Tournoi</h2>
                <select 
                    value={selectedPeriod} 
                    onChange={e => setSelectedPeriod(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-base text-white focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="this_year">Cette Année</option>
                    <option value="last_6_months">6 Derniers Mois</option>
                    <option value="last_30_days">30 Derniers Jours</option>
                    <option value="all_time">Depuis toujours</option>
                </select>
            </div>
            <div className="overflow-x-auto mt-4">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-600 text-sm text-gray-400">
                            <tr>
                                <th className="p-3 text-center w-16">Rang</th>
                                <th className="p-3">Joueur</th>
                                <th className="p-3 text-right">Points</th>
                                <th className="p-3 text-center">Tournois</th>
                                <th className="p-3 text-center">Victoires</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rankings.map(p => (
                                <tr key={p.player.id} className={`border-b border-gray-700/50 ${p.rank <= 3 ? 'bg-yellow-500/10' : ''}`}>
                                    <td className="p-3 text-center">
                                        <span className={`font-bold text-lg ${p.rank <= 3 ? 'text-yellow-400' : 'text-white'}`}>{p.rank}</span>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center space-x-3">
                                            <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                            <span className="font-semibold">{p.player.nickname}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right font-bold text-lg text-blue-400 font-mono">{p.points.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                    <td className="p-3 text-center font-semibold text-lg">{p.tournamentsPlayed}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex items-center justify-center gap-2 font-semibold text-lg">
                                            {p.wins > 0 && <TrophyIcon className="w-5 h-5 text-yellow-500"/>}
                                            {p.wins}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                    {rankings.map(p => (
                        <div key={p.player.id} className={`p-4 rounded-lg ${p.rank <= 3 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-700/50'}`}>
                            <div className="flex items-center justify-between mb-3">
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
                            <div className="pt-3 border-t border-gray-600/50 grid grid-cols-2 gap-2 text-sm text-center">
                                <div><p className="text-gray-400">Tournois</p><p className="font-semibold">{p.tournamentsPlayed}</p></div>
                                <div><p className="text-gray-400">Victoires</p><p className="font-semibold flex items-center justify-center gap-1">{p.wins > 0 && <TrophyIcon className="w-4 h-4 text-yellow-500"/>} {p.wins}</p></div>
                            </div>
                        </div>
                    ))}
                </div>
                 {rankings.length === 0 && <p className="text-center p-8 text-gray-400">Aucune donnée pour la période sélectionnée.</p>}
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
            case 'this_month': dateRange = { start: startOfMonth(now), end: endOfMonth(now) }; break;
            case 'last_30_days': dateRange = { start: subDays(now, 30), end: now }; break;
            case 'last_6_months': dateRange = { start: subMonths(now, 6), end: now }; break;
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
    
    return (
        <>
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-white">Classement Cash Game</h2>
                 <select 
                    value={period} 
                    onChange={e => setPeriod(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-base text-white focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="this_year">Cette Année</option>
                    <option value="last_6_months">6 Derniers Mois</option>
                    <option value="last_30_days">30 Derniers Jours</option>
                    <option value="all_time">Depuis toujours</option>
                    <option value="custom">Personnalisé</option>
                </select>
            </div>
             {period === 'custom' && (
                <div className="grid grid-cols-2 gap-4 my-4 p-4 bg-gray-800/50 rounded-lg">
                     <div><label>Début</label><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1 [color-scheme:dark]" /></div>
                     <div><label>Fin</label><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 mt-1 [color-scheme:dark]" /></div>
                </div>
            )}
             <div className="overflow-x-auto mt-4">
                {/* Desktop Table */}
                 <div className="hidden md:block">
                     <table className="w-full text-left">
                        <thead className="border-b border-gray-600 text-sm text-gray-400">
                            <tr>
                                <th className="p-3 text-center w-16">Rang</th>
                                <th className="p-3">Joueur</th>
                                <th className="p-3 text-right">Temps de Jeu Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rankings.map((p, index) => (
                                <tr key={p.player.id} className={`border-b border-gray-700/50 ${index < 3 ? 'bg-yellow-500/10' : ''}`}>
                                    <td className="p-3 text-center"><span className={`font-bold text-lg ${index < 3 ? 'text-yellow-400' : 'text-white'}`}>{index + 1}</span></td>
                                    <td className="p-3"><div className="flex items-center space-x-3"><img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" /><span className="font-semibold">{p.player.nickname}</span></div></td>
                                    <td className="p-3 text-right font-bold text-lg text-blue-400 font-mono">{formatHours(p.totalTimeMs)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                 {rankings.length === 0 && <p className="text-center p-8 text-gray-400">Aucune session de cash game pour la période sélectionnée.</p>}
            </div>
        </>
    )
};


const PublicRankingPage = () => {
    const { syncedState: data } = usePublicSync();
    const [activeTab, setActiveTab] = useState<'tournament' | 'cash_game'>('tournament');
    
    if (!data) {
        return (
            <div className="p-8 text-center text-2xl text-gray-400">
                <div className="spinner h-8 w-8 mx-auto mb-4" style={{borderWidth: '4px'}}></div>
                <p>Connexion au serveur du directeur...</p>
            </div>
        );
    }
    
    const { tournaments, players, cashGameSessions } = data;
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const handleExport = () => {
        // This is a placeholder as export logic will be inside each tab component now
        alert("Utilisez le bouton d'exportation dans l'onglet actif.");
    };
    
    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <header className="mb-6">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <h1 className="text-4xl font-bold text-white">Classement des Joueurs</h1>
                    <Button variant="secondary" size="sm" onClick={handleExport} className="flex items-center gap-2">
                        <ArrowDownTrayIcon className="w-4 h-4" /> Exporter
                    </Button>
                </div>
            </header>
            
            <div className="flex items-center gap-2 border-b border-gray-700 mb-6">
                <TabButton label="Classement Tournoi" icon={<TrophyIcon className="w-5 h-5"/>} isActive={activeTab === 'tournament'} onClick={() => setActiveTab('tournament')} />
                <TabButton label="Classement Cash Game" icon={<ClockIcon className="w-5 h-5"/>} isActive={activeTab === 'cash_game'} onClick={() => setActiveTab('cash_game')} />
            </div>

            <Card>
                {activeTab === 'tournament' && <TournamentRanking tournaments={tournaments} playerMap={playerMap} />}
                {activeTab === 'cash_game' && <CashGameRanking cashGameSessions={cashGameSessions} playerMap={playerMap} />}
            </Card>
        </div>
    )
}

export default PublicRankingPage;