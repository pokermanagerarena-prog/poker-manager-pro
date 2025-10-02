import React, { useRef } from 'react';
import { Card, CardHeader, Button, ArrowDownTrayIcon, ArrowUpTrayIcon } from './components';
import { useTournamentStore } from './store';
import { AppState } from './types';

const ImportExportPage = () => {
    const { state, dispatch } = useTournamentStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleExport = () => {
        // Create a copy of the state, removing non-serializable/transient parts
        const stateToExport: Partial<AppState> = { ...state };
        delete stateToExport.entryToPrint;
        delete stateToExport.tableToPrint;
        delete stateToExport.playerListToPrint;
        delete stateToExport.seatDrawToPrint;
        delete stateToExport.payoutToPrint;
        delete stateToExport.financeReportToPrint;
        delete stateToExport.moveSlipsToPrint;

        const dataStr = JSON.stringify(stateToExport, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `poker_manager_backup_${timestamp}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const importedState = JSON.parse(text) as AppState;
                
                if (typeof importedState.version === 'undefined' || !Array.isArray(importedState.tournaments)) {
                    throw new Error("Invalid backup file format.");
                }
                
                if (window.confirm("ATTENTION ! L'importation d'un fichier de sauvegarde remplacera TOUTES les données actuelles de l'application. Cette action est irréversible. Êtes-vous absolument sûr de vouloir continuer ?")) {
                    dispatch({ type: 'REPLACE_STATE', payload: importedState });
                    alert("Les données ont été restaurées avec succès ! L'application va se recharger.");
                    window.location.reload();
                }
            } catch (error) {
                console.error("Error processing backup file:", error);
                alert("Erreur lors du traitement du fichier de sauvegarde. Assurez-vous qu'il est valide.");
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = ""; 
                }
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-6">Importer / Exporter les Données</h1>
            
            <Card className="mb-6">
                <CardHeader>Exporter les Données</CardHeader>
                <p className="text-gray-400 mb-4">
                    Sauvegardez l'intégralité des données de l'application (tournois, joueurs, modèles, etc.) dans un seul fichier JSON. Conservez ce fichier en lieu sûr.
                </p>
                <Button onClick={handleExport} className="w-full flex items-center justify-center gap-2">
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Télécharger le Fichier de Sauvegarde
                </Button>
            </Card>

            <Card className="border-red-500/50">
                <CardHeader className="text-red-400">Importer les Données</CardHeader>
                 <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg mb-4">
                    <h4 className="font-bold text-red-400">AVERTISSEMENT</h4>
                    <p className="text-red-300 text-sm">
                        L'importation d'un fichier écrasera et remplacera <strong className="font-bold">toutes les données existantes</strong> dans l'application. Utilisez cette fonction uniquement pour restaurer une sauvegarde précédente.
                    </p>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
                <Button onClick={handleImportClick} variant="danger" className="w-full flex items-center justify-center gap-2">
                    <ArrowUpTrayIcon className="w-5 h-5" />
                    Importer un Fichier de Sauvegarde
                </Button>
            </Card>
        </div>
    );
};

export default ImportExportPage;