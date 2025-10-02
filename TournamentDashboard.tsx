import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournamentStore } from './store';
import { TournamentClock } from './TournamentClock';
import { Card, CardHeader, Button, TrophyIcon, UsersIcon, ListBulletIcon, TablesIcon, ScreenIcon, CurrencyDollarIcon, BanknotesIcon, ChipIcon, PencilIcon, StatCard, TabButton, MegaphoneIcon, UserGroupIcon, ClipboardDocumentListIcon, ArrowTopRightOnSquareIcon, ChartBarIcon, ArrowUturnLeftIcon, LockClosedIcon, IdentificationIcon, SparklesIcon, Modal } from './components';
import { TournamentStatus, Tournament, TournamentType, TournamentPhase, FlightStatus, Player, EntryStatus, Season } from './types';
import { RegisterPlayerModal } from './RegisterPlayerModal';
import { LevelStructureEditor } from './LevelStructureEditor';
import { TableViewWidget } from './TableViewWidget';
import { EditTournamentModal } from './EditTournamentModal';
import { DealMakingModal } from './DealMakingModal';
import { PayoutsWidget } from './PayoutsWidget';
import { PlayerListWidget } from './PlayerListWidget';
import { WaitingListWidget } from './WaitingListWidget';
import { ReEntryPendingWidget } from './ReEntryPendingWidget';
import { ResultsWidget } from './ResultsWidget';
import { MultiFlightControls } from './MultiFlightControls';
import { AnnouncementsManager } from './AnnouncementsManager';
import { FinancesWidget } from './FinancesWidget';
import { LiveCoverage } from './LiveCoverage';
import { monitorTournamentState } from './aiAgent';
import { DisplayEditor } from './DisplayEditor';
import { SimultaneousEliminationModal } from './SimultaneousEliminationModal';
import { MassChipCountModal } from './MassChipCountModal';
import { TournamentStatsWidget } from './TournamentStatsWidget';
import { DealerScheduleWidget } from './DealerRotationWidget';
import { AiKnowledgeBaseWidget } from './AiKnowledgeBaseWidget';

// --- WIDGETS ---

