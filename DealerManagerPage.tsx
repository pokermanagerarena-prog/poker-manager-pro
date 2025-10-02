import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTournamentStore } from './store';
import { Dealer, Tournament, DealerShift } from './types';
import { Card, CardHeader, Button, Modal, TrashIcon, PencilIcon, PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, BanknotesIcon } from './components';
import { format as formatDateFns, differenceInMilliseconds, startOfDay, endOfDay } from 'date-fns';


const GlobalPayrollModal = ({ isOpen, onClose, dealers, tournaments }: { isOpen: boolean, onClose: () => void, dealers: Dealer[], tournaments: Tournament[] }) => {
    const [hourlyRate, setHourlyRate] = useState(() => localStorage.getItem('globalHourlyRate') || '100');
    const today = new Date();
    const [startDate, setStartDate] = useState(formatDateFns(startOfDay(today), "yyyy-MM-dd"));
    const [endDate, setEndDate] = useState(formatDateFns(endOfDay(today), "yyyy-MM-dd"));

    useEffect(() => {
        localStorage.setItem('globalHourlyRate', hourlyRate);
    }, [hourlyRate]);

    const payrollData = useMemo(() => {
        const rate = parseFloat(hourlyRate) || 0;
        const start = startOfDay(new Date(startDate)).getTime();
        const end = endOfDay(new Date(endDate)).getTime();
        
        const shiftsByDealer: { [key: string]: { shifts: (DealerShift & { tournamentName: string })[] } } = {};

        tournaments.forEach(t => {
            (t.dealerShifts || []).forEach(shift => {
                if (shift.shiftEndTime && shift.shiftStartTime >= start && shift.shiftEndTime <= end) {
                    if (!shiftsByDealer[shift.dealerId]) {
                        shiftsByDealer[shift.dealerId] = { shifts: [] };
                    }
                    shiftsByDealer[shift.dealerId].shifts.push({ ...shift, tournamentName: t.name });
                }
            });
        });
        
        return Object.entries(shiftsByDealer).map(([dealerId, data]) => {
            const dealer = dealers.find(d => d.id === dealerId);
            const totalDurationMs = data.shifts.reduce((sum, s) => sum + (s.shiftEndTime! - s.shiftStartTime), 0);
            
            const shiftsByTournament: { [name: string]: { totalDurationMs: number } } = {};
            data.shifts.forEach(s => {
                if(!shiftsByTournament[s.tournamentName]) {
                    shiftsByTournament[s.tournamentName] = { totalDurationMs: 0 };
                }
                shiftsByTournament[s.tournamentName].totalDurationMs += (s.shiftEndTime! - s.shiftStartTime);
            });

            return {
                dealerId,
                dealerName: dealer?.nickname || 'Unknown',
                totalDurationMs,
                totalPay: (totalDurationMs / (1000 * 60 * 60)) * rate,
                breakdown: Object.entries(shiftsByTournament).map(([name, tournamentData]) => ({
                    tournamentName: name,
                    durationMs: tournamentData.totalDurationMs
                }))
            };
        }).sort((a,b) => a.dealerName.localeCompare(b.dealerName));

    }, [hourlyRate, startDate, endDate, tournaments, dealers]);
    
    const formatDuration = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    };
    
     const handleExportCsv = () => {
        const rate = parseFloat(hourlyRate) || 0;
        const headers = ['Croupier', 'Tournoi', 'Date', 'Durée (HH:MM)', 'Montant Dû (MAD)'];
        const csvRows = [headers.join(',')];

        payrollData.forEach(data => {
            data.breakdown.forEach(item => {
                 const durationHours = item.durationMs / (1000 * 60 * 60);
                 const amount = durationHours * rate;
                 const row = [
                    `"${data.dealerName.replace(/"/g, '""')}"`,
                    `"${item.tournamentName.replace(/"/g, '""')}"`,
                    formatDateFns(new Date(startDate), "dd/MM/yyyy"), // This is simplified, needs better date handling per shift
                    formatDuration(item.durationMs).replace('h ', ':'),
                    amount.toFixed(2)
                 ];
                 csvRows.push(row.join(','));
            });
             // Add total row for each dealer
            csvRows.push([`"${data.dealerName} - TOTAL"`, '', '', formatDuration(data.totalDurationMs).replace('h ', ':'), data.totalPay.toFixed(2)].join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `rapport_paie_${startDate}_a_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <CardHeader>Rapport de Paie Global</CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-900/50 rounded-md">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Date de début</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Date de fin</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`${inputClasses} [color-scheme:dark]`} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Taux Horaire (MAD)</label>
                    <input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} className={inputClasses} />
                </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="border-b border-gray-600 text-sm text-gray-400 sticky top-0 bg-gray-800">
                        <tr>
                            <th className="p-2">Croupier</th>
                            <th className="p-2 text-center">Durée Totale</th>
                            <th className="p-2 text-right">Montant Dû</th>
                        </tr>
                    </thead>
                    <tbody>
                        {payrollData.map(data => (
                             <React.Fragment key={data.dealerId}>
                                <tr className="bg-gray-700/50">
                                    <td className="p-3 font-semibold">{data.dealerName}</td>
                                    <td className="p-3 text-center font-mono font-semibold">{formatDuration(data.totalDurationMs)}</td>
                                    <td className="p-3 text-right font-mono font-bold text-green-400">{data.totalPay.toFixed(2)} MAD</td>
                                </tr>
                                {data.breakdown.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-700/20">
                                        <td className="pl-8 py-2 text-sm text-gray-400">{item.tournamentName}</td>
                                        <td className="py-2 text-center text-sm font-mono text-gray-400">{formatDuration(item.durationMs)}</td>
                                        <td></td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                         {payrollData.length === 0 && (
                            <tr>
                                <td colSpan={3} className="text-center p-8 text-gray-400">Aucun service de croupier terminé dans la période sélectionnée.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

             <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-700">
                <Button variant="secondary" onClick={handleExportCsv} className="flex items-center gap-2"><ArrowDownTrayIcon className="w-5 h-5"/> Exporter en CSV</Button>
                <Button onClick={onClose}>Fermer</Button>
            </div>
        </Modal>
    );
};


const DealerEditModal = ({ dealer, onClose }: { dealer: Partial<Dealer>, onClose: () => void }) => {
    const { state, dispatch } = useTournamentStore();
    const [id, setId] = useState(dealer.id || `${Date.now()}`);
    const [nickname, setNickname] = useState(dealer.nickname || '');
    const [firstName, setFirstName] = useState(dealer.firstName || '');
    const [lastName, setLastName] = useState(dealer.lastName || '');
    const [notes, setNotes] = useState(dealer.notes || '');
    const [avatarUrl, setAvatarUrl] = useState(dealer.avatarUrl || '');
    
    const isEditing = !!dealer.id;

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
        
        if (!nickname.trim()) {
            alert("Le pseudo du croupier ne peut pas être vide.");
            return;
        }

        const isDuplicate = state.dealers.some(d => {
            if (isEditing && d.id === dealer.id) return false;
            return d.nickname.toLowerCase() === nickname.trim().toLowerCase();
        });
        
        if (isDuplicate) {
            alert(`Le pseudo "${nickname.trim()}" est déjà utilisé par un autre croupier.`);
            return;
        }

        const dealerData: Dealer = {
            id: isEditing ? dealer.id! : id,
            nickname: nickname.trim(),
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            notes: notes.trim(),
            avatarUrl: avatarUrl.trim() || `https://i.pravatar.cc/40?u=${id}`,
        };

        if (isEditing) {
            dispatch({ type: 'UPDATE_DEALER', payload: dealerData });
        } else {
            dispatch({ type: 'ADD_DEALER', payload: dealerData });
        }
        onClose();
    };
    
    const inputClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";
    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";

    return (
        <Modal isOpen={true} onClose={onClose}>
            <CardHeader>{isEditing ? 'Modifier le Croupier' : 'Ajouter un Nouveau Croupier'}</CardHeader>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dealerFirstName" className={labelClasses}>Prénom</label>
                        <input type="text" id="dealerFirstName" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="dealerLastName" className={labelClasses}>Nom</label>
                        <input type="text" id="dealerLastName" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClasses} />
                    </div>
                </div>
                <div>
                    <label htmlFor="dealerNickname" className={labelClasses}>Pseudo (affiché dans le tournoi)</label>
                    <input type="text" id="dealerNickname" value={nickname} onChange={e => setNickname(e.target.value)} required className={inputClasses} />
                </div>
                <div>
                    <label className={labelClasses}>Avatar</label>
                    <div className="flex items-center gap-4">
                        <img 
                            src={avatarUrl || `https://i.pravatar.cc/80?u=${dealer.id || 'new_dealer'}`}
                            alt="Aperçu de l'avatar"
                            className="w-16 h-16 rounded-full bg-gray-600 object-cover"
                        />
                        <Button type="button" variant="secondary" onClick={() => (document.getElementById('dealerAvatarFile') as HTMLInputElement)?.click()}>
                            Changer l'image
                        </Button>
                        <input
                            type="file"
                            id="dealerAvatarFile"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="dealerNotes" className={labelClasses}>Notes (privées)</label>
                    <textarea id="dealerNotes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={inputClasses}></textarea>
                </div>
                
                <div className="flex justify-end gap-4 pt-4 mt-4 border-t border-gray-700">
                    <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
                    <Button type="submit" variant="primary">Sauvegarder</Button>
                </div>
            </form>
        </Modal>
    );
};

