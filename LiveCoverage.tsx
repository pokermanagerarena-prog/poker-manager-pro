import React, { useState, useEffect, useRef } from 'react';
import { useTournamentStore } from './store';
import { Tournament, LiveCoverageSuggestion, LiveCoveragePost } from './types';
import { Card, CardHeader, Button, TrashIcon, SparklesIcon, PencilIcon, ArrowUpTrayIcon } from './components';
import { requestOnDemandAnalysis } from './aiAgent';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Génération en cours...</span>
    </div>
);

const quickQuestions = {
    "🎬 Avant le tournoi": [
        "Qui sont les joueurs les plus connus déjà installés ?",
        "Quelles nationalités sont représentées aujourd’hui ?",
        "Combien de joueurs sont attendus pour ce tournoi ?",
        "Quels sont les chiffres clés de la structure (stack de départ, blinds, niveaux) ?",
        "Quels champions des éditions précédentes participent ?",
        "Y a-t-il des visages nouveaux ou des rookies à suivre ?",
        "Quelle est l’ambiance dans la salle à l’ouverture ?",
        "Quels joueurs arrivent avec une réputation à défendre ?",
        "Quelle est la météo et l’atmosphère autour du casino aujourd’hui ?",
        "Quels sponsors ou personnalités sont présents pour ce lancement ?"
    ],
    "🃏 Premiers niveaux": [
        "Qui a remporté les premiers gros pots ?",
        "Quels joueurs se démarquent par un style agressif ?",
        "Quels joueurs semblent adopter une stratégie très serrée ?",
        "Quels coups notables ont marqué le début du tournoi ?",
        "Quelle est l’ambiance entre les joueurs à table ?",
        "Y a-t-il déjà eu des éliminations surprises ?",
        "Qui a doublé son tapis rapidement ?",
        "Quelle table paraît la plus “animée” ?",
        "Quelles sont les anecdotes des premiers niveaux ?",
        "Quels joueurs sont les plus souriants ou détendus ?"
    ],
    "💥 Bustouts & Moments clés": [
        "Qui a été le premier joueur éliminé aujourd’hui ?",
        "Raconte un bad beat marquant du dernier niveau.",
        "Quels joueurs accumulent déjà plusieurs éliminations ?",
        "Quelle main la plus spectaculaire a été révélée ?",
        "Qui a pris le plus gros risque pour un bluff réussi ?",
        "Y a-t-il eu une confrontation entre deux gros stacks ?",
        "Qui a quitté la salle sous les applaudissements ou les rires ?",
        "Quelles ont été les réactions du public après une grosse main ?",
        "Qui a tenté un move créatif qui n’a pas fonctionné ?",
        "Qui a fait la remontée la plus impressionnante après un tapis réduit ?"
    ],
    "🔥 Approche de la bulle": [
        "Combien de joueurs restent avant la bulle ?",
        "Quels short stacks tentent de survivre ?",
        "Qui est le chipleader à ce moment précis ?",
        "Quels joueurs se crispent et ralentissent le jeu ?",
        "Quelle est la tension dans la salle à la bulle ?",
        "Qui est en train de mettre la pression aux autres avec un gros stack ?",
        "Quels joueurs serrent les dents pour espérer “gratter l’argent” ?",
        "Quelle a été la main la plus tendue juste avant la bulle ?",
        "Quels joueurs plaisantent malgré la pression ?",
        "Quelle est la réaction du public autour des tables à ce moment clé ?"
    ],
    "💰 Places payées": [
        "Qui a été le malheureux “bubble boy” ?",
        "Quels sont les premiers joueurs à entrer dans l’argent ?",
        "Qui célèbre déjà son min-cash ?",
        "Quels joueurs visent clairement beaucoup plus que le min-cash ?",
        "Qui sont les favoris encore en course après la bulle ?",
        "Quelle est la nouvelle dynamique après l’annonce des places payées ?",
        "Quels joueurs short stacks ont réussi à survivre à la bulle ?",
        "Qui est en train de dominer clairement sa table ?",
        "Quelle est l’ambiance générale après cette étape cruciale ?",
        "Qui a surpris tout le monde en s’accrochant jusqu’aux places payées ?"
    ],
    "🎯 Fin de journée / Fin de Day 1": [
        "Qui termine en tête du chipcount ?",
        "Quels joueurs connus ont survécu à cette journée ?",
        "Qui a impressionné par son style de jeu ?",
        "Quelles ont été les mains les plus mémorables du jour ?",
        "Quelle est l’ambiance à la sortie des joueurs ?",
        "Quels outsiders sont encore en course ?",
        "Quels favoris ont chuté plus tôt que prévu ?",
        "Qui a fait la remontée la plus spectaculaire de la journée ?",
        "Quel est le bilan global en termes d’entrées et de prize pool ?",
        "Quelle histoire marquante retiendra-t-on de ce Day 1 ?"
    ],
    "🏆 Table finale": [
        "Qui sont les finalistes et quels sont leurs profils ?",
        "Quels sont les stacks à l’entame de la table finale ?",
        "Qui est le grand favori en jetons ?",
        "Quels joueurs sont short stack mais combatifs ?",
        "Qui est le plus expérimenté à cette table ?",
        "Quels outsiders peuvent surprendre ?",
        "Quelle est l’ambiance autour de la table finale ?",
        "Quels coups marquent déjà cette dernière ligne droite ?",
        "Qui impressionne par son sang-froid dans ce moment décisif ?",
        "Quelle tension ressent-on dans la salle lors de cette table finale ?"
    ],
    "👑 Victoire": [
        "Qui a remporté le tournoi ?",
        "Raconte la main finale dans le détail.",
        "Quelles émotions a exprimées le vainqueur ?",
        "Quels sont les gains remportés ?",
        "Comment a réagi le public à la victoire ?",
        "Quels joueurs complètent le podium ?",
        "Quelle est la photo finale à retenir ?",
        "Quel est le parcours du vainqueur tout au long du tournoi ?",
        "Quels ont été les moments charnières de sa victoire ?",
        "Quel message final retenir de ce tournoi ?"
    ]
};

