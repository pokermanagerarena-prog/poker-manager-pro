import React, { createContext, useContext, ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ListBulletIcon, TrophyIcon, BanknotesIcon, CloseIcon } from './components';
import { PublicState } from './App'; // Import PublicState type from App.tsx
import Peer, { DataConnection } from 'peerjs';

interface PublicSyncContextType {
    syncedState: PublicState | null;
}
const PublicSyncContext = createContext<PublicSyncContextType>({ syncedState: null });
export const usePublicSync = () => useContext(PublicSyncContext);

const PublicSyncProvider = ({ children }: { children: ReactNode }) => {
    const [syncedState, setSyncedState] = useState<PublicState | null>(null);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const location = useLocation();
    const peerRef = useRef<Peer | null>(null);
    const hostConnectionRef = useRef<DataConnection | null>(null);
    const reconnectAttemptRef = useRef<number>(0);

    const hostId = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get('sync');
    }, [location.search]);

    useEffect(() => {
        if (!hostId) {
            setStatus('disconnected');
            return;
        }

        const cleanup = () => {
            if (hostConnectionRef.current) {
                hostConnectionRef.current.close();
                hostConnectionRef.current = null;
            }
            if (peerRef.current) {
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };

        const connect = () => {
            cleanup();
            setStatus('connecting');
            const peer = new Peer();
            peerRef.current = peer;

            peer.on('open', () => {
                console.log('Public client PeerJS ID:', peer.id);
                const conn = peer.connect(hostId, {
                    reliable: true,
                    metadata: { type: 'public-viewer' }
                });
                hostConnectionRef.current = conn;

                conn.on('open', () => {
                    console.log('Connected to host via PeerJS');
                    setStatus('connected');
                    reconnectAttemptRef.current = 0;
                });

                conn.on('data', (data: any) => {
                    try {
                        setSyncedState(JSON.parse(data as string));
                    } catch (e) {
                        console.error("Failed to parse public state:", e);
                    }
                });

                conn.on('close', () => {
                    console.log('Disconnected from host');
                    setStatus('disconnected');
                    setSyncedState(null);
                    // Exponential backoff reconnect logic
                    const timeout = Math.min(30000, (2 ** reconnectAttemptRef.current) * 1000);
                    setTimeout(() => {
                        reconnectAttemptRef.current++;
                        console.log(`Attempting to reconnect to host in ${timeout / 1000}s...`);
                        connect();
                    }, timeout);
                });
                
                conn.on('error', (err) => {
                    console.error('PeerJS connection error:', err);
                    conn.close();
                });
            });

            peer.on('error', (err) => {
                console.error('PeerJS main error:', err);
                setStatus('disconnected');
                // Could add retry for peer creation itself
            });
        };

        connect();

        return () => {
            cleanup();
        };
    }, [hostId]);

    return (
        <PublicSyncContext.Provider value={{ syncedState }}>
            {status !== 'connected' && (
                 <div className="absolute inset-0 bg-gray-900/80 z-50 flex flex-col items-center justify-center text-center p-4">
                     <div className="spinner h-8 w-8 mx-auto mb-4" style={{borderWidth: '4px'}}></div>
                     <p className="text-xl text-white">Connexion au tournoi en cours...</p>
                     <p className="text-sm text-gray-400 mt-2">Si la connexion échoue, veuillez re-scanner le QR code du tournoi.</p>
                 </div>
            )}
            {children}
        </PublicSyncContext.Provider>
    );
};


const PublicLayout = () => {
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [location.pathname]);
    
    const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-3 rounded-md text-base font-medium transition-colors ${
            isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
        }`;

    const navLinks = (
        <>
            <NavLink to={{ pathname: '/public', search: location.search }} end className={navLinkClasses}>
                <ListBulletIcon className="w-5 h-5" />
                Lobby des Tournois
            </NavLink>
            <NavLink to={{ pathname: '/public/cash-game', search: location.search }} className={navLinkClasses}>
                <BanknotesIcon className="w-5 h-5" />
                Cash Game
            </NavLink>
            <NavLink to={{ pathname: '/public/ranking', search: location.search }} className={navLinkClasses}>
                <TrophyIcon className="w-5 h-5" />
                Classement Général
            </NavLink>
        </>
    );

    return (
        <div className="min-h-screen flex flex-col bg-gray-900 text-gray-200">
            <header className="bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 p-4 flex justify-between items-center sticky top-0 z-40">
                <h1 className="text-xl font-bold text-white">
                    <NavLink to={{ pathname: '/public', search: location.search }}>
                        Poker Manager PRO+
                    </NavLink>
                </h1>
                <nav className="hidden md:flex items-center gap-2">
                    {navLinks}
                </nav>
                 <div className="md:hidden">
                    <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-md text-gray-300 hover:bg-gray-700">
                        <ListBulletIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>
            
            {/* Mobile Menu */}
             <div className={`fixed inset-0 z-50 transform transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`}>
                <div className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)}></div>
                <div className="relative w-72 h-full bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Menu</h2>
                        <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-md text-gray-300 hover:bg-gray-700">
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <nav className="flex flex-col gap-3">
                        {navLinks}
                    </nav>
                </div>
            </div>

            <div className="flex-grow relative">
                <PublicSyncProvider>
                    <Outlet />
                </PublicSyncProvider>
            </div>
        </div>
    );
};
export default PublicLayout;