const DealerManagerPage = () => {
    const { state, dispatch } = useTournamentStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isPayrollModalOpen, setPayrollModalOpen] = useState(false);
    const [editingDealer, setEditingDealer] = useState<Partial<Dealer> | null>(null);
    const csvFileInputRef = useRef<HTMLInputElement>(null);

    const filteredDealers = useMemo(() => {
        return state.dealers
            .filter(d => 
                d.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.lastName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => a.nickname.localeCompare(b.nickname));
    }, [state.dealers, searchTerm]);

    const openModalForNew = () => {
        setEditingDealer({ 
            nickname: '', 
            firstName: '',
            lastName: '',
            notes: '',
            avatarUrl: '' 
        });
        setEditModalOpen(true);
    };

    const openModalForEdit = (dealer: Dealer) => {
        setEditingDealer(dealer);
        setEditModalOpen(true);
    };
    
    const closeModal = () => {
        setEditingDealer(null);
        setEditModalOpen(false);
    }
    
    const handleDelete = (dealerId: string) => {
        if(window.confirm("Êtes-vous sûr de vouloir supprimer ce croupier ? Cette action est irréversible.")) {
            dispatch({ type: 'DELETE_DEALER', payload: { dealerId } });
        }
    };

    const handleExportCsv = () => {
        const headers = ['ID', 'Nickname', 'FirstName', 'LastName', 'Notes'];
        const csvRows = [headers.join(',')];

        state.dealers.forEach(d => {
            const row = [
                `"${d.id.replace(/"/g, '""')}"`,
                `"${d.nickname.replace(/"/g, '""')}"`,
                `"${d.firstName.replace(/"/g, '""')}"`,
                `"${d.lastName.replace(/"/g, '""')}"`,
                `"${d.notes.replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `dealers_backup.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

                const getIndex = (name: string) => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
                const idIndex = getIndex('ID');
                const nicknameIndex = getIndex('Nickname');
                const firstNameIndex = getIndex('FirstName');
                const lastNameIndex = getIndex('LastName');
                const notesIndex = getIndex('Notes');

                if (nicknameIndex === -1) {
                    alert("Le fichier CSV doit contenir une colonne 'Nickname'.");
                    return;
                }

                const parsedDealers: Partial<Dealer>[] = rows.map((rowStr): Partial<Dealer> | null => {
                    const row = rowStr.split(',');
                    const nickname = row[nicknameIndex]?.trim();
                    if (!nickname) return null;

                    return {
                        id: idIndex > -1 ? row[idIndex]?.trim() : undefined,
                        nickname,
                        firstName: firstNameIndex > -1 ? row[firstNameIndex]?.trim() : '',
                        lastName: lastNameIndex > -1 ? row[lastNameIndex]?.trim() : '',
                        notes: notesIndex > -1 ? row[notesIndex]?.trim() : '',
                    };
                }).filter((d): d is Partial<Dealer> => d !== null);

                if (parsedDealers.length > 0) {
                     await dispatch({ type: 'MERGE_DEALERS_FROM_CSV', payload: { dealers: parsedDealers } });
                     alert(`${parsedDealers.length} croupiers importés et fusionnés avec succès !`);
                } else {
                     alert("Aucun croupier valide n'a été trouvé dans le fichier CSV.");
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
    
    const triggerCsvFileSelect = () => csvFileInputRef.current?.click();

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            {isPayrollModalOpen && <GlobalPayrollModal isOpen={isPayrollModalOpen} onClose={() => setPayrollModalOpen(false)} dealers={state.dealers} tournaments={state.tournaments} />}
            <input type="file" ref={csvFileInputRef} onChange={handleCsvFileChange} style={{ display: 'none' }} accept=".csv" />
            <header className="mb-6">
                <Link to="/" className="text-blue-400 hover:underline text-sm mb-2 block">&larr; Retour à l'accueil</Link>
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <h1 className="text-4xl font-bold text-white">Gestion des Croupiers</h1>
                    <div className="flex items-center gap-2 flex-wrap">
                         <Button variant="secondary" onClick={triggerCsvFileSelect} className="flex items-center gap-2">
                            <ArrowUpTrayIcon className="w-5 h-5"/> Importer (CSV)
                        </Button>
                        <Button variant="secondary" onClick={handleExportCsv} className="flex items-center gap-2">
                            <ArrowDownTrayIcon className="w-5 h-5"/> Exporter (CSV)
                        </Button>
                         <Button variant="secondary" onClick={() => setPayrollModalOpen(true)} className="flex items-center gap-2 bg-green-600/20 text-green-300 hover:bg-green-600/30">
                            <BanknotesIcon className="w-5 h-5"/> Rapport de Paie Global
                        </Button>
                        <Button variant="primary" onClick={openModalForNew} className="flex items-center gap-2">
                            <PlusIcon className="w-5 h-5"/> Ajouter un Croupier
                        </Button>
                    </div>
                </div>
            </header>

            <Card>
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Rechercher par pseudo, nom ou prénom..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
                
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
                    {filteredDealers.map(dealer => (
                        <div key={dealer.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-700/50 p-3 rounded-md gap-4">
                            <div className="flex items-center space-x-4">
                                <img src={dealer.avatarUrl} alt={dealer.nickname} className="w-10 h-10 rounded-full" />
                                <div>
                                    <span className="font-semibold text-white">{dealer.nickname}</span>
                                    {(dealer.firstName || dealer.lastName) && (
                                      <p className="text-sm text-gray-400">{dealer.firstName} {dealer.lastName}</p>
                                    )}
                                </div>
                            </div>
                             <div className="flex gap-2 self-end sm:self-center">
                                <Button variant="secondary" className="p-2" onClick={() => openModalForEdit(dealer)} title="Modifier le croupier"><PencilIcon className="w-4 h-4"/></Button>
                                <Button variant="danger" className="p-2" onClick={() => handleDelete(dealer.id)} title="Supprimer le croupier"><TrashIcon className="w-4 h-4"/></Button>
                            </div>
                        </div>
                    ))}
                    {filteredDealers.length === 0 && (
                        <p className="text-center text-gray-400 py-8">Aucun croupier trouvé.</p>
                    )}
                </div>
            </Card>

            {isEditModalOpen && editingDealer && (
                <DealerEditModal 
                    dealer={editingDealer} 
                    onClose={closeModal} 
                />
            )}
        </div>
    );
};

export default DealerManagerPage;
