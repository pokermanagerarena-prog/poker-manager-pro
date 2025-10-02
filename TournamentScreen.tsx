import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { useTournamentStore, calculatePayouts } from './store';
import { Tournament, TournamentStatus, EntryStatus, Payout, TournamentType, TournamentPhase, FlightStatus, WidgetConfig, DisplaySettings, WidgetType, Entry, Player } from './types';
import { ScrollingTicker } from './components';
import { useParams } from 'react-router-dom';

const formatTime = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const AlertOverlay = ({ alert, onClear }: { alert: { id: string, message: string, duration: number }, onClear: (alertId: string) => void }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onClear(alert.id), 500); 
        }, alert.duration * 1000);

        return () => clearTimeout(timer);
    }, [alert, onClear]);

    return (
        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center z-50 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`p-8 bg-blue-600/90 backdrop-blur-md rounded-lg shadow-2xl border-2 border-blue-400 text-center transition-transform duration-500 transform ${visible ? 'scale-100' : 'scale-90'}`}>
                <p className="text-5xl font-bold text-white whitespace-pre-wrap">{alert.message}</p>
            </div>
        </div>
    );
};

// --- WIDGET COMPONENTS ---

const PpmcLogoWidget = () => {
    const logoWrapperRef = React.useRef<HTMLDivElement>(null);
    const isInitialized = React.useRef(false);

    React.useEffect(() => {
        if (isInitialized.current || !logoWrapperRef.current) return;
        
        const logoWrapper = logoWrapperRef.current;
        isInitialized.current = true;

        const letterContainers = logoWrapper.querySelectorAll('.letter-container');

        const createCardParticle = (x: number, y: number) => {
            const particle = document.createElement('div');
            particle.className = 'card-particle';
            
            const suits = ['♠', '♥', '♦', '♣'];
            const randomSuit = suits[Math.floor(Math.random() * suits.length)];
            
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.innerHTML = `<span class="suit-symbol">${randomSuit}</span>`;
            
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 100 + 50;
            const lifetime = Math.random() * 2000 + 1500;
            
            logoWrapper.appendChild(particle);
            
            let rotation = 0;
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / lifetime;
                
                if (progress >= 1) {
                    if (particle.parentNode) {
                        particle.remove();
                    }
                    return;
                }
                
                const distance = velocity * progress;
                const newX = x + Math.cos(angle) * distance;
                const newY = y + Math.sin(angle) * distance + (progress * progress * 200);
                
                const opacity = 1 - progress;
                rotation += 10;
                
                particle.style.left = newX + 'px';
                particle.style.top = newY + 'px';
                particle.style.opacity = String(opacity);
                particle.style.transform = `rotate(${rotation}deg)`;
                
                requestAnimationFrame(animate);
            }
            animate();
        };

        const handleClick = () => {
            letterContainers.forEach((container, index) => {
                setTimeout(() => {
                    container.classList.add('flipping');
                    setTimeout(() => {
                        container.classList.remove('flipping');
                    }, 600);
                }, index * 100);
            });
            
            const rect = logoWrapper.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            for (let i = 0; i < 20; i++) {
                setTimeout(() => {
                    const angle = (i / 20) * Math.PI * 2;
                    const radius = 50;
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    createCardParticle(x, y);
                }, i * 30);
            }
        };

        const intervalId = setInterval(() => {
            if (Math.random() > 0.8) {
                const rect = logoWrapper.getBoundingClientRect();
                const x = Math.random() * rect.width;
                const y = Math.random() * rect.height;
                createCardParticle(x, y);
            }
        }, 3000);

        const handleMouseEnter = () => {
            const letters = logoWrapper.querySelectorAll('.letter');
            letters.forEach((letter, index) => {
                const htmlLetter = letter as HTMLElement;
                setTimeout(() => {
                    htmlLetter.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        htmlLetter.style.transform = '';
                    }, 200);
                }, index * 50);
            });
        };

        logoWrapper.addEventListener('click', handleClick);
        logoWrapper.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            logoWrapper.removeEventListener('click', handleClick);
            logoWrapper.removeEventListener('mouseenter', handleMouseEnter);
            clearInterval(intervalId);
            isInitialized.current = false;
        };
    }, []);

    const css = `
        .ppmc-logo-widget {
            font-family: 'Georgia', serif;
            overflow: hidden;
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .ppmc-logo-widget .container {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2rem;
            z-index: 10;
            transform: scale(0.8); /* Scale down slightly to fit */
        }
        .ppmc-logo-widget .logo-wrapper {
            position: relative;
            cursor: pointer;
            user-select: none;
            perspective: 1000px;
        }
        .ppmc-logo-widget .logo {
            display: flex;
            gap: 12px;
            position: relative;
            z-index: 10;
            transform-style: preserve-3d;
        }
        .ppmc-logo-widget .letter-container {
            position: relative;
            width: 100px;
            height: 120px;
            transform-style: preserve-3d;
            transition: transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .ppmc-logo-widget .letter {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3.5rem;
            font-weight: 900;
            border-radius: 8px;
            box-shadow: 
                0 8px 20px rgba(0,0,0,0.5),
                inset 0 1px 0 rgba(255,255,255,0.2);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            overflow: hidden;
        }
        .ppmc-logo-widget .letter-front {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e40af 100%);
            border: 2px solid #60a5fa;
            color: white;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            backface-visibility: hidden;
        }
        .ppmc-logo-widget .letter-back {
            background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 50%, #dbeafe 100%);
            border: 2px solid #3b82f6;
            transform: rotateY(180deg);
            backface-visibility: hidden;
        }
        .ppmc-logo-widget .suit {
            position: absolute;
            font-size: 2rem;
            color: #60a5fa;
            font-weight: bold;
        }
        .ppmc-logo-widget .suit.top-left { top: 8px; left: 8px; }
        .ppmc-logo-widget .suit.bottom-right { bottom: 8px; right: 8px; transform: rotate(180deg); }
        .ppmc-logo-widget .letter-container:hover .letter-front { transform: rotateY(-180deg); }
        .ppmc-logo-widget .letter-container:hover .letter-back { transform: rotateY(0deg); }
        .ppmc-logo-widget .logo-wrapper:hover .letter-container { animation: ppmcShuffle 0.8s ease-in-out; }
        @keyframes ppmcShuffle {
            0%, 100% { transform: translateX(0) translateY(0) rotateZ(0deg); }
            25% { transform: translateX(-10px) translateY(-5px) rotateZ(-5deg); }
            75% { transform: translateX(10px) translateY(-5px) rotateZ(5deg); }
        }
        .ppmc-logo-widget .chip-value {
            position: absolute;
            top: 5px; right: 5px;
            font-size: 0.9rem; font-weight: bold; color: #1e40af;
        }
        .ppmc-logo-widget .poker-chip {
            position: absolute; width: 40px; height: 40px; border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, #3b82f6, #1e40af);
            border: 2px solid #60a5fa; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            opacity: 0; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .ppmc-logo-widget .logo-wrapper:hover .poker-chip { opacity: 1; animation: ppmcChipFloat 3s ease-in-out infinite; }
        .ppmc-logo-widget .poker-chip:nth-child(1) { top: -20px; left: -20px; animation-delay: 0s; }
        .ppmc-logo-widget .poker-chip:nth-child(2) { top: -20px; right: -20px; animation-delay: 0.5s; }
        .ppmc-logo-widget .poker-chip:nth-child(3) { bottom: -20px; left: -20px; animation-delay: 1s; }
        .ppmc-logo-widget .poker-chip:nth-child(4) { bottom: -20px; right: -20px; animation-delay: 1.5s; }
        @keyframes ppmcChipFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .ppmc-logo-widget .card-particle {
            position: absolute; width: 20px; height: 30px;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            border: 1px solid #60a5fa; border-radius: 3px;
            pointer-events: none; opacity: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .ppmc-logo-widget .suit-symbol {
            position: absolute; font-size: 1.2rem; color: #60a5fa;
            top: 50%; left: 50%; transform: translate(-50%, -50%);
        }
        .ppmc-logo-widget .tagline {
            color: #60a5fa; font-size: 1.4rem; text-align: center;
            letter-spacing: 2px; font-weight: 300; text-transform: uppercase;
            opacity: 0; transform: translateY(20px);
            transition: all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-shadow: 0 0 10px rgba(96, 165, 250, 0.5);
        }
        .ppmc-logo-widget .logo-wrapper:hover + .tagline { opacity: 1; transform: translateY(0); }
        .ppmc-logo-widget .flipping { animation: ppmcFlipCard 0.6s ease-in-out; }
        @keyframes ppmcFlipCard {
            0% { transform: rotateY(0); } 50% { transform: rotateY(90deg); } 100% { transform: rotateY(180deg); }
        }
        .ppmc-logo-widget .table-edge {
            position: absolute; bottom: -50px; left: 50%;
            transform: translateX(-50%); width: 300px; height: 100px;
            background: radial-gradient(ellipse at center top, rgba(30, 64, 175, 0.3) 0%, transparent 70%);
            border-radius: 50% 50% 0 0; opacity: 0; transition: opacity 0.5s;
        }
        .ppmc-logo-widget .logo-wrapper:hover ~ .table-edge { opacity: 1; }
        .ppmc-logo-widget .blue-glow {
            position: absolute; width: 200px; height: 200px;
            background: radial-gradient(circle, rgba(96, 165, 250, 0.2) 0%, transparent 70%);
            top: 50%; left: 50%; transform: translate(-50%, -50%);
            opacity: 0; transition: opacity 0.5s; pointer-events: none;
            animation: ppmcBluePulse 3s ease-in-out infinite;
        }
        .ppmc-logo-widget .logo-wrapper:hover .blue-glow { opacity: 1; }
        @keyframes ppmcBluePulse {
            0%, 100% { transform: translate(-50%, -50%) scale(1); }
            50% { transform: translate(-50%, -50%) scale(1.2); }
        }
    `;

    return (
        <div className="ppmc-logo-widget">
            <style>{css}</style>
             <div className="container">
                <div className="logo-wrapper" ref={logoWrapperRef}>
                    <div className="logo">
                        <div className="letter-container">
                            <div className="letter letter-front">P<span className="suit top-left">♠</span><span className="suit bottom-right">♠</span></div>
                            <div className="letter letter-back"><span className="chip-value">100</span><span className="suit-symbol">♠</span></div>
                        </div>
                        <div className="letter-container">
                            <div className="letter letter-front">P<span className="suit top-left">♥</span><span className="suit bottom-right">♥</span></div>
                            <div className="letter letter-back"><span className="chip-value">100</span><span className="suit-symbol">♥</span></div>
                        </div>
                        <div className="letter-container">
                            <div className="letter letter-front">M<span className="suit top-left">♦</span><span className="suit bottom-right">♦</span></div>
                            <div className="letter letter-back"><span className="chip-value">50</span><span className="suit-symbol">♦</span></div>
                        </div>
                        <div className="letter-container">
                            <div className="letter letter-front">C<span className="suit top-left">♣</span><span className="suit bottom-right">♣</span></div>
                            <div className="letter letter-back"><span className="chip-value">25</span><span className="suit-symbol">♣</span></div>
                        </div>
                    </div>
                    <div className="blue-glow"></div>
                    <div className="poker-chip"></div><div className="poker-chip"></div>
                    <div className="poker-chip"></div><div className="poker-chip"></div>
                </div>
                <div className="table-edge"></div>
                <p className="tagline">Royal Flush • Premium Experience</p>
            </div>
        </div>
    );
};

