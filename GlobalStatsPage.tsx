import React, { useState, useMemo } from 'react';
import { useTournamentStore } from './store';
import { Season, Player, Tournament, TournamentStatus, EntryStatus, Entry } from './types';
import { Link } from 'react-router-dom';
import { Card, CardHeader, Button, TrophyIcon, ArrowDownTrayIcon } from './components';
import { calculatePayouts } from './store';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, TimeScale, PointElement, LineElement } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, TimeScale, PointElement, LineElement);

interface PlayerStats {
    playerId: string;
    tournamentsPlayed: number;
    wins: number;
    itmCount: number;
    totalWinnings: number;
    totalCost: number;
}

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
};

const GlobalStatsPage = () => {
    const { state } = useTournamentStore();
    const { tournaments, players, seasons } = state;
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'netProfit', direction: 'descending' });

    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const { playerRankings, completedTournamentsForCharts } = useMemo(() => {
        let completedTournaments: Tournament[];

        if (selectedSeasonId === 'all') {
            completedTournaments = tournaments.filter(t => t.status === TournamentStatus.COMPLETED);
        } else {
            completedTournaments = tournaments.filter(t =>
                t.status === TournamentStatus.COMPLETED && t.seasonId === selectedSeasonId
            );
        }

        const playerStats: { [playerId: string]: PlayerStats } = {};

        players.forEach(p => {
            playerStats[p.id] = { playerId: p.id, tournamentsPlayed: 0, wins: 0, itmCount: 0, totalWinnings: 0, totalCost: 0 };
        });

        completedTournaments.forEach(tourney => {
            // --- 1. Financial Calculations (Transaction-based, this is robust) ---
            const totalBuyinCommissions = (tourney.buyinCommissions || []).reduce((sum, c) => sum + c.amount, 0);
            const totalAddonCommissions = (tourney.addonCommissions || []).reduce((sum, c) => sum + c.amount, 0);

            tourney.transactions.forEach(tx => {
                if (!playerStats[tx.playerId]) return;
                
                if (tx.type === 'buyin' || tx.type === 'rebuy') {
                    playerStats[tx.playerId].totalCost += tx.amount + totalBuyinCommissions;
                } else if (tx.type === 'addon') {
                    playerStats[tx.playerId].totalCost += tx.amount + totalAddonCommissions;
                } else if (tx.type === 'dealer_bonus') {
                    playerStats[tx.playerId].totalCost += tx.amount;
                } else if (tx.type === 'payout') {
                    playerStats[tx.playerId].totalWinnings += Math.abs(tx.amount);
                }
            });

            // --- 2. Performance Calculations (Player-centric, new logic) ---
            const totalEntrants = tourney.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
            if (totalEntrants === 0) return; // Skip tournaments with no valid entries

            const totalPrizePool = (tourney.entries.reduce((sum, e) => sum + e.buyins, 0) * tourney.buyin) + (tourney.entries.reduce((sum, e) => sum + e.addons, 0) * tourney.addonCost);
            const payouts = tourney.payoutSettings.mode === 'manual' ? tourney.payoutSettings.manualPayouts : calculatePayouts(totalPrizePool, totalEntrants);
            const paidPlaces = payouts.length;

            const entriesByPlayer = new Map<string, Entry[]>();
            tourney.entries.forEach(entry => {
                if (!entriesByPlayer.has(entry.playerId)) {
                    entriesByPlayer.set(entry.playerId, []);
                }
                entriesByPlayer.get(entry.playerId)!.push(entry);
            });

            entriesByPlayer.forEach((playerEntries, playerId) => {
                if (!playerStats[playerId]) return;

                // Increment tournaments played once per player, per tournament
                playerStats[playerId].tournamentsPlayed += 1;

                // Find the player's best entry for determining their final rank
                const bestEntry = playerEntries
                    .filter(e => e.eliminationIndex !== null)
                    .sort((a, b) => (b.eliminationIndex ?? 0) - (a.eliminationIndex ?? 0))[0];

                if (bestEntry) {
                    // Dynamically calculate rank from the reliable eliminationIndex
                    const finalRank = totalEntrants - bestEntry.eliminationIndex! + 1;

                    if (finalRank <= paidPlaces) {
                        playerStats[playerId].itmCount += 1;
                    }
                    
                    if (finalRank === 1) {
                        playerStats[playerId].wins += 1;
                    }
                }
            });
        });

        const calculatedRankings = Object.values(playerStats)
            .filter(stats => stats.tournamentsPlayed > 0)
            .map(stats => {
                const netProfit = stats.totalWinnings - stats.totalCost;
                const roi = stats.totalCost > 0 ? (netProfit / stats.totalCost) * 100 : 0;
                const itmPercentage = stats.tournamentsPlayed > 0 ? (stats.itmCount / stats.tournamentsPlayed) * 100 : 0;
                return {
                    ...stats,
                    netProfit,
                    roi,
                    itmPercentage,
                    player: playerMap.get(stats.playerId)
                };
            }).filter((r): r is typeof r & {player: Player} => !!r.player);

        calculatedRankings.sort((a, b) => {
            const aValue = getNestedValue(a, sortConfig.key);
            const bValue = getNestedValue(b, sortConfig.key);

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return 0;
        });

        return { playerRankings: calculatedRankings, completedTournamentsForCharts: completedTournaments };

    }, [tournaments, players, playerMap, seasons, selectedSeasonId, sortConfig]);

    const { profitChartData, participationChartData } = useMemo(() => {
        const top10ByProfit = [...playerRankings]
            .sort((a,b) => b.netProfit - a.netProfit)
            .slice(0, 10)
            .reverse();

        const profitChartData = {
            labels: top10ByProfit.map(p => p.player.nickname),
            datasets: [{
                label: 'Bénéfice Net (MAD)',
                data: top10ByProfit.map(p => p.netProfit),
                backgroundColor: top10ByProfit.map(p => p.netProfit >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)'),
                borderColor: top10ByProfit.map(p => p.netProfit >= 0 ? '#16a34a' : '#dc2626'),
                borderWidth: 1,
            }]
        };
        
        const sortedTournaments = [...completedTournamentsForCharts].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const participationChartData = {
            labels: sortedTournaments.map(t => new Date(t.startDate)),
            datasets: [{
                label: 'Nombre de Participants',
                data: sortedTournaments.map(t => t.entries.length),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                tension: 0.1,
            }]
        };
        
        return { profitChartData, participationChartData };

    }, [playerRankings, completedTournamentsForCharts]);

    const baseChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#e5e7eb' } },
            tooltip: {
                backgroundColor: '#1f2937',
                titleColor: '#e5e7eb',
                bodyColor: '#d1d5db',
                borderColor: '#4b5563',
                borderWidth: 1,
            }
        },
    };
    
    const barOptions = { ...baseChartOptions, indexAxis: 'y' as const, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }, y: { ticks: { color: '#9ca3af' }, grid: { color: 'transparent' } } } };
    const lineOptions = { ...baseChartOptions, scales: { x: { type: 'time' as const, time: { unit: 'day' as const }, ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }, y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } } } };

    const requestSort = (key: string) => {
        let direction: 'ascending' | 'descending' = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };
    
    const getSortIndicator = (key: string) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'descending' ? ' ↓' : ' ↑';
    };

    const handleExport = () => {
        if (playerRankings.length === 0) return;

        const headers = ['Joueur', 'Tournois Joués', 'ITM', '% ITM', 'Gains Totals (MAD)', 'Coût Total (MAD)', 'Bénéfice Net (MAD)', 'ROI (%)', 'Victoires'];
        const csvRows = [headers.join(',')];

        playerRankings.forEach(p => {
            if (!p.player) return;
            const row = [
                `"${p.player.nickname.replace(/"/g, '""')}"`,
                p.tournamentsPlayed,
                p.itmCount,
                p.itmPercentage.toFixed(1),
                p.totalWinnings,
                p.totalCost,
                p.netProfit,
                p.roi.toFixed(1),
                p.wins
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
        const safeSeasonName = selectedSeason ? selectedSeason.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'all_seasons';
        link.setAttribute("href", url);
        link.setAttribute("download", `global_stats_${safeSeasonName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    const Th = ({ children, sortKey }: { children: React.ReactNode, sortKey: string }) => (
        <th onClick={() => requestSort(sortKey)} className="p-3 text-sm text-left text-gray-400 cursor-pointer hover:text-white transition-colors">
            {children}
            {getSortIndicator(sortKey)}
        </th>
    );

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <header className="mb-6">
                <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; Retour à l'accueil</Link>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <h1 className="text-4xl font-bold text-white">Statistiques Globales</h1>
                    <div className="flex items-center gap-4">
                        <select
                            value={selectedSeasonId}
                            onChange={e => setSelectedSeasonId(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-base text-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">Statistiques Globales (Toutes Saisons)</option>
                            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
                            <ArrowDownTrayIcon className="w-5 h-5"/> Exporter en CSV
                        </Button>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <Card>
                    <CardHeader>Top 10 - Bénéfice Net (MAD)</CardHeader>
                    <div className="h-96"><Bar options={barOptions} data={profitChartData} /></div>
                </Card>
                 <Card>
                    <CardHeader>Participation aux Tournois</CardHeader>
                    <div className="h-96"><Line options={lineOptions} data={participationChartData} /></div>
                </Card>
            </div>

            <Card>
                 {/* Desktop Table */}
                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-600">
                            <tr>
                                <Th sortKey="player.nickname">Joueur</Th>
                                <Th sortKey="tournamentsPlayed">Tournois Joués</Th>
                                <Th sortKey="itmCount">ITM</Th>
                                <Th sortKey="itmPercentage">% ITM</Th>
                                <Th sortKey="totalWinnings">Gains Totals</Th>
                                <Th sortKey="totalCost">Coût Total</Th>
                                <Th sortKey="netProfit">Bénéfice Net</Th>
                                <Th sortKey="roi">ROI</Th>
                                <Th sortKey="wins">Victoires</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {playerRankings.map(p => (
                                <tr key={p.playerId} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                                    <td className="p-3">
                                        <div className="flex items-center space-x-3">
                                            <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                            <span className="font-semibold">{p.player.nickname}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">{p.tournamentsPlayed}</td>
                                    <td className="p-3 text-center">{p.itmCount}</td>
                                    <td className="p-3 text-center">{p.itmPercentage.toFixed(1)}%</td>
                                    <td className="p-3 text-right font-mono text-green-400">{p.totalWinnings.toLocaleString()}</td>
                                    <td className="p-3 text-right font-mono text-yellow-400">{p.totalCost.toLocaleString()}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {p.netProfit.toLocaleString()}
                                    </td>
                                    <td className={`p-3 text-center font-mono font-bold ${p.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{p.roi.toFixed(1)}%</td>
                                    <td className="p-3 text-center">
                                         <div className="flex items-center justify-center gap-2">
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
                <div className="md:hidden space-y-4">
                    {playerRankings.map(p => (
                        <div key={p.playerId} className="bg-gray-800/50 p-4 rounded-lg">
                            <div className="flex items-center gap-3 mb-3">
                                <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                <span className="font-semibold text-lg">{p.player.nickname}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div className="font-semibold text-gray-300">Bénéfice Net:</div>
                                <div className={`font-mono font-bold text-right ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{p.netProfit.toLocaleString()} MAD</div>
                                
                                <div className="text-gray-400">ROI:</div>
                                <div className={`font-mono text-right ${p.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{p.roi.toFixed(1)}%</div>
                                
                                <div className="text-gray-400">Gains Totals:</div>
                                <div className="font-mono text-right text-green-400">{p.totalWinnings.toLocaleString()} MAD</div>

                                <div className="text-gray-400">Coût Total:</div>
                                <div className="font-mono text-right text-yellow-400">{p.totalCost.toLocaleString()} MAD</div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-700/50 grid grid-cols-3 gap-2 text-center text-sm">
                                <div>
                                    <div className="text-gray-400">Tournois</div>
                                    <div className="font-semibold">{p.tournamentsPlayed}</div>
                                </div>
                                <div>
                                    <div className="text-gray-400">ITM</div>
                                    <div className="font-semibold">{p.itmCount} ({p.itmPercentage.toFixed(0)}%)</div>
                                </div>
                                 <div>
                                    <div className="text-gray-400">Victoires</div>
                                    <div className="font-semibold flex items-center justify-center gap-1">
                                        {p.wins > 0 && <TrophyIcon className="w-4 h-4 text-yellow-500"/>} {p.wins}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {playerRankings.length === 0 && (
                    <div className="text-center p-8 text-gray-400">Aucune donnée de tournoi terminé pour la saison sélectionnée.</div>
                )}
            </Card>
        </div>
    );
};

export default GlobalStatsPage;
