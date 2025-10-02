import React, { useMemo } from 'react';
import { Card, CardHeader, UsersIcon } from './components';
import { Player } from './types';
import { usePublicSync } from './PublicLayout';

const PublicCashGamePage = () => {
    const { syncedState: data } = usePublicSync();

    if (!data) {
        return (
            <div className="p-8 text-center text-2xl text-gray-400">
                <div className="spinner h-8 w-8 mx-auto mb-4" style={{borderWidth: '4px'}}></div>
                <p>Connexion au serveur du directeur...</p>
            </div>
        );
    }
    
    const { cashGameTables, cashGameSessions, players } = data;
    const playerMap = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

    const tablesData = useMemo(() => {
        return cashGameTables.map(table => {
            const seatedPlayers = cashGameSessions
                .filter(s => s.tableId === table.id && s.endTime === null)
                .map(s => playerMap.get(s.playerId))
                .filter((p): p is Player => !!p);

            const waitingPlayers = table.waitingList
                .map(playerId => playerMap.get(playerId))
                .filter((p): p is Player => !!p);

            return {
                ...table,
                seatedPlayers,
                waitingPlayers
            };
        });
    }, [cashGameTables, cashGameSessions, playerMap]);

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-white">Tables de Cash Game Actives</h1>
                <p className="text-gray-400 mt-2">Consultez en direct l'occupation des tables et les listes d'attente.</p>
            </header>

            {tablesData.length === 0 ? (
                 <Card>
                    <div className="text-center py-12 text-gray-500">
                         <UsersIcon className="w-16 h-16 mx-auto mb-4" />
                         <p className="text-lg">Aucune table de cash game n'est actuellement ouverte.</p>
                     </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {tablesData.map(table => (
                        <Card key={table.id} className="flex flex-col">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <span>{table.name}</span>
                                    <span className="text-sm font-semibold bg-gray-700 px-2 py-1 rounded-md">{table.seatedPlayers.length} / {table.seats}</span>
                                </div>
                                <p className="text-sm font-normal text-gray-400 mt-1">{table.variant} - {table.blinds}</p>
                            </CardHeader>
                            
                            <div className="space-y-4 flex-grow flex flex-col">
                                <div className="flex-grow">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Joueurs Assis</h4>
                                    <div className="space-y-1 text-sm">
                                        {table.seatedPlayers.length > 0 ? (
                                            table.seatedPlayers.map(p => <div key={p.id} className="bg-gray-700/50 p-1.5 rounded">{p.nickname}</div>)
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">Aucun joueur assis.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Liste d'Attente ({table.waitingPlayers.length})</h4>
                                    <div className="space-y-1 text-sm">
                                         {table.waitingPlayers.length > 0 ? (
                                            table.waitingPlayers.map((p, index) => <div key={p.id} className="bg-gray-700/50 p-1.5 rounded">{index + 1}. {p.nickname}</div>)
                                        ) : (
                                            <p className="text-xs text-gray-500 italic">Liste d'attente vide.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PublicCashGamePage;