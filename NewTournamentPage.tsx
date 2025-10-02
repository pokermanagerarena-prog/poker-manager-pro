import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTournamentStore, createDefaultDisplaySettings } from './store';
import { Tournament, TournamentStatus, Level, TournamentType, Flight, FlightStatus, TournamentPhase, DisplaySettings, Commission, TournamentTemplate } from './types';
import { Card, Button, TrashIcon, PlusIcon, Modal, CardHeader, ArrowDownTrayIcon, ArrowUpTrayIcon } from './components';

const DEFAULT_LEVELS_DAY1: Level[] = [
  { level: 1, smallBlind: 100, bigBlind: 200, ante: 0, duration: 20, isBreak: false, phase: 'DAY1' },
  { level: 2, smallBlind: 200, bigBlind: 400, ante: 0, duration: 20, isBreak: false, phase: 'DAY1' },
  { level: 3, smallBlind: 300, bigBlind: 600, ante: 50, duration: 20, isBreak: false, phase: 'DAY1' },
];
const DEFAULT_LEVELS_DAY2: Level[] = [
  { level: 4, smallBlind: 500, bigBlind: 1000, ante: 100, duration: 45, isBreak: false, phase: 'DAY2' },
  { level: 5, smallBlind: 800, bigBlind: 1600, ante: 200, duration: 45, isBreak: false, phase: 'DAY2' },
];
const DEFAULT_LEVELS_FINAL: Level[] = [
    { level: 6, smallBlind: 1000, bigBlind: 2000, ante: 300, duration: 60, isBreak: false, phase: 'FINAL' },
];

const CommissionEditor = ({ commissions, setCommissions, title }: { commissions: Commission[], setCommissions: (commissions: Commission[]) => void, title: string }) => {
    const handleCommissionChange = (index: number, field: 'name' | 'amount', value: string) => {
        const newCommissions = [...commissions];
        const commission = { ...newCommissions[index] };
        if (field === 'amount') {
            commission.amount = parseInt(value, 10) || 0;
        } else {
            commission.name = value;
        }
        newCommissions[index] = commission;
        setCommissions(newCommissions);
    };

    const addCommission = () => {
        setCommissions([...commissions, { id: `c${Date.now()}`, name: '', amount: 0 }]);
    };

    const removeCommission = (index: number) => {
        setCommissions(commissions.filter((_, i) => i !== index));
    };
    
    const inputClasses = "w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";
    
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {commissions.map((commission, index) => (
                <div key={commission.id} className="flex items-center gap-2">
                    <input type="text" placeholder="Nom (ex: Frais de salle)" value={commission.name} onChange={e => handleCommissionChange(index, 'name', e.target.value)} className={inputClasses} required/>
                    <input type="number" placeholder="Montant (MAD)" value={commission.amount} onChange={e => handleCommissionChange(index, 'amount', e.target.value)} className={`${inputClasses} w-32`} required/>
                    <Button type="button" variant="danger" onClick={() => removeCommission(index)} className="h-10"><TrashIcon className="w-5 h-5"/></Button>
                </div>
            ))}
             <Button type="button" variant="secondary" onClick={addCommission} className="flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Ajouter une commission</Button>
        </div>
    );
};

const ManageTemplatesModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
    const { state, dispatch } = useTournamentStore();

    const handleDelete = (templateId: string, name: string) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le modèle "${name}" ?`)) {
            dispatch({ type: 'DELETE_TOURNAMENT_TEMPLATE', payload: { templateId } });
        }
    };

    const handleExportTemplate = (template: TournamentTemplate) => {
        const dataStr = JSON.stringify(template, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `template_${safeName}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Gérer les Modèles de Tournoi</CardHeader>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {state.tournamentTemplates.length === 0 && <p className="text-gray-400">Aucun modèle sauvegardé.</p>}
                {state.tournamentTemplates.map(template => (
                    <div key={template.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                        <p className="font-semibold text-white">{template.name}</p>
                        <div className="flex gap-2">
                             <Button variant="secondary" className="p-2" onClick={() => handleExportTemplate(template)} title="Exporter le modèle"><ArrowDownTrayIcon className="w-4 h-4"/></Button>
                            <Button variant="danger" className="p-2" onClick={() => handleDelete(template.id, template.name)} title="Supprimer le modèle"><TrashIcon className="w-4 h-4"/></Button>
                        </div>
                    </div>
                ))}
            </div>
             <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    )
}

