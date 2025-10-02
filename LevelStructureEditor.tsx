import React, { useState, useEffect, useRef } from 'react';
import { useTournamentStore } from './store';
import { Card, CardHeader, Button, TrashIcon, PlusIcon, Modal, ArrowDownTrayIcon, ArrowUpTrayIcon } from './components';
import { TournamentStatus, Level, TournamentType, TournamentPhase } from './types';

type PhaseTab = 'DAY1' | 'DAY2' | 'FINAL';

// Add a temporary, unique ID to each level for stable keys in React's render.
// This is an internal type for the editor only.
interface EditableLevel extends Level {
    _internalId: string;
}


export const LevelStructureEditor = ({ tournamentId }: { tournamentId: string }) => {
    const { state, dispatch } = useTournamentStore();
    const tournament = state.tournaments.find(t => t.id === tournamentId);
    
    // Use the internal EditableLevel type for the local state
    const [levels, setLevels] = useState<EditableLevel[]>([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [activeTab, setActiveTab] = useState<PhaseTab>('DAY1');
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const htmlInputRef = useRef<HTMLInputElement>(null); // New ref for HTML import

    useEffect(() => {
        if (tournament && !hasChanges) {
            // When loading levels from the global state, assign a unique internal ID to each.
            // This ID is used for React's `key` prop to ensure component stability during edits.
            const initialLevels = tournament.levels.map((l, index) => ({
                ...l,
                _internalId: `level-${l.level}-${index}-${Math.random()}`
            }));
            setLevels(initialLevels);
        }
    }, [tournament, hasChanges]);


    if (!tournament) return null;

    const isEditable = tournament.status !== TournamentStatus.COMPLETED;
    const isMultiFlight = tournament.type === TournamentType.MULTI_FLIGHT;

    const handleLevelChange = (internalId: string, field: keyof Level, value: string | number | boolean) => {
        // Update state immutably: create a new array, and a new object for the modified level.
        const newLevels = levels.map(level => {
            if (level._internalId === internalId) {
                return { ...level, [field]: value };
            }
            return level;
        });
        setLevels(newLevels);
        setHasChanges(true);
    };

    const handleDeleteLevel = (internalId: string) => {
        const newLevels = levels
            .filter(l => l._internalId !== internalId)
            .map((level, i) => ({ ...level, level: i + 1 })); // Re-number levels after deletion
        setLevels(newLevels);
        setHasChanges(true);
    };

    const addLevel = (isBreak: boolean) => {
        const lastLevelInPhase = levels.filter(l => l.phase === activeTab).pop();
        const referenceLevel = lastLevelInPhase || levels[levels.length - 1]; // Fallback to last level overall

        const newLevelData = {
            smallBlind: isBreak ? 0 : (referenceLevel?.bigBlind || 100),
            bigBlind: isBreak ? 0 : (referenceLevel?.bigBlind || 100) * 2,
            ante: isBreak ? 0 : (referenceLevel?.ante || 0),
            duration: isBreak ? 10 : (referenceLevel?.duration || 20),
            isBreak: isBreak,
            phase: activeTab
        };
        
        // Create the new level with a unique internal ID
        const newEditableLevel: EditableLevel = {
            ...newLevelData,
            level: 0, // will be renumbered
            _internalId: `new-level-${Date.now()}`
        };

        const allLevels = [...levels];
        let insertionIndex = allLevels.length;

        // Find the index of the last level of the current phase to insert after it.
        const lastIndexOfPhase = allLevels.map(l => l.phase).lastIndexOf(activeTab);
        if (lastIndexOfPhase !== -1) {
            insertionIndex = lastIndexOfPhase + 1;
        } else {
            // If phase not found, find where the phase should start and insert there.
            const phaseOrder: PhaseTab[] = ['DAY1', 'DAY2', 'FINAL'];
            const currentPhaseOrderIndex = phaseOrder.indexOf(activeTab);
            
            if (currentPhaseOrderIndex > 0) {
                const prevPhase = phaseOrder[currentPhaseOrderIndex - 1];
                const lastIndexOfPrevPhase = allLevels.map(l => l.phase).lastIndexOf(prevPhase);
                if (lastIndexOfPrevPhase !== -1) {
                    insertionIndex = lastIndexOfPrevPhase + 1;
                } else { // prev phase also doesn't exist, check one more back
                     if (currentPhaseOrderIndex > 1) {
                        const prevPrevPhase = phaseOrder[currentPhaseOrderIndex - 2];
                        const lastIndexOfPrevPrevPhase = allLevels.map(l => l.phase).lastIndexOf(prevPrevPhase);
                         if (lastIndexOfPrevPrevPhase !== -1) {
                            insertionIndex = lastIndexOfPrevPrevPhase + 1;
                        }
                     }
                }
            } else {
                insertionIndex = 0;
            }
        }
        
        // If still not found (e.g., empty levels array), default to 0 for DAY1 or end for others.
        if (insertionIndex === allLevels.length && !levels.some(l => l.phase === activeTab)) {
            if (activeTab === 'DAY1') insertionIndex = 0;
        }

        allLevels.splice(insertionIndex, 0, newEditableLevel);
        
        const renumbered = allLevels.map((l, i) => ({ ...l, level: i + 1 }));
        setLevels(renumbered);
        setHasChanges(true);
    };

    const handleSaveChanges = () => {
        // Before dispatching, strip the temporary internal ID from each level object.
        const cleanedLevels = levels.map(({ _internalId, ...rest }) => rest);
        const reorderedLevels = cleanedLevels.map((l, i) => ({ ...l, level: i + 1 }));
        dispatch({
            type: 'UPDATE_LEVEL_STRUCTURE',
            payload: { tournamentId, newLevels: reorderedLevels }
        });
        setHasChanges(false);
    };

    const handleDiscardChanges = () => {
        // Setting hasChanges to false will trigger the useEffect to reload the original state from the store
        setHasChanges(false);
    };
    
    const handleSaveAsTemplate = () => {
        const name = window.prompt("Enter a name for this blind structure template:");
        if (name && name.trim()) {
            // Strip internal IDs before saving as a template
            const cleanedLevels = levels.map(({ _internalId, ...rest }) => rest);
            dispatch({ type: 'SAVE_BLIND_TEMPLATE', payload: { name, levels: cleanedLevels } });
            alert(`Template "${name}" saved!`);
        }
    };

    const handleExportCSV = () => {
        const header = "Level,Small Blind,Big Blind,Ante,Duration";
        let breakCount = 0;
        const rows = levels.map(level => {
            if (level.isBreak) {
                breakCount++;
                return `Break ${breakCount},,,,${level.duration}m`;
            }
            return `Round ${level.level},${level.smallBlind},${level.bigBlind},${level.ante},${level.duration}m`;
        });

        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const safeName = tournament.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", `blind_structure_${safeName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportClick = () => {
        csvInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split(/\r\n|\n/).filter(line => line.trim());
                if (lines.length < 2) throw new Error("CSV is empty or has no data rows.");
                
                const dataLines = lines.slice(1);
                const importedLevels: Partial<Level>[] = [];

                dataLines.forEach(line => {
                    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    const levelName = values[0] || '';
                    const isBreak = levelName.toLowerCase().includes('break');
                    
                    const newLevel: Partial<Level> = {
                        smallBlind: parseInt(values[1]?.replace(/,/g, '') || '0', 10),
                        bigBlind: parseInt(values[2]?.replace(/,/g, '') || '0', 10),
                        ante: parseInt(values[3]?.replace(/,/g, '') || '0', 10),
                        duration: parseInt((values[4] || '0').replace('m', ''), 10),
                        isBreak: isBreak,
                        phase: activeTab // Assign to current tab; user can adjust later
                    };
                    importedLevels.push(newLevel);
                });

                const finalLevels = importedLevels.map((l, i) => ({
                     ...l, 
                     level: i + 1,
                     _internalId: `imported-${i}-${Date.now()}`
                })) as EditableLevel[];

                if (window.confirm(`Found ${finalLevels.length} levels. Do you want to replace the current structure with the imported one?`)) {
                    setLevels(finalLevels);
                    setHasChanges(true);
                }
            } catch (error) {
                console.error("Error parsing CSV:", error);
                alert("Failed to parse CSV file. Please ensure it has the correct format: Level,Small Blind,Big Blind,Ante,Duration");
            } finally {
                if (csvInputRef.current) csvInputRef.current.value = "";
            }
        };
        reader.readAsText(file);
    };

    // New handler for HTML import
    const handleHtmlFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const htmlString = e.target?.result as string;
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlString, 'text/html');
                
                const roundsTable = doc.querySelector('.roundsTable');
                if (!roundsTable) throw new Error("Could not find '.roundsTable' in the HTML file.");

                const rows = Array.from(roundsTable.querySelectorAll('tr'));
                if (rows.length < 2) throw new Error("No data rows found in the table.");

                const dataRows = rows.slice(1); // Skip header row
                const importedLevels: Partial<Level>[] = [];

                dataRows.forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length < 5) return; // Skip invalid rows

                    const levelName = (cells[0].textContent || '').trim();
                    const isBreak = levelName.toLowerCase().includes('break');

                    const newLevel: Partial<Level> = {
                        smallBlind: parseInt((cells[1].textContent || '0').replace(/,/g, '').trim(), 10) || 0,
                        bigBlind: parseInt((cells[2].textContent || '0').replace(/,/g, '').trim(), 10) || 0,
                        ante: parseInt((cells[3].textContent || '0').replace(/,/g, '').trim(), 10) || 0,
                        duration: parseInt((cells[4].textContent || '0').replace('m', '').trim(), 10) || 0,
                        isBreak: isBreak,
                        phase: activeTab // Assign to current tab
                    };
                    importedLevels.push(newLevel);
                });
                
                const finalLevels = importedLevels.map((l, i) => ({
                     ...l, 
                     level: i + 1,
                     _internalId: `imported-html-${i}-${Date.now()}`
                })) as EditableLevel[];


                if (window.confirm(`Found ${finalLevels.length} levels in the HTML file. Do you want to replace the current structure?`)) {
                    setLevels(finalLevels);
                    setHasChanges(true);
                }

            } catch (error) {
                console.error("Error parsing HTML file:", error);
                alert("Failed to parse HTML file. Please ensure it's a valid export from The Tournament Director.");
            } finally {
                if (htmlInputRef.current) htmlInputRef.current.value = "";
            }
        };
        // The user's provided file had ISO-8859-1 encoding.
        reader.readAsText(file, 'ISO-8859-1');
    };

    const filteredLevels = isMultiFlight ? levels.filter(l => l.phase === activeTab) : levels;
    const inputClass = "bg-gray-700 w-full text-center p-1 rounded-md border border-transparent focus:bg-gray-600 focus:border-blue-500 disabled:bg-transparent disabled:text-gray-300";

    const TabButton = ({ tab, label }: { tab: PhaseTab, label: string }) => (
        <button onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
            {label}
        </button>
    );
    
    const LoadTemplateModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
        const templates = state.blindStructureTemplates;

        const handleLoad = (templateLevels: Level[]) => {
            if(window.confirm("Are you sure you want to replace the current structure? This action is irreversible.")) {
                 const initialLevels = templateLevels.map((l, index) => ({
                    ...l,
                    _internalId: `level-template-${l.level}-${index}-${Math.random()}`
                }));
                setLevels(initialLevels);
                setHasChanges(true);
                onClose();
            }
        };

        const handleDelete = (templateId: string, templateName: string) => {
            if(window.confirm(`Are you sure you want to delete the template "${templateName}"?`)) {
                dispatch({ type: 'DELETE_BLIND_TEMPLATE', payload: { templateId } });
            }
        };

        return (
            <Modal isOpen={isOpen} onClose={onClose}>
                <CardHeader>Load a Blind Structure Template</CardHeader>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                    {templates.length === 0 && <p className="text-gray-400">No saved templates found.</p>}
                    {templates.map(template => (
                        <div key={template.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                            <div>
                                <p className="font-semibold text-white">{template.name}</p>
                                <p className="text-xs text-gray-400">{template.levels.length} levels</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => handleLoad(template.levels)}>Load</Button>
                                <Button variant="danger" className="p-2" onClick={() => handleDelete(template.id, template.name)}><TrashIcon className="w-4 h-4"/></Button>
                            </div>
                        </div>
                    ))}
                </div>
                 <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </div>
            </Modal>
        );
    };

    return (
        <Card>
            <input type="file" ref={csvInputRef} hidden onChange={handleFileSelected} accept=".csv" />
            <input type="file" ref={htmlInputRef} hidden onChange={handleHtmlFileSelected} accept=".html,.htm" />
            <LoadTemplateModal isOpen={isLoadModalOpen} onClose={() => setIsLoadModalOpen(false)} />
            <div className="flex justify-between items-start">
                <CardHeader>Level Structure</CardHeader>
                {isMultiFlight && (
                    <div className="bg-gray-900/50 p-1 rounded-lg flex space-x-1">
                        <TabButton tab="DAY1" label="Day 1 Flights" />
                        <TabButton tab="DAY2" label="Day 2" />
                        <TabButton tab="FINAL" label="Final" />
                    </div>
                )}
            </div>
            <div className="overflow-x-auto mt-4">
                <table className="w-full text-left">
                    <thead className="border-b border-gray-600 text-sm text-gray-400">
                        <tr>
                            <th className="p-2 text-center w-20">Level</th>
                            <th className="p-2 text-center">Small Blind</th>
                            <th className="p-2 text-center">Big Blind</th>
                            <th className="p-2 text-center">Ante</th>
                            <th className="p-2 text-center w-24">Duration</th>
                            <th className="p-2 text-center w-24">Break?</th>
                            {isEditable && <th className="p-2 w-16"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLevels.map((level) => (
                            <tr key={level._internalId} className={`border-b border-gray-700/50 ${level.isBreak ? 'bg-blue-500/10' : ''}`}>
                                <td className="p-2 text-center font-bold">{level.level}</td>
                                <td className="p-1"><input type="number" value={level.smallBlind} disabled={!isEditable || level.isBreak} onChange={(e) => handleLevelChange(level._internalId, 'smallBlind', parseInt(e.target.value, 10) || 0)} className={inputClass} /></td>
                                <td className="p-1"><input type="number" value={level.bigBlind} disabled={!isEditable || level.isBreak} onChange={(e) => handleLevelChange(level._internalId, 'bigBlind', parseInt(e.target.value, 10) || 0)} className={inputClass} /></td>
                                <td className="p-1"><input type="number" value={level.ante} disabled={!isEditable || level.isBreak} onChange={(e) => handleLevelChange(level._internalId, 'ante', parseInt(e.target.value, 10) || 0)} className={inputClass} /></td>
                                <td className="p-1"><input type="number" value={level.duration} disabled={!isEditable} onChange={(e) => handleLevelChange(level._internalId, 'duration', parseInt(e.target.value, 10) || 0)} className={`${inputClass} text-center`} /></td>
                                <td className="p-1 text-center">
                                    <input type="checkbox" checked={level.isBreak} disabled={!isEditable} onChange={(e) => handleLevelChange(level._internalId, 'isBreak', e.target.checked)} className="h-5 w-5 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500" />
                                </td>
                                {isEditable && (
                                    <td className="p-2 text-center">
                                        <button onClick={() => handleDeleteLevel(level._internalId)} className="text-gray-400 hover:text-red-500" aria-label="Delete level">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isEditable && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-600">
                    <div className="flex flex-wrap gap-4">
                        <Button variant="secondary" onClick={() => addLevel(false)} className="flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Add Level</Button>
                        <Button variant="secondary" onClick={() => addLevel(true)} className="flex items-center gap-2"><PlusIcon className="w-5 h-5"/> Add Break</Button>
                        <Button variant="secondary" onClick={() => setIsLoadModalOpen(true)}>Load Template</Button>
                        <Button variant="secondary" onClick={handleSaveAsTemplate}>Save as Template</Button>
                        <Button variant="secondary" onClick={handleImportClick} className="flex items-center gap-2"><ArrowUpTrayIcon className="w-5 h-5"/> Importer CSV</Button>
                        <Button variant="secondary" onClick={() => htmlInputRef.current?.click()} className="flex items-center gap-2"><ArrowUpTrayIcon className="w-5 h-5"/> Importer HTML (TD)</Button>
                        <Button variant="secondary" onClick={handleExportCSV} className="flex items-center gap-2"><ArrowDownTrayIcon className="w-5 h-5"/> Exporter CSV</Button>
                    </div>
                    {hasChanges && (
                        <div className="flex gap-4">
                            <Button variant="secondary" onClick={handleDiscardChanges}>Discard Changes</Button>
                            <Button variant="primary" onClick={handleSaveChanges}>Save Changes</Button>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};