import {
    ActionType,
    Card,
    CardType,
    GameAction,
    GamePhase,
    GamePlayerView,
    GameState,
    PendingAction,
    ResponseType,
    Ruleset,
} from "../../shared/types.js";
import { createDeck, shuffleDeck } from "../utils/cardUtils.js";
import { Player } from "./Player.js";

export class Game {
    public readonly code: string;
    public hostPlayerId: string;
    public lastActivityAt: Date;
    public players: Player[];
    public deck: Card[];
    public currentPlayerIndex: number;
    public phase: GamePhase;
    public pendingAction: PendingAction | null;
    public actionHistory: GameAction[];
    public readonly createdAt: Date;
    public readonly maxPlayers: number;
    public playersWhoMustLoseCard: Set<string>;
    public chatHistory: { id: string; playerId: string; playerName: string; text: string; timestamp: Date }[];
    public readonly ruleset: Ruleset;
    private pendingResolution: "action_success" | "action_fail" | "next_turn";

    constructor(gameCode: string, hostPlayerId: string, ruleset: Ruleset = Ruleset.STANDARD) {
        this.code = gameCode;
        this.hostPlayerId = hostPlayerId;
        this.ruleset = ruleset;
        this.lastActivityAt = new Date();
        this.players = [];
        this.deck = [];
        this.currentPlayerIndex = 0;
        this.phase = GamePhase.WAITING;
        this.pendingAction = null;
        this.actionHistory = [];
        this.chatHistory = [];
        this.createdAt = new Date();
        this.maxPlayers = 6;
        this.playersWhoMustLoseCard = new Set();
        this.pendingResolution = "next_turn";
    }

    public addPlayer(player: Player): boolean {
        if (this.players.length >= this.maxPlayers) return false;
        if (this.phase !== GamePhase.WAITING) return false;
        if (this.players.some((p) => p.id === player.id)) return false;
        this.players.push(player);
        return true;
    }

    public removePlayer(playerId: string): boolean {
        const playerIndex = this.players.findIndex((p) => p.id === playerId);
        if (playerIndex === -1) return false;
        const player = this.players[playerIndex];
        if (this.phase === GamePhase.PLAYING && player.cards.length > 0) {
            this.deck.push(...player.cards);
            this.deck = shuffleDeck(this.deck);
        }
        this.players.splice(playerIndex, 1);
        if (playerIndex <= this.currentPlayerIndex && this.currentPlayerIndex > 0) {
            this.currentPlayerIndex--;
        }
        return true;
    }

    public reconnectPlayer(playerId: string, newSocketId: string): boolean {
        const player = this.getPlayerById(playerId);
        if (!player) return false;
        player.socketId = newSocketId;
        player.setConnectionStatus(true);
        return true;
    }

    public resetGame(): void {
        for (const player of this.players) {
            player.cards = [];
            player.coins = 2;
            player.isAlive = true;
        }
        this.deck = [];
        this.pendingAction = null;
        this.actionHistory = [];
        this.playersWhoMustLoseCard = new Set();
        this.pendingResolution = "next_turn";
        this.currentPlayerIndex = 0;
        this.phase = GamePhase.WAITING;
        this.updateActivity();
    }

    public startGame(): boolean {
        if (this.players.length < 2) return false;
        if (this.phase !== GamePhase.WAITING) return false;
        this.deck = shuffleDeck(createDeck());
        for (const player of this.players) {
            for (let i = 0; i < 2; i++) {
                const card = this.deck.pop();
                if (card) player.addCard(card);
            }
        }
        this.phase = GamePhase.PLAYING;
        this.currentPlayerIndex = 0;
        return true;
    }

