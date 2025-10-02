
import React, { useMemo, useState } from 'react';
import { useTournamentStore, calculatePayouts } from './store';
import { Tournament, Player, EntryStatus } from './types';
import { Card, CardHeader, StatCard, CurrencyDollarIcon, Button, ArrowDownTrayIcon } from './components';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, BarController } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, DoughnutController, BarController);

interface PlayerStat {
    playerId: string;
    player: Player;
    rebuys: number;
    addons: number;
    totalCost: number;
    winnings: number;
    netProfit: number;
}

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
};

export const TournamentStatsWidget = ({ tournament }: { tournament: Tournament }) => {
    const { state } = useTournamentStore();
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' }>({ key: 'netProfit', direction: 'descending' });
    const [searchTerm, setSearchTerm] = useState('');

    const playerMap = useMemo(() => new Map(state.players.map(p => [p.id, p])), [state.players]);

    const { playerStats, summary, payoutChartData, chipLeaderChartData } = useMemo(() => {
        const stats: { [playerId: string]: PlayerStat } = {};
        
        const playerIdsInTournament = new Set(tournament.entries.map(e => e.playerId));
    
        playerIdsInTournament.forEach(playerId => {
            const player = playerMap.get(playerId);
            if (player) {
                stats[playerId] = {
                    playerId: playerId,
                    player: player,
                    rebuys: 0,
                    addons: 0,
                    totalCost: 0,
                    winnings: 0,
                    netProfit: 0,
                };
            }
        });
        
        const totalBuyinCommissions = (tournament.buyinCommissions || []).reduce((sum, c) => sum + c.amount, 0);
        const totalAddonCommissions = (tournament.addonCommissions || []).reduce((sum, c) => sum + c.amount, 0);

        tournament.transactions.forEach(tx => {
            if (stats[tx.playerId]) {
                if (tx.type === 'buyin' || tx.type === 'rebuy') {
                    stats[tx.playerId].totalCost += tx.amount + totalBuyinCommissions;
                    if (tx.type === 'rebuy') stats[tx.playerId].rebuys += 1;
                } else if (tx.type === 'addon') {
                    stats[tx.playerId].totalCost += tx.amount + totalAddonCommissions;
                    stats[tx.playerId].addons += 1;
                } else if (tx.type === 'dealer_bonus') {
                    stats[tx.playerId].totalCost += tx.amount;
                } else if (tx.type === 'payout') {
                    stats[tx.playerId].winnings += Math.abs(tx.amount);
                }
            }
        });

        const playerStatsArray = Object.values(stats).map(stat => ({
            ...stat,
            netProfit: stat.winnings - stat.totalCost,
        }));
        
        const totalRebuys = playerStatsArray.reduce((sum, s) => sum + s.rebuys, 0);
        const totalAddons = playerStatsArray.reduce((sum, s) => sum + s.addons, 0);
        
        const buyinCount = tournament.transactions.filter(t => t.type === 'buyin' || t.type === 'rebuy').length;
        const addonCount = tournament.transactions.filter(t => t.type === 'addon').length;
        const totalCommissions = (buyinCount * totalBuyinCommissions) + (addonCount * totalAddonCommissions);

        // Chart Data Calculation
        const totalPrizePool = (tournament.entries.reduce((sum, e) => sum + e.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((sum, e) => sum + e.addons, 0) * tournament.addonCost);
        const totalEntries = tournament.entries.filter(e => e.status !== 'Merge Discarded').length;
        const payouts = calculatePayouts(totalPrizePool, totalEntries);
        const activePlayers = tournament.entries
            .filter(e => e.status === EntryStatus.ACTIVE)
            .map(entry => ({ ...entry, player: playerMap.get(entry.playerId) }))
            .filter((e): e is typeof e & {player: Player} => !!e.player)
            .sort((a, b) => b.chipCount - a.chipCount);
        
        const chartColors = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#1d4ed8', '#2563eb'];
        
        const payoutChartData = {
            labels: payouts.slice(0, 7).map(p => `#${p.rank}`),
            datasets: [{
                label: 'Payout (MAD)',
                data: payouts.slice(0, 7).map(p => p.amount),
                backgroundColor: chartColors,
                borderColor: '#1f2937',
                borderWidth: 2,
            }]
        };

        const top10Leaders = activePlayers.slice(0, 10);
        const chipLeaderChartData = {
            labels: top10Leaders.map(p => p.player.nickname),
            datasets: [{
                label: 'Chip Count',
                data: top10Leaders.map(p => p.chipCount),
                backgroundColor: '#3b82f6',
                borderColor: '#1e40af',
                borderWidth: 1,
            }]
        };

        return { 
            playerStats: playerStatsArray,
            summary: { totalRebuys, totalAddons, totalCommissions },
            payoutChartData,
            chipLeaderChartData,
        };

    }, [tournament, playerMap]);
    
    const sortedPlayerStats = useMemo(() => {
        let filteredStats = [...playerStats];

        if (searchTerm.trim() !== '') {
            const lowercasedSearch = searchTerm.toLowerCase();
            filteredStats = filteredStats.filter(stat =>
                stat.player.nickname.toLowerCase().includes(lowercasedSearch)
            );
        }
        
        const sortableItems = filteredStats;
        sortableItems.sort((a, b) => {
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
        return sortableItems;
    }, [playerStats, sortConfig, searchTerm]);

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
        if (sortedPlayerStats.length === 0) return;

        const headers = ['Joueur', 'Re-entries/Rebuys', 'Add-ons', 'Coût Total (MAD)', 'Gains (MAD)', 'Bénéfice Net (MAD)'];
        const csvRows = [headers.join(',')];

        sortedPlayerStats.forEach(p => {
            const row = [
                `"${p.player.nickname.replace(/"/g, '""')}"`,
                p.rebuys,
                p.addons,
                p.totalCost,
                p.winnings,
                p.netProfit
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeTournamentName = tournament.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("href", url);
        link.setAttribute("download", `stats_${safeTournamentName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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

    const doughnutOptions = { ...baseChartOptions, plugins: { ...baseChartOptions.plugins, legend: { ...baseChartOptions.plugins.legend, position: 'right' as const }}};
    const barOptions = { ...baseChartOptions, scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }, y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } } } };

    const Th = ({ children, sortKey, className }: { children: React.ReactNode, sortKey: string, className?: string }) => (
        <th onClick={() => requestSort(sortKey)} className={`p-3 text-sm text-left text-gray-400 cursor-pointer hover:text-white transition-colors ${className}`}>
            {children}
            {getSortIndicator(sortKey)}
        </th>
    );

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Re-entries / Rebuys" value={summary.totalRebuys} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
                <StatCard label="Total Add-ons" value={summary.totalAddons} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
                <StatCard label="Total Commissions" value={`${summary.totalCommissions.toLocaleString()} MAD`} icon={<CurrencyDollarIcon className="w-6 h-6"/>} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>Distribution du Prizepool</CardHeader>
                    <div className="h-80"><Doughnut options={doughnutOptions} data={payoutChartData} /></div>
                </Card>
                 <Card>
                    <CardHeader>Top 10 Chip Leaders</CardHeader>
                    <div className="h-80"><Bar options={barOptions} data={chipLeaderChartData} /></div>
                </Card>
            </div>

            <Card>
                <div className="flex justify-between items-center">
                    <CardHeader>Statistiques par Joueur</CardHeader>
                    <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2 -mt-4">
                        <ArrowDownTrayIcon className="w-5 h-5"/>
                        Exporter en CSV
                    </Button>
                </div>
                 <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher un joueur..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                <div className="overflow-x-auto max-h-[50vh]">
                    <table className="w-full text-left">
                        <thead className="border-b border-gray-600 sticky top-0 bg-gray-800">
                            <tr>
                                <Th sortKey="player.nickname">Joueur</Th>
                                <Th sortKey="rebuys" className="text-center">Re-entries/Rebuys</Th>
                                <Th sortKey="addons" className="text-center">Add-ons</Th>
                                <Th sortKey="totalCost" className="text-right">Coût Total</Th>
                                <Th sortKey="winnings" className="text-right">Gains</Th>
                                <Th sortKey="netProfit" className="text-right">Bénéfice Net</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedPlayerStats.map(p => (
                                <tr key={p.playerId} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                                    <td className="p-3">
                                        <div className="flex items-center space-x-3">
                                            <img src={p.player.avatarUrl} alt={p.player.nickname} className="w-10 h-10 rounded-full" />
                                            <span className="font-semibold">{p.player.nickname}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">{p.rebuys}</td>
                                    <td className="p-3 text-center">{p.addons}</td>
                                    <td className="p-3 text-right font-mono text-yellow-400">{p.totalCost.toLocaleString()}</td>
                                    <td className="p-3 text-right font-mono text-green-400">{p.winnings.toLocaleString()}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${p.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {p.netProfit.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};