const NewTournamentPage = () => {
    const { state, dispatch } = useTournamentStore();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [tournamentType, setTournamentType] = useState<TournamentType>(TournamentType.STANDARD);
    const [flights, setFlights] = useState<Partial<Flight>[]>([
        { name: 'Day 1A', startDate: new Date().toISOString().split('T')[0] }
    ]);
    const [blindTemplateId, setBlindTemplateId] = useState<string>('default');
    
    const [buyinCommissions, setBuyinCommissions] = useState<Commission[]>([{ id: `bc${Date.now()}`, name: 'Rake', amount: 10 }]);
    const [addonCommissions, setAddonCommissions] = useState<Commission[]>([{ id: `ac${Date.now()}`, name: 'Rake', amount: 5 }]);
    
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        startDate: new Date().toISOString().split('T')[0],
        buyin: '100',
        startingStack: '20000',
        rebuysAllowed: true,
        addonCost: '50',
        addonChips: '10000',
        dealerBonusCost: '10',
        dealerBonusChips: '5000',
        flightQualificationPercentage: '20',
    });
    const [startTime, setStartTime] = useState('');
    const [isManageTemplatesModalOpen, setManageTemplatesModalOpen] = useState(false);

    const handleLoadTemplate = (templateId: string) => {
        if (!templateId) return;

        const template = state.tournamentTemplates.find(t => t.id === templateId);
        if (template) {
            setTournamentType(template.tournamentType);
            setFormData(prev => ({
                ...prev,
                name: '', // Reset name, location, and date
                location: '',
                startDate: new Date().toISOString().split('T')[0],
                buyin: template.buyin,
                startingStack: template.startingStack,
                rebuysAllowed: template.rebuysAllowed,
                addonCost: template.addonCost,
                addonChips: template.addonChips,
                dealerBonusCost: template.dealerBonusCost,
                dealerBonusChips: template.dealerBonusChips,
                flightQualificationPercentage: template.flightQualificationPercentage,
            }));
            setBuyinCommissions(JSON.parse(JSON.stringify(template.buyinCommissions)));
            setAddonCommissions(JSON.parse(JSON.stringify(template.addonCommissions)));
            setBlindTemplateId(template.blindTemplateId);
            if (template.tournamentType === TournamentType.MULTI_FLIGHT) {
                setFlights([{ name: 'Day 1A', startDate: new Date().toISOString().split('T')[0] }]);
            }
        }
    };
    
    const handleSaveAsTemplate = () => {
        const name = window.prompt("Entrez un nom pour ce modèle de tournoi :");
        if (name && name.trim()) {
            const newTemplate: TournamentTemplate = {
                id: `tt-${Date.now()}`,
                name: name.trim(),
                tournamentType,
                buyin: formData.buyin,
                startingStack: formData.startingStack,
                rebuysAllowed: formData.rebuysAllowed,
                addonCost: formData.addonCost,
                addonChips: formData.addonChips,
                dealerBonusCost: formData.dealerBonusCost,
                dealerBonusChips: formData.dealerBonusChips,
                flightQualificationPercentage: formData.flightQualificationPercentage,
                buyinCommissions,
                addonCommissions,
                blindTemplateId
            };
            dispatch({ type: 'SAVE_TOURNAMENT_TEMPLATE', payload: newTemplate });
            alert(`Modèle "${name.trim()}" sauvegardé !`);
        }
    };
    
    const handleImportTemplateFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const importedTemplate = JSON.parse(text) as TournamentTemplate;

                // Basic validation
                if (!importedTemplate.name || !importedTemplate.buyin || !importedTemplate.blindTemplateId) {
                    throw new Error("Fichier de modèle invalide ou corrompu.");
                }

                const newName = window.prompt(`Modèle "${importedTemplate.name}" importé. Entrez un nom pour le sauvegarder dans l'application :`, importedTemplate.name);

                if (newName && newName.trim()) {
                    const newTemplate: TournamentTemplate = {
                        ...importedTemplate,
                        id: `tt-${Date.now()}`, // Assign a new unique ID
                        name: newName.trim(),
                    };
                    dispatch({ type: 'SAVE_TOURNAMENT_TEMPLATE', payload: newTemplate });
                    alert(`Modèle "${newName.trim()}" importé et sauvegardé avec succès !`);
                }
            } catch (error) {
                console.error("Erreur lors de l'importation du modèle :", error);
                alert("Erreur lors de la lecture du fichier. Assurez-vous que le format JSON est valide.");
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = ""; 
                }
            }
        };
        reader.readAsText(file);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };
    
    const handleFlightChange = (index: number, field: keyof Flight, value: string) => {
        const newFlights = [...flights];
        newFlights[index] = {...newFlights[index], [field]: value };
        setFlights(newFlights);
    }

    const addFlight = () => {
        const lastFlightNum = flights.length > 0 ? flights[flights.length - 1]?.name?.match(/\d+(\w)$/)?.[1] : 'A';
        const nextLetter = String.fromCharCode((lastFlightNum || '@').charCodeAt(0) + 1);
        setFlights([...flights, { name: `Day 1${nextLetter}`, startDate: new Date().toISOString().split('T')[0] }]);
    }
    
    const removeFlight = (index: number) => {
        if (flights.length > 1) {
            setFlights(flights.filter((_, i) => i !== index));
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const isMultiFlight = tournamentType === TournamentType.MULTI_FLIGHT;
        
        let levels: Level[];
        if (blindTemplateId === 'default') {
             levels = isMultiFlight 
                ? [...DEFAULT_LEVELS_DAY1, ...DEFAULT_LEVELS_DAY2, ...DEFAULT_LEVELS_FINAL]
                : [...DEFAULT_LEVELS_DAY1];
        } else {
            const template = state.blindStructureTemplates.find(t => t.id === blindTemplateId);
            levels = template ? JSON.parse(JSON.stringify(template.levels)) : [...DEFAULT_LEVELS_DAY1];
        }

        const initialClockTime = levels.length > 0 ? levels[0].duration * 60 : 0;
        
        const scheduledStartTime = tournamentType === TournamentType.STANDARD && formData.startDate && startTime
            ? new Date(`${formData.startDate}T${startTime}`).toISOString()
            : null;

        const finalFlights: Flight[] = (isMultiFlight ? flights : [{ name: 'Main Event', startDate: scheduledStartTime || formData.startDate }]).map((f, i) => ({
            id: `f${Date.now()}${i}`,
            name: f.name || `Day 1${i+1}`,
            startDate: new Date(f.startDate || Date.now()).toISOString(),
            status: FlightStatus.SCHEDULED,
            currentLevel: 1,
            clockTimeRemaining: initialClockTime,
            lastClockStartTime: null,
            lateRegistrationClosed: false,
        }));

        const tournamentName = formData.name || 'Unnamed Tournament';
            
        const newTournament: Tournament = {
            id: `t${Date.now()}`,
            name: tournamentName,
            location: formData.location || 'Online',
            status: TournamentStatus.SCHEDULED,
            startDate: finalFlights[0].startDate,
            scheduledStartTime,
            buyin: parseInt(formData.buyin, 10) || 0,
            buyinCommissions: buyinCommissions.filter(c => c.name && c.amount > 0),
            startingStack: parseInt(formData.startingStack, 10) || 10000,
            rebuysAllowed: formData.rebuysAllowed,
            addonCost: parseInt(formData.addonCost, 10) || 0,
            addonCommissions: addonCommissions.filter(c => c.name && c.amount > 0),
            addonChips: parseInt(formData.addonChips, 10) || 0,
            dealerBonusCost: parseInt(formData.dealerBonusCost, 10) || 0,
            dealerBonusChips: parseInt(formData.dealerBonusChips, 10) || 0,
            entries: [],
            levels: levels,
            tables: [],
            dealerShifts: [],
            dealerSchedule: null,
            currentLevel: 1, // Global clock now acts as fallback/Day 2 clock
            clockTimeRemaining: initialClockTime,
            lastClockStartTime: null,
            blockedSeats: [],
            payoutSettings: { mode: 'auto', manualPayouts: [] },
            displaySettings: createDefaultDisplaySettings(tournamentName),
            announcements: [],
            transactions: [],
            displayAlert: null,
            isArchived: false,
            liveCoveragePosts: [],
            liveCoverageSuggestions: [],
            liveCoverageSettings: {
                autopilotEnabled: false,
                systemInstruction: `Vous êtes un journaliste expert en poker, rédigeant des publications pour un reportage en direct. Votre style est professionnel, précis et captivant.

**TON & STYLE :**
Adaptez votre ton à la phase du tournoi :
-   **Début :** Accueillant et informatif.
-   **Milieu :** Analytique, mettant en avant les dynamiques intéressantes.
-   **Bulle & TF :** Tendu, dramatique, cinématographique.
-   **Fin :** Héroïque et solennel.

**DIRECTIVES CLÉS :**
1.  **Précision Factuelle :** Basez-vous STRICTEMENT sur les faits fournis (noms des joueurs, tapis, cartes, etc.). N'inventez JAMAIS de détails sur une main qui ne sont pas fournis.
2.  **Enrichissement Contextuel :** Si des informations sur un joueur sont fournies (style de jeu, palmarès, anecdotes), vous DEVEZ les intégrer pour enrichir le récit et le rendre plus personnel.
3.  **Storytelling :** Racontez une histoire. Une élimination n'est pas juste une main, c'est la fin d'un parcours. Un changement de chip leader est un tournant.
4.  **Clarté :** Utilisez un vocabulaire poker précis mais accessible. Expliquez les situations complexes si nécessaire.

**CONTRAINTES (À RESPECTER IMPÉRATIVEMENT) :**
-   **NE PAS** utiliser de clichés éculés comme 'tapis-payé', 'il a trouvé son bonheur', 'la rivière magique'.
-   **NE PAS** répéter la même phrase d'introduction pour plusieurs publications. Variez vos accroches.
-   **NE PAS** inventer les émotions ou les pensées des joueurs. Décrivez l'action, pas la psychologie.
-   **NE PAS** déterminer le gagnant d'une main. Les informations fournies vous indiquent déjà qui a gagné. Votre rôle est de raconter COMMENT et pourquoi c'est important.`,
                isGenerating: false,
            },
            aiKnowledgeBase: {
                sponsors: '',
                lastMinuteInfo: '',
                buffetMenu: '',
                anecdotes: '',
            },
            lateRegistrationClosed: false,
            
            // --- Multi-Flight Specific ---
            type: tournamentType,
            phase: isMultiFlight ? TournamentPhase.FLIGHTS : TournamentPhase.DAY2,
            flights: finalFlights,
            mergePolicy: isMultiFlight ? 'best_stack_per_player' : undefined,
            day2Settings: isMultiFlight ? {
                qualifiedPlayerCount: 'all' as const,
                flightQualificationPercentage: parseInt(formData.flightQualificationPercentage, 10)
            } : undefined,
            preMergeStateSnapshot: null,
            preDay2DrawStateSnapshot: null,
        };

        dispatch({ type: 'ADD_TOURNAMENT', payload: newTournament });
        navigate(`/t/${newTournament.id}`);
    };

    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
             <ManageTemplatesModal 
                isOpen={isManageTemplatesModalOpen}
                onClose={() => setManageTemplatesModalOpen(false)}
            />
            <input type="file" ref={fileInputRef} onChange={handleImportTemplateFile} style={{ display: 'none' }} accept=".json" />
            <header className="mb-8">
                <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; All Tournaments</Link>
                <h1 className="text-4xl font-bold text-white">Create New Tournament</h1>
            </header>
            <Card>
                <form onSubmit={handleSubmit} className="space-y-6">
                     <div className="bg-gray-700/50 p-4 rounded-lg mb-2 flex flex-wrap items-center gap-4">
                        <label htmlFor="template-loader" className={`${labelClasses} mb-0 flex-shrink-0`}>Charger un modèle :</label>
                        <select
                            id="template-loader"
                            onChange={(e) => {
                                handleLoadTemplate(e.target.value);
                                e.target.value = ""; // Reset dropdown after selection
                            }}
                            className={`${inputClasses} flex-grow`}
                            value=""
                        >
                            <option value="">-- Sélectionner un modèle --</option>
                            {state.tournamentTemplates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2"><ArrowUpTrayIcon className="w-5 h-5"/> Importer un Modèle</Button>
                        <Button type="button" variant="secondary" onClick={() => setManageTemplatesModalOpen(true)}>Gérer les modèles</Button>
                    </div>

                    {/* Tournament Type */}
                    <div>
                        <label className={labelClasses}>Tournament Type</label>
                        <div className="flex gap-2 rounded-lg bg-gray-700 p-1">
                            <Button type="button" onClick={() => setTournamentType(TournamentType.STANDARD)} className={`w-full ${tournamentType === TournamentType.STANDARD ? 'bg-blue-600' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}>Standard</Button>
                            <Button type="button" onClick={() => setTournamentType(TournamentType.MULTI_FLIGHT)} className={`w-full ${tournamentType === TournamentType.MULTI_FLIGHT ? 'bg-blue-600' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}>Multi-Flight</Button>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="name" className={labelClasses}>Tournament Name</label>
                        <input type="text" name="name" id="name" value={formData.name} required placeholder="e.g., Weekly Deepstack" className={inputClasses} onChange={handleChange}/>
                    </div>
                    <div>
                        <label htmlFor="location" className={labelClasses}>Location</label>
                        <input type="text" name="location" id="location" value={formData.location} onChange={handleChange} placeholder="e.g., The Card Room" className={inputClasses} />
                    </div>

                    {/* Flights for Multi-Flight */}
                    {tournamentType === TournamentType.MULTI_FLIGHT && (
                        <div className="space-y-4 border-t border-b border-gray-600 py-6">
                            <h3 className="text-lg font-semibold text-white">Flight Management (Day 1s)</h3>
                            {flights.map((flight, index) => (
                                <div key={index} className="flex items-end gap-4">
                                    <div className="flex-grow">
                                        <label htmlFor={`flight-name-${index}`} className={labelClasses}>Flight Name</label>
                                        <input type="text" id={`flight-name-${index}`} value={flight.name || ''} onChange={(e) => handleFlightChange(index, 'name', e.target.value)} required className={inputClasses} />
                                    </div>
                                    <div className="flex-grow">
                                        <label htmlFor={`flight-date-${index}`} className={labelClasses}>Start Date</label>
                                        <input type="date" id={`flight-date-${index}`} value={flight.startDate || ''} onChange={(e) => handleFlightChange(index, 'startDate', e.target.value)} required className={`${inputClasses} [color-scheme:dark]`} />
                                    </div>
                                    <Button type="button" variant="danger" onClick={() => removeFlight(index)} disabled={flights.length <= 1} className="h-10">
                                        <TrashIcon className="w-5 h-5"/>
                                    </Button>
                                </div>
                            ))}
                            <Button type="button" variant="secondary" onClick={addFlight}>Add Another Flight</Button>

                            <div className="pt-4">
                                <label htmlFor="flightQualificationPercentage" className={labelClasses}>Flight End Condition (%)</label>
                                <input type="number" name="flightQualificationPercentage" id="flightQualificationPercentage" value={formData.flightQualificationPercentage} onChange={handleChange} min="1" max="100" required className={inputClasses} />
                                <p className="text-xs text-gray-400 mt-1">A flight can be marked as complete when this percentage of its starting players remain.</p>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label htmlFor="blindTemplate" className={labelClasses}>Blind Structure</label>
                        <select 
                            name="blindTemplate" 
                            id="blindTemplate"
                            value={blindTemplateId} 
                            onChange={e => setBlindTemplateId(e.target.value)}
                            className={inputClasses}
                        >
                            <option value="default">Default Structure</option>
                            {state.blindStructureTemplates.map(template => (
                                <option key={template.id} value={template.id}>{template.name} ({template.levels.length} levels)</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="buyin" className={labelClasses}>Part Prizepool (MAD)</label>
                            <input type="number" name="buyin" id="buyin" min="0" value={formData.buyin} onChange={handleChange} required className={inputClasses} />
                        </div>
                        <div>
                            <label htmlFor="startingStack" className={labelClasses}>Starting Stack</label>
                            <input type="number" name="startingStack" id="startingStack" min="0" step="100" value={formData.startingStack} onChange={handleChange} required className={inputClasses} />
                        </div>
                         {tournamentType === TournamentType.STANDARD && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2">
                                <div>
                                    <label htmlFor="startDate" className={labelClasses}>Start Date</label>
                                    <input type="date" name="startDate" id="startDate" value={formData.startDate} onChange={handleChange} required className={`${inputClasses} [color-scheme:dark]`} />
                                </div>
                                 <div>
                                    <label htmlFor="startTime" className={labelClasses}>Heure de Démarrage (auto)</label>
                                    <input type="time" name="startTime" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
                                </div>
                            </div>
                         )}
                    </div>
                    
                    <div className="border-t border-gray-600 pt-6 space-y-6">
                        <CommissionEditor commissions={buyinCommissions} setCommissions={setBuyinCommissions} title="Commissions sur Buy-in / Re-entry"/>
                    </div>


                    <div className="border-t border-gray-600 pt-6 space-y-6">
                       <div className="flex items-center">
                            <input type="checkbox" name="rebuysAllowed" id="rebuysAllowed" checked={formData.rebuysAllowed} onChange={handleChange} className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="rebuysAllowed" className="ml-3 block text-sm font-medium text-gray-200">Rebuys / Re-entries & Add-ons autorisés</label>
                        </div>
                        {formData.rebuysAllowed && (
                             <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="addonCost" className={labelClasses}>Part Prizepool Add-on (MAD)</label>
                                        <input type="number" name="addonCost" id="addonCost" min="0" value={formData.addonCost} onChange={handleChange} className={inputClasses} />
                                    </div>
                                    <div>
                                        <label htmlFor="addonChips" className={labelClasses}>Jetons Add-on</label>
                                        <input type="number" name="addonChips" id="addonChips" min="0" step="100" value={formData.addonChips} onChange={handleChange} className={inputClasses} />
                                    </div>
                                </div>
                                 <CommissionEditor commissions={addonCommissions} setCommissions={setAddonCommissions} title="Commissions sur Add-on"/>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-600 pt-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Bonus Croupier (Optionnel)</h3>
                        <p className="text-xs text-gray-400 mb-4">Permet aux joueurs d'acheter un bonus de jetons. Le coût de ce bonus n'est pas inclus dans le prizepool.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="dealerBonusCost" className={labelClasses}>Coût du Bonus (MAD)</label>
                                <input type="number" name="dealerBonusCost" id="dealerBonusCost" min="0" value={formData.dealerBonusCost} onChange={handleChange} className={inputClasses} />
                            </div>
                            <div>
                                <label htmlFor="dealerBonusChips" className={labelClasses}>Jetons du Bonus</label>
                                <input type="number" name="dealerBonusChips" id="dealerBonusChips" min="0" step="100" value={formData.dealerBonusChips} onChange={handleChange} className={inputClasses} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-between items-center space-x-4 border-t border-gray-700 pt-6">
                        <Button type="button" variant="secondary" onClick={handleSaveAsTemplate}>
                            Sauvegarder comme modèle
                        </Button>
                        <div className="flex space-x-4">
                            <Link to="/" className="px-6 py-2 rounded-md font-semibold text-sm bg-gray-600 text-gray-100 hover:bg-gray-700 transition-colors flex items-center">
                                Cancel
                            </Link>
                            <Button type="submit" variant="primary" className="px-6 py-2">
                                Create Tournament
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default NewTournamentPage;