    public getGameState(_forPlayerId?: string): GameState {
        const players: GamePlayerView[] = this.players.map((p) => p.getPrivateState());
        return {
            code: this.code,
            phase: this.phase,
            players,
            currentPlayerIndex: this.currentPlayerIndex,
            currentPlayer: this.getCurrentPlayer()?.getPublicState(),
            pendingAction: this.pendingAction,
            deck: this.deck,
            winner: this.getWinner()?.getPublicState(),
            actionHistory: this.actionHistory,
            createdAt: this.createdAt,
            maxPlayers: this.maxPlayers,
            hostPlayerId: this.hostPlayerId,
            playersWhoMustLoseCard: Array.from(this.playersWhoMustLoseCard),
            ruleset: this.ruleset,
        };
    }

    public getCurrentPlayer(): Player | null {
        if (this.players.length === 0) return null;
        return this.players[this.currentPlayerIndex];
    }

    public getPlayerById(playerId: string): Player | null {
        return this.players.find((p) => p.id === playerId) || null;
    }

    public getAlivePlayers(): Player[] {
        return this.players.filter((p) => p.isAlive);
    }

    public nextTurn(): void {
        const alivePlayers = this.getAlivePlayers();
        if (alivePlayers.length <= 1) {
            this.endGame();
            return;
        }
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (!this.players[this.currentPlayerIndex].isAlive);
    }

    public isGameOver(): boolean {
        return this.getAlivePlayers().length <= 1;
    }

    public endGame(): void {
        this.phase = GamePhase.ENDED;
        this.pendingAction = null;
    }

    public getWinner(): Player | null {
        const alivePlayers = this.getAlivePlayers();
        return alivePlayers.length === 1 ? alivePlayers[0] : null;
    }

    public updateActivity(): void {
        this.lastActivityAt = new Date();
    }

    // --- Action Management ---

    private getCardForAction(actionType: ActionType): CardType | undefined {
        switch (actionType) {
            case ActionType.TAX:
                return CardType.DUKE;
            case ActionType.ASSASSINATE:
                return CardType.ASSASSIN;
            case ActionType.STEAL:
                return CardType.CAPTAIN;
            case ActionType.EXCHANGE:
                return CardType.AMBASSADOR;
            default:
                return undefined;
        }
    }

    private getBlockableCards(actionType: ActionType): CardType[] {
        switch (actionType) {
            case ActionType.FOREIGN_AID:
                return [CardType.DUKE];
            case ActionType.ASSASSINATE:
                return [CardType.CONTESSA];
            case ActionType.STEAL:
                return [CardType.AMBASSADOR, CardType.CAPTAIN];
            default:
                return [];
        }
    }

    private getActionCost(actionType: ActionType): number {
        switch (actionType) {
            case ActionType.COUP:
                return 7;
            case ActionType.ASSASSINATE:
                return 3;
            default:
                return 0;
        }
    }

    private getEligibleResponders(): string[] {
        if (!this.pendingAction) return [];
        const actorId = this.pendingAction.action.playerId;
        return this.getAlivePlayers()
            .filter((p) => p.id !== actorId)
            .map((p) => p.id);
    }

    public declareAction(
        playerId: string,
        actionType: ActionType,
        targetId?: string,
        isDouble?: boolean,
        coupTargetCard?: CardType,
    ): { success: boolean; error?: string; immediate?: boolean; needsCardLoss?: string } {
        const currentPlayer = this.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== playerId) {
            return { success: false, error: "Not your turn" };
        }
        const player = this.getPlayerById(playerId);
        if (!player || !player.isAlive) {
            return { success: false, error: "Player not alive" };
        }

        // Coin checks differ by ruleset
        if (this.ruleset === Ruleset.WAUKEGAN) {
            // Waukegan: income/FA blocked at 10+, no forced coup, max 12
            if (player.coins >= 10 && (actionType === ActionType.INCOME || actionType === ActionType.FOREIGN_AID)) {
                return { success: false, error: "Cannot take coins when at 10+" };
            }
        } else {
            // Standard: must coup at 10+
            if (player.coins >= 10 && actionType !== ActionType.COUP) {
                return { success: false, error: "Must Coup with 10+ coins" };
            }
        }

