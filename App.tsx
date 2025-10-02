import React, { useState, useRef, useEffect, useMemo, createContext, useContext, ReactNode, useCallback } from 'react';
import { Routes, Route, Link, Outlet, useLocation } from 'react-router-dom';
import { useTournamentStore, setBroadcaster, setPublicStateBroadcaster, setSyncClientStatus } from './store';
import { TournamentDashboard } from './TournamentDashboard';
import NewTournamentPage from './NewTournamentPage';
// FIX: Add TrophyIcon to imports
import { Card, ChartBarIcon, UsersIcon, Button, DotsVerticalIcon, ArrowUpTrayIcon, ArrowDownTrayIcon, ArchiveBoxIcon, ArrowUturnLeftIcon, TrashIcon, IdentificationIcon, BanknotesIcon, Modal, CardHeader, QrCodeIcon, CameraIcon, WifiIcon, NoSymbolIcon, ArrowPathIcon, CloseIcon, TrophyIcon, ArrowsRightLeftIcon, ListBulletIcon } from './components';
import { Tournament, TournamentStatus, AppState, Action, Player, Season, CashGameTable, CashGameSession, EntryStatus } from './types';
import { TournamentScreen } from './TournamentScreen';
import RankingPage from './RankingPage';
import PlayerManagerPage from './PlayerManagerPage';
import DealerManagerPage from './DealerManagerPage';
import PrintableTicket from './PrintableTicket';
import GlobalStatsPage from './GlobalStatsPage';
import PrintableTable from './PrintableTable';
import PrintablePlayerList from './PrintablePlayerList';
import PrintableSeatDraw from './PrintableSeatDraw';
import PrintablePayout from './PrintablePayout';
import PrintableFinanceReport from './PrintableFinanceReport';
import PublicLobby from './PublicLobby';
import PublicTournamentView from './PublicTournamentView';
import PublicLayout from './PublicLayout';
import DealerDisplayScreen from './DealerDisplayScreen';
import PrintableMoveSlips from './PrintableMoveSlips';
import { CashGamePage } from './CashGamePage';
import QRCode from 'qrcode';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { generateUUID } from './utils';
// FIX: Import PeerJSOption to resolve type error.
import Peer, { DataConnection, PeerJSOption } from 'peerjs';
import PublicCashGamePage from './PublicCashGamePage';
import ImportExportPage from './ImportExportPage';
// FIX: Import 'PublicRankingPage' component to fix 'Cannot find name' error.
import PublicRankingPage from './PublicRankingPage';


// --- SYNC FEATURE ---

type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
interface SyncContextType {
    status: SyncStatus;
    sessionId: string | null;
    isHost: boolean;
    createSession: () => void;
    joinSession: (id: string) => void;
    closeSession: () => void;
    retryConnection: () => void;
}
const SyncContext = createContext<SyncContextType | undefined>(undefined);
const useSync = () => useContext(SyncContext)!;

type SyncPayload = 
    | { type: 'ACTION', payload: Action }
    | { type: 'FULL_STATE_SYNC', payload: Omit<AppState, 'entryToPrint' | 'tableToPrint' | 'playerListToPrint' | 'seatDrawToPrint' | 'payoutToPrint' | 'financeReportToPrint' | 'moveSlipsToPrint'> };

export type PublicState = {
    tournaments: Tournament[];
    players: Player[];
    seasons: Season[];
    cashGameTables: CashGameTable[];
    cashGameSessions: CashGameSession[];
}

const toPublicState = (fullState: AppState): PublicState => ({
    tournaments: fullState.tournaments.filter(t => !t.isArchived),
    players: fullState.players.map(({ notes, ...player }) => ({ ...player, notes: '' })), // remove private notes
    seasons: fullState.seasons,
    cashGameTables: fullState.cashGameTables,
    cashGameSessions: fullState.cashGameSessions,
});

// FIX: Change type from Peer.PeerJSOption to PeerJSOption.
const getPeerJsConfig = (): PeerJSOption => {
    // FIX: Change type from Peer.PeerJSOption to PeerJSOption.
    const config: PeerJSOption = {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        }
    };

    // Check for environment variables for TURN server
    const turnUrls = process.env.TURN_URLS;
    const turnUsername = process.env.TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL;

    if (turnUrls && turnUsername && turnCredential) {
        config.config!.iceServers.push({
            urls: turnUrls,
            username: turnUsername,
            credential: turnCredential,
        });
        console.log("TURN server configuration loaded.");
    } else {
        console.log("No TURN server configuration found. PeerJS will rely on STUN only, which may fail across different networks.");
    }

    return config;
};


