import { GoogleGenAI } from "@google/genai";
// FIX: Add TournamentType to imports
import { Tournament, Player, EntryStatus, TournamentStatus, TournamentPhase, Entry, EliminationDetails, LiveCoveragePost, TournamentType } from './types';
import { Action, calculatePayouts } from './store';

type Dispatch = React.Dispatch<Action>;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// Helper function to find a player by ID
const getPlayer = (players: Player[], id: string) => players.find(p => p.id === id);

// Helper function to find the current chip leader
const getChipLeader = (tournament: Tournament, players: Player[]): (Entry & { player: Player }) | null => {
    const activePlayers = tournament.entries
        .filter(e => e.status === EntryStatus.ACTIVE)
        .map(entry => ({...entry, player: players.find(p => p.id === entry.playerId)}))
        .filter((e): e is Entry & {player: Player} => !!e.player);
    
    if (activePlayers.length === 0) return null;

    return activePlayers.reduce((leader, current) => current.chipCount > leader.chipCount ? current : leader, activePlayers[0]);
};

// --- AI CONTENT GENERATION ---

async function generateAiContent(
    textPrompt: string,
    imagePrompt: string
): Promise<{ content: string; imageUrl: string | null; }> {
    let content = '';
    let imageUrl: string | null = null;

    try {
        // Generate Text
        const textResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: textPrompt,
        });
        content = textResponse.text;
    } catch (error) {
        console.error("Error generating text with Gemini API:", error);
        return { content: '', imageUrl: null };
    }

    if (!content) {
        return { content: '', imageUrl: null };
    }

    try {
        // Generate Image
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `An artistic, thematic image for a live poker tournament report. The style should be modern and engaging. The subject is: ${imagePrompt}`,
            config: { numberOfImages: 1 }
        });

        if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
            imageUrl = `data:image/png;base64,${imageResponse.generatedImages[0].image.imageBytes}`;
        }
    } catch (error) {
        console.error("Error generating image with Gemini API:", error);
        imageUrl = null; // Proceed with text only if image fails
    }

    return { content, imageUrl };
}

// --- ON-DEMAND ANALYSIS ---

export const requestOnDemandAnalysis = async (
    tournament: Tournament,
    players: Player[],
    query: string,
    dispatch: Dispatch
) => {
    // Set loading state
    dispatch({ type: 'SET_AI_GENERATING', payload: { tournamentId: tournament.id, isGenerating: true } });

    const activePlayers = tournament.entries.filter(e => e.status === EntryStatus.ACTIVE).map(e => ({...e, player: getPlayer(players, e.playerId)}));
    const chipCounts = activePlayers.sort((a,b) => b.chipCount - a.chipCount).map(p => `${p.player?.nickname}: ${p.chipCount}`).join(', ');
    const currentLevel = tournament.levels[tournament.currentLevel - 1];
    
    if (!currentLevel) {
        console.error("AI Agent: Could not find current level info.");
        dispatch({ type: 'SET_AI_GENERATING', payload: { tournamentId: tournament.id, isGenerating: false } });
        return;
    }

    // Add more context
    const totalPrizePool = (tournament.entries.reduce((sum, e) => sum + e.buyins, 0) * tournament.buyin) + (tournament.entries.reduce((sum, e) => sum + e.addons, 0) * tournament.addonCost);
    const totalEntries = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
    
    // Correctly calculate total and average chips
    const entriesForChipCalc = tournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED);
    const totalBuyins = entriesForChipCalc.reduce((sum, e) => sum + e.buyins, 0);
    const totalAddons = entriesForChipCalc.reduce((sum, e) => sum + e.addons, 0);
    const totalDealerBonuses = entriesForChipCalc.reduce((sum, e) => sum + (e.dealerBonuses || 0), 0);
    const totalChips = (totalBuyins * tournament.startingStack) + (totalAddons * tournament.addonChips) + (totalDealerBonuses * tournament.dealerBonusChips);
    const averageStack = activePlayers.length > 0 ? Math.round(totalChips / activePlayers.length) : 0;

    const payouts = calculatePayouts(totalPrizePool, totalEntries);
    const payoutStructure = payouts.map(p => `Rank ${p.rank}: ${p.amount} MAD`).join(', ');
    const recentPosts = tournament.liveCoveragePosts.slice(0, 5).map(p => `[${new Date(p.timestamp).toLocaleTimeString()}] ${p.content}`).join('\n');


    const context = `
        Here is the current state of the poker tournament "${tournament.name}":
        - Current Level: ${tournament.currentLevel}
        - Blinds: ${currentLevel.smallBlind}/${currentLevel.bigBlind} (ante: ${currentLevel.ante})
        - Players Remaining: ${activePlayers.length}
        - Total Entries: ${totalEntries}
        - Total Chips in Play: ${totalChips.toLocaleString()}
        - Average Stack: ${averageStack.toLocaleString()}
        - Chip Leader: ${activePlayers[0]?.player?.nickname || 'N/A'} with ${activePlayers[0]?.chipCount.toLocaleString() || 'N/A'} chips.
        - Payout Structure: ${payoutStructure}
        - Recent Live Coverage Posts:
        ${recentPosts}
        - Full Chip Counts: ${chipCounts}
    `;

    const textPrompt = `
        ${tournament.liveCoverageSettings.systemInstruction}
        Based on the following tournament data, please answer this request: "${query}". Provide a direct, concise answer in the form of a live coverage post.

        Tournament Data:
        ${context}
    `;
    const imageContext = `A poker tournament report answering the question: ${query}`;
    
    const { content, imageUrl } = await generateAiContent(textPrompt, imageContext);

    if (content) {
        dispatch({
            type: 'ADD_LIVE_COVERAGE_POST',
            payload: { tournamentId: tournament.id, content, imageUrl, author: 'ai' }
        });
    }

    // Unset loading state
    dispatch({ type: 'SET_AI_GENERATING', payload: { tournamentId: tournament.id, isGenerating: false } });
};

