import React, { useState, useEffect } from 'react';
import { useTournamentStore } from './store';
import { Tournament, AiKnowledgeBase } from './types';
import { Card, CardHeader, Button } from './components';

export const AiKnowledgeBaseWidget = ({ tournament }: { tournament: Tournament }) => {
    const { dispatch } = useTournamentStore();
    const [knowledge, setKnowledge] = useState<AiKnowledgeBase>({
        sponsors: '',
        lastMinuteInfo: '',
        buffetMenu: '',
        anecdotes: '',
    });

    useEffect(() => {
        if (tournament.aiKnowledgeBase) {
            setKnowledge(tournament.aiKnowledgeBase);
        }
    }, [tournament.aiKnowledgeBase]);

    const handleChange = (field: keyof AiKnowledgeBase, value: string) => {
        setKnowledge(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        dispatch({
            type: 'UPDATE_TOURNAMENT',
            payload: { ...tournament, aiKnowledgeBase: knowledge }
        });
        alert('Base de connaissances IA mise à jour !');
    };

    const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
    const textareaClasses = "w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500";

    return (
        <Card>
            <CardHeader>Base de Connaissances IA</CardHeader>
            <p className="text-sm text-gray-400 mb-6">Fournissez des informations contextuelles pour que l'IA puisse générer des publications plus riches et personnalisées sur ce tournoi.</p>
            <div className="space-y-4">
                <div>
                    <label htmlFor="sponsors" className={labelClasses}>Sponsors & Partenaires</label>
                    <textarea id="sponsors" rows={2} value={knowledge.sponsors} onChange={e => handleChange('sponsors', e.target.value)} placeholder="Ex: Ce tournoi est sponsorisé par PPMC et TexaPoker..." className={textareaClasses} />
                </div>
                <div>
                    <label htmlFor="lastMinuteInfo" className={labelClasses}>Infos de dernière minute</label>
                    <textarea id="lastMinuteInfo" rows={2} value={knowledge.lastMinuteInfo} onChange={e => handleChange('lastMinuteInfo', e.target.value)} placeholder="Ex: Les inscriptions tardives sont ouvertes jusqu'à la fin du niveau 6..." className={textareaClasses} />
                </div>
                <div>
                    <label htmlFor="buffetMenu" className={labelClasses}>Menu du buffet</label>
                    <textarea id="buffetMenu" rows={2} value={knowledge.buffetMenu} onChange={e => handleChange('buffetMenu', e.target.value)} placeholder="Ex: Ce soir au buffet : paella, salades variées et dessert..." className={textareaClasses} />
                </div>
                <div>
                    <label htmlFor="anecdotes" className={labelClasses}>Anecdotes sur le tournoi</label>
                    <textarea id="anecdotes" rows={3} value={knowledge.anecdotes} onChange={e => handleChange('anecdotes', e.target.value)} placeholder="Ex: C'est la 5ème édition de notre Main Event annuel. Le vainqueur de l'année dernière, Jean Dupont, est de retour pour défendre son titre..." className={textareaClasses} />
                </div>
            </div>
             <div className="mt-6 flex justify-end">
                <Button variant="primary" onClick={handleSave}>Sauvegarder les informations</Button>
            </div>
        </Card>
    );
};