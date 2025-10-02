import { Payout, PokerTable, DealerSchedule } from './types';
import { formatISO, addMinutes, format } from 'date-fns';

export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * Calculates player points for a tournament.
 * The formula is designed to be more balanced, reducing the heavy impact of high buy-ins and large fields.
 * It rewards consistency by dampening the effect of rank and total entrants.
 * Formula: (BasePoints + log10(Buy-in) * BuyinFactor) * (cbrt(TotalEntrants) / sqrt(Rank))
 */
export const calculatePoints = (buyin: number, totalEntrants: number, rank: number): number => {
    if (totalEntrants <= 0 || rank <= 0 || buyin < 0) return 0;

    // Further reduced buy-in impact by lowering the multiplier
    const buyinFactor = Math.log10(buyin || 1) * 25;
    const basePoints = 100;

    // Dampened the impact of large fields (cube root) and high ranks (square root)
    // to reward consistency more.
    const performanceMultiplier = (Math.cbrt(totalEntrants) / Math.sqrt(rank));

    const points = (basePoints + buyinFactor) * performanceMultiplier;
    
    return Math.round(points * 100) / 100; // Round to 2 decimal places
};


export const calculatePayouts = (totalPrizePool: number, totalEntries: number): Payout[] => {
    if (totalEntries === 0 || totalPrizePool === 0) return [];
    
    // Payout structure based on number of entries
    let paidPlaces = 0;
    if (totalEntries >= 50) paidPlaces = 9;
    else if (totalEntries >= 40) paidPlaces = 7;
    else if (totalEntries >= 30) paidPlaces = 5;
    else if (totalEntries >= 20) paidPlaces = 4;
    else if (totalEntries >= 10) paidPlaces = 3;
    else if (totalEntries >= 5) paidPlaces = 2;
    else if (totalEntries > 1) paidPlaces = 1;

    if (paidPlaces === 0) return [];
    
    // Example percentage structures
    const percentages: { [key: number]: number[] } = {
        1: [1.0],
        2: [0.65, 0.35],
        3: [0.50, 0.30, 0.20],
        4: [0.45, 0.25, 0.18, 0.12],
        5: [0.40, 0.23, 0.15, 0.12, 0.10],
        7: [0.38, 0.22, 0.15, 0.10, 0.07, 0.05, 0.03],
        9: [0.35, 0.22, 0.15, 0.10, 0.07, 0.05, 0.03, 0.015, 0.015],
    };

    const structure = percentages[paidPlaces] || percentages[9];
    const payouts: Payout[] = [];
    let remainingPool = totalPrizePool;
    
    for (let i = 0; i < paidPlaces; i++) {
        const percentage = structure[i] || 0;
        const amount = totalPrizePool * percentage;
        // Round to nearest 5 or 10 for cleaner payouts
        const roundedAmount = Math.floor(amount / 5) * 5; 
        payouts.push({ rank: i + 1, amount: roundedAmount });
        remainingPool -= roundedAmount;
    }
    
    // Distribute any remainder due to rounding to the first place
    if(payouts.length > 0) {
        payouts[0].amount += remainingPool;
    }
    
    return payouts;
};

// --- DEALER SCHEDULE GENERATOR ---

interface ScheduleBlock {
    tables: PokerTable[];
    dealers: string[];
    // FIX: Added '2T-3D' to support blocks of 2 tables.
    schema: '2T-3D' | '3T-4D' | '4T-5D' | '5T-6D'; // 2 Tables-3 Dealers, etc.
}

export const generateDealerScheduleAlgorithm = (
    tables: PokerTable[],
    dealerIds: string[],
    startTime: Date,
    durationHours: number,
    granularity: number
): DealerSchedule | null => {
    // 1. Partition tables into blocks and assign dealers
    let remainingTables = [...tables].sort((a, b) => a.id - b.id);
    let remainingDealers = [...dealerIds];
    const blocks: ScheduleBlock[] = [];

    // FIX: Added 2 to the partition priorities to allow the algorithm to create blocks of 2 tables.
    const partitionPriorities = [5, 4, 3, 2];
    for (const size of partitionPriorities) {
        const dealersNeeded = size + 1;
        while (remainingTables.length >= size && remainingDealers.length >= dealersNeeded) {
            const blockTables = remainingTables.splice(0, size);
            const blockDealers = remainingDealers.splice(0, dealersNeeded);
            blocks.push({
                tables: blockTables,
                dealers: blockDealers,
                schema: `${size}T-${dealersNeeded}D` as ScheduleBlock['schema']
            });
        }
    }
    
    if (remainingTables.length > 0) {
        alert(`Impossible de générer un planning équitable. Il y a ${remainingTables.length} table(s) non assignée(s). Assurez-vous d'avoir N+1 croupiers par bloc de N tables et que le nombre de tables puisse être partitionné.`);
        return null;
    }

    // 2. Generate the schedule slot by slot
    const schedule: DealerSchedule = {};
    const totalMinutes = durationHours * 60;
    
    let blockTeams = blocks.map(b => b.dealers);
    let tableGroups = blocks.map(b => b.tables);

    for (let t = 0; t < totalMinutes; t += granularity) {
        const currentTime = addMinutes(startTime, t);
        const timestamp = format(currentTime, "yyyy-MM-dd'T'HH:mm:ss");
        schedule[timestamp] = {};

        // 2a. Handle 2-hour block swap
        if (t > 0 && t % 120 === 0) {
            // Simple round-robin swap for teams and tables
            blockTeams.push(blockTeams.shift()!);
            tableGroups.push(tableGroups.shift()!);
        }
        
        // 2b. Apply atomic schema rotation for each block
        blockTeams.forEach((team, blockIndex) => {
            const blockTables = tableGroups[blockIndex];
            const timeSlotIndex = (t / granularity) % team.length;
            
            for(let i=0; i < blockTables.length; i++) {
                const table = blockTables[i];
                const dealerIndex = (i + timeSlotIndex) % team.length;
                schedule[timestamp][`T${table.id}`] = team[dealerIndex];
            }
        });
    }

    return schedule;
};