        // Income: no challenge/block, resolve immediately
        if (actionType === ActionType.INCOME) {
            const toAdd = this.ruleset === Ruleset.WAUKEGAN ? Math.min(1, 12 - player.coins) : 1;
            if (toAdd > 0) player.addCoins(toAdd);
            this.actionHistory.push({
                id: crypto.randomUUID(),
                type: ActionType.INCOME,
                playerId,
                timestamp: new Date(),
            });
            this.nextTurn();
            this.updateActivity();
            return { success: true, immediate: true };
        }

        // Coup: no challenge/block, resolve immediately
        if (actionType === ActionType.COUP) {
            if (!player.canAfford(7)) return { success: false, error: "Need 7 coins to Coup" };
            if (!targetId) return { success: false, error: "Coup requires a target" };
            const target = this.getPlayerById(targetId);
            if (!target || !target.isAlive) return { success: false, error: "Invalid target" };
            player.removeCoins(7);

            // Waukegan: targeted coup — specify which card to remove
            if (this.ruleset === Ruleset.WAUKEGAN && coupTargetCard) {
                this.actionHistory.push({
                    id: crypto.randomUUID(),
                    type: ActionType.COUP,
                    playerId,
                    targetId,
                    coupTargetCard,
                    timestamp: new Date(),
                });
                if (target.hasCard(coupTargetCard)) {
                    const cards = target.getCardsOfType(coupTargetCard);
                    target.removeCard(cards[0].id);
                    if (target.cards.length === 0) target.eliminate();
                }
                // Miss: coins spent, nothing happens to target
                if (this.isGameOver()) {
                    this.endGame();
                } else {
                    this.nextTurn();
                }
                this.updateActivity();
                return { success: true, immediate: true };
            }

            // Standard coup
            this.actionHistory.push({
                id: crypto.randomUUID(),
                type: ActionType.COUP,
                playerId,
                targetId,
                timestamp: new Date(),
            });
            this.playersWhoMustLoseCard.add(targetId);
            this.pendingResolution = "next_turn";
            this.updateActivity();
            return { success: true, immediate: true, needsCardLoss: targetId };
        }

        // Assassinate: deduct coins now (coins stay spent even if blocked)
        if (actionType === ActionType.ASSASSINATE) {
            if (!player.canAfford(3)) return { success: false, error: "Need 3 coins to Assassinate" };
            if (!targetId) return { success: false, error: "Assassination requires a target" };
            const target = this.getPlayerById(targetId);
            if (!target || !target.isAlive) return { success: false, error: "Invalid target" };
            player.removeCoins(3);
        }

        if (actionType === ActionType.STEAL) {
            if (!targetId) return { success: false, error: "Steal requires a target" };
            const target = this.getPlayerById(targetId);
            if (!target || !target.isAlive) return { success: false, error: "Invalid target" };
        }

        const useDouble = isDouble && this.ruleset === Ruleset.WAUKEGAN;

        const gameAction: GameAction = {
            id: crypto.randomUUID(),
            type: actionType,
            playerId,
            targetId,
            cardClaimed: this.getCardForAction(actionType),
            isDouble: useDouble || undefined,
            timestamp: new Date(),
        };

        const alivePlayers = this.getAlivePlayers().filter((p) => p.id !== playerId);
        const challengeableActions = [ActionType.TAX, ActionType.ASSASSINATE, ActionType.STEAL, ActionType.EXCHANGE];
        const blockableActions = [ActionType.FOREIGN_AID, ActionType.ASSASSINATE, ActionType.STEAL];
        const canChallenge = challengeableActions.includes(actionType);
        let canBlock = blockableActions.includes(actionType);

        const challengeableBy = canChallenge ? alivePlayers.map((p) => p.id) : [];
        let blockableBy: string[] = [];
        if (canBlock) {
            if (actionType === ActionType.FOREIGN_AID) {
                blockableBy = alivePlayers.map((p) => p.id);
            } else if (targetId) {
                blockableBy = [targetId];
            }
            // Waukegan: Double Captain cannot be blocked
            if (useDouble && actionType === ActionType.STEAL) {
                blockableBy = [];
                canBlock = false;
            }
        }