const parseFontSize = (fs: string | undefined, defaultVal: number, defaultUnit: string): { value: number; unit: string } => {
    if (!fs) return { value: defaultVal, unit: defaultUnit };
    const match = fs.match(/(\d+\.?\d*)\s*(\w+|%)/);
    if (match) {
        return { value: parseFloat(match[1]), unit: match[2] };
    }
    return { value: defaultVal, unit: defaultUnit };
};

const ClockWidget = ({ tournament, config, clockSource, displayTime }: { tournament: Tournament, config: WidgetConfig, clockSource: any, displayTime: number }) => {
    const currentLevel = clockSource.currentLevel;
    const levelInfo = tournament.levels[currentLevel - 1];
    const nextLevelInfo = tournament.levels[currentLevel];

    const nextBreakTime = useMemo(() => {
        const currentLevelIndex = tournament.levels.findIndex(l => l.level === clockSource.currentLevel);
        let timeUntilBreakInSeconds = -1;
        if (currentLevelIndex >= 0 && !tournament.levels[currentLevelIndex].isBreak) {
            const nextBreakIndex = tournament.levels.findIndex((l, i) => i > currentLevelIndex && l.isBreak);
            if (nextBreakIndex !== -1) {
                timeUntilBreakInSeconds = displayTime;
                for (let i = currentLevelIndex + 1; i < nextBreakIndex; i++) {
                    timeUntilBreakInSeconds += tournament.levels[i].duration * 60;
                }
            }
        }
        return timeUntilBreakInSeconds >= 0 ? formatTime(timeUntilBreakInSeconds) : null;
    }, [tournament.levels, clockSource.currentLevel, displayTime]);

    if (!levelInfo) return null;

    const mainSize = parseFontSize(config.fontSize, 10, 'rem');
    const relativeSize = (ratio: number) => `${mainSize.value * ratio}${mainSize.unit}`;

    return (
        <div className="flex flex-col items-center justify-around h-full text-center py-4">
            <div className="flex-shrink-0">
                <div className="font-bold text-gray-300" style={{ fontSize: relativeSize(0.1875) }}>
                    {levelInfo.isBreak ? "PAUSE" : `ROUND ${levelInfo.level}`}
                </div>
                <div className="font-mono font-bold" style={{ fontSize: config.fontSize || '10rem', color: config.color || 'white', lineHeight: 1.1 }}>
                    {formatTime(displayTime)}
                </div>
                <div className="font-semibold text-blue-300 mt-2" style={{ fontSize: relativeSize(0.225) }}>
                    {levelInfo.isBreak ? "Retour du tournoi bientôt" : `${levelInfo.smallBlind.toLocaleString()} / ${levelInfo.bigBlind.toLocaleString()}`}
                    {!levelInfo.isBreak && levelInfo.ante > 0 && <span className="text-gray-400 ml-4" style={{ fontSize: '0.8em' }}> (ante {levelInfo.ante.toLocaleString()})</span>}
                </div>
            </div>

            <div className="w-full max-w-lg space-y-4 flex-shrink-0">
                {nextLevelInfo && !levelInfo.isBreak && (
                    <div className="text-gray-400 border-t border-white/10 pt-3">
                        <p className="uppercase font-semibold tracking-wider" style={{ fontSize: relativeSize(0.125) }}>PROCHAIN NIVEAU</p>
                        <p className="font-bold text-gray-200" style={{ fontSize: relativeSize(0.15) }}>
                            {nextLevelInfo.isBreak ? "PAUSE" : `${nextLevelInfo.smallBlind.toLocaleString()} / ${nextLevelInfo.bigBlind.toLocaleString()}`}
                            {!nextLevelInfo.isBreak && nextLevelInfo.ante > 0 && <span className="ml-2" style={{ fontSize: '0.8em' }}>(ante {nextLevelInfo.ante.toLocaleString()})</span>}
                        </p>
                    </div>
                )}
                {nextBreakTime && (
                    <div className="text-gray-400">
                        <p className="uppercase font-semibold tracking-wider" style={{ fontSize: relativeSize(0.125) }}>Next Break</p>
                        <p className="font-bold text-gray-200" style={{ fontSize: relativeSize(0.15) }}>{nextBreakTime}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const StatsWidget = ({ tournament, config, stats }: { tournament: Tournament, config: WidgetConfig, stats: any }) => {
    const data = {
        players_remaining: `${stats.activePlayerCount} / ${stats.totalEntries}`,
        players_total: stats.totalEntries,
        avg_stack: stats.averageStack.toLocaleString(),
        avg_stack_bb: stats.avgStackInBB,
        prizepool: `${stats.totalPrizePool.toLocaleString()} MAD`,
        chip_leader_name: stats.playerRankings[0]?.name || '-',
        chip_leader_stack: stats.playerRankings[0]?.chips.toLocaleString() || '-',
    };

    const value = data[config.statType as keyof typeof data] || 'N/A';
    
    return (
        <div style={{ fontSize: config.fontSize || '3rem', color: config.color || 'white', fontWeight: config.fontWeight || '700' }}>
            {config.label && <p className="text-gray-400 uppercase tracking-wider" style={{ fontSize: '0.33em' }}>{config.label}</p>}
            <p>{value}</p>
        </div>
    )
};

const PayoutsWidget = ({ tournament, config, stats, containerSize }: { tournament: Tournament, config: WidgetConfig, stats: any, containerSize: { width: number, height: number } }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    
    const payoutsToShow = stats.payouts.slice(0, config.payoutCount || 10);

    useLayoutEffect(() => {
        if (containerRef.current && contentRef.current) {
            const isOverflow = contentRef.current.scrollHeight > containerRef.current.clientHeight;
            setIsOverflowing(isOverflow);
        }
    }, [payoutsToShow, containerSize]);

    const animationDuration = isOverflowing ? `${payoutsToShow.length * 2.5}s` : 'none';
    
    const items = payoutsToShow.map((p: Payout) => (
        <div key={p.rank} className="flex justify-between items-baseline bg-black/20 p-2 rounded-md">
            <span className="font-semibold text-gray-300">#{p.rank}</span>
            <span className="font-bold text-white">{p.description || `${p.amount.toLocaleString()} MAD`}</span>
        </div>
    ));

    return (
        <div className="w-full h-full flex flex-col" style={{ fontSize: config.fontSize || '1rem', color: config.color || 'white' }}>
            <h3 className="text-gray-300 font-bold uppercase tracking-wider mb-2 flex-shrink-0" style={{ fontSize: '1.2em'}}>STRUCTURE DES PAYOUTS</h3>
            <div ref={containerRef} className="flex-grow overflow-hidden relative w-full">
                <div
                    ref={contentRef}
                    className={isOverflowing ? 'animate-scroll-vertical' : ''}
                    style={{'--animation-duration': animationDuration} as React.CSSProperties}
                >
                    <div className="space-y-1">{items}</div>
                    {isOverflowing && <div aria-hidden="true" className="mt-4 space-y-1">{items}</div>}
                </div>
            </div>
        </div>
    );
};

const ChipLeadersWidget = ({ tournament, config, stats, containerSize }: { tournament: Tournament, config: WidgetConfig, stats: any, containerSize: { width: number, height: number } }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    
    const leaders = stats.playerRankings.slice(0, config.leaderCount || 10);
    
    useLayoutEffect(() => {
        if (containerRef.current && contentRef.current) {
            const isOverflow = contentRef.current.scrollHeight > containerRef.current.clientHeight;
            setIsOverflowing(isOverflow);
        }
    }, [leaders, containerSize]);

    const animationDuration = isOverflowing ? `${leaders.length * 3}s` : 'none';

    const items = leaders.map((p: any, index: number) => (
        <div key={index} className="flex justify-between items-baseline bg-black/20 p-2 rounded-md">
            <span className="font-semibold text-gray-300 truncate pr-2">#{index+1} {p.name}</span>
            <span className="font-bold font-mono text-white flex-shrink-0">{p.chips.toLocaleString()}</span>
        </div>
    ));

    return (
        <div className="w-full h-full flex flex-col" style={{ fontSize: config.fontSize || '1rem', color: config.color || 'white' }}>
             <h3 className="text-gray-300 font-bold uppercase tracking-wider mb-2 flex-shrink-0" style={{ fontSize: '1.2em'}}>CHIP LEADERS</h3>
            <div ref={containerRef} className="flex-grow overflow-hidden relative w-full">
                 <div
                    ref={contentRef}
                    className={isOverflowing ? 'animate-scroll-vertical' : ''}
                    style={{'--animation-duration': animationDuration} as React.CSSProperties}
                >
                    <div className="space-y-1">{items}</div>
                    {isOverflowing && <div aria-hidden="true" className="mt-4 space-y-1">{items}</div>}
                </div>
            </div>
        </div>
    );
};

const SponsorsWidget = ({ tournament, config }: { tournament: Tournament, config: WidgetConfig }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { sponsors } = tournament.displaySettings;

    useEffect(() => {
        if (!sponsors || sponsors.length === 0) return;

        const currentSponsor = sponsors[currentIndex];
        const duration = (currentSponsor.duration || 5) * 1000;

        const timer = setTimeout(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % sponsors.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [currentIndex, sponsors]);

    if (!sponsors || sponsors.length === 0) {
        return <div className="text-gray-500">Aucun sponsor à afficher</div>;
    }
    
    const currentSponsor = sponsors[currentIndex];

    return (
        <div className="w-full h-full flex items-center justify-center transition-opacity duration-500">
            <img key={currentSponsor.id} src={currentSponsor.imageUrl} alt={currentSponsor.name} className="max-w-full max-h-full object-contain animate-fade-in" />
             <style>{`.animate-fade-in { animation: fadeIn 0.5s; } @keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }`}</style>
        </div>
    );
};

// Main Exported Component
export const TournamentScreen = ({ tournament: tournamentProp, players: playersProp }: { tournament?: Tournament, players?: Player[] }) => {
    const params = useParams<{ id: string }>();
    const { state, dispatch } = useTournamentStore();
    
    const tournament = tournamentProp || state.tournaments.find(t => t.id === params.id);
    const players = playersProp || state.players;

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    const [dynamicBackgroundColor, setDynamicBackgroundColor] = useState(tournament?.displaySettings.backgroundColor || '#0D1117');

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries && entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                setContainerSize({ width, height });
            }
        });

        const currentRef = containerRef.current;
        if (currentRef) {
            resizeObserver.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                resizeObserver.unobserve(currentRef);
            }
        };
    }, []);

    // --- Centralized Clock Logic ---
    const clockSource = useMemo(() => {
        if (!tournament) return null;
        const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
        const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
        return activeFlight || tournament;
    }, [tournament]);

    const { status, lastClockStartTime, clockTimeRemaining } = clockSource || {};
    const isRunning = status === TournamentStatus.RUNNING;
    const [, setTick] = useState(0);

    useEffect(() => {
        let timer: number | undefined;
        if (isRunning) {
            timer = window.setInterval(() => setTick(t => t + 1), 1000);
        }
        return () => { if (timer) clearInterval(timer); };
    }, [isRunning]);

    const currentDisplayTime = (() => {
        if (isRunning && lastClockStartTime && clockTimeRemaining !== undefined) {
            const elapsed = Math.floor((Date.now() - lastClockStartTime) / 1000);
            return Math.max(0, clockTimeRemaining - elapsed);
        }
        return clockTimeRemaining || 0;
    })();

    useEffect(() => {
        if (!tournament || !tournament.displaySettings.dynamicBackgroundColorEnabled || !clockSource) {
            if (tournament) {
                setDynamicBackgroundColor(tournament.displaySettings.backgroundColor);
            }
            return;
        }
    
        const levelInfo = tournament.levels[clockSource.currentLevel - 1];
        if (!levelInfo) return;
    
        if (clockSource.status === TournamentStatus.PAUSED || levelInfo.isBreak) {
            setDynamicBackgroundColor('hsl(0, 60%, 20%)'); // Bordeaux for pause
            return;
        }
    
        const actualLevels = tournament.levels.filter(l => !l.isBreak);
        const totalActualLevels = actualLevels.length;
        
        const currentLevelIndexInFullArray = clockSource.currentLevel - 1;
        const passedActualLevels = tournament.levels.slice(0, currentLevelIndexInFullArray + 1).filter(l => !l.isBreak).length;
    
        const progress = totalActualLevels > 1 ? Math.max(0, passedActualLevels - 1) / (totalActualLevels - 1) : 0;
        
        const startHue = 240; // blue
        const endHue = 15;   // red-orange
        const hue = startHue - (progress * (startHue - endHue));
    
        const startSat = 60;
        const endSat = 70;
        const saturation = startSat + (progress * (endSat - startSat));
    
        const startLight = 25;
        const endLight = 30;
        const lightness = startLight + (progress * (endLight - startLight));
        
        const newColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        setDynamicBackgroundColor(newColor);
    
    }, [clockSource, tournament?.displaySettings, tournament?.levels]);


    // --- Data Calculation Memo ---
    const tournamentStats = useMemo(() => {
        if (!tournament || !clockSource || !players) return null;

        const currentLevel = clockSource.currentLevel;

        let entriesForCalculations: Entry[];
        let entriesForDisplay: Entry[];

        const isMultiFlightDay1Phase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;

        if (isMultiFlightDay1Phase) {
            const runningFlight = tournament.flights.find(f => f.status === FlightStatus.RUNNING);
            if (runningFlight) {
                entriesForCalculations = tournament.entries.filter(e => e.flightId === runningFlight.id);
                entriesForDisplay = entriesForCalculations;
            } else {
                entriesForCalculations = tournament.entries;
                entriesForDisplay = tournament.entries;
            }
        } else {
            entriesForCalculations = tournament.entries;
            entriesForDisplay = tournament.entries;
        }
        
        const totalEntries = entriesForCalculations.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
        
        const activePlayerCount = entriesForDisplay.filter(e => e.status === EntryStatus.ACTIVE).length;
        
        const totalBuyins = entriesForCalculations.reduce((sum, e) => sum + e.buyins, 0);
        const totalAddons = entriesForCalculations.reduce((sum, e) => sum + e.addons, 0);
        const totalDealerBonuses = entriesForCalculations.reduce((sum, e) => sum + (e.dealerBonuses || 0), 0);
        
        const totalPrizePool = (totalBuyins * tournament.buyin) + (totalAddons * tournament.addonCost);
        const totalChips = (totalBuyins * tournament.startingStack) + (totalAddons * tournament.addonChips) + (totalDealerBonuses * tournament.dealerBonusChips);
        
        const averageStack = activePlayerCount > 0 ? Math.round(totalChips / activePlayerCount) : 0;
        
        const levelInfo = tournament.levels[currentLevel - 1];
        const bb = levelInfo ? levelInfo.bigBlind : 0;
        const avgStackInBB = bb > 0 ? `${Math.round(averageStack / bb)} BB` : '-';
        
        const payouts = tournament.payoutSettings.mode === 'manual' && tournament.payoutSettings.manualPayouts.length > 0
            ? [...tournament.payoutSettings.manualPayouts].sort((a,b) => a.rank - b.rank)
            : calculatePayouts(totalPrizePool, totalEntries);
            
        const playerRankings = entriesForDisplay
            .filter(e => e.status === EntryStatus.ACTIVE)
            .sort((a,b) => b.chipCount - a.chipCount)
            .map(e => ({
                name: players.find(p => p.id === e.playerId)?.nickname || 'Unknown',
                chips: e.chipCount
            }));

        return { totalEntries, activePlayerCount, averageStack, totalPrizePool, avgStackInBB, payouts, playerRankings, totalChips };
    }, [tournament, players, clockSource]);

    // --- Tag Parser ---
    const tagParser = (text: string) => {
        if (!tournament || !clockSource || !tournamentStats) return text;
        const currentLevel = clockSource.currentLevel;
        
        const now = new Date();
        const replacements: { [key: string]: string | number } = {
            '<tournoi_nom>': tournament.name,
            '<joueurs_restants>': tournamentStats.activePlayerCount,
            '<joueurs_total>': tournamentStats.totalEntries,
            '<avg_stack>': tournamentStats.averageStack.toLocaleString(),
            '<avg_stack_bb>': tournamentStats.avgStackInBB,
            '<prizepool_total>': `${tournamentStats.totalPrizePool.toLocaleString()} MAD`,
            '<niveau_actuel>': currentLevel,
            '<blinds_actuelles>': `${tournament.levels[currentLevel - 1]?.smallBlind || 0}/${tournament.levels[currentLevel - 1]?.bigBlind || 0}`,
            '<ante_actuel>': tournament.levels[currentLevel - 1]?.ante || 0,
            '<prochaines_blinds>': tournament.levels[currentLevel] ? `${tournament.levels[currentLevel].smallBlind}/${tournament.levels[currentLevel].bigBlind}` : 'N/A',
            '<prochain_break_temps>': 'N/A', // Handled inside ClockWidget now
            '<heure_actuelle>': now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            '<chip_leader_nom>': tournamentStats.playerRankings[0]?.name || '-',
            '<chip_leader_stack>': tournamentStats.playerRankings[0]?.chips.toLocaleString() || '-',
            '<total_chips>': tournamentStats.totalChips.toLocaleString(),
        };
        return text.replace(/<[^>]+>/g, tag => String(replacements[tag] || tag));
    };

    // --- Ticker Settings & Backward Compatibility ---
    const displaySettingsData = tournament?.displaySettings;
    const topTicker = displaySettingsData?.topTicker ?? { enabled: false, content: 'announcements', speed: 'normal' };
    const bottomTicker = displaySettingsData?.bottomTicker ?? (displaySettingsData as any)?.ticker ?? { enabled: true, content: 'payouts', speed: 'normal' };

    // --- Ticker Items ---
    const getTickerItems = (content: 'players' | 'payouts' | 'announcements') => {
        if (!tournamentStats || !tournament) return [];
        switch (content) {
            case 'payouts': return tournamentStats.payouts?.map(p => ` #${p.rank} - ${p.description || `${p.amount.toLocaleString()} MAD`}`) ?? [];
            case 'announcements': {
                const announcements = (tournament.announcements || []).map(a => ({
                    text: `📢 ${a.text}`,
                    timestamp: new Date(a.createdAt).getTime(),
                }));

                if (announcements.length === 0) {
                    return ["Bienvenue au tournoi !"];
                }

                return announcements
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map(item => item.text);
            }
            case 'players':
            default: return tournamentStats.playerRankings?.map((p, i) => `#${i + 1} ${p.name}: ${p.chips.toLocaleString()}`) ?? [];
        }
    };
    
    const topTickerItems = useMemo(() => getTickerItems(topTicker.content), [topTicker.content, tournamentStats, tournament?.announcements, tournament?.liveCoveragePosts]);
    const bottomTickerItems = useMemo(() => getTickerItems(bottomTicker.content), [bottomTicker.content, tournamentStats, tournament?.announcements, tournament?.liveCoveragePosts]);
    
    // --- Alert Handling ---
    const handleClearAlert = (alertId: string) => {
        if (tournament) {
            dispatch({ type: 'CLEAR_DISPLAY_ALERT', payload: { tournamentId: tournament.id, alertId } });
        }
    };

    if (!tournament || !tournamentStats || !clockSource) return <div className="bg-[#0D1117] text-white h-full w-full flex items-center justify-center text-2xl">Chargement...</div>;

    const { displaySettings, displayAlert } = tournament;
    
    const BASE_WIDTH = 1920;
    const BASE_HEIGHT = 1080;

    const scale = useMemo(() => {
        if (containerSize.width === 0 || containerSize.height === 0) return 0;
        const scaleX = containerSize.width / BASE_WIDTH;
        const scaleY = containerSize.height / BASE_HEIGHT;
        return Math.min(scaleX, scaleY);
    }, [containerSize]);
    
    const { dynamicBackgroundColorEnabled, backgroundImage, backgroundColor } = displaySettings;
    
    const outerContainerStyle = useMemo(() => {
        if (dynamicBackgroundColorEnabled) {
            return {
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
                backgroundColor: 'transparent',
            };
        } else {
            return {
                backgroundColor: backgroundColor,
                backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
            };
        }
    }, [dynamicBackgroundColorEnabled, backgroundImage, backgroundColor]);

    const mainStyle = {
        display: 'grid',
        gridTemplateColumns: displaySettings.gridTemplateColumns,
        gridTemplateRows: displaySettings.gridTemplateRows,
        gap: `${displaySettings.gap}px`,
        width: `${BASE_WIDTH}px`,
        height: `${BASE_HEIGHT}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
    };

    return (
        <div style={outerContainerStyle} className="text-gray-200 h-screen w-full flex flex-col p-4 font-sans antialiased bg-cover bg-center relative">
            <style>{`
                .animate-scroll-vertical {
                    animation: scroll-up var(--animation-duration, 20s) linear infinite;
                    will-change: transform;
                }
                @keyframes scroll-up {
                    from { transform: translateY(0); }
                    to { transform: translateY(-50%); }
                }
            `}</style>
            {dynamicBackgroundColorEnabled && (
                <div 
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: dynamicBackgroundColor,
                        opacity: backgroundImage ? 0.75 : 1,
                        transition: 'background-color 2s ease-in-out',
                        zIndex: 0,
                    }}
                />
            )}
            
            <div className="relative z-10 w-full h-full flex flex-col">
                {topTicker.enabled && <div className="flex-shrink-0 pb-4"><ScrollingTicker items={topTickerItems} speed={topTicker.speed} /></div>}

                <div ref={containerRef} className="flex-grow w-full h-full flex items-center justify-center" style={{ minHeight: 0, overflow: 'hidden' }}>
                    <main style={mainStyle} className="flex-shrink-0">
                       {displaySettings.cells.map(cell => {
                           const widget = displaySettings.widgets.find(w => w.id === cell.widgetId);
                           const cellStyle = { gridColumn: cell.col, gridRow: cell.row };
                           const widgetStyle = {
                               textAlign: widget?.textAlign || 'center',
                               justifyContent: widget?.justifyContent || 'center',
                               alignItems: widget?.alignItems || 'center',
                               flexDirection: widget?.flexDirection || 'column',
                           } as React.CSSProperties;
                           
                           const isHidden = widget?.isHidden;

                           return (
                               <div 
                                    key={cell.id} 
                                    style={cellStyle} 
                                    className={isHidden ? "" : "bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 flex overflow-hidden"}
                                >
                                   {widget && !isHidden && (
                                       <div className="w-full h-full flex" style={widgetStyle}>
                                        {(() => {
                                            switch (widget.type) {
                                                case WidgetType.CLOCK: return <ClockWidget tournament={tournament} displayTime={currentDisplayTime} config={widget} clockSource={clockSource} />;
                                                case WidgetType.BLINDS: return null; // This is now part of the ClockWidget
                                                case WidgetType.STATS: return <StatsWidget tournament={tournament} config={widget} stats={tournamentStats} />;
                                                case WidgetType.PAYOUTS: return <PayoutsWidget tournament={tournament} config={widget} stats={tournamentStats} containerSize={containerSize}/>;
                                                case WidgetType.CHIP_LEADERS: return <ChipLeadersWidget tournament={tournament} config={widget} stats={tournamentStats} containerSize={containerSize}/>;
                                                case WidgetType.TEXT: return <div style={{ fontSize: widget.fontSize, color: widget.color, fontWeight: widget.fontWeight, whiteSpace: 'pre-wrap' }}>{tagParser(widget.content || '')}</div>;
                                                case WidgetType.IMAGE: return widget.imageUrl ? <img src={widget.imageUrl} className="max-w-full max-h-full object-contain" /> : null;
                                                case WidgetType.SPONSORS: return <SponsorsWidget tournament={tournament} config={widget} />;
                                                case WidgetType.LOGO_PPMC: return <PpmcLogoWidget />;
                                                default: return null;
                                            }
                                        })()}
                                       </div>
                                   )}
                               </div>
                           )
                       })}
                    </main>
                </div>
                
                {bottomTicker.enabled && <div className="flex-shrink-0 pt-4"><ScrollingTicker items={bottomTickerItems} speed={bottomTicker.speed} /></div>}
            </div>

            {displayAlert && <AlertOverlay alert={displayAlert} onClear={handleClearAlert} />}
        </div>
    );
};