const SyncProvider = ({ children }: { children: ReactNode }) => {
    const [status, setStatus] = useState<SyncStatus>('disconnected');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const { state, dispatch } = useTournamentStore();

    const peerRef = useRef<Peer | null>(null);
    const directorConnectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const publicConnectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const hostConnectionRef = useRef<DataConnection | null>(null);

    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        setSyncClientStatus(!isHost);
    }, [isHost]);

    const cleanup = useCallback(() => {
        console.log("Cleaning up PeerJS connections...");
        if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null; }
        
        directorConnectionsRef.current.forEach(conn => conn.close());
        directorConnectionsRef.current.clear();
        
        publicConnectionsRef.current.forEach(conn => conn.close());
        publicConnectionsRef.current.clear();

        if (hostConnectionRef.current) { hostConnectionRef.current.close(); hostConnectionRef.current = null; }
        setBroadcaster(null);
        setPublicStateBroadcaster(null);
    }, []);
    
    const initializeHost = useCallback((newId: string) => {
        cleanup();
        setStatus('connecting');
        const peerConfig = getPeerJsConfig();
        const peer = new Peer(newId, peerConfig);
        peerRef.current = peer;

        (peer as any).on('open', (id: string) => {
            setSessionId(id);
            setIsHost(true);
            setStatus('connected');
            console.log(`Host session started with PeerJS ID: ${id}`);
        });

        (peer as any).on('connection', (conn: DataConnection) => {
            (conn as any).on('open', () => {
                const metadata = (conn as any).metadata;

                if (metadata?.type === 'public-viewer') {
                    console.log(`New public viewer connected: ${conn.peer}`);
                    publicConnectionsRef.current.set(conn.peer, conn);
                    const publicState = toPublicState(stateRef.current);
                    conn.send(JSON.stringify(publicState));
                } else {
                    console.log(`New director connected: ${conn.peer}`);
                    directorConnectionsRef.current.set(conn.peer, conn);
                    const currentState = stateRef.current;
                    const fullState: Omit<AppState, 'entryToPrint' | 'tableToPrint' | 'playerListToPrint' | 'seatDrawToPrint' | 'payoutToPrint' | 'financeReportToPrint' | 'moveSlipsToPrint'> = {
                        version: currentState.version, tournaments: currentState.tournaments, players: currentState.players, dealers: currentState.dealers,
                        blindStructureTemplates: currentState.blindStructureTemplates, displayTemplates: currentState.displayTemplates, seasons: currentState.seasons,
                        tournamentTemplates: currentState.tournamentTemplates, cashGameTables: currentState.cashGameTables, cashGameSessions: currentState.cashGameSessions,
                    };
                    const syncPayload: SyncPayload = { type: 'FULL_STATE_SYNC', payload: fullState };
                    conn.send(JSON.stringify(syncPayload));
                }
            });
            (conn as any).on('data', (data: any) => {
                try {
                    const parsedData: SyncPayload = JSON.parse(data as string);
                    if (parsedData.type === 'ACTION') {
                        dispatch(parsedData.payload);
                    }
                } catch (error) { console.error('Host failed to parse incoming data from client:', error); }
            });
            (conn as any).on('close', () => { 
                directorConnectionsRef.current.delete(conn.peer);
                publicConnectionsRef.current.delete(conn.peer);
                console.log(`Peer ${conn.peer} disconnected.`);
            });
            (conn as any).on('error', (err: any) => { console.warn(`Connection error with ${conn.peer}:`, err); });
        });
        (peer as any).on('error', (err: any) => { setStatus('error'); console.error('PeerJS Host Error:', err); });
        (peer as any).on('disconnected', () => { setStatus('connecting'); peer.reconnect(); });
        (peer as any).on('close', () => { setStatus('disconnected'); });
    }, [cleanup, dispatch]);
    
    const initializeClient = useCallback((hostId: string) => {
        cleanup();
        setStatus('connecting');
        const peerConfig = getPeerJsConfig();
        const peer = new Peer(peerConfig);
        peerRef.current = peer;

        (peer as any).on('open', () => {
            const conn = peer.connect(hostId, { reliable: true });
            hostConnectionRef.current = conn;
            (conn as any).on('open', () => { setSessionId(hostId); setIsHost(false); setStatus('connected'); });
            (conn as any).on('data', (data: any) => {
                try {
                    const parsedData: SyncPayload = JSON.parse(data as string);
                    if (parsedData.type === 'FULL_STATE_SYNC') {
                        const fullPayload: AppState = { ...parsedData.payload, entryToPrint: null, tableToPrint: null, playerListToPrint: null, seatDrawToPrint: null, payoutToPrint: null, financeReportToPrint: null, moveSlipsToPrint: null };
                        dispatch({ type: 'REPLACE_STATE', payload: fullPayload, fromSync: true } as Action & { fromSync: boolean });
                    } else if (parsedData.type === 'ACTION') {
                        dispatch({ ...parsedData.payload, fromSync: true } as Action & { fromSync: boolean });
                    }
                } catch (error) { console.error('Failed to parse incoming data:', error); }
            });
            (conn as any).on('close', () => { setStatus('disconnected'); });
            (conn as any).on('error', (err: any) => { console.warn(`Connection error with host ${conn.peer}:`, err); });
        });
        (peer as any).on('error', (err: any) => { setStatus('error'); console.error('PeerJS Client Error:', err); });
        (peer as any).on('disconnected', () => { setStatus('connecting'); peer.reconnect(); });
        (peer as any).on('close', () => { setStatus('disconnected'); });
    }, [cleanup, dispatch]);
    
    // Director Sync Broadcaster (for both host and client)
    useEffect(() => {
        if (status !== 'connected') {
            setBroadcaster(null);
            return;
        }

        if (isHost) {
            setBroadcaster((action: Action) => {
                const syncPayload: SyncPayload = { type: 'ACTION', payload: action };
                const payloadString = JSON.stringify(syncPayload);
                directorConnectionsRef.current.forEach(conn => { if (conn.open) conn.send(payloadString); });
            });
        } else {
            setBroadcaster((action: Action) => {
                if (hostConnectionRef.current && hostConnectionRef.current.open) {
                    const syncPayload: SyncPayload = { type: 'ACTION', payload: action };
                    const payloadString = JSON.stringify(syncPayload);
                    hostConnectionRef.current.send(payloadString);
                }
            });
        }
        
        return () => {
            setBroadcaster(null);
        };
    }, [isHost, status]);

    // Public State Broadcaster (Repurposed for PeerJS)
    useEffect(() => {
        if (isHost && status === 'connected') {
            setPublicStateBroadcaster((currentState: AppState) => {
                const publicState = toPublicState(currentState);
                const payloadString = JSON.stringify(publicState);
                publicConnectionsRef.current.forEach(conn => {
                    if (conn.open) {
                        conn.send(payloadString);
                    }
                });
            });
        } else {
            setPublicStateBroadcaster(null);
        }
        return () => setPublicStateBroadcaster(null);
    }, [isHost, status]);


    const createSession = useCallback(() => { initializeHost(generateUUID().slice(0, 8)); }, [initializeHost]);
    const joinSession = useCallback((id: string) => { initializeClient(id); }, [initializeClient]);
    const closeSession = useCallback(() => {
        cleanup();
        setStatus('disconnected');
        setSessionId(null);
        setIsHost(false);
        setSyncClientStatus(false);
    }, [cleanup]);
    const retryConnection = useCallback(() => { if (sessionId) { if (isHost) initializeHost(sessionId); else initializeClient(sessionId); } }, [sessionId, isHost, initializeHost, initializeClient]);
    
    useEffect(() => () => cleanup(), [cleanup]);

    return (
        <SyncContext.Provider value={{ status, sessionId, isHost, createSession, joinSession, closeSession, retryConnection }}>
            {children}
        </SyncContext.Provider>
    );
};

