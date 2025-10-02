import React, { useState, useEffect, useRef } from 'react';
import { useTournamentStore } from './store';
import { Tournament, TournamentStatus, FlightStatus, TournamentPhase, TournamentType } from './types';
import { Card, Button, PlayIcon, PauseIcon, ForwardIcon, BackwardIcon } from './components';

const formatTime = (totalSeconds: number): string => {
  if (totalSeconds < 0) totalSeconds = 0;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const TournamentClock = ({ tournamentId }: { tournamentId: string }) => {
  const { state, dispatch } = useTournamentStore();
  const tournament = state.tournaments.find(t => t.id === tournamentId);
  const [levelChangeInProgress, setLevelChangeInProgress] = useState(false);
  // FIX: Explicitly pass undefined to useRef to fix "Expected 1 arguments, but got 0" error.
  const prevLevelRef = useRef<number | undefined>(undefined);
  
  const [, setTick] = useState(0);

  if (!tournament) return <div>Tournament not found.</div>;

  const isMultiFlightPhase = tournament.type === TournamentType.MULTI_FLIGHT && tournament.phase === TournamentPhase.FLIGHTS;
  const activeFlight = isMultiFlightPhase ? tournament.flights.find(f => f.status === FlightStatus.RUNNING) : null;
  
  const clockSource = activeFlight || tournament;

  const {
    status,
    currentLevel,
    levels,
    clockTimeRemaining,
    lastClockStartTime,
  } = clockSource === tournament ? tournament : {
      status: tournament.status, // Main tournament status drives the clock
      currentLevel: activeFlight!.currentLevel,
      levels: tournament.levels,
      clockTimeRemaining: activeFlight!.clockTimeRemaining,
      lastClockStartTime: activeFlight!.lastClockStartTime,
  };
  
  const isRunning = status === TournamentStatus.RUNNING;

  const levelInfo = levels[currentLevel - 1];
  const nextLevelInfo = currentLevel < levels.length ? levels[currentLevel] : null;

  useEffect(() => {
    prevLevelRef.current = currentLevel;
  });

  useEffect(() => {
    let timer: number | undefined;
    if (isRunning) {
      timer = window.setInterval(() => {
        setTick(t => t + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning]);
  
  const currentTime = (() => {
    if (isRunning && lastClockStartTime) {
      const elapsed = Math.floor((Date.now() - lastClockStartTime) / 1000);
      return Math.max(0, clockTimeRemaining - elapsed);
    }
    return clockTimeRemaining;
  })();

  useEffect(() => {
    // This effect triggers the level change when the timer hits zero.
    // It is locked by `levelChangeInProgress` to prevent multiple dispatches.
    if (isRunning && currentTime <= 0 && !levelChangeInProgress) {
        setLevelChangeInProgress(true);
        dispatch({ type: 'NEXT_LEVEL', payload: { tournamentId } });
    }
  }, [isRunning, currentTime, levelChangeInProgress, tournamentId, dispatch]);

  useEffect(() => {
    // This effect resets the lock once the level has actually changed.
    // This is more reliable than checking currentTime, as it depends on the confirmed state update.
    if (prevLevelRef.current !== undefined && currentLevel !== prevLevelRef.current) {
        setLevelChangeInProgress(false);
    }
  }, [currentLevel]);


  useEffect(() => {
    if (!tournament || tournament.status !== TournamentStatus.SCHEDULED || !tournament.scheduledStartTime) {
        return;
    }

    const checkStartTime = () => {
        const scheduledTime = new Date(tournament.scheduledStartTime!).getTime();
        if (Date.now() >= scheduledTime) {
            dispatch({ type: 'TOGGLE_CLOCK', payload: { tournamentId, running: true } });
        }
    };

    checkStartTime(); 
    const interval = setInterval(checkStartTime, 1000);

    return () => clearInterval(interval);
  }, [tournament, tournamentId, dispatch]);


  const handleToggleClock = () => {
    dispatch({ type: 'TOGGLE_CLOCK', payload: { tournamentId, running: !isRunning } });
  };
  
  const handleNextLevel = () => {
      dispatch({ type: 'NEXT_LEVEL', payload: { tournamentId } });
  };

  const handlePreviousLevel = () => {
      dispatch({ type: 'PREVIOUS_LEVEL', payload: { tournamentId } });
  };

  if (!levelInfo) {
      return <Card>Chargement du niveau...</Card>;
  }


  return (
    <Card className="flex flex-col">
      <div className="text-center flex-grow">
        <p className="text-sm font-semibold text-gray-400 uppercase">
          {levelInfo.isBreak ? "BREAK" : `Level ${levelInfo.level}`}
        </p>
        <h1 className="text-7xl lg:text-8xl font-mono font-bold text-white my-2">
          {formatTime(currentTime)}
        </h1>
        
        {levelInfo.isBreak ? (
            <div className="text-2xl font-semibold text-yellow-400">Tournament on Break</div>
        ) : (
            <div className="text-3xl font-semibold text-blue-400">
              {levelInfo.smallBlind} / {levelInfo.bigBlind}
              {levelInfo.ante > 0 && <span className="text-xl text-gray-400 ml-2">(ante {levelInfo.ante})</span>}
            </div>
        )}
      </div>

      <div className="border-t border-gray-700 mt-4 pt-4 text-center">
        {nextLevelInfo ? (
            <p className="text-gray-400">
              Next: {nextLevelInfo.isBreak ? 'Break' : `${nextLevelInfo.smallBlind}/${nextLevelInfo.bigBlind}`}
            </p>
        ) : (
            <p className="text-gray-400">Final Level</p>
        )}
      </div>

      <div className="flex justify-center space-x-2 mt-6">
         <Button onClick={handlePreviousLevel} variant="secondary" className="w-32 flex items-center justify-center" disabled={currentLevel === 1}>
          <BackwardIcon className="w-5 h-5 mr-2"/> Précédent
        </Button>
        <Button onClick={handleToggleClock} className="w-32 flex items-center justify-center">
          {isRunning ? <><PauseIcon className="w-5 h-5 mr-2"/> Pause</> : <><PlayIcon className="w-5 h-5 mr-2"/> Démarrer</>}
        </Button>
        <Button onClick={handleNextLevel} variant="secondary" className="w-32 flex items-center justify-center" disabled={!nextLevelInfo}>
          <ForwardIcon className="w-5 h-5 mr-2"/> Suivant
        </Button>
      </div>
    </Card>
  );
};