import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTournamentStore } from './store';
import { Player } from './types';
import { Card, CardHeader, Button, Modal, TrashIcon, PencilIcon, PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, QrCodeIcon, BarcodeIcon, IdentificationIcon } from './components';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';


const PlayerIdModal = ({ player, onClose }: { player: Player, onClose: () => void }) => {
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const barcodeSvgRef = useRef<SVGSVGElement>(null);
    const [view, setView] = useState<'qr' | 'barcode'>('qr');

    useEffect(() => {
        const qrData = JSON.stringify({
            source: "PokerTournamentManagerPRO+",
            playerId: player.id
        });
        
        if (view === 'qr' && qrCanvasRef.current) {
            QRCode.toCanvas(qrCanvasRef.current, qrData, {
                width: 256,
                margin: 2,
                color: { dark: '#FFFFFF', light: '#00000000' } // White on transparent
            }, (error) => {
                if (error) console.error(error);
            });
        }
        
        if (view === 'barcode' && barcodeSvgRef.current) {
            try {
                 JsBarcode(barcodeSvgRef.current, qrData, {
                    format: 'CODE128',
                    lineColor: '#ffffff',
                    background: 'transparent',
                    width: 1.5,
                    height: 60,
                    displayValue: false,
                 });
            } catch (error) {
                console.error("Erreur de génération du code-barres:", error);
            }
        }

    }, [player.id, view]);
    
    const TabButton = ({ tabName, label, icon }: { tabName: 'qr' | 'barcode', label: string, icon: React.ReactNode }) => {
        const isActive = view === tabName;
        return ( <button onClick={() => setView(tabName)} className={`w-full flex justify-center items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-600'}`}> {icon} {label} </button> )
    }

    return (
        <Modal isOpen={true} onClose={onClose}>
            <div className="text-center p-4 bg-gray-900 rounded-lg">
                <CardHeader>Carte d'Identité pour {player.nickname}</CardHeader>
                
                 <div className="flex gap-2 rounded-lg bg-gray-700 p-1 my-4">
                    <TabButton tabName="qr" label="Code QR" icon={<QrCodeIcon className="w-5 h-5"/>}/>
                    <TabButton tabName="barcode" label="Code-barres" icon={<BarcodeIcon className="w-5 h-5"/>}/>
                </div>

                <div className="my-4 flex justify-center items-center h-72">
                    {view === 'qr' ? (
                        <canvas ref={qrCanvasRef} />
                    ) : (
                        <div className="flex flex-col items-center" style={{maxWidth: '100%', overflowX: 'auto'}}>
                            <svg ref={barcodeSvgRef} />
                            <p className="text-xs text-gray-400 mt-2">ID: {player.id}</p>
                        </div>
                    )}
                </div>

                <img src={player.avatarUrl} alt={player.nickname} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-gray-700"/>
                <p className="text-gray-400">Scannez ce code pour inscrire rapidement le joueur à un tournoi.</p>
                 <div className="mt-6">
                    <Button variant="secondary" onClick={onClose}>Fermer</Button>
                </div>
            </div>
        </Modal>
    );
};