export const LiveCoverage = ({ tournament }: { tournament: Tournament }) => {
    const { state, dispatch } = useTournamentStore();
    const [newPostContent, setNewPostContent] = useState('');
    const [editingSuggestion, setEditingSuggestion] = useState<{ id: string; content: string } | null>(null);
    const [onDemandQuery, setOnDemandQuery] = useState('');
    
    const [openShareMenuId, setOpenShareMenuId] = useState<string | null>(null);
    const [copySuccessMessage, setCopySuccessMessage] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    // Local state for settings to avoid re-rendering on every character change
    const [localSettings, setLocalSettings] = useState(tournament.liveCoverageSettings);

    // This useEffect hook synchronizes the local state with the tournament prop from the global store.
    // It ensures that when the AI's generating status is updated by the agent, the UI reflects the change.
    useEffect(() => {
        setLocalSettings(tournament.liveCoverageSettings);
    }, [tournament.liveCoverageSettings]);

     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenShareMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [menuRef]);

    const handleSettingsSave = () => {
        dispatch({ type: 'UPDATE_TOURNAMENT', payload: { ...tournament, liveCoverageSettings: localSettings } });
        alert("Paramètres de l'IA sauvegardés.");
    };

    const handleCreatePost = (e: React.FormEvent) => {
        e.preventDefault();
        if (newPostContent.trim()) {
            dispatch({ type: 'ADD_LIVE_COVERAGE_POST', payload: { tournamentId: tournament.id, content: newPostContent, author: 'director' } });
            setNewPostContent('');
        }
    };

    const handleDeletePost = (postId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette publication ?")) {
            dispatch({ type: 'DELETE_LIVE_COVERAGE_POST', payload: { tournamentId: tournament.id, postId } });
        }
    };

    const handleSuggestionAction = (suggestionId: string, status: 'approved' | 'rejected', content?: string) => {
        dispatch({ type: 'UPDATE_AI_SUGGESTION_STATUS', payload: { tournamentId: tournament.id, suggestionId, status, updatedContent: content } });
        if (editingSuggestion?.id === suggestionId) {
            setEditingSuggestion(null);
        }
    };
    
    const handleOnDemandSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (onDemandQuery.trim() && !localSettings.isGenerating) {
            await requestOnDemandAnalysis(tournament, state.players, onDemandQuery, dispatch);
            setOnDemandQuery('');
        }
    };

    const handleToggleShareMenu = (postId: string) => {
        setOpenShareMenuId(prevId => (prevId === postId ? null : postId));
    };

    const handleQuickQuestionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedQuestion = e.target.value;
        if (selectedQuestion) {
            setOnDemandQuery(selectedQuestion);
            // Reset the select so the same question can be chosen again
            e.target.value = ""; 
        }
    };

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopySuccessMessage('Texte copié !');
            setTimeout(() => setCopySuccessMessage(''), 2000);
            setOpenShareMenuId(null);
        }, (err) => {
            console.error('Could not copy text: ', err);
            alert('Erreur lors de la copie du texte.');
            setOpenShareMenuId(null);
        });
    };

    const handleDownloadImage = (imageUrl: string) => {
        const link = document.createElement('a');
        link.href = imageUrl;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `live-coverage-${timestamp}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setOpenShareMenuId(null);
    };

    const pendingSuggestions = tournament.liveCoverageSuggestions.filter(s => s.status === 'pending');
    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="space-y-6">
             <Card>
                <CardHeader>Paramètres de l'Assistant IA</CardHeader>
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md">
                        <div>
                            <label htmlFor="autopilot-toggle" className="font-medium text-white">Autopilote IA</label>
                            <p className="text-sm text-gray-400">Si activé, l'IA publiera automatiquement les moments clés sans approbation.</p>
                        </div>
                        <label htmlFor="autopilot-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="autopilot-toggle" className="sr-only peer" 
                                checked={localSettings.autopilotEnabled} 
                                onChange={e => setLocalSettings(prev => ({...prev, autopilotEnabled: e.target.checked}))} />
                            <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                     <div>
                        <label htmlFor="system-instruction" className="block text-sm font-medium text-gray-300 mb-1">Instructions pour l'IA</label>
                         <textarea
                            id="system-instruction"
                            value={localSettings.systemInstruction}
                            onChange={(e) => setLocalSettings(prev => ({...prev, systemInstruction: e.target.value}))}
                            className={inputClasses}
                            rows={3}
                        />
                    </div>
                    <div className="flex justify-end">
                        <Button variant="primary" onClick={handleSettingsSave}>Sauvegarder les Paramètres</Button>
                    </div>
                </div>
            </Card>

            <Card>
                <CardHeader>Demandez à votre Co-pilote IA</CardHeader>
                <form onSubmit={handleOnDemandSubmit} className="space-y-4">
                    <select
                        onChange={handleQuickQuestionSelect}
                        className={`${inputClasses} mb-2`}
                        defaultValue=""
                    >
                        <option value="">-- Choisir une question rapide --</option>
                        {Object.entries(quickQuestions).map(([category, questions]) => (
                            <optgroup key={category} label={category}>
                                {questions.map((q, index) => (
                                    <option key={index} value={q}>{q}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                     <textarea
                        value={onDemandQuery}
                        onChange={(e) => setOnDemandQuery(e.target.value)}
                        placeholder="Ex: Fais un résumé du dernier niveau. Qui sont les 3 joueurs avec le plus petit tapis ? Combien de joueurs avant d'atteindre les places payées ?"
                        className={inputClasses}
                        rows={3}
                        disabled={localSettings.isGenerating}
                    />
                    <div className="flex justify-end">
                         <Button type="submit" variant="primary" disabled={localSettings.isGenerating}>
                            {localSettings.isGenerating ? <LoadingSpinner /> : 'Générer la Publication'}
                        </Button>
                    </div>
                </form>
            </Card>

            <Card>
                <CardHeader>Créer une nouvelle publication</CardHeader>
                <form onSubmit={handleCreatePost} className="space-y-4">
                    <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Racontez ce qui se passe..."
                        className={inputClasses}
                        rows={4}
                    />
                    <div className="flex justify-end">
                        <Button type="submit" variant="primary">Publier</Button>
                    </div>
                </form>
            </Card>

            {pendingSuggestions.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-6 h-6 text-yellow-400"/>
                            <span>Suggestions de l'IA ({pendingSuggestions.length})</span>
                        </div>
                    </CardHeader>
                    <div className="space-y-3">
                        {pendingSuggestions.map(sugg => (
                            <div key={sugg.id} className="bg-gray-700/50 p-3 rounded-lg">
                                {sugg.imageUrl && <img src={sugg.imageUrl} alt="Suggestion d'image IA" className="mb-3 rounded-md object-cover w-full h-48" />}
                                {editingSuggestion?.id === sugg.id ? (
                                    <textarea
                                        value={editingSuggestion.content}
                                        onChange={e => setEditingSuggestion({ ...editingSuggestion, content: e.target.value })}
                                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white"
                                        rows={3}
                                    />
                                ) : (
                                    <p className="text-gray-200 whitespace-pre-wrap">{sugg.content}</p>
                                )}
                                <div className="flex justify-end items-center gap-2 mt-2 pt-2 border-t border-gray-600/50">
                                    {editingSuggestion?.id === sugg.id ? (
                                        <>
                                            <Button variant="secondary" size="sm" onClick={() => setEditingSuggestion(null)}>Annuler</Button>
                                            <Button variant="primary" size="sm" onClick={() => handleSuggestionAction(sugg.id, 'approved', editingSuggestion.content)}>Approuver & Publier</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="secondary" size="sm" onClick={() => handleSuggestionAction(sugg.id, 'rejected')}>Rejeter</Button>
                                            <Button variant="secondary" size="sm" onClick={() => setEditingSuggestion({ id: sugg.id, content: sugg.content })}>Modifier</Button>
                                            <Button variant="primary" size="sm" onClick={() => handleSuggestionAction(sugg.id, 'approved')}>Approuver</Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {copySuccessMessage && (
                <div className="fixed bottom-4 right-4 bg-green-600 text-white py-2 px-4 rounded-lg shadow-lg z-50 transition-opacity duration-300">
                    {copySuccessMessage}
                </div>
            )}

            <Card>
                <CardHeader>Fil d'actualité</CardHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {tournament.liveCoveragePosts.map(post => (
                        <div key={post.id} className="bg-gray-700/50 p-4 rounded-lg relative">
                             <div className="absolute top-2 right-2 flex items-center gap-1">
                                <div className="relative">
                                     <Button variant="secondary" className="p-1 h-auto" onClick={(e) => { e.stopPropagation(); handleToggleShareMenu(post.id); }} title="Partager la publication">
                                        <ArrowUpTrayIcon className="w-4 h-4" />
                                    </Button>
                                    {openShareMenuId === post.id && (
                                        <div ref={menuRef} className="absolute right-0 mt-2 z-20 w-56 bg-gray-900 border border-gray-600 rounded-md shadow-lg py-1">
                                            <button onClick={() => handleCopyText(post.content)} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700">
                                                Copier le Texte
                                            </button>
                                            {post.imageUrl && (
                                                <button onClick={() => handleDownloadImage(post.imageUrl!)} className="flex items-center gap-3 w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700">
                                                    Télécharger l'Image
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <Button variant="danger" className="p-1 h-auto" onClick={() => handleDeletePost(post.id)}>
                                    <TrashIcon className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                                {post.author === 'ai' && <SparklesIcon className="w-4 h-4 text-yellow-500" />}
                                <span>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span>&bull;</span>
                                <span>Niveau {post.level}</span>
                            </div>
                            {post.imageUrl && <img src={post.imageUrl} alt="Image de publication" className="my-3 rounded-lg object-cover w-full h-64" />}
                            <p className="text-gray-100 whitespace-pre-wrap">{post.content}</p>
                        </div>
                    ))}
                     {tournament.liveCoveragePosts.length === 0 && (
                        <p className="text-center text-gray-500 py-8">Aucune publication pour le moment.</p>
                     )}
                </div>
            </Card>
        </div>
    );
};