        this.pendingAction = {
            action: gameAction,
            challengeableBy,
            blockableBy,
            responses: {},
            timeoutDuration: 30000,
            canBlock,
            canChallenge,
        };
        this.phase = GamePhase.CHALLENGE_PHASE;
        this.actionHistory.push(gameAction);
        this.updateActivity();
        return { success: true, immediate: false };
    }

    public respondToAction(
        responderId: string,
        response: ResponseType,
        cardClaimed?: CardType,
        isDouble?: boolean,
        redirectTargetId?: string,
    ): {
        success: boolean;
        error?: string;
        event: "challenge_resolved" | "block_declared" | "action_resolved" | "waiting";
        challengerWon?: boolean;
        loserId?: string;
        needsCardLoss?: string[];
    } {
        if (!this.pendingAction || this.phase !== GamePhase.CHALLENGE_PHASE) {
            return { success: false, error: "No pending action", event: "waiting" };
        }
        const pa = this.pendingAction;
        const actorId = pa.action.playerId;

        if (responderId === actorId) {
            return { success: false, error: "Cannot respond to your own action", event: "waiting" };
        }
        if (pa.responses[responderId] !== undefined) {
            return { success: false, error: "Already responded", event: "waiting" };
        }

        if (response === ResponseType.CHALLENGE) {
            if (!pa.canChallenge || !pa.challengeableBy.includes(responderId)) {
                return { success: false, error: "Cannot challenge this action", event: "waiting" };
            }
            const claimedCard = pa.action.cardClaimed!;
            const actor = this.getPlayerById(actorId)!;
            const actionIsDouble = pa.action.isDouble && this.ruleset === Ruleset.WAUKEGAN;

            // Double claims require 2 cards to prove
            const actorHasCard = actionIsDouble
                ? actor.getCardsOfType(claimedCard).length >= 2
                : actor.hasCard(claimedCard);
            pa.responses[responderId] = ResponseType.CHALLENGE;

            if (actorHasCard) {
                // Challenge failed: actor proves card(s), challenger loses influence
                if (actionIsDouble) {
                    const cards = actor.getCardsOfType(claimedCard);
                    actor.removeCard(cards[0].id);
                    actor.removeCard(cards[1].id);
                    this.deck.push(cards[0], cards[1]);
                    this.deck = shuffleDeck(this.deck);
                    actor.addCard(this.deck.pop()!);
                    actor.addCard(this.deck.pop()!);
                } else {
                    const cardInstances = actor.getCardsOfType(claimedCard);
                    const cardToReturn = cardInstances[0];
                    actor.removeCard(cardToReturn.id);
                    this.deck.push(cardToReturn);
                    this.deck = shuffleDeck(this.deck);
                    const newCard = this.deck.pop()!;
                    actor.addCard(newCard);
                }
                this.playersWhoMustLoseCard.add(responderId);
                this.pendingResolution = "action_success";
                return {
                    success: true,
                    event: "challenge_resolved",
                    challengerWon: false,
                    loserId: responderId,
                    needsCardLoss: [responderId],
                };
            } else {
                // Challenge succeeded: actor was bluffing, action fails, coins refunded
                this.playersWhoMustLoseCard.add(actorId);
                const cost = this.getActionCost(pa.action.type);
                if (cost > 0) actor.addCoins(cost);
                this.pendingResolution = "action_fail";
                return {
                    success: true,
                    event: "challenge_resolved",
                    challengerWon: true,
                    loserId: actorId,
                    needsCardLoss: [actorId],
                };
            }
        }

        if (response === ResponseType.BLOCK) {
            if (!pa.canBlock || !pa.blockableBy.includes(responderId)) {
                return { success: false, error: "Cannot block this action", event: "waiting" };
            }
            if (!cardClaimed) {
                return { success: false, error: "Must specify card when blocking", event: "waiting" };
            }
            const validBlockCards = this.getBlockableCards(pa.action.type);
            if (!validBlockCards.includes(cardClaimed)) {
                return { success: false, error: "Invalid card for blocking this action", event: "waiting" };
            }
            // Waukegan: Double Assassin can only be blocked by Double Contessa
            const blockIsDouble = isDouble && this.ruleset === Ruleset.WAUKEGAN;
            if (this.ruleset === Ruleset.WAUKEGAN && pa.action.isDouble && pa.action.type === ActionType.ASSASSINATE) {
                if (cardClaimed !== CardType.CONTESSA || !blockIsDouble) {
                    return {
                        success: false,
                        error: "Double Assassin can only be blocked by Double Contessa",
                        event: "waiting",
                    };
                }
            }
            pa.block = {
                blockerId: responderId,
                cardClaimed,
                isDouble: blockIsDouble || undefined,
                redirectTargetId: blockIsDouble && redirectTargetId ? redirectTargetId : undefined,
                responses: {},
            };
            pa.responses[responderId] = ResponseType.BLOCK;
            this.phase = GamePhase.BLOCK_PHASE;
            return { success: true, event: "block_declared" };
        }

        if (response === ResponseType.ALLOW) {
            pa.responses[responderId] = ResponseType.ALLOW;
            const eligibleResponders = this.getEligibleResponders();
            const allResponded = eligibleResponders.every((id) => pa.responses[id] !== undefined);
            if (allResponded) {
                this.pendingResolution = "action_success";
                return { success: true, event: "action_resolved" };
            }
            return { success: true, event: "waiting" };
        }

        return { success: false, error: "Invalid response", event: "waiting" };
    }

    public respondToBlock(
        responderId: string,
        response: ResponseType,
    ): {
        success: boolean;
        error?: string;
        event: "challenge_resolved" | "block_stands" | "waiting";
        challengerWon?: boolean;
        loserId?: string;
        needsCardLoss?: string[];
    } {
        if (!this.pendingAction?.block || this.phase !== GamePhase.BLOCK_PHASE) {
            return { success: false, error: "No pending block", event: "waiting" };
        }
        const block = this.pendingAction.block;

        if (responderId === block.blockerId) {
            return { success: false, error: "Cannot respond to your own block", event: "waiting" };
        }
        if (block.responses[responderId] !== undefined) {
            return { success: false, error: "Already responded", event: "waiting" };
        }

        if (response === ResponseType.CHALLENGE) {
            const blocker = this.getPlayerById(block.blockerId)!;
            const blockIsDouble = block.isDouble && this.ruleset === Ruleset.WAUKEGAN;

            // Double block claims require 2 cards to prove
            const blockerHasCard = blockIsDouble
                ? blocker.getCardsOfType(block.cardClaimed).length >= 2
                : blocker.hasCard(block.cardClaimed);
            block.responses[responderId] = ResponseType.CHALLENGE;

            if (blockerHasCard) {
                // Block challenge failed: blocker proves card(s), challenger loses, block stands
                if (blockIsDouble) {
                    const cards = blocker.getCardsOfType(block.cardClaimed);
                    blocker.removeCard(cards[0].id);
                    blocker.removeCard(cards[1].id);
                    this.deck.push(cards[0], cards[1]);
                    this.deck = shuffleDeck(this.deck);
                    blocker.addCard(this.deck.pop()!);
                    blocker.addCard(this.deck.pop()!);
                    // Double Contessa redirect: assassination goes to redirect target
                    if (block.redirectTargetId && this.pendingAction!.action.type === ActionType.ASSASSINATE) {
                        const redirectTarget = this.getPlayerById(block.redirectTargetId);
                        if (redirectTarget && redirectTarget.isAlive) {
                            this.pendingAction!.action.targetId = block.redirectTargetId;
                            this.pendingResolution = "action_success";
                        } else {
                            this.pendingResolution = "action_fail";
                        }
                    } else {
                        this.pendingResolution = "action_fail";
                    }
                } else {
                    const cardInstances = blocker.getCardsOfType(block.cardClaimed);
                    const cardToReturn = cardInstances[0];
                    blocker.removeCard(cardToReturn.id);
                    this.deck.push(cardToReturn);
                    this.deck = shuffleDeck(this.deck);
                    const newCard = this.deck.pop()!;
                    blocker.addCard(newCard);
                    this.pendingResolution = "action_fail";
                }
                this.playersWhoMustLoseCard.add(responderId);
                return {
                    success: true,
                    event: "challenge_resolved",
                    challengerWon: false,
                    loserId: responderId,
                    needsCardLoss: [responderId],
                };
            } else {
                // Block challenge succeeded: blocker was bluffing
                // Dylan's Gambit: Waukegan + assassination + blocker bluffed = lose ALL cards
                if (this.ruleset === Ruleset.WAUKEGAN && this.pendingAction!.action.type === ActionType.ASSASSINATE) {
                    for (const card of [...blocker.cards]) {
                        blocker.removeCard(card.id);
                    }
                    blocker.eliminate();
                    this.pendingResolution = "action_success"; // Assassination "succeeds" (blocker eliminated)
                    return {
                        success: true,
                        event: "challenge_resolved",
                        challengerWon: true,
                        loserId: block.blockerId,
                        needsCardLoss: [], // Already eliminated, no card selection
                    };
                }
                // Standard: blocker loses 1 card, action proceeds
                this.playersWhoMustLoseCard.add(block.blockerId);
                this.pendingResolution = "action_success";
                return {
                    success: true,
                    event: "challenge_resolved",
                    challengerWon: true,
                    loserId: block.blockerId,
                    needsCardLoss: [block.blockerId],
                };
            }
        }

        if (response === ResponseType.ALLOW) {
            block.responses[responderId] = ResponseType.ALLOW;
            const eligibleResponders = this.getAlivePlayers()
                .filter((p) => p.id !== block.blockerId)
                .map((p) => p.id);
            const allResponded = eligibleResponders.every((id) => block.responses[id] !== undefined);
            if (allResponded) {
                // Waukegan: Double Contessa redirect — assassination goes to redirect target
                if (
                    this.ruleset === Ruleset.WAUKEGAN &&
                    block.isDouble &&
                    block.redirectTargetId &&
                    this.pendingAction!.action.type === ActionType.ASSASSINATE
                ) {
                    const redirectTarget = this.getPlayerById(block.redirectTargetId);
                    if (redirectTarget && redirectTarget.isAlive) {
                        this.pendingAction!.action.targetId = block.redirectTargetId;
                        this.pendingResolution = "action_success";
                        return { success: true, event: "block_stands" };
                    }
                }
                this.pendingResolution = "action_fail";
                return { success: true, event: "block_stands" };
            }
            return { success: true, event: "waiting" };
        }

        return { success: false, error: "Invalid response", event: "waiting" };
    }

    public loseCard(
        playerId: string,
        cardId: string,
    ): { success: boolean; error?: string; eliminated: boolean; gameOver: boolean; pendingCardLoss: boolean } {
        if (!this.playersWhoMustLoseCard.has(playerId)) {
            return {
                success: false,
                error: "Player does not need to lose a card",
                eliminated: false,
                gameOver: false,
                pendingCardLoss: false,
            };
        }
        const player = this.getPlayerById(playerId);
        if (!player) {
            return {
                success: false,
                error: "Player not found",
                eliminated: false,
                gameOver: false,
                pendingCardLoss: false,
            };
        }
        const card = player.removeCard(cardId);
        if (!card) {
            return {
                success: false,
                error: "Card not found",
                eliminated: false,
                gameOver: false,
                pendingCardLoss: false,
            };
        }
        this.playersWhoMustLoseCard.delete(playerId);

        let eliminated = false;
        if (player.cards.length === 0) {
            player.eliminate();
            eliminated = true;
        }

        if (this.isGameOver()) {
            this.endGame();
            return { success: true, eliminated, gameOver: true, pendingCardLoss: false };
        }

        const pendingCardLoss = this.playersWhoMustLoseCard.size > 0;
        if (!pendingCardLoss) {
            this.finalizePendingResolution();
        }
        return { success: true, eliminated, gameOver: false, pendingCardLoss };
    }

    public finalizePendingResolution(): void {
        if (this.pendingResolution === "action_success" && this.pendingAction) {
            this.executeAction(this.pendingAction.action);
        } else {
            this.pendingAction = null;
            this.phase = GamePhase.PLAYING;
            if (!this.isGameOver()) this.nextTurn();
        }
        this.pendingResolution = "next_turn";
    }

    private executeAction(action: GameAction): void {
        const player = this.getPlayerById(action.playerId);
        if (!player) return;

        const isDouble = action.isDouble && this.ruleset === Ruleset.WAUKEGAN;

        switch (action.type) {
            case ActionType.FOREIGN_AID: {
                const toAdd = this.ruleset === Ruleset.WAUKEGAN ? Math.min(2, 12 - player.coins) : 2;
                if (toAdd > 0) player.addCoins(toAdd);
                break;
            }

            case ActionType.TAX: {
                const base = isDouble ? 5 : 3;
                const toAdd = this.ruleset === Ruleset.WAUKEGAN ? Math.min(base, 12 - player.coins) : base;
                if (toAdd > 0) player.addCoins(toAdd);
                break;
            }

            case ActionType.STEAL: {
                const target = action.targetId ? this.getPlayerById(action.targetId) : null;
                if (target && target.isAlive) {
                    const stealAmount = isDouble ? 3 : 2;
                    const stolen = Math.min(stealAmount, target.coins);
                    target.removeCoins(stolen);
                    player.addCoins(stolen);
                }
                break;
            }

            case ActionType.ASSASSINATE: {
                const target = action.targetId ? this.getPlayerById(action.targetId) : null;
                if (target && target.isAlive) {
                    this.pendingAction = null;
                    this.pendingResolution = "next_turn";
                    this.phase = GamePhase.PLAYING;
                    this.playersWhoMustLoseCard.add(target.id);
                    return; // nextTurn happens after target chooses card
                }
                break;
            }

            case ActionType.EXCHANGE: {
                const drawCount = isDouble ? 3 : 2;
                const drawn: Card[] = [];
                for (let i = 0; i < drawCount && this.deck.length > 0; i++) {
                    drawn.push(this.deck.pop()!);
                }
                if (this.pendingAction) {
                    this.pendingAction.exchangeOptions = [...player.cards, ...drawn];
                    this.phase = GamePhase.PLAYING;
                    return; // Wait for player to choose which cards to keep
                }
                break;
            }
        }

        this.pendingAction = null;
        this.phase = GamePhase.PLAYING;
        if (this.isGameOver()) {
            this.endGame();
        } else {
            this.nextTurn();
        }
    }

    public performExchange(playerId: string, keepCardIds: string[]): { success: boolean; error?: string } {
        if (!this.pendingAction?.exchangeOptions || this.pendingAction.action.playerId !== playerId) {
            return { success: false, error: "No pending exchange for this player" };
        }
        const player = this.getPlayerById(playerId);
        if (!player) return { success: false, error: "Player not found" };

        const keepCount = player.cards.length;
        if (keepCardIds.length !== keepCount) {
            return { success: false, error: `Must keep exactly ${keepCount} card(s)` };
        }

        const allOptions = this.pendingAction.exchangeOptions;
        const keptCards = allOptions.filter((c) => keepCardIds.includes(c.id));
        if (keptCards.length !== keepCount) {
            return { success: false, error: "Invalid card selection" };
        }
        const returnCards = allOptions.filter((c) => !keepCardIds.includes(c.id));

        player.cards = keptCards;
        this.deck.push(...returnCards);
        this.deck = shuffleDeck(this.deck);
        this.pendingAction = null;
        this.phase = GamePhase.PLAYING;
        if (!this.isGameOver()) this.nextTurn();
        this.updateActivity();
        return { success: true };
    }
}