const PlayerEditModal = ({ player, onClose }: { player: Partial<Player>, onClose: () => void }) => {
    const { state, dispatch } = useTournamentStore();
    const [id, setId] = useState(player.id || '');
    const [nickname, setNickname] = useState(player.nickname || '');
    const [firstName, setFirstName] = useState(player.firstName || '');
    const [lastName, setLastName] = useState(player.lastName || '');
    const [email, setEmail] = useState(player.email || '');
    const [phone, setPhone] = useState(player.phone || '');
    const [gender, setGender] = useState(player.gender || 'unspecified');
    const [notes, setNotes] = useState(player.notes || '');
    const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl || '');
    // AI Fields
    const [styleOfPlay, setStyleOfPlay] = useState(player.styleOfPlay || '');
    const [achievements, setAchievements] = useState(player.achievements || '');
    const [publicNotes, setPublicNotes] = useState(player.publicNotes || '');
    const [hendonMobUrl, setHendonMobUrl] = useState(player.hendonMobUrl || '');
    
    const isEditing = !!player.id;

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const finalId = id.trim();
        const trimmedNickname = nickname.trim();
        const trimmedEmail = email.trim();
        const trimmedPhone = phone.trim();

        if (!finalId || !/^\d+$/.test(finalId)) {
            alert("L'ID est requis et ne doit contenir que des chiffres.");
            return;
        }
        if (!trimmedNickname) {
            alert("Le pseudo du joueur ne peut pas être vide.");
            return;
        }

        const isDuplicateId = state.players.some(p => {
            if (isEditing && p.id === player.id) return false;
            return p.id === finalId;
        });

        if (isDuplicateId) {
            alert(`Erreur : L'ID "${finalId}" est déjà utilisé par un autre joueur.`);
            return;
        }

        const isDuplicateInfo = state.players.some(p => {
            if (isEditing && p.id === player.id) return false;
            if (trimmedNickname && p.nickname.toLowerCase() === trimmedNickname.toLowerCase()) {
                alert(`Erreur : Le pseudo "${trimmedNickname}" est déjà utilisé.`);
                return true;
            }
            if (trimmedEmail && p.email && p.email.toLowerCase() === trimmedEmail.toLowerCase()) {
                alert(`Erreur : L'email "${trimmedEmail}" est déjà utilisé.`);
                return true;
            }
            if (trimmedPhone && p.phone && p.phone === trimmedPhone) {
                alert(`Erreur : Le numéro de téléphone "${trimmedPhone}" est déjà utilisé.`);
                return true;
            }
            return false;
        });

        if (isDuplicateInfo) {
            return;
        }

        if (isEditing && finalId !== player.id) {
            const isPlayerInTournament = state.tournaments.some(t => t.entries.some(e => e.playerId === player.id));
            if (isPlayerInTournament) {
                if (!window.confirm("Attention : Ce joueur participe à un ou plusieurs tournois. Changer son ID pourrait corrompre les données historiques. Êtes-vous sûr de vouloir continuer ?")) {
                    return;
                }
            }
        }

        const playerData: Player = {
            id: finalId,
            nickname: trimmedNickname,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: trimmedEmail,
            phone: trimmedPhone,
            gender: gender as Player['gender'],
            notes: notes.trim(),
            avatarUrl: avatarUrl.trim() || `https://i.pravatar.cc/40?u=${finalId}`,
            // AI Fields
            styleOfPlay: styleOfPlay.trim(),
            achievements: achievements.trim(),
            publicNotes: publicNotes.trim(),
            hendonMobUrl: hendonMobUrl.trim(),
        };

        if (isEditing) {
            dispatch({ type: 'UPDATE_PLAYER', payload: playerData });
        } else {
            dispatch({ type: 'ADD_PLAYER', payload: playerData });
        }
        onClose();
    };
    
    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";

    return (
        <Modal isOpen={true} onClose={onClose}>
            <CardHeader>{isEditing ? 'Modifier le Joueur' : 'Ajouter un Nouveau Joueur'}</CardHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                 <div>
                    <label htmlFor="playerId" className={labelClasses}>ID Joueur (numérique, unique)</label>
                    <input 
                        type="text" 
                        id="playerId" 
                        value={id} 
                        onChange={e => setId(e.target.value)} 
                        required 
                        pattern="[0-9]*"
                        title="L'ID ne doit contenir que des chiffres."
                        className={inputClasses} 
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="playerFirstName" className={labelClasses}>Prénom</label>
                        <input type="text" id="playerFirstName" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="playerLastName" className={labelClasses}>Nom</label>
                        <input type="text" id="playerLastName" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClasses} />
                    </div>
                </div>
                <div>
                    <label htmlFor="playerNickname" className={labelClasses}>Pseudo (affiché dans le tournoi)</label>
                    <input type="text" id="playerNickname" value={nickname} onChange={e => setNickname(e.target.value)} required className={inputClasses} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="playerEmail" className={labelClasses}>Email</label>
                        <input type="email" id="playerEmail" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="playerPhone" className={labelClasses}>Téléphone</label>
                        <input type="tel" id="playerPhone" value={phone} onChange={e => setPhone(e.target.value)} className={inputClasses} />
                    </div>
                </div>
                 <div>
                    <label htmlFor="playerGender" className={labelClasses}>Genre</label>
                    <select id="playerGender" value={gender} onChange={e => setGender(e.target.value as Player['gender'])} className={inputClasses}>
                        <option value="unspecified">Non spécifié</option>
                        <option value="male">Homme</option>
                        <option value="female">Femme</option>
                        <option value="other">Autre</option>
                    </select>
                </div>
                <div>
                    <label className={labelClasses}>Avatar</label>
                    <div className="flex items-center gap-4">
                        <img 
                            src={avatarUrl || `https://i.pravatar.cc/80?u=${player.id || 'new_player'}`}
                            alt="Aperçu de l'avatar"
                            className="w-16 h-16 rounded-full bg-gray-600 object-cover"
                        />
                        <Button type="button" variant="secondary" onClick={() => (document.getElementById('playerAvatarFile') as HTMLInputElement)?.click()}>
                            Changer l'image
                        </Button>
                        <input
                            type="file"
                            id="playerAvatarFile"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="playerNotes" className={labelClasses}>Notes (privées)</label>
                    <textarea id="playerNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses}></textarea>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-600">
                    <h3 className="text-lg font-semibold text-white mb-2">Base de Connaissances IA</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="styleOfPlay" className={labelClasses}>Style de Jeu</label>
                            <input type="text" id="styleOfPlay" value={styleOfPlay} onChange={e => setStyleOfPlay(e.target.value)} placeholder="Ex: Très agressif, n'hésite pas à bluffer" className={inputClasses} />
                        </div>
                         <div>
                            <label htmlFor="achievements" className={labelClasses}>Palmarès</label>
                            <textarea id="achievements" value={achievements} onChange={e => setAchievements(e.target.value)} rows={2} placeholder="Ex: Vainqueur du Main Event 2023, 3x ITM" className={inputClasses}></textarea>
                        </div>
                         <div>
                            <label htmlFor="publicNotes" className={labelClasses}>Anecdotes Publiques</label>
                            <textarea id="publicNotes" value={publicNotes} onChange={e => setPublicNotes(e.target.value)} rows={2} placeholder="Ex: Est connu pour porter son chapeau fétiche" className={inputClasses}></textarea>
                        </div>
                        <div>
                            <label htmlFor="hendonMobUrl" className={labelClasses}>URL Hendon Mob</label>
                            <input type="url" id="hendonMobUrl" value={hendonMobUrl} onChange={e => setHendonMobUrl(e.target.value)} placeholder="https://pokerdb.thehendonmob.com/player.php?a=..." className={inputClasses} />
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="primary">Sauvegarder</Button>
                </div>
            </form>
        </Modal>
    );
};