// --- ELIMINATION POST GENERATION ---
export const generateEliminationPost = async (
    tournament: Tournament,
    players: Player[],
    eliminatedEntries: (Entry & { player: Player })[],
    details: EliminationDetails
): Promise<{ content: string, imageUrl: string | null } | null> => {
    let textPrompt = `${tournament.liveCoverageSettings.systemInstruction}\n`;
    let imageContext = '';

    if (tournament.type === TournamentType.MULTI_FLIGHT) {
        const currentPhase = tournament.phase === TournamentPhase.FLIGHTS ? `Phase de qualification (Day 1)` : `Phase finale (Day 2+)`;
        textPrompt += `\n**CONTEXTE IMPORTANT :** Il s'agit d'un tournoi multi-flight. Nous sommes actuellement dans la phase : ${currentPhase}. Adapte ton commentaire en conséquence. Ne parle PAS de classement final, de vainqueur du tournoi ou de bulle si nous sommes en phase de qualification.`;
    }

    const eliminator = details.eliminatorId ? players.find(p => p.id === details.eliminatorId) : undefined;
    
    let streetInfo = '';
    if (details.street) {
        switch (details.street) {
            case 'pre-flop': streetInfo = ` L'action cruciale (all-in) s'est déroulée pré-flop.`; break;
            case 'flop': streetInfo = ` L'action cruciale (all-in) s'est déroulée au flop.`; break;
            case 'turn': streetInfo = ` L'action cruciale (all-in) s'est déroulée au turn.`; break;
            case 'river': streetInfo = ` L'action cruciale (all-in) s'est déroulée à la river.`; break;
        }
    }

    let boardInstruction = '';
    if (details.boardCards && details.street && details.street !== 'pre-flop') {
        const cardCount = details.street === 'flop' ? 3 : (details.street === 'turn' ? 4 : 5);
        boardInstruction = ` En décrivant l'action, ne mentionne que les ${cardCount} premières cartes du board qui étaient visibles à ce moment-là. Tu peux mentionner le board final complet (les 5 cartes) lors de la conclusion de la main.`;
    }

    if (eliminatedEntries.length === 1) {
        const eliminated = eliminatedEntries[0];
        textPrompt += `\n**ÉVÉNEMENT :** Élimination de "${eliminated.player.nickname}".`;
        
        let eliminatedPlayerInfo = '';
        if (eliminated.player.styleOfPlay) eliminatedPlayerInfo += `\n- Style de jeu : ${eliminated.player.styleOfPlay}`;
        if (eliminated.player.achievements) eliminatedPlayerInfo += `\n- Palmarès : ${eliminated.player.achievements}`;
        if (eliminated.player.publicNotes) eliminatedPlayerInfo += `\n- Anecdote : ${eliminated.player.publicNotes}`;
        if (eliminated.player.hendonMobUrl) eliminatedPlayerInfo += `\n- Profil Hendon Mob : ${eliminated.player.hendonMobUrl}`;
        if (eliminatedPlayerInfo) {
            textPrompt += `\n**Informations sur ${eliminated.player.nickname} :**${eliminatedPlayerInfo}`;
        }
        
        if (eliminator) {
            textPrompt += `\n**Vainqueur de la main :** "${eliminator.nickname}".`;
            let eliminatorInfo = '';
            if (eliminator.styleOfPlay) eliminatorInfo += `\n- Style de jeu : ${eliminator.styleOfPlay}`;
            if (eliminator.achievements) eliminatorInfo += `\n- Palmarès : ${eliminator.achievements}`;
            if (eliminator.publicNotes) eliminatorInfo += `\n- Anecdote : ${eliminator.publicNotes}`;
            if (eliminator.hendonMobUrl) eliminatorInfo += `\n- Profil Hendon Mob : ${eliminator.hendonMobUrl}`;
            if (eliminatorInfo) {
                textPrompt += `\n**Informations sur ${eliminator.nickname} :**${eliminatorInfo}`;
            }
        }
        
        textPrompt += `\n**DÉTAILS DE LA MAIN :**
- Cartes du Vainqueur (${eliminator?.nickname || 'Inconnu'}) : ${details.eliminatorCards || 'Non spécifiées'}
- Cartes de ${eliminated.player.nickname} : ${details.eliminatedPlayerCards || 'Non spécifiées'}
- Board Final : ${details.boardCards || 'Non spécifié'}
- Moment clé de l'action : ${details.street || 'Non spécifié'}${boardInstruction}${streetInfo}`;

        imageContext = `Photographie d'art d'un tournoi de poker, style cinématographique. Un joueur, ${eliminated.player.nickname}, au visage abattu, se lève de la table tandis que son adversaire, ${eliminator?.nickname || 'un adversaire'}, rassemble un énorme tas de jetons. Focus sur les cartes maîtresses de la main. Éclairage contrasté, ambiance tendue.`;
        
    } else {
        const eliminatedNames = eliminatedEntries.map(e => `"${e.player.nickname}"`).join(' et ');
        textPrompt += `\n**ÉVÉNEMENT :** Élimination multiple spectaculaire.`;
        textPrompt += `\n**Joueurs Éliminés :** ${eliminatedNames}.`;
        
        if (eliminator) {
             textPrompt += `\n**Vainqueur de la main :** "${eliminator.nickname}".`;
             imageContext = `${eliminator.nickname} remportant un pot massif après avoir éliminé plusieurs joueurs. Photographie d'action, jetons en mouvement, expression de victoire intense.`;
        } else {
            imageContext = `Un pot énorme au milieu d'une table de poker avec plusieurs joueurs montrant leurs cartes après une confrontation dramatique.`;
        }
        
        textPrompt += `\n**DÉTAILS DE LA MAIN :**
- Cartes du Vainqueur (${eliminator?.nickname || 'Inconnu'}) : ${details.eliminatorCards || 'Non spécifiées'}
- Board Final : ${details.boardCards || 'Non spécifié'}
- Moment clé de l'action : ${details.street || 'Non spécifié'}${boardInstruction}${streetInfo}`;
    }

    textPrompt += `\n\n**VOTRE MISSION :** Rédigez une publication captivante qui raconte cette main, en vous basant sur votre style journalistique et les directives fournies.`;

    const { content, imageUrl } = await generateAiContent(textPrompt, imageContext);
    
    if (content) {
        return { content, imageUrl };
    }
    
    return null;
};


