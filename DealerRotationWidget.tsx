import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTournamentStore } from './store';
import { Card, CardHeader, Button, Modal, PlayIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, BanknotesIcon } from './components';
import { Tournament, Dealer, DealerSchedule, DealerShift } from './types';
import { generateDealerScheduleAlgorithm } from './utils';
import { format, differenceInMilliseconds, addMinutes } from 'date-fns';
import QRCode from 'qrcode';

// --- NEW COMPONENT: DealerShiftTimer ---
const DealerShiftTimer = ({ startTime }: { startTime: number | null }) => {
    const [elapsed, setElapsed] = useState(startTime ? Date.now() - startTime : 0);

    useEffect(() => {
        if (!startTime) return;
        const timer = setInterval(() => {
            setElapsed(Date.now() - startTime);
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    if (!startTime) return null;
    return <span className="font-mono text-xs text-gray-400">{formatTime(elapsed)}</span>;
};

const formatDuration = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
};

const DealerPayrollReport = ({ tournament, dealers }: { tournament: Tournament, dealers: Dealer[]}) => {
    const [hourlyRate, setHourlyRate] = useState(() => localStorage.getItem(`hourlyRate_${tournament.id}`) || '100');
     const [expandedDealer, setExpandedDealer] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem(`hourlyRate_${tournament.id}`, hourlyRate);
    }, [hourlyRate, tournament.id]);

    const payrollData = useMemo(() => {
        const rate = parseFloat(hourlyRate) || 0;
        const completedShifts = (tournament.dealerShifts || []).filter(s => s.shiftEndTime !== null && s.shiftStartTime !== null);

        const shiftsByDealer: { [key: string]: DealerShift[] } = {};
        completedShifts.forEach(shift => {
            if (!shiftsByDealer[shift.dealerId]) shiftsByDealer[shift.dealerId] = [];
            shiftsByDealer[shift.dealerId].push(shift);
        });

        const report = Object.keys(shiftsByDealer).map(dealerId => {
            const dealer = dealers.find(d => d.id === dealerId);
            const dealerShifts = shiftsByDealer[dealerId];
            
            let totalDurationMs = 0;
            const dailyBreakdown: { [date: string]: number } = {};

            dealerShifts.forEach(shift => {
                const duration = differenceInMilliseconds(shift.shiftEndTime!, shift.shiftStartTime!);
                totalDurationMs += duration;
                const dateKey = format(new Date(shift.shiftStartTime!), 'yyyy-MM-dd');
                dailyBreakdown[dateKey] = (dailyBreakdown[dateKey] || 0) + duration;
            });

            return {
                dealerId,
                dealerName: dealer?.nickname || 'Unknown',
                totalDurationMs,
                dailyBreakdown: Object.entries(dailyBreakdown).map(([date, duration]) => ({ date, duration })),
                totalPay: (totalDurationMs / (1000 * 60 * 60)) * rate
            };
        });

        return report.sort((a, b) => a.dealerName.localeCompare(b.dealerName));
    }, [tournament.dealerShifts, dealers, hourlyRate]);

    const handleExportCsv = () => {
        const rate = parseFloat(hourlyRate) || 0;
        const headers = ['Croupier', 'Date', 'Durée (HH:MM)', 'Montant Dû (MAD)'];
        const csvRows = [headers.join(',')];

        payrollData.forEach(data => {
            data.dailyBreakdown.forEach(item => {
                 const durationHours = item.duration / (1000 * 60 * 60);
                 const amount = durationHours * rate;
                 const row = [
                    `"${data.dealerName.replace(/"/g, '""')}"`,
                    format(new Date(item.date), "dd/MM/yyyy"),
                    formatDuration(item.duration).replace('h ', ':'),
                    amount.toFixed(2)
                 ];
                 csvRows.push(row.join(','));
            });
             // Add total row for each dealer
            csvRows.push([`"${data.dealerName} - TOTAL"`, '', formatDuration(data.totalDurationMs).replace('h ', ':'), data.totalPay.toFixed(2)].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeName = tournament.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("href", url);
        link.setAttribute("download", `rapport_paie_${safeName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (payrollData.length === 0) {
        return (
             <div className="mt-6 border-t border-gray-600 pt-4">
                <h3 className="text-lg font-semibold text-white mb-2">Rapport de Paie</h3>
                 <p className="text-sm text-gray-500 text-center py-4">Aucun service de croupier terminé pour ce tournoi.</p>
            </div>
        )
    }

    return (
        <div className="mt-6 border-t border-gray-600 pt-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Rapport de Paie</h3>
                <div className="flex items-center gap-4">
                     <div className="flex items-center gap-2">
                        <label htmlFor="hourly-rate" className="text-sm text-gray-400">Taux Horaire (MAD)</label>
                        <input id="hourly-rate" type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} className="w-24 bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white" />
                    </div>
                    <Button variant="secondary" onClick={handleExportCsv} className="flex items-center gap-2">
                        <ArrowDownTrayIcon className="w-5 h-5"/> Exporter CSV
                    </Button>
                </div>
            </div>

            <div className="space-y-1">
                {payrollData.map(data => (
                    <details key={data.dealerId} className="bg-gray-700/50 rounded-lg overflow-hidden" onToggle={(e) => { if((e.target as HTMLDetailsElement).open) setExpandedDealer(data.dealerId); else if(expandedDealer === data.dealerId) setExpandedDealer(null); }} open={expandedDealer === data.dealerId}>
                        <summary className="p-3 cursor-pointer flex justify-between items-center list-none">
                            <span className="font-semibold text-white">{data.dealerName}</span>
                            <div className="flex items-center gap-6">
                                <span className="font-mono">{formatDuration(data.totalDurationMs)}</span>
                                <span className="font-mono font-bold text-green-400">{data.totalPay.toFixed(2)} MAD</span>
                            </div>
                        </summary>
                        <div className="bg-gray-900/30 px-3 pb-3">
                            <table className="w-full text-sm mt-2">
                                <thead>
                                    <tr className="border-b border-gray-600">
                                        <th className="text-left font-normal text-gray-400 py-1">Date</th>
                                        <th className="text-right font-normal text-gray-400 py-1">Durée</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.dailyBreakdown.map(item => (
                                        <tr key={item.date}>
                                            <td className="py-1">{format(new Date(item.date), "dd/MM/yyyy")}</td>
                                            <td className="py-1 text-right font-mono">{formatDuration(item.duration)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
};


const DealerScheduleGeneratorModal = ({ tournament, availableDealers, isOpen, onClose }: { tournament: Tournament, availableDealers: Dealer[], isOpen: boolean, onClose: () => void }) => {
    const { dispatch } = useTournamentStore();
    const [selectedDealerIds, setSelectedDealerIds] = useState<Set<string>>(new Set((tournament.dealerShifts || []).filter(ds => ds.status !== 'off_duty').map(ds => ds.dealerId)));
    const [durationHours, setDurationHours] = useState(6);
    const [granularity, setGranularity] = useState(30);

    const [startTime, setStartTime] = useState(() => {
        const now = new Date();
        const minutes = now.getMinutes();
        const remainder = minutes % granularity;
        const minutesToAdd = remainder === 0 ? 0 : granularity - remainder;
        const nextSlot = addMinutes(now, minutesToAdd);
        nextSlot.setSeconds(0);
        nextSlot.setMilliseconds(0);
        return format(nextSlot, "yyyy-MM-dd'T'HH:mm");
    });

    const handleToggleDealer = (dealerId: string) => {
        setSelectedDealerIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dealerId)) newSet.delete(dealerId);
            else newSet.add(dealerId);
            return newSet;
        });
    };

    const handleGenerate = () => {
        const [datePart, timePart] = startTime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        const generationStartTime = new Date(year, month - 1, day, hours, minutes);

        if (isNaN(generationStartTime.getTime())) {
            alert("L'heure de début sélectionnée est invalide. Veuillez la vérifier.");
            return;
        }

        const oldSchedule = tournament.dealerSchedule || {};
        const oldTimestamps = Object.keys(oldSchedule).sort();

        const preservedSchedule: DealerSchedule = {};
        for (const ts of oldTimestamps) {
            if (new Date(ts).getTime() < generationStartTime.getTime()) {
                preservedSchedule[ts] = oldSchedule[ts];
            }
        }

        const newSchedulePart = generateDealerScheduleAlgorithm(
            tournament.tables,
            Array.from(selectedDealerIds),
            generationStartTime,
            durationHours,
            granularity
        );

        if (newSchedulePart) {
            const finalSchedule = { ...preservedSchedule, ...newSchedulePart };
            dispatch({ type: 'GENERATE_DEALER_SCHEDULE', payload: { tournamentId: tournament.id, schedule: finalSchedule } });
            onClose();
        }
    };

    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Générer / Regénérer un Planning</CardHeader>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Croupiers à inclure</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 bg-gray-900/50 rounded-md max-h-48 overflow-y-auto">
                        {availableDealers.map(dealer => (
                            <div key={dealer.id} onClick={() => handleToggleDealer(dealer.id)} className={`flex items-center gap-2 p-2 rounded-md cursor-pointer ${selectedDealerIds.has(dealer.id) ? 'bg-blue-600' : 'bg-gray-700'}`}>
                                <input type="checkbox" checked={selectedDealerIds.has(dealer.id)} readOnly className="h-4 w-4 rounded border-gray-500 bg-gray-800 text-blue-600 focus:ring-blue-500 pointer-events-none" />
                                <span className="text-sm font-semibold">{dealer.nickname}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Heure de début (re)génération</label>
                        <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Durée (heures)</label>
                        <input type="number" value={durationHours} min="1" max="24" onChange={e => setDurationHours(parseInt(e.target.value))} className={inputClasses} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Créneaux (min)</label>
                        <select value={granularity} onChange={e => setGranularity(parseInt(e.target.value))} className={inputClasses}>
                            <option value="20">20 minutes</option>
                            <option value="30">30 minutes</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="primary" onClick={handleGenerate}>Générer le Planning</Button>
            </div>
        </Modal>
    );
};

const FullScheduleModal = ({ schedule, tables, scheduledDealers, onClose }: { schedule: DealerSchedule, tables: Tournament['tables'], scheduledDealers: Dealer[], onClose: () => void }) => {
    const [now, setNow] = useState(new Date());
    const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

    useEffect(() => {
        const timerId = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timerId);
    }, []);

    const timestamps = useMemo(() => Object.keys(schedule).sort(), [schedule]);
    const dealerMap = useMemo(() => new Map(scheduledDealers.map(d => [d.id, d])), [scheduledDealers]);
    const sortedTables = useMemo(() => [...tables].sort((a, b) => a.id - b.id), [tables]);

    const currentSlotIndex = useMemo(() => {
        const nowTime = now.getTime();
        let index = -1;
        for (let i = timestamps.length - 1; i >= 0; i--) {
            if (new Date(timestamps[i]).getTime() <= nowTime) {
                index = i;
                break;
            }
        }
        return index;
    }, [timestamps, now]);

    useEffect(() => {
        if (currentSlotIndex !== -1 && rowRefs.current[currentSlotIndex]) {
            rowRefs.current[currentSlotIndex]?.scrollIntoView({
                behavior: 'auto',
                block: 'center',
            });
        }
    }, [currentSlotIndex]);

    return (
        <Modal isOpen={true} onClose={onClose}>
            <CardHeader>Planning Complet des Croupiers</CardHeader>
            <div className="max-h-[80vh] overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-800 z-10">
                        <tr className="border-b border-gray-600">
                            <th className="p-2 text-sm text-gray-400">Heure</th>
                            {sortedTables.map(table => <th key={table.id} className="p-2 text-sm text-center text-gray-400">{table.name}</th>)}
                            <th className="p-2 text-sm text-center text-gray-400">En Pause</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timestamps.map((ts, index) => {
                            const assignments = schedule[ts];
                            const assignedDealers = new Set(Object.values(assignments));
                            const onBreakDealers = scheduledDealers.filter(d => !assignedDealers.has(d.id));
                            
                            const isPast = index < currentSlotIndex;
                            const isCurrent = index === currentSlotIndex;
                            
                            const rowClass = isCurrent
                                ? 'bg-blue-900/50 border-y-2 border-blue-500'
                                : isPast
                                ? 'bg-gray-800/60 text-gray-500'
                                : 'border-b border-gray-700/50';

                            return (
                                <tr key={ts} className={rowClass} ref={el => { if (el) rowRefs.current[index] = el; }}>
                                    <td className={`p-2 font-mono text-xs whitespace-nowrap ${isPast ? 'text-gray-500' : ''}`}>{format(new Date(ts), 'HH:mm')}</td>
                                    {sortedTables.map(table => {
                                        const dealerId = assignments[`T${table.id}`];
                                        const dealer = dealerId ? dealerMap.get(dealerId) : null;
                                        return <td key={table.id} className={`p-2 text-center text-sm whitespace-nowrap ${isPast ? 'text-gray-500' : 'text-white'}`}>{dealer?.nickname || '-'}</td>
                                    })}
                                    <td className={`p-2 text-center text-xs whitespace-nowrap ${isPast ? 'text-gray-500' : 'text-yellow-400'}`}>
                                        {onBreakDealers.map(d => d.nickname).join(', ')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
};

const DealerScheduleDisplayModal = ({ tournamentId, onClose }: { tournamentId: string, onClose: () => void }) => {
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const displayUrl = `${window.location.origin}${window.location.pathname}#/public/t/${tournamentId}/dealers`;

    useEffect(() => {
        if (qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, displayUrl, {
                width: 256,
                margin: 2,
                color: { dark: '#FFFFFF', light: '#00000000' }
            }, (error) => {
                if (error) console.error(error);
            });
        }
    }, [displayUrl]);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(displayUrl).then(() => {
            alert('URL copiée dans le presse-papiers !');
        });
    };

    return (
        <Modal isOpen={true} onClose={onClose}>
            <CardHeader>Affichage Public du Planning</CardHeader>
            <p className="text-gray-400 mb-4">
                Ouvrez cette URL sur un autre écran (TV, tablette) ou scannez le QR code pour afficher le planning en direct pour les croupiers.
            </p>
            <div className="text-center">
                <canvas ref={qrCanvasRef} />
            </div>
            <div className="mt-4 p-2 bg-gray-900 rounded-md text-center">
                <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 break-all hover:underline">
                    {displayUrl}
                </a>
            </div>
            <div className="flex justify-end gap-4 mt-6">
                <Button variant="secondary" onClick={handleCopyUrl}>Copier l'URL</Button>
                <Button onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    );
};


export const DealerScheduleWidget = ({ tournament }: { tournament: Tournament }) => {
    const { state, dispatch } = useTournamentStore();
    const { dealers } = state;
    const [isGeneratorOpen, setGeneratorOpen] = useState(false);
    const [isFullScheduleOpen, setFullScheduleOpen] = useState(false);
    const [isDisplayModalOpen, setDisplayModalOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const dealersAssignedData = useMemo(() => {
        return (tournament.dealerShifts || [])
            .filter(shift => shift.status !== 'off_duty')
            .map(shift => ({ shift, dealer: dealers.find(d => d.id === shift.dealerId) }))
            .filter((item): item is { shift: DealerShift, dealer: Dealer } => !!item.dealer)
            .sort((a, b) => {
                if (a.shift.status === 'assigned' && b.shift.status !== 'assigned') return -1;
                if (a.shift.status !== 'assigned' && b.shift.status === 'assigned') return 1;
                return a.dealer.nickname.localeCompare(b.dealer.nickname);
            });
    }, [tournament.dealerShifts, dealers]);
    
    const assignedButNotStartedCount = dealersAssignedData.filter(d => d.shift.status === 'assigned').length;

    const assignedDealerIds = new Set(dealersAssignedData.map(d => d.dealer.id));
    const availableDealers = dealers.filter(d => !assignedDealerIds.has(d.id));
    
    const dealersInSchedule = useMemo(() => {
        if (!tournament.dealerSchedule) return [];
        const schedule = tournament.dealerSchedule;
        const dealerIdsInSchedule = new Set<string>();
        Object.values(schedule).forEach(assignments => {
            Object.values(assignments).forEach(dealerId => {
                if (dealerId) dealerIdsInSchedule.add(dealerId);
            });
        });
        return dealers.filter(d => dealerIdsInSchedule.has(d.id));
    }, [tournament.dealerSchedule, dealers]);

    const handleAssign = (dealerId: string) => dispatch({ type: 'ASSIGN_DEALER_TO_TOURNAMENT', payload: { tournamentId: tournament.id, dealerId } });
    const handleUnassign = (dealerId: string) => dispatch({ type: 'UNASSIGN_DEALER', payload: { tournamentId: tournament.id, dealerId } });
    const handleStartService = (dealerId: string) => dispatch({ type: 'START_DEALER_SERVICE', payload: { tournamentId: tournament.id, dealerId } });
    const handleStartAll = () => dispatch({ type: 'START_ALL_ASSIGNED_DEALERS_SERVICE', payload: { tournamentId: tournament.id } });
    const handleEndShift = (dealerId: string) => dispatch({ type: 'END_DEALER_SHIFT', payload: { tournamentId: tournament.id, dealerId } });
    const handleToggleBreak = (dealerId: string) => dispatch({ type: 'TOGGLE_DEALER_BREAK', payload: { tournamentId: tournament.id, dealerId } });

    return (
        <>
            {isGeneratorOpen && <DealerScheduleGeneratorModal tournament={tournament} availableDealers={dealers} isOpen={isGeneratorOpen} onClose={() => setGeneratorOpen(false)} />}
            {isFullScheduleOpen && tournament.dealerSchedule && <FullScheduleModal schedule={tournament.dealerSchedule} tables={tournament.tables} scheduledDealers={dealersInSchedule} onClose={() => setFullScheduleOpen(false)} />}
            {isDisplayModalOpen && <DealerScheduleDisplayModal tournamentId={tournament.id} onClose={() => setDisplayModalOpen(false)} />}
            
            <Card>
                <CardHeader>Gestion des Croupiers</CardHeader>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                    <Button variant="primary" onClick={() => setGeneratorOpen(true)}>Générer / Regénérer Planning</Button>
                    <Button variant="secondary" onClick={() => setFullScheduleOpen(true)} disabled={!tournament.dealerSchedule}>Voir Planning Complet</Button>
                    <Button variant="secondary" onClick={() => setDisplayModalOpen(true)} disabled={!tournament.dealerSchedule}>Afficher pour Croupiers</Button>
                </div>

                <div className="space-y-4">
                     <div>
                        <div className="flex justify-between items-center mb-2">
                             <h3 className="text-sm font-semibold text-gray-300">Croupiers Assignés au Tournoi ({dealersAssignedData.length})</h3>
                             {assignedButNotStartedCount > 0 && (
                                <Button size="sm" variant="primary" onClick={handleStartAll}>
                                    Démarrer le service pour tous ({assignedButNotStartedCount})
                                </Button>
                             )}
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                             {dealersAssignedData.map(({ dealer, shift }) => (
                                <div key={dealer.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <img src={dealer.avatarUrl} alt={dealer.nickname} className="w-8 h-8 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-white text-sm">{dealer.nickname}</p>
                                            {shift.status === 'working' && <DealerShiftTimer startTime={shift.shiftStartTime} />}
                                            {shift.status === 'on_break' && <span className="font-mono text-xs text-yellow-400">EN PAUSE</span>}
                                            {shift.status === 'assigned' && <span className="font-mono text-xs text-gray-400">En attente</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {shift.status === 'assigned' && <>
                                            <Button size="sm" variant="secondary" className="text-xs px-2 py-1" onClick={() => handleStartService(dealer.id)}>Démarrer</Button>
                                            <Button size="sm" variant="danger" className="text-xs px-2 py-1" onClick={() => handleUnassign(dealer.id)}>Retirer</Button>
                                        </>}
                                        {(shift.status === 'working' || shift.status === 'on_break') && <>
                                            <Button size="sm" variant="secondary" className="text-xs px-2 py-1" onClick={() => handleToggleBreak(dealer.id)}>{shift.status === 'on_break' ? 'Reprendre' : 'Pause'}</Button>
                                            <Button size="sm" variant="danger" className="text-xs px-2 py-1" onClick={() => handleEndShift(dealer.id)}>Fin de service</Button>
                                        </>}
                                    </div>
                                </div>
                            ))}
                             {dealersAssignedData.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Aucun croupier assigné</p>}
                        </div>
                    </div>

                    <div>
                         <h3 className="text-sm font-semibold text-gray-300 mb-2">Croupiers Disponibles ({availableDealers.length})</h3>
                         <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {availableDealers.map(dealer => (
                                <div key={dealer.id} className="flex items-center justify-between bg-gray-900/50 p-2 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <img src={dealer.avatarUrl} alt={dealer.nickname} className="w-8 h-8 rounded-full" />
                                        <p className="font-semibold text-white text-sm">{dealer.nickname}</p>
                                    </div>
                                    <Button size="sm" variant="secondary" className="text-xs px-2 py-1" onClick={() => handleAssign(dealer.id)}>Assigner au Tournoi</Button>
                                </div>
                            ))}
                             {availableDealers.length === 0 && <p className="text-xs text-gray-500 text-center py-2">Tous les croupiers sont assignés</p>}
                        </div>
                    </div>
                </div>
                <DealerPayrollReport tournament={tournament} dealers={dealers} />
            </Card>
        </>
    );
};
