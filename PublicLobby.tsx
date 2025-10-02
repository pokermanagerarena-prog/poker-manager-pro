import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Tournament, TournamentStatus, Level } from './types';
import { Card, Button, ClockIcon, UsersIcon, Modal, CardHeader } from './components';
import { usePublicSync } from './PublicLayout';

const formatTimeLeft = (targetDate: string) => {
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const difference = target - now;

    if (difference <= 0) return "En cours";

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    if (days > 0) return `Dans ${days} jour(s)`;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const PublicTournamentCard = ({ tournament }: { tournament: Tournament }) => {
    const [timeLeft, setTimeLeft] = useState(formatTimeLeft(tournament.startDate));
    const [isStructureModalOpen, setStructureModalOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (tournament.status === TournamentStatus.SCHEDULED) {
            const interval = setInterval(() => {
                setTimeLeft(formatTimeLeft(tournament.startDate));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [tournament.startDate, tournament.status]);

    const totalPrizePool = (tournament.entries.reduce((sum, e) => sum + e.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((sum, e) => sum + e.addons, 0) * tournament.addonCost);

    const statusClasses: {[key in TournamentStatus]: string} = {
        [TournamentStatus.SCHEDULED]: "bg-gray-500",
        [TournamentStatus.RUNNING]: "bg-green-500 animate-pulse",
        [TournamentStatus.PAUSED]: "bg-yellow-500",
        [TournamentStatus.COMPLETED]: "bg-red-700",
    };
    
    const handleStructureButtonClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Crucial: prevent the card's onClick from firing
        e.preventDefault();
        setStructureModalOpen(true);
    };

    const handleCardClick = () => {
        navigate({ pathname: `/public/tournament/${tournament.id}`, search: location.search });
    };

    return (
        <>
            <StructureModal isOpen={isStructureModalOpen} onClose={() => setStructureModalOpen(false)} levels={tournament.levels} />
            <Card 
                onClick={handleCardClick}
                className="hover:border-blue-500 transition-colors duration-300 relative flex flex-col h-full cursor-pointer"
            >
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <h3 className="text-xl font-bold text-white pr-8">{tournament.name}</h3>
                        <span className={`px-2 py-1 text-xs font-bold text-white rounded-full flex items-center gap-2`}>
                            <span className={`w-2 h-2 rounded-full ${statusClasses[tournament.status]}`}></span>
                            {tournament.status}
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-4">{tournament.location}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm my-4">
                        <div className="flex items-center gap-2 text-gray-300"><ClockIcon className="w-4 h-4 text-blue-400"/> <span>{new Date(tournament.startDate).toLocaleString('fr-FR', {dateStyle: 'medium', timeStyle: 'short'})}</span></div>
                        <div className="flex items-center gap-2 text-gray-300"><UsersIcon className="w-4 h-4 text-blue-400"/> <span>{tournament.entries.length} participants</span></div>
                    </div>
                </div>
                 <div className="border-t border-gray-700 pt-4 mt-auto">
                    {tournament.status === TournamentStatus.SCHEDULED && (
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-xs text-gray-400">Démarre dans</p>
                                <p className="font-semibold text-lg font-mono text-yellow-400">{timeLeft}</p>
                            </div>
                            <Button variant="secondary" onClick={handleStructureButtonClick}>Structure</Button>
                        </div>
                    )}
                     {tournament.status !== TournamentStatus.SCHEDULED && (
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Prizepool:</span>
                            <span className="font-bold text-green-400 text-lg">{totalPrizePool.toLocaleString()} MAD</span>
                         </div>
                     )}
                </div>
            </Card>
        </>
    )
};

const StructureModal = ({ isOpen, onClose, levels }: { isOpen: boolean, onClose: () => void, levels: Level[] }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Structure des Blinds</CardHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                 <table className="w-full text-left">
                    <thead className="border-b border-gray-600 text-sm text-gray-400 sticky top-0 bg-gray-800">
                        <tr>
                            <th className="p-2 text-center w-20">Niveau</th>
                            <th className="p-2 text-center">Blinds</th>
                            <th className="p-2 text-center">Ante</th>
                            <th className="p-2 text-center w-24">Durée</th>
                        </tr>
                    </thead>
                    <tbody>
                        {levels.map((level) => (
                            <tr key={level.level} className={`border-b border-gray-700/50 ${level.isBreak ? 'bg-blue-500/10 text-blue-300' : ''}`}>
                                <td className="p-2 text-center font-bold">{level.isBreak ? "PAUSE" : level.level}</td>
                                <td className="p-2 text-center">{level.isBreak ? '-' : `${level.smallBlind}/${level.bigBlind}`}</td>
                                <td className="p-2 text-center">{level.ante > 0 ? level.ante : '-'}</td>
                                <td className="p-2 text-center">{level.duration} min</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Modal>
    );
};

const PublicLobby = () => {
    const { syncedState: data } = usePublicSync();

    if (!data) {
        return (
            <div className="p-8 text-center text-2xl text-gray-400">
                <div className="spinner h-8 w-8 mx-auto mb-4" style={{borderWidth: '4px'}}></div>
                <p>Connexion au serveur du directeur...</p>
            </div>
        );
    }
    
    const { tournaments } = data;

    const { live, upcoming, archived } = useMemo(() => {
        const live: Tournament[] = [];
        const upcoming: Tournament[] = [];
        const archived: Tournament[] = [];
        
        const now = new Date();

        tournaments.forEach(t => {
            if (t.isArchived) {
                archived.push(t);
                return;
            }

            switch (t.status) {
                case TournamentStatus.COMPLETED:
                    archived.push(t);
                    break;
                case TournamentStatus.RUNNING:
                case TournamentStatus.PAUSED:
                    live.push(t);
                    break;
                case TournamentStatus.SCHEDULED:
                    if (new Date(t.startDate) <= now) {
                        live.push(t);
                    } else {
                        upcoming.push(t);
                    }
                    break;
            }
        });

        live.sort((a, b) => {
            const aIsRunning = a.status === TournamentStatus.RUNNING || a.status === TournamentStatus.PAUSED;
            const bIsRunning = b.status === TournamentStatus.RUNNING || b.status === TournamentStatus.PAUSED;
            if (aIsRunning && !bIsRunning) return -1;
            if (!aIsRunning && bIsRunning) return 1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
        upcoming.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        archived.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        
        return { live, upcoming, archived };
    }, [tournaments]);

    const Section = ({ title, tournaments }: { title: string, tournaments: Tournament[] }) => {
        if (tournaments.length === 0) return null;
        return (
            <section className="mb-12">
                <h2 className="text-3xl font-bold text-white mb-6 border-b-2 border-blue-500 pb-2">{title}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {tournaments.map(t => <PublicTournamentCard key={t.id} tournament={t} />)}
                </div>
            </section>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <Section title="Tournois en Direct" tournaments={live} />
            <Section title="Tournois à Venir" tournaments={upcoming} />
            <Section title="Résultats Récents" tournaments={archived} />
        </div>
    );
};

export default PublicLobby;