const ScannerModal = ({ onScanSuccess, onClose }: { onScanSuccess: (decodedText: string) => void, onClose: () => void }) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    useEffect(() => {
        const config = { fps: 10, qrbox: { width: 250, height: 250 }};
        const scanner = new Html5Qrcode('sync-qr-reader', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
        scannerRef.current = scanner;
        scanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {}).catch(() => { alert("Impossible d'accéder à la caméra."); onClose(); });
        return () => { if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(err => console.error("Failed to stop scanner", err)); };
    }, [onScanSuccess, onClose]);
    return <Modal isOpen={true} onClose={onClose}><CardHeader>Scanner le QR Code de la Session</CardHeader><div id="sync-qr-reader" className="w-full bg-gray-900 rounded-lg"></div></Modal>;
};

const PublicLinkModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { sessionId } = useSync();
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const publicViewUrl = useMemo(() => {
        if (!sessionId) return '';
        const { origin, pathname } = window.location;
        const baseUrl = `${origin}${pathname}`.replace('index.html', '');
        return `${baseUrl}#/public?sync=${sessionId}`;
    }, [sessionId]);

    useEffect(() => {
        if (isOpen && publicViewUrl && qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, publicViewUrl, { width: 256, margin: 2, color: { dark: '#FFFFFF', light: '#111827' }}, (err) => err && console.error(err));
        }
    }, [isOpen, publicViewUrl]);

    if (!isOpen || !sessionId) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Partager la Vue Publique</CardHeader>
            <div className="text-center">
                <p className="text-gray-300 mb-2">Les joueurs peuvent scanner ce code pour voir le tournoi en direct sur leur téléphone.</p>
                <div className="bg-white inline-block p-4 rounded-lg"><canvas ref={qrCanvasRef}></canvas></div>
                <p className="text-xs text-gray-400 mt-2 break-all">{publicViewUrl}</p>
            </div>
        </Modal>
    );
};

const SyncModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { sessionId, isHost, createSession, joinSession, closeSession } = useSync();
    const [isScanning, setScanning] = useState(false);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => { if (isOpen && sessionId && isHost && qrCanvasRef.current) QRCode.toCanvas(qrCanvasRef.current, sessionId, { width: 256, margin: 2, color: { dark: '#FFFFFF', light: '#111827' }}, (err) => err && console.error(err)); }, [isOpen, sessionId, isHost]);
    const handleScanSuccess = (decodedText: string) => { setScanning(false); joinSession(decodedText); onClose(); };
    if (!isOpen) return null;
    if (isScanning) return <ScannerModal onScanSuccess={handleScanSuccess} onClose={() => setScanning(false)} />;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Synchronisation Multi-Appareils</CardHeader>
            {!sessionId && (<div className="flex flex-col md:flex-row gap-4"><Button variant="primary" className="w-full py-4 text-lg" onClick={createSession}>Créer une Session</Button><Button variant="secondary" className="w-full py-4 text-lg" onClick={() => setScanning(true)}>Rejoindre une Session</Button></div>)}
            {sessionId && isHost && (<div className="text-center"><p className="text-gray-300 mb-2">Session active. Les autres directeurs peuvent scanner ce code pour rejoindre :</p><div className="bg-white inline-block p-4 rounded-lg"><canvas ref={qrCanvasRef}></canvas></div><p className="font-mono text-2xl font-bold tracking-widest my-4 text-white">{sessionId}</p><Button variant="danger" onClick={() => {closeSession(); onClose();}}>Fermer la Session</Button></div>)}
            {sessionId && !isHost && (<div className="text-center"><WifiIcon className="w-16 h-16 mx-auto text-green-500 mb-4" /><p className="text-xl text-white">Vous avez rejoint la session.</p><p className="font-mono text-2xl font-bold tracking-widest my-4 text-white">{sessionId}</p><p className="text-sm text-gray-400">Toute action effectuée par l'hôte sera synchronisée sur cet appareil.</p><Button variant="danger" className="mt-6" onClick={() => {closeSession(); onClose();}}>Quitter la Session</Button></div>)}
        </Modal>
    );
};