// --- AUTOMATED MONITORING ---

const publishOrSuggest = async (
    tournament: Tournament,
    triggerEvent: string,
    textPrompt: string,
    imageContext: string,
    dispatch: Dispatch
) => {
    const { content, imageUrl } = await generateAiContent(textPrompt, imageContext);

    if (content) {
        if (tournament.liveCoverageSettings.autopilotEnabled) {
            dispatch({
                type: 'ADD_LIVE_COVERAGE_POST',
                payload: { tournamentId: tournament.id, content, imageUrl, author: 'ai' }
            });
        } else {
            dispatch({
                type: 'ADD_AI_SUGGESTION',
                payload: {
                    tournamentId: tournament.id,
                    suggestion: { content, imageUrl, triggerEvent }
                }
            });
        }
    }
};

export const monitorTournamentState = (
    prevTournament: Tournament,
    currentTournament: Tournament,
    players: Player[],
    dispatch: Dispatch
) => {

    if (JSON.stringify(prevTournament) === JSON.stringify(currentTournament) || !currentTournament.liveCoverageSettings) {
        return;
    }

    if (currentTournament.status === TournamentStatus.RUNNING) {
        
        // --- Proactive Suggestions (Strategic) ---
        // 1. Chip Leader Change
        const prevLeader = getChipLeader(prevTournament, players);
        const currentLeader = getChipLeader(currentTournament, players);

        if (currentLeader && prevLeader && currentLeader.playerId !== prevLeader.playerId) {
            const triggerEvent = 'chip_leader_change';
            const hasPendingSuggestion = currentTournament.liveCoverageSuggestions.some(s => s.triggerEvent === triggerEvent && s.status === 'pending');

            if (!hasPendingSuggestion) {
                let textPrompt = `${currentTournament.liveCoverageSettings.systemInstruction}
**ÉVÉNEMENT :** Changement de Chip Leader.
Nouveau Chip Leader : "${currentLeader.player.nickname}" avec ${currentLeader.chipCount.toLocaleString()} jetons.
Ancien Chip Leader : "${prevLeader.player.nickname}" qui a maintenant ${prevTournament.entries.find(e=>e.playerId === prevLeader.playerId)?.chipCount.toLocaleString()} jetons.

**Informations sur le nouveau leader (${currentLeader.player.nickname}):**
- Style : ${currentLeader.player.styleOfPlay || 'Non défini'}
- Palmarès : ${currentLeader.player.achievements || 'Non défini'}

Rédige une publication pour annoncer ce changement de dynamique au sommet du classement. Souligne l'ascension du nouveau leader.`;

                const imageContext = `Photographie de poker artistique. Le nouveau chip leader, ${currentLeader.player.nickname}, est au premier plan, concentré, avec une montagne de jetons devant lui. L'ancien chip leader est visible en arrière-plan, avec une expression plus sombre. Contraste fort, ambiance de passation de pouvoir.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            }
        }
        
        // --- Reactive Event-based Posts (Gameplay) ---
        const prevActiveCount = prevTournament.entries.filter(e => e.status === EntryStatus.ACTIVE).length;
        const currentActiveCount = currentTournament.entries.filter(e => e.status === EntryStatus.ACTIVE).length;
        const isMultiFlightDay1 = currentTournament.type === TournamentType.MULTI_FLIGHT && currentTournament.phase === TournamentPhase.FLIGHTS;

        // Level Change
        if (currentTournament.currentLevel > prevTournament.currentLevel) {
            const newLevel = currentTournament.levels[currentTournament.currentLevel - 1];
            if (newLevel) { // Guarded, this is good.
                const triggerEvent = 'level_up';
                const textPrompt = newLevel.isBreak 
                    ? `${currentTournament.liveCoverageSettings.systemInstruction}. Annonce que le tournoi "${currentTournament.name}" est now on a ${newLevel.duration}-minute break.`
                    : `${currentTournament.liveCoverageSettings.systemInstruction}. Annonce que le tournoi "${currentTournament.name}" est passé au Niveau ${newLevel.level}. Les nouvelles blinds sont ${newLevel.smallBlind}/${newLevel.bigBlind} avec un ante de ${newLevel.ante}.`;
                const imageContext = newLevel.isBreak 
                    ? `Des joueurs de poker qui se détendent pendant une pause, discutant loin des tables. Ambiance décontractée, lumière naturelle si possible.`
                    : `Gros plan sur des jetons de poker avec une incrustation numérique moderne montrant les nouveaux niveaux de blinds : ${newLevel.smallBlind}/${newLevel.bigBlind}.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            }
        }

        const totalBuyins = currentTournament.entries.reduce((sum, entry) => sum + entry.buyins, 0);
        const totalAddons = currentTournament.entries.reduce((sum, entry) => sum + entry.addons, 0);
        const totalPrizePool = (totalBuyins * currentTournament.buyin) + (totalAddons * currentTournament.addonCost);
        const totalEntries = currentTournament.entries.filter(e => e.status !== EntryStatus.MERGE_DISCARDED).length;
        const payouts = calculatePayouts(totalPrizePool, totalEntries);
        const paidPlaces = payouts.length;

        // Bubble approaching/bursting & Final Table - ONLY IF NOT a Day 1 flight
        if (!isMultiFlightDay1 && prevActiveCount !== currentActiveCount && paidPlaces > 0) {
            const finalTableSize = currentTournament.tables[0]?.seats || 9;
            const bubbleThreshold = 3; 

            if (prevActiveCount > paidPlaces + bubbleThreshold && currentActiveCount <= paidPlaces + bubbleThreshold && currentActiveCount > paidPlaces + 1) {
                const triggerEvent = 'bubble_approach';
                const playersToBubble = currentActiveCount - paidPlaces;
                const textPrompt = `${currentTournament.liveCoverageSettings.systemInstruction}
**ÉVÉNEMENT :** L'approche de la bulle !
Il ne reste plus que ${playersToBubble} élimination(s) avant que tous les joueurs restants ne soient dans l'argent (ITM).
- Joueurs restants : ${currentActiveCount}
- Places payées : ${paidPlaces}
Rédige une publication courte pour décrire la tension qui monte dans la salle du tournoi "${currentTournament.name}".`;

                const imageContext = `Une salle de tournoi de poker plongée dans une semi-obscurité. La tension est palpable sur les visages des joueurs. Une bulle de savon métaphorique flotte au-dessus des tables, prête à éclater. Style cinématographique, grain de film.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            } else if (prevActiveCount > finalTableSize && currentActiveCount <= finalTableSize) { // Final Table
                const triggerEvent = 'final_table_formed';
                const textPrompt = `${currentTournament.liveCoverageSettings.systemInstruction}. La table finale du tournoi "${currentTournament.name}" est formée ! Les ${currentActiveCount} derniers joueurs s'affrontent maintenant pour le titre. Rédige un post exaltant sur ce moment.`;
                const imageContext = `Une table de poker illuminée de manière spectaculaire, avec les ${currentActiveCount} finalistes prenant place. Le trophée du tournoi est visible au centre. Ambiance épique et solennelle.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            } else if (prevActiveCount > paidPlaces && currentActiveCount <= paidPlaces) { // Bubble Burst
                const triggerEvent = 'bubble_burst';
                const textPrompt = `${currentTournament.liveCoverageSettings.systemInstruction}. La bulle a éclaté dans le tournoi "${currentTournament.name}" ! Les ${currentActiveCount} joueurs restants sont maintenant tous dans l'argent. Annonce ce moment dramatique et crucial.`;
                const imageContext = `Une explosion de jetons de poker et de confettis. Le texte "In The Money!" est incrusté de manière stylisée. Ambiance de célébration et de soulagement.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            } else if (currentActiveCount === paidPlaces + 1 && prevActiveCount > currentActiveCount) { // Approaching Bubble
                const triggerEvent = 'stone_bubble';
                const textPrompt = `${currentTournament.liveCoverageSettings.systemInstruction}. Le tournoi "${currentTournament.name}" est maintenant à la bulle ! Il reste ${currentActiveCount} joueurs pour ${paidPlaces} places payées. Rédige un court post sur cette haute tension.`;
                const imageContext = `Un joueur de poker tendu regardant ses cartes, avec une grande bulle transparente flottant au-dessus de la table, sur le point de éclater.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            }
        }
    }
    
    // Winner Declared
    if (prevTournament.status !== TournamentStatus.COMPLETED && currentTournament.status === TournamentStatus.COMPLETED) {
        const winnerEntry = currentTournament.entries
            .filter(e => e.eliminationIndex !== null)
            .sort((a, b) => b.eliminationIndex! - a.eliminationIndex!)[0];

        if (winnerEntry) {
            const winnerPlayer = getPlayer(players, winnerEntry.playerId);
            if (winnerPlayer) {
                const triggerEvent = 'winner_declared';
                const textPrompt = `${currentTournament.liveCoverageSettings.systemInstruction}. Nous avons un champion ! "${winnerPlayer.nickname}" vient de remporter le tournoi "${currentTournament.name}". Rédige une publication de célébration pour féliciter le vainqueur.`;
                const imageContext = `Un champion de poker, ${winnerPlayer.nickname}, soulevant un grand trophée et entouré de piles de jetons de poker.`;
                publishOrSuggest(currentTournament, triggerEvent, textPrompt, imageContext, dispatch);
            }
        }
    }
};