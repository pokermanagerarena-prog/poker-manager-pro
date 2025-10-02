import React, { useState, useEffect, useRef } from 'react';
import { useTournamentStore, templates } from './store';
import { Tournament, DisplaySettings, WidgetConfig, WidgetType, Sponsor, TickerSettings, DisplayTemplate } from './types';
import { Card, CardHeader, Button, Modal, PencilIcon, EyeIcon, EyeSlashIcon, TrashIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from './components';

const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";
const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
const smallInputClasses = "w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-white focus:ring-blue-500 focus:border-blue-500 text-sm";

const TemplateSelectionModal = ({ isOpen, onClose, onSelectTemplate, customTemplates, onDeleteTemplate }: { isOpen: boolean, onClose: () => void, onSelectTemplate: (template: string | DisplayTemplate) => void, customTemplates: DisplayTemplate[], onDeleteTemplate: (templateId: string) => void }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Choisir un Modèle de Présentation</CardHeader>
            <p className="text-gray-400 mb-6">Chaque modèle propose une mise en page différente. Vous pourrez ensuite personnaliser les couleurs, le fond et le contenu de chaque bloc.</p>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Modèles Prédéfinis</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(templates).map(([key, t]) => (
                            <div key={key} onClick={() => onSelectTemplate(key)} className="bg-gray-700/50 p-4 rounded-lg border-2 border-gray-600 hover:border-blue-500 cursor-pointer transition-all">
                                <h3 className="font-bold text-lg text-white">{t.name}</h3>
                                <p className="text-sm text-gray-300 mt-1">{t.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {customTemplates.length > 0 && (
                     <div>
                        <h3 className="text-lg font-semibold text-white mt-6 pt-4 border-t border-gray-600 mb-2">Vos Modèles</h3>
                        <div className="space-y-3">
                            {customTemplates.map(template => (
                                <div key={template.id} className="bg-gray-700/50 p-3 rounded-lg border-2 border-gray-600 hover:border-blue-500 transition-all flex justify-between items-center">
                                    <div onClick={() => onSelectTemplate(template)} className="cursor-pointer flex-grow pr-4">
                                        <h4 className="font-bold text-white">{template.name}</h4>
                                        <p className="text-xs text-gray-300 mt-1">{template.settings.widgets.length} blocs configurés</p>
                                    </div>
                                    <Button variant="danger" className="p-2 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onDeleteTemplate(template.id); }}>
                                        <TrashIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

const WidgetEditModal = ({ widget, onSave, onClose }: { widget: WidgetConfig, onSave: (updatedWidget: WidgetConfig) => void, onClose: () => void }) => {
    const [config, setConfig] = useState(widget);

    useEffect(() => {
        setConfig(widget);
    }, [widget]);

    const handleChange = (field: keyof WidgetConfig, value: any) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleChange('imageUrl', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    return (
        <Modal isOpen={true} onClose={onClose}>
            <CardHeader>Modifier le Bloc : {widget.type}</CardHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                 {/* Widget-specific configuration */}
                <h4 className="text-sm font-semibold text-gray-300 border-b border-gray-600 pb-1">Paramètres Spécifiques</h4>
                {widget.type === WidgetType.TEXT && (
                    <div>
                        <label className={labelClasses}>Contenu</label>
                        <textarea value={config.content || ''} onChange={e => handleChange('content', e.target.value)} className={`${inputClasses} min-h-[80px]`} placeholder="Entrez du texte et des balises..."/>
                         <p className="text-xs text-gray-400 mt-1">Utilisez `\n` pour un saut de ligne.</p>
                    </div>
                )}
                {widget.type === WidgetType.IMAGE && (
                    <div>
                        <label className={labelClasses}>Image</label>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30" />
                        {config.imageUrl && <img src={config.imageUrl} className="mt-2 h-16 w-auto object-contain rounded bg-black/20"/>}
                    </div>
                )}
                {widget.type === WidgetType.STATS && (
                    <div className="space-y-2">
                        <div>
                            <label className={labelClasses}>Label</label>
                            <input type="text" placeholder="ex: Tapis Moyen" value={config.label || ''} onChange={e => handleChange('label', e.target.value)} className={inputClasses}/>
                        </div>
                        <div>
                            <label className={labelClasses}>Type de Statistique</label>
                            <select value={config.statType || 'players_remaining'} onChange={e => handleChange('statType', e.target.value as any)} className={inputClasses}>
                                <option value="players_remaining">Joueurs restants</option>
                                <option value="players_total">Joueurs total</option>
                                <option value="avg_stack">Tapis moyen</option>
                                <option value="avg_stack_bb">Tapis moyen (BB)</option>
                                <option value="prizepool">Prizepool</option>
                                <option value="chip_leader_name">Nom Chip Leader</option>
                                <option value="chip_leader_stack">Tapis Chip Leader</option>
                            </select>
                        </div>
                    </div>
                )}
                {widget.type === WidgetType.CHIP_LEADERS && (
                    <div>
                        <label className={labelClasses}>Nombre de leaders à afficher</label>
                        <input type="number" min="1" max="10" value={config.leaderCount || 5} onChange={e => handleChange('leaderCount', parseInt(e.target.value, 10))} className={inputClasses} />
                    </div>
                )}
                {widget.type === WidgetType.PAYOUTS && (
                    <div>
                        <label className={labelClasses}>Nombre de payouts à afficher</label>
                        <input type="number" min="1" max="20" value={config.payoutCount || 9} onChange={e => handleChange('payoutCount', parseInt(e.target.value, 10))} className={inputClasses} />
                    </div>
                )}

                {/* Common Style Properties */}
                {widget.type !== WidgetType.LOGO_PPMC && widget.type !== WidgetType.SPONSORS && widget.type !== WidgetType.IMAGE && (
                    <div className="pt-4 border-t border-gray-600">
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">Style du Widget</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-400">Taille Police</label>
                                <input type="text" placeholder="ex: 2rem" value={config.fontSize || ''} onChange={e => handleChange('fontSize', e.target.value)} className={smallInputClasses} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Graisse</label>
                                <select value={config.fontWeight || '400'} onChange={e => handleChange('fontWeight', e.target.value as any)} className={smallInputClasses}>
                                    <option value="300">Léger</option><option value="400">Normal</option><option value="500">Moyen</option><option value="600">Semi-gras</option><option value="700">Gras</option><option value="800">Extra-gras</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Couleur</label>
                                <input type="color" value={config.color || '#FFFFFF'} onChange={e => handleChange('color', e.target.value)} className="w-full h-8 p-0.5 bg-gray-900 border border-gray-600 rounded-md" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400">Align. Texte</label>
                                <select value={config.textAlign || 'center'} onChange={e => handleChange('textAlign', e.target.value as any)} className={smallInputClasses}>
                                    <option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={onClose}>Annuler</Button>
                <Button variant="primary" onClick={() => onSave(config)}>Sauvegarder</Button>
            </div>
        </Modal>
    );
}

const TickerConfigurator = ({ title, settings, onChange }: { title: string, settings: TickerSettings, onChange: (newSettings: TickerSettings) => void }) => {
    return (
        <Card>
            <CardHeader>{title}</CardHeader>
            <div className="space-y-4">
                <div className="flex items-center">
                    <input type="checkbox" id={`${title}-enabled`} checked={settings.enabled} onChange={e => onChange({ ...settings, enabled: e.target.checked })} className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500" />
                    <label htmlFor={`${title}-enabled`} className="ml-3 block text-sm font-medium text-gray-200">Activer le bandeau défilant</label>
                </div>
                {settings.enabled && <>
                    <div>
                        <label className={labelClasses}>Contenu</label>
                        <select value={settings.content} onChange={e => onChange({ ...settings, content: e.target.value as any })} className={inputClasses}>
                            <option value="players">Classement des joueurs</option>
                            <option value="payouts">Structure des payouts</option>
                            <option value="announcements">Annonces</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClasses}>Vitesse</label>
                        <select value={settings.speed} onChange={e => onChange({ ...settings, speed: e.target.value as any })} className={inputClasses}>
                            <option value="slow">Lente</option>
                            <option value="normal">Normale</option>
                            <option value="fast">Rapide</option>
                        </select>
                    </div>
                </>}
            </div>
        </Card>
    );
}


export const DisplayEditor = ({ tournament }: { tournament: Tournament }) => {
    const { state: globalState, dispatch } = useTournamentStore();
    const [settings, setSettings] = useState<DisplaySettings>(() => {
        const initial = JSON.parse(JSON.stringify(tournament.displaySettings));
        // Backward compatibility: migrate old 'ticker' to 'bottomTicker'
        if ((initial as any).ticker) {
            initial.bottomTicker = (initial as any).ticker;
            delete (initial as any).ticker;
        }
        if (!initial.topTicker) {
            initial.topTicker = { enabled: false, content: 'announcements', speed: 'normal' };
        }
         if (!initial.bottomTicker) {
            initial.bottomTicker = { enabled: true, content: 'payouts', speed: 'normal' };
        }
        return initial;
    });

    const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {
        dispatch({ type: 'UPDATE_DISPLAY_SETTINGS', payload: { tournamentId: tournament.id, settings } });
        alert('Paramètres de présentation sauvegardés !');
    };

    const handleSaveAsTemplate = () => {
        const name = window.prompt("Entrez un nom pour ce modèle de présentation :");
        if (name && name.trim()) {
            dispatch({ type: 'SAVE_DISPLAY_TEMPLATE', payload: { name: name.trim(), settings } });
            alert(`Modèle "${name.trim()}" sauvegardé !`);
        }
    };

    const handleExportTemplate = () => {
        const safeTournamentName = tournament.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const suggestedFilename = `template_${safeTournamentName}.json`;
        
        const filename = window.prompt("Entrez un nom pour le fichier d'exportation :", suggestedFilename);
        if (!filename) {
            return; // User cancelled
        }
        
        const dataStr = JSON.stringify(settings, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportTemplate = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const importedSettings = JSON.parse(text);

                if (!importedSettings.gridTemplateColumns || !importedSettings.cells || !importedSettings.widgets) {
                    throw new Error("Fichier de modèle invalide ou corrompu.");
                }

                const templateName = window.prompt("Entrez un nom pour ce nouveau modèle importé :");
                if (templateName && templateName.trim()) {
                    const newTemplateSettings: DisplaySettings = {
                        gridTemplateColumns: importedSettings.gridTemplateColumns,
                        gridTemplateRows: importedSettings.gridTemplateRows,
                        gap: importedSettings.gap || 16,
                        backgroundColor: importedSettings.backgroundColor || '#0D1117',
                        backgroundImage: importedSettings.backgroundImage || null,
                        cells: importedSettings.cells,
                        widgets: importedSettings.widgets,
                        sponsors: importedSettings.sponsors || [],
                        topTicker: importedSettings.topTicker || { enabled: false, content: 'announcements', speed: 'normal' },
                        bottomTicker: importedSettings.bottomTicker || { enabled: true, content: 'players', speed: 'normal' },
                    };

                    dispatch({ type: 'SAVE_DISPLAY_TEMPLATE', payload: { name: templateName.trim(), settings: newTemplateSettings } });
                    alert(`Modèle "${templateName.trim()}" importé et sauvegardé avec succès ! Vous pouvez maintenant le sélectionner via "Changer de Modèle".`);
                }
            } catch (error) {
                console.error("Erreur lors de l'importation du modèle :", error);
                alert("Erreur lors de la lecture du fichier. Assurez-vous que le format JSON est valide.");
            } finally {
                if (event.target) {
                    event.target.value = ""; 
                }
            }
        };
        reader.readAsText(file);
    };
    
    const handleSettingsChange = (field: keyof DisplaySettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleBackgroundImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleSettingsChange('backgroundImage', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleApplyTemplate = (templateOrKey: string | DisplayTemplate) => {
        if (typeof templateOrKey === 'string') {
            const template = templates[templateOrKey as keyof typeof templates];
            if (template) {
                if (window.confirm(`Êtes-vous sûr de vouloir appliquer le modèle "${template.name}" ? Cela remplacera votre mise en page actuelle.`)) {
                    const newSettings = template.generator(tournament.name);
                    setSettings(newSettings);
                }
            }
        } else {
            if (window.confirm(`Êtes-vous sûr de vouloir appliquer votre modèle "${templateOrKey.name}" ? Cela remplacera votre mise en page actuelle.`)) {
                const newSettings = JSON.parse(JSON.stringify(templateOrKey.settings));
                newSettings.widgets.forEach((widget: WidgetConfig) => {
                    if (widget.type === WidgetType.TEXT && widget.content?.includes('<tournoi_nom>')) {
                        widget.content = widget.content.replace(/<tournoi_nom>/g, tournament.name);
                    }
                });
                setSettings(newSettings);
            }
        }
        setTemplateModalOpen(false);
    };
    
    const handleWidgetUpdate = (updatedWidget: WidgetConfig) => {
        setSettings(prev => ({
            ...prev,
            widgets: prev.widgets.map(w => w.id === updatedWidget.id ? updatedWidget : w)
        }));
        setEditingWidget(null);
    };

    const handleToggleWidgetVisibility = (widgetId: string) => {
        setSettings(prev => ({
            ...prev,
            widgets: prev.widgets.map(w =>
                w.id === widgetId ? { ...w, isHidden: !w.isHidden } : w
            )
        }));
    };

    return (
        <div className="space-y-6">
            <input type="file" ref={fileInputRef} onChange={handleFileSelected} style={{ display: 'none' }} accept=".json" />
            <TemplateSelectionModal 
                isOpen={isTemplateModalOpen} 
                onClose={() => setTemplateModalOpen(false)} 
                onSelectTemplate={handleApplyTemplate}
                customTemplates={globalState.displayTemplates}
                onDeleteTemplate={(templateId) => {
                    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) {
                        dispatch({ type: 'DELETE_DISPLAY_TEMPLATE', payload: { templateId } });
                    }
                }}
            />
            {editingWidget && <WidgetEditModal widget={editingWidget} onSave={handleWidgetUpdate} onClose={() => setEditingWidget(null)} />}

            <Card>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <CardHeader className="mb-0">Modèle de Présentation</CardHeader>
                    <Button variant="secondary" onClick={() => setTemplateModalOpen(true)}>Changer de Modèle</Button>
                </div>
                 <p className="text-gray-400 mt-2 text-sm">
                    Aperçu de la structure actuelle. Utilisez le bouton ci-dessus pour choisir une nouvelle mise en page.
                </p>
                 <div
                    className="w-full aspect-video bg-gray-900/50 rounded-lg p-2 mt-4 relative border border-gray-700"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: settings.gridTemplateColumns,
                        gridTemplateRows: settings.gridTemplateRows,
                        gap: `${settings.gap}px`,
                    }}
                >
                    {settings.cells.map(cell => {
                        const widget = settings.widgets.find(w=>w.id === cell.widgetId);
                        return (
                            <div
                                key={cell.id}
                                className="bg-gray-700/50 border border-dashed border-gray-600/30 rounded-md flex items-center justify-center p-1"
                                style={{ gridColumn: cell.col, gridRow: cell.row }}
                            >
                                <span className="text-gray-500 text-center text-xs">{widget?.type || 'Vide'}{widget?.label ? `: ${widget.label}` : ''}</span>
                            </div>
                        )
                    })}
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>Paramètres Globaux</CardHeader>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClasses}>Couleur de fond</label>
                            <input
                                type="color"
                                value={settings.backgroundColor}
                                onChange={e => handleSettingsChange('backgroundColor', e.target.value)}
                                className="w-full h-10 p-1 bg-gray-700 border border-gray-600 rounded-md"
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Image de fond</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleBackgroundImageUpload}
                                className="text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-500/20 file:text-blue-300 hover:file:bg-blue-500/30"
                            />
                            {settings.backgroundImage && (
                                <div className="mt-2 flex items-center gap-4">
                                    <img src={settings.backgroundImage} alt="Aperçu fond" className="h-16 w-auto object-contain rounded bg-black/20" />
                                    <Button variant="danger" size="sm" onClick={() => handleSettingsChange('backgroundImage', null)}>
                                        Supprimer
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center pt-4 border-t border-gray-700">
                            <input
                                type="checkbox"
                                id="dynamic-bg-toggle"
                                checked={settings.dynamicBackgroundColorEnabled || false}
                                onChange={e => handleSettingsChange('dynamicBackgroundColorEnabled', e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 bg-gray-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="dynamic-bg-toggle" className="ml-3 block text-sm font-medium text-gray-200">
                                Activer les couleurs de fond dynamiques par niveau
                            </label>
                        </div>
                    </div>
                </Card>
                <div className="space-y-6">
                    <TickerConfigurator title="Bandeau Défilant (Haut)" settings={settings.topTicker} onChange={newTickerSettings => handleSettingsChange('topTicker', newTickerSettings)} />
                    <TickerConfigurator title="Bandeau Défilant (Bas)" settings={settings.bottomTicker} onChange={newTickerSettings => handleSettingsChange('bottomTicker', newTickerSettings)} />
                </div>
            </div>
            
             <Card>
                <CardHeader>Configuration des Blocs</CardHeader>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                    {settings.widgets.map(widget => (
                        <div key={widget.id} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-md">
                            <div>
                                <p className="font-semibold text-white">{widget.type}</p>
                                {widget.label && <p className="text-xs text-gray-400">{widget.label}</p>}
                                {widget.content && <p className="text-xs text-gray-400 truncate max-w-xs">{widget.content.replace(/\n/g, ' ')}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="p-2"
                                    onClick={() => handleToggleWidgetVisibility(widget.id)}
                                    title={widget.isHidden ? 'Afficher le bloc' : 'Cacher le bloc'}
                                >
                                    {widget.isHidden ? <EyeSlashIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                                </Button>
                                <Button variant="secondary" onClick={() => setEditingWidget(widget)} className="flex items-center gap-2">
                                    <PencilIcon className="w-4 h-4"/>
                                    Configurer
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="mt-6 flex flex-wrap gap-4 items-center">
                <Button variant="secondary" onClick={handleSaveAsTemplate}>
                    Sauvegarder comme modèle
                </Button>
                <Button variant="secondary" onClick={handleImportTemplate} className="flex items-center gap-2">
                    <ArrowUpTrayIcon className="w-5 h-5"/> Importer un modèle
                </Button>
                <Button variant="secondary" onClick={handleExportTemplate} className="flex items-center gap-2">
                    <ArrowDownTrayIcon className="w-5 h-5"/> Exporter ce modèle
                </Button>
                <Button variant="primary" className="flex-grow py-3" onClick={handleSave}>
                    Sauvegarder les Modifications de la Présentation
                </Button>
            </div>
        </div>
    );
};