const SyncStatusIndicator = ({ setSyncModalOpen, setPublicLinkModalOpen }: { setSyncModalOpen: (isOpen: boolean) => void, setPublicLinkModalOpen: (isOpen: boolean) => void }) => {
    const { status, retryConnection, isHost, sessionId } = useSync();
    const statusMap: Record<SyncStatus, { Icon: React.ElementType, color: string, text: string }> = { disconnected: { Icon: NoSymbolIcon, color: 'text-gray-500', text: 'Déconnecté' }, connecting: { Icon: ArrowPathIcon, color: 'text-yellow-500 animate-spin', text: 'Connexion...' }, connected: { Icon: WifiIcon, color: 'text-green-500', text: 'Synchronisé' }, error: { Icon: NoSymbolIcon, color: 'text-red-500', text: 'Erreur' }, };
    const { Icon, color, text } = statusMap[status];

    return (
        <div className="flex items-center gap-2">
            {isHost && sessionId && <Button variant="secondary" size="sm" onClick={() => setPublicLinkModalOpen(true)}>Partager la vue publique</Button>}
            <button onClick={() => setSyncModalOpen(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${ status === 'connected' ? 'bg-green-500/10' : status === 'error' ? 'bg-red-500/10' : 'bg-gray-700/50 hover:bg-gray-700' }`} title="Gérer la synchronisation des directeurs"><Icon className={`w-5 h-5 ${color}`} /><span className={`font-semibold ${color}`}>{text}</span></button>
            {status === 'error' && <Button variant="secondary" size="sm" onClick={retryConnection} className="py-1.5">Réessayer</Button>}
        </div>
    );
};

const Dropdown = ({ label, children }: { label: React.ReactNode, children: ReactNode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleDropdown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={toggleDropdown} className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white">
                {label}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </button>
            {isOpen && (
                <div onClick={() => setIsOpen(false)} className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-700">
                    {children}
                </div>
            )}
        </div>
    );
};

const DropdownLink = ({ to, icon, label }: { to: string, icon: ReactNode, label: string }) => {
    return <Link to={to} className="px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">{icon}{label}</Link>;
}

const navLinks = [
    { to: '/', label: 'Tableau de Bord', icon: TrophyIcon, color: 'blue' },
    { to: '/cash-game', label: 'Cash Game', icon: BanknotesIcon, color: 'green' },
    { to: '/players', label: 'Joueurs', icon: UsersIcon, color: 'purple' },
    { to: '/dealers', label: 'Croupiers', icon: IdentificationIcon, color: 'yellow' },
    { to: '/ranking', label: 'Classement', icon: ChartBarIcon, color: 'red' },
];

const NavLinkWithColor = ({ to, label, icon: Icon, color, isActive, onClick }: { to:string, label:string, icon: React.ElementType, color:string, isActive: boolean, onClick?: () => void }) => {
    const baseClasses = "w-full px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2";
    
    const colorSchemes: Record<string, {active: string, inactive: string}> = {
        blue: {
            active: "bg-blue-600 text-white shadow-lg",
            inactive: "text-gray-300 hover:bg-blue-700 hover:text-white"
        },
        green: {
            active: "bg-green-600 text-white shadow-lg",
            inactive: "text-gray-300 hover:bg-green-700 hover:text-white"
        },
        purple: {
            active: "bg-purple-600 text-white shadow-lg",
            inactive: "text-gray-300 hover:bg-purple-700 hover:text-white"
        },
        yellow: {
            active: "bg-yellow-500 text-black shadow-lg",
            inactive: "text-gray-300 hover:bg-yellow-500 hover:text-black"
        },
        red: {
            active: "bg-red-600 text-white shadow-lg",
            inactive: "text-gray-300 hover:bg-red-700 hover:text-white"
        },
    };
    
    const scheme = colorSchemes[color] || colorSchemes.blue;
    const finalClasses = `${baseClasses} ${isActive ? scheme.active : scheme.inactive}`;

    return (
        <Link to={to} className={finalClasses} onClick={onClick}>
            <Icon className="w-5 h-5"/> {label}
        </Link>
    );
};


const MainLayout = ({ setSyncModalOpen, setPublicLinkModalOpen }: { setSyncModalOpen: (isOpen: boolean) => void, setPublicLinkModalOpen: (isOpen: boolean) => void }) => {
    const location = useLocation();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200">
             <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-40">
                <div className="flex justify-between items-center">
                    <Link to="/" className="text-xl font-bold text-white flex-shrink-0">Poker Manager PRO+</Link>
                    
                    <div className="hidden md:flex items-center gap-6">
                        <nav className="flex items-center gap-3">
                            {navLinks.map(link => (
                                <NavLinkWithColor
                                    key={link.to}
                                    to={link.to}
                                    label={link.label}
                                    icon={link.icon}
                                    color={link.color}
                                    isActive={location.pathname === link.to}
                                />
                            ))}
                        </nav>

                        <div className="flex items-center gap-4">
                            <SyncStatusIndicator setSyncModalOpen={setSyncModalOpen} setPublicLinkModalOpen={setPublicLinkModalOpen} />
                            
                            <Dropdown label="Outils">
                                <DropdownLink to="/archives" icon={<ArchiveBoxIcon className="w-5 h-5"/>} label="Archives" />
                                <DropdownLink to="/global-stats" icon={<ChartBarIcon className="w-5 h-5"/>} label="Statistiques" />
                                <DropdownLink to="/import-export" icon={<ArrowsRightLeftIcon className="w-5 h-5"/>} label="Importer / Exporter" />
                            </Dropdown>

                            <div className="h-6 w-px bg-gray-600 hidden sm:block"></div>
                            <Link to="/new" className="hidden sm:block"><Button>+ Nouveau Tournoi</Button></Link>
                        </div>
                    </div>
                     <div className="md:hidden">
                        <Button variant="secondary" onClick={() => setMobileMenuOpen(true)}>
                            <ListBulletIcon className="w-6 h-6" />
                        </Button>
                    </div>
                </div>
            </header>
            {/* Mobile Menu */}
             <div className={`fixed inset-0 z-50 transform transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`}>
                <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="relative w-72 h-full bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
                    <h2 className="text-2xl font-bold text-white mb-6">Poker Manager PRO+</h2>
                    <nav className="flex flex-col gap-3">
                        {navLinks.map(link => (
                            <NavLinkWithColor
                                key={link.to}
                                to={link.to}
                                label={link.label}
                                icon={link.icon}
                                color={link.color}
                                isActive={location.pathname === link.to}
                                onClick={() => setMobileMenuOpen(false)}
                            />
                        ))}
                    </nav>
                     <div className="mt-auto border-t border-gray-700 pt-4 space-y-3">
                        <div className="px-2 my-2">
                            <SyncStatusIndicator setSyncModalOpen={setSyncModalOpen} setPublicLinkModalOpen={setPublicLinkModalOpen} />
                        </div>
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">Outils</h3>
                        <DropdownLink to="/archives" icon={<ArchiveBoxIcon className="w-5 h-5"/>} label="Archives" />
                        <DropdownLink to="/global-stats" icon={<ChartBarIcon className="w-5 h-5"/>} label="Statistiques" />
                        <DropdownLink to="/import-export" icon={<ArrowsRightLeftIcon className="w-5 h-5"/>} label="Importer / Exporter" />
                        <Link to="/new"><Button className="w-full mt-2">+ Nouveau Tournoi</Button></Link>
                    </div>
                </div>
            </div>
            <main className="flex-grow">
                <Outlet />
            </main>
        </div>
    );
};

const HomePage = () => {
    const { state, dispatch } = useTournamentStore();
    const [filter, setFilter] = useState<'all' | 'running' | 'upcoming' | 'completed'>('all');
    const importFileRef = useRef<HTMLInputElement>(null);

    const tournaments = useMemo(() => {
        let filtered = state.tournaments.filter(t => !t.isArchived);
        switch(filter) {
            case 'running': return filtered.filter(t => t.status === TournamentStatus.RUNNING || t.status === TournamentStatus.PAUSED);
            case 'upcoming': return filtered.filter(t => t.status === TournamentStatus.SCHEDULED);
            case 'completed': return filtered.filter(t => t.status === TournamentStatus.COMPLETED);
            default: return filtered;
        }
    }, [state.tournaments, filter]);

    const handleImportTournamentFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const importedData = JSON.parse(text);

                if (!importedData.tournament || !Array.isArray(importedData.players)) {
                    throw new Error("Invalid tournament export file format.");
                }
                
                const existingTournament = state.tournaments.find(t => t.id === importedData.tournament.id);
                const confirmMessage = existingTournament 
                    ? `Un tournoi avec l'ID "${importedData.tournament.id}" existe déjà (${existingTournament.name}). Voulez-vous l'écraser ?`
                    : `Voulez-vous importer le tournoi "${importedData.tournament.name}" ?`;

                if (window.confirm(confirmMessage)) {
                    dispatch({ type: 'IMPORT_TOURNAMENT', payload: importedData });
                    alert(`Tournoi "${importedData.tournament.name}" importé avec succès !`);
                }
            } catch (error) {
                console.error("Error processing tournament file:", error);
                alert("Erreur lors du traitement du fichier. Assurez-vous qu'il est valide.");
            } finally {
                if (importFileRef.current) {
                    importFileRef.current.value = ""; 
                }
            }
        };
        reader.readAsText(file);
    };

    const FilterButton = ({ label, value }: { label: string, value: typeof filter }) => (
        <button 
            onClick={() => setFilter(value)} 
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${filter === value ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700/50'}`}
        >
            {label}
        </button>
    );
    
    const TournamentCard = ({ tournament }: { tournament: Tournament }) => {
        const [isMenuOpen, setMenuOpen] = useState(false);
        const menuRef = useRef<HTMLDivElement>(null);
        const activePlayers = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE).length;
        const totalEntries = tournament.entries.length;

        useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                    setMenuOpen(false);
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => document.removeEventListener("mousedown", handleClickOutside);
        }, []);

        const stopPropagationAnd = (fn: (e: React.MouseEvent) => void) => (e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            fn(e);
        };

        const toggleMenu = stopPropagationAnd(() => setMenuOpen(prev => !prev));
        
        const handleExport = stopPropagationAnd(() => {
            if (window.confirm(`Voulez-vous exporter le tournoi "${tournament.name}" ?`)) {
                const playerIdsInTournament = new Set(tournament.entries.map(entry => entry.playerId));
                const playersToExport = state.players.filter(p => playerIdsInTournament.has(p.id));
                const exportData = { tournament, players: playersToExport };
                
                const dataStr = JSON.stringify(exportData, null, 2);
                const blob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const safeName = tournament.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                link.download = `tournament_${safeName}.json`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                setMenuOpen(false);
            }
        });

        const handleArchive = stopPropagationAnd(() => {
            if (window.confirm(`Êtes-vous sûr de vouloir archiver le tournoi "${tournament.name}" ?`)) {
                dispatch({ type: 'ARCHIVE_TOURNAMENT', payload: { tournamentId: tournament.id } });
            }
            setMenuOpen(false);
        });

        const handleDelete = stopPropagationAnd(() => {
            if (window.confirm(`ATTENTION : Voulez-vous vraiment supprimer définitivement le tournoi "${tournament.name}" ? Cette action est irréversible.`)) {
                dispatch({ type: 'DELETE_TOURNAMENT', payload: { tournamentId: tournament.id } });
            }
            setMenuOpen(false);
        });

        return (
             <div className="relative group">
                <Link to={`/t/${tournament.id}`} className="block">
                    <Card className="hover:border-blue-500 transition-colors h-full flex flex-col">
                        <div className="flex justify-between items-start">
                            <h3 className="text-lg font-bold text-white pr-8">{tournament.name}</h3>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                tournament.status === TournamentStatus.RUNNING ? 'bg-green-500/20 text-green-300' :
                                tournament.status === TournamentStatus.COMPLETED ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'
                            }`}>{tournament.status}</span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{tournament.location}</p>
                        <div className="flex-grow mt-4 text-sm text-gray-300 space-y-2">
                            <p className="flex items-center gap-2"><UsersIcon className="w-4 h-4 text-blue-400"/> {activePlayers} / {totalEntries} joueurs</p>
                        </div>
                        <div className="border-t border-gray-700 mt-4 pt-4 text-xs text-gray-500">
                            Créé le {new Date(tournament.startDate).toLocaleDateString()}
                        </div>
                    </Card>
                </Link>
                 <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div ref={menuRef} className="relative">
                        <Button onClick={toggleMenu} size="sm" variant="secondary" className="p-2">
                            <DotsVerticalIcon className="w-4 h-4" />
                        </Button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-md shadow-lg py-1 z-20 border border-gray-700">
                                <button onClick={handleExport} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
                                    <ArrowDownTrayIcon className="w-4 h-4"/> Exporter ce tournoi
                                </button>
                                <button onClick={handleArchive} className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2">
                                    <ArchiveBoxIcon className="w-4 h-4"/> Archiver
                                </button>
                                <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2">
                                    <TrashIcon className="w-4 h-4"/> Supprimer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            <input type="file" ref={importFileRef} onChange={handleImportTournamentFileChange} style={{ display: 'none' }} accept=".json" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h1 className="text-3xl font-bold text-white">Tableau de Bord</h1>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                     <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-lg overflow-x-auto">
                        <FilterButton label="Tous les Tournois" value="all" />
                        <FilterButton label="En cours" value="running" />
                        <FilterButton label="À venir" value="upcoming" />
                        <FilterButton label="Terminés" value="completed" />
                    </div>
                     <Button variant="secondary" onClick={() => importFileRef.current?.click()} className="flex items-center gap-2 w-full sm:w-auto justify-center">
                        <ArrowUpTrayIcon className="w-5 h-5"/> Importer un Tournoi
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {tournaments.map(t => <TournamentCard key={t.id} tournament={t}/>)}
            </div>
            {tournaments.length === 0 && (
                <Card className="col-span-full text-center py-12">
                     <p className="text-gray-400">Aucun tournoi pour ce filtre. <Link to="/new" className="text-blue-400 hover:underline">Créez-en un maintenant !</Link></p>
                </Card>
            )}
        </div>
    );
};

// FIX: The App component was missing its body and was not exported.
// I have completed the component with routing and state management for modals and printables,
// and added the default export.
function App() {
  const { state, dispatch, loading } = useTournamentStore();
  const { entryToPrint, tableToPrint, playerListToPrint, seatDrawToPrint, payoutToPrint, financeReportToPrint, moveSlipsToPrint } = state;
  const [isSyncModalOpen, setSyncModalOpen] = useState(false);
  const [isPublicLinkModalOpen, setPublicLinkModalOpen] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      // Clear the printed item from state
      if(state.entryToPrint) dispatch({ type: 'CLEAR_ENTRY_TO_PRINT' });
      if(state.tableToPrint) dispatch({ type: 'CLEAR_TABLE_TO_PRINT' });
      if(state.playerListToPrint) dispatch({ type: 'CLEAR_PLAYER_LIST_TO_PRINT' });
      if(state.seatDrawToPrint) dispatch({ type: 'CLEAR_SEAT_DRAW_TO_PRINT' });
      if(state.payoutToPrint) dispatch({ type: 'CLEAR_PAYOUT_TO_PRINT' });
      if(state.financeReportToPrint) dispatch({ type: 'CLEAR_FINANCE_REPORT_TO_PRINT' });
      if(state.moveSlipsToPrint) dispatch({ type: 'CLEAR_MOVE_SLIPS_TO_PRINT' });
    };

    const hasPrintable = state.entryToPrint || state.tableToPrint || state.playerListToPrint || state.seatDrawToPrint || state.payoutToPrint || state.financeReportToPrint || state.moveSlipsToPrint;

    if (hasPrintable) {
      // Add event listener before printing
      window.addEventListener('afterprint', handleAfterPrint);
      
      // Use a short timeout to ensure the printable component has rendered
      setTimeout(() => {
        window.print();
      }, 100);
    }
    
    // Cleanup function to remove the event listener
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [state, dispatch]);

  if (loading) {
    return (
        <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center">
            <div className="spinner"></div>
        </div>
    );
  }

  if (entryToPrint) return <PrintableTicket data={entryToPrint} />;
  if (tableToPrint) return <PrintableTable data={tableToPrint} />;
  if (playerListToPrint) return <PrintablePlayerList data={playerListToPrint} />;
  if (seatDrawToPrint) return <PrintableSeatDraw data={seatDrawToPrint} />;
  if (payoutToPrint) return <PrintablePayout data={payoutToPrint} />;
  if (financeReportToPrint) return <PrintableFinanceReport data={financeReportToPrint} />;
  if (moveSlipsToPrint) return <PrintableMoveSlips data={moveSlipsToPrint} />;

  return (
    <SyncProvider>
      <SyncModal isOpen={isSyncModalOpen} onClose={() => setSyncModalOpen(false)} />
      <PublicLinkModal isOpen={isPublicLinkModalOpen} onClose={() => setPublicLinkModalOpen(false)} />
      <Routes>
        <Route path="/public/*" element={<PublicLayout />}>
          <Route index element={<PublicLobby />} />
          <Route path="tournament/:id" element={<PublicTournamentView />} />
          <Route path="tournament/:id/dealers" element={<DealerDisplayScreen />} />
          <Route path="cash-game" element={<PublicCashGamePage />} />
          <Route path="ranking" element={<PublicRankingPage />} />
        </Route>
        
        <Route path="/t/:id/screen" element={<TournamentScreen />} />
        
        <Route path="/" element={<MainLayout setSyncModalOpen={setSyncModalOpen} setPublicLinkModalOpen={setPublicLinkModalOpen} />}>
          <Route index element={<HomePage />} />
          <Route path="new" element={<NewTournamentPage />} />
          <Route path="t/:id" element={<TournamentDashboard />} />
          <Route path="ranking" element={<RankingPage />} />
          <Route path="players" element={<PlayerManagerPage />} />
          <Route path="dealers" element={<DealerManagerPage />} />
          <Route path="cash-game" element={<CashGamePage />} />
          <Route path="global-stats" element={<GlobalStatsPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="archives" element={<HomePage />} /> {/* Placeholder */}
        </Route>
      </Routes>
    </SyncProvider>
  );
}

export default App;
