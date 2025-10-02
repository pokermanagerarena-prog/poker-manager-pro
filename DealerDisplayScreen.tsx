import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournamentStore } from './store';
import { Tournament, Dealer, DealerSchedule, PokerTable } from './types';
import { format } from 'date-fns';

const DealerDisplayScreen = () => {
    const { id } = useParams<{ id: string }>();
    const { state } = useTournamentStore();
    const tournament = state.tournaments.find(t => t.id === id);
    const { dealers } = state;
    const [currentTime, setCurrentTime] = useState(new Date());
    const currentSlotRef = useRef<HTMLTableRowElement>(null);
    const hasScrolled = useRef(false);

    useEffect(() => {
        const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    
    const { timestamps, sortedTables, dealerMap, onBreakDealersBySlot, currentSlotIndex } = useMemo(() => {
        if (!tournament?.dealerSchedule) return { timestamps: [], sortedTables: [], dealerMap: new Map(), onBreakDealersBySlot: {}, currentSlotIndex: -1 };
        
        const schedule = tournament.dealerSchedule;
        const timestamps = Object.keys(schedule).sort();
        const dealerMap = new Map(dealers.map(d => [d.id, d]));
        const sortedTables = [...tournament.tables].sort((a, b) => a.id - b.id);
        
        const dealerIdsInSchedule = new Set<string>();
        Object.values(schedule).forEach(assignments => {
            Object.values(assignments).forEach(dealerId => {
                if(dealerId) dealerIdsInSchedule.add(dealerId);
            });
        });

        const onBreakDealersBySlot: { [ts: string]: Dealer[] } = {};
        timestamps.forEach(ts => {
            const assignedDealers = new Set(Object.values(schedule[ts]));
            onBreakDealersBySlot[ts] = Array.from(dealerIdsInSchedule)
                .map(id => dealerMap.get(id))
                .filter((d): d is Dealer => !!d && !assignedDealers.has(d.id));
        });

        const nowTime = currentTime.getTime();
        let currentIdx = -1;
        for (let i = timestamps.length - 1; i >= 0; i--) {
            if (new Date(timestamps[i]).getTime() <= nowTime) {
                currentIdx = i;
                break;
            }
        }

        return { timestamps, sortedTables, dealerMap, onBreakDealersBySlot, currentSlotIndex: currentIdx };
    }, [tournament, dealers, currentTime]);

    useEffect(() => {
        if (currentSlotRef.current && !hasScrolled.current) {
            currentSlotRef.current.scrollIntoView({
                behavior: 'auto',
                block: 'center'
            });
            hasScrolled.current = true; // Prevents re-scrolling on every minor re-render
        }
        // If the current slot index changes, allow scrolling again
        if(currentSlotIndex !== -1) {
            const timeout = setTimeout(() => { hasScrolled.current = false; }, 30000); // Allow re-centering every 30s
            return () => clearTimeout(timeout);
        }
    }, [currentSlotIndex]);
    
    if (!tournament) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', fontFamily: 'sans-serif' }}>
                <h1>Tournoi non trouvé</h1>
                <p><Link to="/public" style={{ color: '#007bff' }}>Retourner au Lobby</Link></p>
            </div>
        );
    }
    
    if (!tournament.dealerSchedule) {
         return (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', fontFamily: 'sans-serif' }}>
                <h1>Planning des croupiers non disponible</h1>
                <p>Aucun planning n'a été généré pour ce tournoi.</p>
            </div>
        );
    }

    const css = `
        body {
            background-color: #F8F9FA !important;
            color: #212529 !important;
            overflow: hidden; /* Prevent body scroll */
        }
        .dealer-display-container {
            font-family: 'Segoe UI', Roboto, system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            height: 100vh;
            padding: 2rem;
        }
        .header {
            flex-shrink: 0;
            border-bottom: 4px solid #000;
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }
        .header h1 {
            font-size: 3.5rem;
            font-weight: 700;
            line-height: 1;
        }
        .clock {
            font-size: 3rem;
            font-weight: 700;
            font-family: 'monospace', 'Courier New';
        }
        .schedule-grid {
            flex-grow: 1;
            overflow: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 1.25rem;
        }
        th, td {
            padding: 1rem;
            text-align: center;
            border: 1px solid #DEE2E6;
            white-space: nowrap;
        }
        thead th {
            background-color: #E9ECEF;
            position: sticky;
            top: 0;
            z-index: 10;
            font-weight: 600;
        }
        tr.current-slot {
            background-color: #FFF3CD !important;
            border: 3px solid #FFC107;
            font-weight: bold;
        }
        tr.past-slot {
            color: #6C757D;
            background-color: #F8F9FA;
        }
        td.break-column {
            background-color: #D1E7DD; /* Light green */
            color: #0F5132;
        }
    `;

    return (
        <>
            <style>{css}</style>
            <div className="dealer-display-container">
                <header className="header">
                    <h1>{tournament.name}</h1>
                    <div className="clock">{format(currentTime, 'HH:mm:ss')}</div>
                </header>
                <main className="schedule-grid">
                    <table>
                        <thead>
                            <tr>
                                <th>Heure</th>
                                {sortedTables.map(table => <th key={table.id}>{table.name}</th>)}
                                <th>En Pause</th>
                            </tr>
                        </thead>
                        <tbody>
                            {timestamps.map((ts, index) => {
                                const assignments = tournament.dealerSchedule![ts];
                                const onBreak = onBreakDealersBySlot[ts];
                                const isCurrent = index === currentSlotIndex;
                                const isPast = index < currentSlotIndex;
                                const rowClass = isCurrent ? 'current-slot' : (isPast ? 'past-slot' : '');

                                return (
                                    <tr key={ts} className={rowClass} ref={isCurrent ? currentSlotRef : null}>
                                        <td className="font-mono text-lg">{format(new Date(ts), 'HH:mm')}</td>
                                        {sortedTables.map(table => {
                                            const dealerId = assignments[`T${table.id}`];
                                            const dealer = dealerId ? dealerMap.get(dealerId) : null;
                                            return <td key={table.id}>{dealer?.nickname || '-'}</td>
                                        })}
                                        <td className="break-column">{onBreak.map(d => d.nickname).join(', ')}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </main>
            </div>
        </>
    );
};

export default DealerDisplayScreen;