const PlayerManagerPage = () => {
    const { state, dispatch } = useTournamentStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editingPlayer, setEditingPlayer] = useState<Partial<Player> | null>(null);
    const [playerForIdCard, setPlayerForIdCard] = useState<Player | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);

    const filteredPlayers = useMemo(() => {
        return state.players
            .filter(p => 
                p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.lastName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.nickname.localeCompare(b.nickname));
    }, [state.players, searchTerm]);

    const openModalForNew = () => {
        setEditingPlayer({ 
            nickname: '', 
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            gender: 'unspecified',
            notes: '',
            avatarUrl: '',
            styleOfPlay: '',
            achievements: '',
            publicNotes: '',
            hendonMobUrl: '',
        });
        setEditModalOpen(true);
    };

    const openModalForEdit = (player: Player) => {
        setEditingPlayer(player);
        setEditModalOpen(true);
    };
    
    const closeModal = () => {
        setEditingPlayer(null);
        setEditModalOpen(false);
    }
    
    const handleDelete = (playerId: string) => {
        if(window.confirm("Êtes-vous sûr de vouloir supprimer ce joueur ? Cette action est irréversible et ne fonctionnera pas si le joueur a participé à un tournoi.")) {
            dispatch({ type: 'DELETE_PLAYER', payload: { playerId } });
        }
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(state.players, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'poker_players_backup.json';
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') {
                    throw new Error("File content is not readable text.");
                }
                const importedPlayers = JSON.parse(text);
                
                if (!Array.isArray(importedPlayers) || (importedPlayers.length > 0 && (typeof importedPlayers[0].id === 'undefined' || typeof importedPlayers[0].nickname === 'undefined'))) {
                    throw new Error("Invalid player file format.");
                }
                
                if (window.confirm("Voulez-vous fusionner les joueurs de ce fichier ? Les joueurs existants seront mis à jour et les nouveaux joueurs seront ajoutés. Aucun joueur ne sera supprimé.")) {
                    await dispatch({ type: 'MERGE_PLAYERS', payload: { players: importedPlayers } });
                    alert(`${importedPlayers.length} joueurs importés et fusionnés avec succès.`);
                }

            } catch (error) {
                console.error("Error processing JSON file:", error);
                alert("Erreur lors du traitement du fichier JSON. Assurez-vous qu'il est valide.");
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };

    const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) throw new Error("File is empty.");
                
                const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");

                const header = lines[0].split(',').map(h => h.trim());
                const rows = lines.slice(1);

                const idIndex = header.indexOf('ID');
                const nameIndex = header.indexOf('Name');
                const phoneIndex = header.indexOf('Phone 1');
                
                if (nameIndex === -1) {
                    alert("Le fichier CSV doit contenir une colonne 'Name'.");
                    return;
                }

                const parsedPlayers: Partial<Player>[] = rows.map((rowStr): Partial<Player> | null => {
                    const row = rowStr.split(',');
                    
                    const nameField = row[nameIndex] || '';
                    if (!nameField) return null;

                    const idField = idIndex > -1 ? row[idIndex] : '';
                    const phoneField = phoneIndex > -1 ? row[phoneIndex] : '';
                    
                    let id: string | undefined = idField || undefined;
                    let firstName: string = '';
                    let lastName: string = '';

                    const nameParts = nameField.split(' ').filter(p => p.trim() !== '');
                    const lastPart = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
                    const hasNumberAtEnd = /\d+$/.test(lastPart);
                    
                    if (!id && hasNumberAtEnd) {
                        id = lastPart;
                    }

                    const nameOnlyParts = hasNumberAtEnd ? nameParts.slice(0, -1) : nameParts;
                    if (nameOnlyParts.length === 1) {
                        firstName = nameOnlyParts[0];
                    } else if (nameOnlyParts.length > 1) {
                        firstName = nameOnlyParts[0];
                        lastName = nameOnlyParts.slice(1).join(' ');
                    }

                    return {
                        id: id,
                        nickname: nameField,
                        firstName: firstName,
                        lastName: lastName,
                        phone: phoneField.trim(),
                    };
                }).filter((p): p is Partial<Player> => p !== null);

                if (parsedPlayers.length > 0) {
                     await dispatch({ type: 'MERGE_PLAYERS_FROM_CSV', payload: { players: parsedPlayers } });
                     alert(`${parsedPlayers.length} joueurs importés et fusionnés avec succès !`);
                } else {
                     alert("Aucun joueur valide n'a été trouvé dans le fichier CSV.");
                }

            } catch (error) {
                console.error("Erreur lors de l'importation CSV :", error);
                alert("Une erreur est survenue pendant l'importation. Vérifiez la console pour plus de détails.");
            } finally {
                if (csvFileInputRef.current) {
                    csvFileInputRef.current.value = "";
                }
            }
        };
        reader.readAsText(file);
    };
    
    const triggerFileSelect = () => fileInputRef.current?.click();
    const triggerCsvFileSelect = () => csvFileInputRef.current?.click();

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".json" />
            <input type="file" ref={csvFileInputRef} onChange={handleCsvFileChange} style={{ display: 'none' }} accept=".csv" />
            <header className="mb-6">
                <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; Retour à l'accueil</Link>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <h1 className="text-4xl font-bold text-white">Gestion des Joueurs</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="secondary" onClick={triggerCsvFileSelect} className="flex items-center gap-2">
                            <ArrowUpTrayIcon className="w-5 h-5"/> Importer (CSV)
                        </Button>
                        <Button variant="secondary" onClick={triggerFileSelect} className="flex items-center gap-2">
                            <ArrowUpTrayIcon className="w-5 h-5"/> Importer (JSON)
                        </Button>
                        <Button variant="secondary" onClick={handleExport} className="flex items-center gap-2">
                            <ArrowDownTrayIcon className="w-5 h-5"/> Exporter (JSON)
                        </Button>
                        <Button variant="primary" onClick={openModalForNew} className="flex items-center gap-2">
                            <PlusIcon className="w-5 h-5"/> Ajouter un Joueur
                        </Button>
                    </div>
                </div>
            </header>

            <Card>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher par ID, pseudo, nom ou prénom..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                    {filteredPlayers.map(player => (
                        <div key={player.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-700/50 p-3 rounded-md gap-4">
                            <div className="flex items-center space-x-4">
                                <img src={player.avatarUrl} alt={player.nickname} className="w-10 h-10 rounded-full" />
                                <div>
                                    <span className="font-semibold text-white">{player.nickname}</span>
                                    <p className="text-sm text-gray-500 font-mono">ID: {player.id}</p>
                                    {(player.firstName || player.lastName) && (
                                      <p className="text-sm text-gray-400">{player.firstName} {player.lastName}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2 self-end sm:self-center">
                                <Button variant="secondary" className="p-2" onClick={() => setPlayerForIdCard(player)} title="Afficher la carte d'identité"><IdentificationIcon className="w-4 h-4"/></Button>
                                <Button variant="secondary" className="p-2" onClick={() => openModalForEdit(player)} title="Modifier le joueur"><PencilIcon className="w-4 h-4"/></Button>
                                <Button variant="danger" className="p-2" onClick={() => handleDelete(player.id)} title="Supprimer le joueur"><TrashIcon className="w-4 h-4"/></Button>
                            </div>
                        </div>
                    ))}
                    {filteredPlayers.length === 0 && (
                        <p className="text-center text-gray-400 py-8">Aucun joueur trouvé.</p>
                    )}
                </div>
            </Card>

            {isEditModalOpen && editingPlayer && (
                <PlayerEditModal 
                    player={editingPlayer} 
                    onClose={closeModal} 
                />
            )}
            {playerForIdCard && (
                <PlayerIdModal player={playerForIdCard} onClose={() => setPlayerForIdCard(null)} />
            )}
        </div>
    );
};

export default PlayerManagerPage;