const ScheduledStartWidget = ({ tournament }: { tournament: Tournament }) => {
    const { dispatch } = useTournamentStore();
    const [time, setTime] = useState('');

    useEffect(() => {
        if (tournament.scheduledStartTime) {
            setTime(new Date(tournament.scheduledStartTime).toTimeString().slice(0, 5));
        } else {
            setTime('');
        }
    }, [tournament.scheduledStartTime]);

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = e.target.value;
        setTime(newTime);

        if (newTime) {
            const datePart = new Date(tournament.startDate).toISOString().split('T')[0];
            const newScheduledTime = new Date(`${datePart}T${newTime}`).toISOString();
            dispatch({ type: 'SET_SCHEDULED_START_TIME', payload: { tournamentId: tournament.id, time: newScheduledTime } });
        } else {
            dispatch({ type: 'SET_SCHEDULED_START_TIME', payload: { tournamentId: tournament.id, time: null } });
        }
    };
    
    if (tournament.status !== TournamentStatus.SCHEDULED || (tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS)) {
        return null;
    }

    return (
        <Card>
            <CardHeader>Démarrage Automatique</CardHeader>
            {tournament.scheduledStartTime ? (
                 <p className="text-sm text-green-400 bg-green-500/10 p-2 rounded-md mb-4">
                    Démarrage automatique programmé à {new Date(tournament.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                 </p>
            ) : (
                <p className="text-sm text-gray-400 mb-4">
                    Définissez une heure pour que le timer démarre automatiquement.
                </p>
            )}
            <div>
                <label htmlFor="auto-start-time" className="block text-sm font-medium text-gray-300 mb-1">Heure de démarrage</label>
                <input
                    type="time"
                    id="auto-start-time"
                    value={time}
                    onChange={handleTimeChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 [color-scheme:dark]"
                />
            </div>
        </Card>
    );
};

const SeasonAssignmentWidget = ({ tournament }: { tournament: Tournament }) => {
    const { state, dispatch } = useTournamentStore();
    const { seasons } = state;

    const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSeasonId = e.target.value;
        dispatch({
            type: 'ASSIGN_TOURNAMENT_SEASON',
            payload: {
                tournamentId: tournament.id,
                seasonId: newSeasonId || null // Send null if "" (Aucune saison) is selected
            }
        });
    };
    
    if (tournament.status !== TournamentStatus.COMPLETED) {
        return null;
    }

    return (
        <Card>
            <CardHeader>Assignation à une saison</CardHeader>
            <p className="text-sm text-gray-400 mb-4">
                Sélectionnez une saison pour inclure ce tournoi dans le classement correspondant.
            </p>
            <div>
                <label htmlFor="season-assignment" className="block text-sm font-medium text-gray-300 mb-1">Saison</label>
                <select
                    id="season-assignment"
                    value={tournament.seasonId || ''}
                    onChange={handleSeasonChange}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Aucune saison (exclure du classement)</option>
                    {seasons.map((season: Season) => (
                        <option key={season.id} value={season.id}>{season.name}</option>
                    ))}
                </select>
            </div>
        </Card>
    );
};


// --- TAB COMPONENTS ---

const TablesTab = ({ tournament, displayFlightId, players }: { tournament: Tournament, displayFlightId: string, players: Player[] }) => {
    const isCompleted = tournament.status === TournamentStatus.COMPLETED;
    return isCompleted 
        ? <ResultsWidget tournament={tournament} players={players} /> 
        : <TableViewWidget tournament={tournament} displayFlightId={displayFlightId} />;
};

const PlayersTab = ({ tournament, displayFlightId, players, isMultiFlightMode }: { tournament: Tournament, displayFlightId: string, players: Player[], isMultiFlightMode: boolean }) => {
    const Day2QualifiersWidget = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
        const qualifiedEntries = useMemo(() => {
            if (!tournament || tournament.type !== TournamentType.MULTI_FLIGHT) return [];

            const flightMap = new Map(tournament.flights.map(f => [f.id, f.name]));
            
            return tournament.entries
                .filter(e => e.status === EntryStatus.QUALIFIED_DAY2)
                .map(entry => {
                    const player = players.find(p => p.id === entry.playerId);
                    if (!player) return null;
                    return {
                        ...entry,
                        player,
                        flightName: flightMap.get(entry.flightId) || 'Unknown Flight'
                    };
                })
                .filter((e): e is NonNullable<typeof e> => e !== null)
                .sort((a, b) => b.chipCount - a.chipCount);
        }, [tournament, players]);

        if (qualifiedEntries.length === 0) {
            return null;
        }

        return (
            <Card>
                <CardHeader>Qualifiés pour le Day 2 ({qualifiedEntries.length})</CardHeader>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {qualifiedEntries.map(entry => (
                        <div key={entry.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-md">
                            <div className="flex items-center space-x-3 min-w-0">
                                <img src={entry.player.avatarUrl} alt={entry.player.nickname} className="w-8 h-8 rounded-full flex-shrink-0" />
                                <div className="truncate">
                                    <p className="font-semibold text-white truncate">{entry.player.nickname}</p>
                                    <p className="text-xs text-gray-400">Qualifié via {entry.flightName}</p>
                                </div>
                            </div>
                            <p className="font-mono font-bold text-lg text-white flex-shrink-0 ml-2">{entry.chipCount.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            </Card>
        );
    };
    
    const isCompleted = tournament.status === TournamentStatus.COMPLETED;
    if (isCompleted) return null;

    return (
        <div className="space-y-6">
            {isMultiFlightMode && <Day2QualifiersWidget tournament={tournament} players={players} />}
            <ReEntryPendingWidget tournament={tournament} />
            <WaitingListWidget tournament={tournament} />
            <PlayerListWidget tournament={tournament} displayFlightId={displayFlightId} />
        </div>
    );
};

const StructureTab = ({ tournament }: { tournament: Tournament }) => {
    const isCompleted = tournament.status === TournamentStatus.COMPLETED;
    if (isCompleted) return null;
    return <LevelStructureEditor tournamentId={tournament.id} />;
};

const StatsTab = ({ tournament }: { tournament: Tournament }) => {
    return <TournamentStatsWidget tournament={tournament} />;
};

const FinancesTab = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
    return <FinancesWidget tournament={tournament} players={players} />;
};

const ScreenTab = ({ tournament }: { tournament: Tournament }) => {
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <CardHeader className="mb-0">
                        Lancer la Présentation
                    </CardHeader>
                    <a href={`#/t/${tournament.id}/screen`} target="_blank" rel="noopener noreferrer">
                        <Button variant="primary" className="flex items-center gap-2">
                            <ArrowTopRightOnSquareIcon className="w-5 h-5"/>
                            Ouvrir dans un nouvel onglet
                        </Button>
                    </a>
                </div>
                <p className="text-gray-400 mt-2 text-sm">
                    Utilisez le lien ci-dessus pour afficher l'écran du tournoi sur un projecteur ou un écran externe. L'éditeur ci-dessous mettra à jour l'affichage en direct.
                </p>
            </Card>
            <DisplayEditor tournament={tournament} />
        </div>
    );
};

const ResultsTab = ({ tournament, players }: { tournament: Tournament, players: Player[] }) => {
    return <ResultsWidget tournament={tournament} players={players} />;
};

const LiveCoverageTab = ({ tournament }: { tournament: Tournament }) => {
    return <LiveCoverage tournament={tournament} />;
};

const AiKnowledgeTab = ({ tournament }: { tournament: Tournament }) => {
    return <AiKnowledgeBaseWidget tournament={tournament} />;
};

const DealersTab = ({ tournament }: { tournament: Tournament }) => {
    return <DealerScheduleWidget tournament={tournament} />;
};

// --- MAIN COMPONENT ---

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export const TournamentDashboard = () => {
    const { id } = useParams<{ id: string }>();
    const { state, dispatch } = useTournamentStore();
    const [isRegisterModalOpen, setRegisterModalOpen] = useState(false);
    const [isDealModalOpen, setDealModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isSimultaneousEliminationModalOpen, setSimultaneousEliminationModalOpen] = useState(false);
    const [isMassChipCountModalOpen, setMassChipCountModalOpen] = useState(false);
    const [isDirectorControlsModalOpen, setDirectorControlsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('tables');
    const [selectedFlightId, setSelectedFlightId] = useState('all');

    const tournamentFromState = state.tournaments.find(t => t.id === id);

    const tournament = useMemo(() => {
        if (!tournamentFromState) return undefined;

        // Provide default settings for backward compatibility with old data
        const liveCoverageSettings = tournamentFromState.liveCoverageSettings || {
            autopilotEnabled: false,
            systemInstruction: "Vous êtes le commentateur officiel d’un tournoi de poker.\nÉcrivez un post en français, moins de 350 mots, au ton adapté à la phase du tournoi :\n\n🎬 Lancement → festif & accueillant.\n🃏 Premiers niveaux → complice & léger.\n💥 Éliminations → dramatique & haletant.\n🔥 Bulle → tendu & journalistique.\n⚡ Table finale bulle → cinématographique.\n🏆 Table finale → héroïque & solennel.\n👑 Heads-up → grandiose.\n\n👉 Mélangez vocabulaire poker accessible + narration simple.\n👉 Mettez en avant émotions, tension, ambiance.\n👉 Si des informations sur un joueur sont fournies (style, palmarès, anecdotes, profil Hendon Mob), UTILISEZ-LES pour enrichir ton récit et le rendre plus personnel et captivant.\n👉 Texte concis, impactant, prêt pour réseaux sociaux.",
            isGenerating: false,
        };
        
        const aiKnowledgeBase = tournamentFromState.aiKnowledgeBase || {
             sponsors: '',
             lastMinuteInfo: '',
             buffetMenu: '',
             anecdotes: '',
        };

        return {
            ...tournamentFromState,
            liveCoverageSettings,
            aiKnowledgeBase,
            liveCoveragePosts: tournamentFromState.liveCoveragePosts || [],
            liveCoverageSuggestions: tournamentFromState.liveCoverageSuggestions || [],
            lateRegistrationClosed: tournamentFromState.lateRegistrationClosed || false,
        };
    }, [tournamentFromState]);

    const isMultiFlightMode = tournament?.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;

    const prevTournament = usePrevious(tournament);

    useEffect(() => {
        if (!prevTournament || !tournament || tournament.status === TournamentStatus.COMPLETED) {
            return;
        }

        const prevActive = prevTournament.entries.filter(e => e.status === EntryStatus.ACTIVE).length;
        const currentActive = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE).length;

        const hasSignificantChange = 
            prevTournament.currentLevel !== tournament.currentLevel ||
            prevActive !== currentActive ||
            prevTournament.status !== tournament.status;

        if (hasSignificantChange) {
            monitorTournamentState(prevTournament, tournament, state.players, dispatch);
        }
    }, [tournament, prevTournament, state.players, dispatch]);

    useEffect(() => {
        if (isMultiFlightMode && tournament) {
            const runningFlight = tournament.flights.find(f => f.status === FlightStatus.RUNNING);
            if (runningFlight) {
                setSelectedFlightId(runningFlight.id);
            } else {
                setSelectedFlightId('all');
            }
        }
    }, [tournament, isMultiFlightMode]);

    const { displayedPrizePool, displayedTotalEntries, displayedActivePlayers, displayedAvgStack } = useMemo(() => {
        if (!tournament) return { displayedPrizePool: 0, displayedTotalEntries: 0, displayedActivePlayers: 0, displayedAvgStack: 0 };

        const relevantEntries = (isMultiFlightMode && selectedFlightId !== 'all')
            ? tournament.entries.filter(e => e.flightId === selectedFlightId)
            : tournament.entries;

        const totalBuyins = relevantEntries.reduce((sum, e) => sum + e.buyins, 0);
        const totalAddons = relevantEntries.reduce((sum, e) => sum + e.addons, 0);
        const prizePool = (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);

        const entriesCount = relevantEntries.filter(e => e.status !== 'Merge Discarded').length;
        const activePlayers = relevantEntries.filter(e => e.status === 'Active').length;

        const totalDealerBonuses = relevantEntries.reduce((sum, e) => sum + (e.dealerBonuses || 0), 0);
        const totalChips = (totalBuyins * tournament.startingStack) + (totalAddons * tournament.addonChips) + (totalDealerBonuses * tournament.dealerBonusChips);
        const avgStack = activePlayers > 0 ? Math.round(totalChips / activePlayers) : 0;
        
        return { displayedPrizePool: prizePool, displayedTotalEntries: entriesCount, displayedActivePlayers: activePlayers, displayedAvgStack: avgStack };
    }, [tournament, isMultiFlightMode, selectedFlightId]);
    
    const activeFlight = useMemo(() => {
        if (!tournament || !isMultiFlightMode) return null;
        return tournament.flights.find(f => f.status === FlightStatus.RUNNING) || null;
    }, [tournament, isMultiFlightMode]);

    const isRegistrationOpen = useMemo(() => {
        if (!tournament) return false;
    
        // The entire tournament's registration can be closed. This is the master switch.
        if (tournament.lateRegistrationClosed) {
            return false;
        }
    
        // For multi-flight tournaments during the flights phase, registration is tied to the active flight.
        if (tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS) {
            const runningFlight = tournament.flights.find(f => f.status === FlightStatus.RUNNING);
            
            // If a flight is running, registration is open ONLY if that specific flight's registration is open.
            if (runningFlight) {
                return !runningFlight.lateRegistrationClosed;
            }
            
            // If no flight is running during the flights phase, registration is effectively closed.
            return false;
        }
        
        // For standard tournaments, or multi-flight tournaments on Day 2+, if the master switch is not off, registration is open.
        return true;
    }, [tournament]);

    if (!tournament) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center text-2xl">
                <p>Tournoi non trouvé. <Link to="/" className="text-blue-400 hover:underline">Retourner à l'accueil</Link></p>
            </div>
        );
    }
    
    const isCompleted = tournament.status === TournamentStatus.COMPLETED;

    const handleRebalance = () => {
        if(window.confirm("Êtes-vous sûr de vouloir rééquilibrer toutes les tables ? Les joueurs seront réassignés en fonction de leur tapis (snake seeding).")) {
            dispatch({ type: 'REBALANCE_TABLES', payload: { tournamentId: tournament.id } });
        }
    };

    const handleCloseRegistration = () => {
        const message = activeFlight
            ? `Êtes-vous sûr de vouloir fermer les inscriptions pour le flight "${activeFlight.name}" ? Les joueurs éliminés de ce flight ne pourront plus re-entry.`
            : "Êtes-vous sûr de vouloir fermer les inscriptions (late registration) ? Cette action est irréversible et finalisera le nombre d'entrées, calculera les paiements et éliminera définitivement tous les joueurs en attente de re-entry.";

        if (window.confirm(message)) {
            dispatch({ 
                type: 'CLOSE_LATE_REGISTRATION', 
                payload: { tournamentId: tournament.id, flightId: activeFlight?.id } 
            });
        }
    };

    const handleUndoMerge = () => {
        if(window.confirm("Êtes-vous sûr d'annuler la fusion ? L'état du tournoi sera restauré à celui d'avant la fusion.")) {
            dispatch({ type: 'UNDO_MERGE', payload: { tournamentId: tournament.id } });
        }
    };

    const handleGenerateDay2Draw = () => {
        const message = tournament.preDay2DrawStateSnapshot 
            ? "Un tirage existe déjà. Voulez-vous le remplacer par un nouveau tirage aléatoire ?"
            : "Voulez-vous générer un tirage de sièges aléatoire pour le Day 2 ?";
        
        if(window.confirm(message)) {
            dispatch({ type: 'GENERATE_DAY2_SEAT_DRAW', payload: { tournamentId: tournament.id } });
        }
    };

    const handleUndoDay2Draw = () => {
        if(window.confirm("Êtes-vous sûr d'annuler le dernier tirage de sièges ?")) {
            dispatch({ type: 'UNDO_DAY2_SEAT_DRAW', payload: { tournamentId: tournament.id } });
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-900 text-white min-h-screen">
            <RegisterPlayerModal tournament={tournament} isOpen={isRegisterModalOpen} onClose={() => setRegisterModalOpen(false)} defaultFlightId={selectedFlightId} />
            <DealMakingModal tournament={tournament} players={state.players} isOpen={isDealModalOpen} onClose={() => setDealModalOpen(false)} />
            <EditTournamentModal tournament={tournament} isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} />
            <SimultaneousEliminationModal tournament={tournament} players={state.players} isOpen={isSimultaneousEliminationModalOpen} onClose={() => setSimultaneousEliminationModalOpen(false)} />
            <MassChipCountModal tournament={tournament} players={state.players} isOpen={isMassChipCountModalOpen} onClose={() => setMassChipCountModalOpen(false)} />

            <header className="mb-6">
                <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; All Tournaments</Link>
                <h1 className="text-4xl font-bold text-white truncate flex items-center gap-3">
                    <span>{tournament.name}</span>
                    {!isCompleted && <button onClick={() => setEditModalOpen(true)} className="text-gray-400 hover:text-white" title="Modifier les informations du tournoi"><PencilIcon className="w-6 h-6"/></button>}
                </h1>
                <p className="text-gray-400">{tournament.location}</p>
            </header>
            
            <div className="lg:hidden mb-6">
                {!isCompleted && <TournamentClock tournamentId={tournament.id} />}
            </div>

            {isMultiFlightMode && !isCompleted && (
                <div className="mb-6 max-w-sm">
                    <label htmlFor="flight-selector" className="block text-sm font-medium text-gray-400 mb-1">Affichage du Flight</label>
                    <select 
                        id="flight-selector"
                        value={selectedFlightId} 
                        onChange={e => setSelectedFlightId(e.target.value)} 
                        className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                    >
                        <option value="all">Vue d'ensemble</option>
                        {tournament.flights.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                </div>
            )}

             <div className="bg-gray-800 border border-gray-700 rounded-lg p-2 mb-6">
                <div className="flex items-center gap-2 overflow-x-auto">
                    <TabButton label="Tables" icon={<TablesIcon className="w-5 h-5"/>} isActive={activeTab === 'tables'} onClick={() => setActiveTab('tables')} />
                    <TabButton label="Players" icon={<UsersIcon className="w-5 h-5"/>} isActive={activeTab === 'players'} onClick={() => setActiveTab('players')} />
                    <TabButton label="Croupiers" icon={<IdentificationIcon className="w-5 h-5"/>} isActive={activeTab === 'dealers'} onClick={() => setActiveTab('dealers')} />
                    <TabButton label="Structure" icon={<ListBulletIcon className="w-5 h-5"/>} isActive={activeTab === 'structure'} onClick={() => setActiveTab('structure')} />
                    <TabButton label="Statistiques" icon={<ChartBarIcon className="w-5 h-5"/>} isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
                    <TabButton label="Finances" icon={<CurrencyDollarIcon className="w-5 h-5"/>} isActive={activeTab === 'finances'} onClick={() => setActiveTab('finances')} />
                    <TabButton label="Présentation" icon={<ScreenIcon className="w-5 h-5"/>} isActive={activeTab === 'screen'} onClick={() => setActiveTab('screen')} />
                    <TabButton label="Results" icon={<TrophyIcon className="w-5 h-5"/>} isActive={activeTab === 'results'} onClick={() => setActiveTab('results')} />
                    <TabButton label="Live Coverage" icon={<MegaphoneIcon className="w-5 h-5"/>} isActive={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} />
                    <TabButton label="Base IA" icon={<SparklesIcon className="w-5 h-5"/>} isActive={activeTab === 'aiKnowledge'} onClick={() => setActiveTab('aiKnowledge')} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard label="Prize Pool" value={`${displayedPrizePool.toLocaleString()} MAD`} icon={<TrophyIcon className="w-6 h-6"/>} />
                <StatCard label="Players" value={`${displayedActivePlayers} / ${displayedTotalEntries}`} icon={<UsersIcon className="w-6 h-6"/>} />
                <StatCard label="Avg. Stack" value={displayedAvgStack.toLocaleString()} icon={<ChipIcon className="w-6 h-6"/>} />
                <Card className="p-0 flex items-center justify-center">
                    {!isCompleted && (
                        <Button
                            variant="secondary"
                            className="w-full h-full text-base"
                            onClick={() => setRegisterModalOpen(true)}
                            disabled={!isRegistrationOpen}
                            title={
                                tournament.lateRegistrationClosed ? "Les inscriptions sont fermées globalement" :
                                activeFlight?.lateRegistrationClosed ? `Les inscriptions pour ${activeFlight.name} sont fermées` :
                                isMultiFlightMode && !activeFlight ? "Démarrez un flight pour inscrire des joueurs" :
                                "Inscrire un nouveau joueur"
                            }
                        >
                            { isRegistrationOpen ? "Inscrire un Joueur" : "Inscriptions Fermées" }
                        </Button>
                    )}
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="space-y-6">
                        {activeTab === 'tables' && <TablesTab tournament={tournament} displayFlightId={selectedFlightId} players={state.players} />}
                        {activeTab === 'players' && <PlayersTab tournament={tournament} displayFlightId={selectedFlightId} players={state.players} isMultiFlightMode={isMultiFlightMode} />}
                        {activeTab === 'dealers' && <DealersTab tournament={tournament} />}
                        {activeTab === 'structure' && <StructureTab tournament={tournament} />}
                        {activeTab === 'stats' && <StatsTab tournament={tournament} />}
                        {activeTab === 'finances' && <FinancesTab tournament={tournament} players={state.players} />}
                        {activeTab === 'screen' && <ScreenTab tournament={tournament} />}
                        {activeTab === 'results' && <ResultsTab tournament={tournament} players={state.players} />}
                        {activeTab === 'marketing' && <LiveCoverageTab tournament={tournament} />}
                        {activeTab === 'aiKnowledge' && <AiKnowledgeTab tournament={tournament} />}
                    </div>
                </div>

                 {/* Right Column */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="hidden lg:block">
                         {!isCompleted && (
                            <TournamentClock tournamentId={tournament.id} />
                        )}
                    </div>

                    <ScheduledStartWidget tournament={tournament} />

                    {isCompleted && (
                        <SeasonAssignmentWidget tournament={tournament} />
                    )}

                    <AnnouncementsManager tournament={tournament} />
                    <PayoutsWidget tournament={tournament} />
                    
                    {!isCompleted && (
                         <>
                            <Button className="w-full" variant="secondary" onClick={() => setDirectorControlsModalOpen(true)}>
                                Director Controls
                            </Button>
                            <Modal isOpen={isDirectorControlsModalOpen} onClose={() => setDirectorControlsModalOpen(false)}>
                                <CardHeader>Director Controls</CardHeader>
                                <div className="flex flex-col gap-3">
                                    {tournament.lastEliminationSnapshot && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                if(window.confirm("Êtes-vous sûr d'annuler la dernière élimination ? Le joueur sera restauré à son état précédent.")) {
                                                    dispatch({ type: 'UNDO_LAST_ELIMINATION', payload: { tournamentId: tournament.id } });
                                                }
                                            }}
                                            className="flex items-center justify-center gap-2 bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/40"
                                        >
                                            <ArrowUturnLeftIcon className="w-5 h-5"/>
                                            Annuler la dernière élimination
                                        </Button>
                                    )}
                                    {tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS && (
                                        <div className="border-b border-gray-700 pb-4 mb-4"><MultiFlightControls tournament={tournament} /></div>
                                    )}
                                    
                                    {isMultiFlightMode && activeFlight && (
                                        <Button 
                                            variant="danger" 
                                            onClick={handleCloseRegistration}
                                            disabled={activeFlight.lateRegistrationClosed}
                                            className="flex items-center justify-center gap-2"
                                        >
                                            <LockClosedIcon className="w-5 h-5"/>
                                            {activeFlight.lateRegistrationClosed 
                                                ? `Reg. Fermée (${activeFlight.name})` 
                                                : `Fermer Reg. (${activeFlight.name})`}
                                        </Button>
                                    )}

                                    {!isMultiFlightMode && (
                                        <Button 
                                            variant="danger" 
                                            onClick={handleCloseRegistration}
                                            disabled={tournament.lateRegistrationClosed}
                                            className="flex items-center justify-center gap-2"
                                        >
                                            <LockClosedIcon className="w-5 h-5"/>
                                            {tournament.lateRegistrationClosed ? 'Inscriptions Fermées' : 'Fermer les Inscriptions'}
                                        </Button>
                                    )}

                                    <Button variant="secondary" onClick={handleRebalance}>Rebalance All Tables</Button>
                                    {tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.DAY2 && tournament.preMergeStateSnapshot && (
                                        <Button variant="secondary" onClick={handleUndoMerge}>Undo Day 2 Merge</Button>
                                    )}
                                    {tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.DAY2 && (
                                        <Button variant="secondary" onClick={handleGenerateDay2Draw} className="flex items-center justify-center gap-2">
                                            Générer le Seat Draw du Day 2
                                        </Button>
                                    )}
                                    {tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.DAY2 && tournament.preDay2DrawStateSnapshot && (
                                        <Button variant="secondary" onClick={handleUndoDay2Draw} className="flex items-center justify-center gap-2">
                                            <ArrowUturnLeftIcon className="w-5 h-5"/> Annuler le Seat Draw
                                        </Button>
                                    )}
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => setDealModalOpen(true)}
                                        disabled={displayedActivePlayers < 2}
                                        title={displayedActivePlayers < 2 ? "Il faut au moins 2 joueurs pour faire un deal" : "Faire un deal"}
                                        className="flex items-center justify-center gap-2"
                                    >
                                        <BanknotesIcon className="w-5 h-5"/> Make a Deal
                                    </Button>
                                    <Button variant="secondary" onClick={() => setSimultaneousEliminationModalOpen(true)} className="flex items-center justify-center gap-2">
                                        <UserGroupIcon className="w-5 h-5"/> Gérer Élimination Simultanée
                                    </Button>
                                    <Button variant="secondary" onClick={() => setMassChipCountModalOpen(true)} className="flex items-center justify-center gap-2">
                                        <ClipboardDocumentListIcon className="w-5 h-5"/> Saisie groupée des tapis
                                    </Button>
                                </div>
                            </Modal>
                         </>
                    )}
                </div>
            </div>
        </div>
    );
};
