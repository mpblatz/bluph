import { Card, CardType } from "../../shared/types.js";
import { v4 as uuidv4 } from "uuid";

export function createDeck(): Card[] {
    const deck: Card[] = [];

    // Add 3 of each card type
    Object.values(CardType).forEach((cardType) => {
        for (let i = 0; i < 3; i++) {
            deck.push({
                type: cardType,
                id: uuidv4(),
            });
        }
    });

    return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

export function getCardAbilities(cardType: CardType): {
    action: string;
    blocks: string[];
    description: string;
} {
    switch (cardType) {
        case CardType.DUKE:
            return {
                action: "Tax (gain 3 coins)",
                blocks: ["Foreign Aid"],
                description: "Take 3 coins from the treasury",
            };

        case CardType.ASSASSIN:
            return {
                action: "Assassinate (pay 3 coins to eliminate target)",
                blocks: [],
                description: "Pay 3 coins to force another player to lose a card",
            };

        case CardType.CAPTAIN:
            return {
                action: "Steal (take 2 coins from target)",
                blocks: ["Steal"],
                description: "Take up to 2 coins from another player",
            };

        case CardType.AMBASSADOR:
            return {
                action: "Exchange (draw 2 cards, return 2)",
                blocks: ["Steal"],
                description: "Draw 2 cards from deck, keep any 2, return the rest",
            };

        case CardType.CONTESSA:
            return {
                action: "None",
                blocks: ["Assassinate"],
                description: "Block assassination attempts",
            };

        default:
            return {
                action: "Unknown",
                blocks: [],
                description: "Unknown card",
            };
    }
}

export function canBlockAction(cardType: CardType, actionType: string): boolean {
    const abilities = getCardAbilities(cardType);
    return abilities.blocks.includes(actionType);
}

export function getBlockingCards(actionType: string): CardType[] {
    return Object.values(CardType).filter((cardType) => canBlockAction(cardType, actionType));
}

export function getRequiredCard(actionType: string): CardType | null {
    switch (actionType.toLowerCase()) {
        case "tax":
            return CardType.DUKE;
        case "assassinate":
            return CardType.ASSASSIN;
        case "steal":
            return CardType.CAPTAIN;
        case "exchange":
            return CardType.AMBASSADOR;
        default:
            return null;
    }
}

export function createCard(cardType: CardType): Card {
    return {
        type: cardType,
        id: uuidv4(),
    };
}

export function getCardDisplayInfo(cardType: CardType): {
    name: string;
    color: string;
    icon: string;
} {
    switch (cardType) {
        case CardType.DUKE:
            return {
                name: "Duke",
                color: "purple",
                icon: "👑",
            };

        case CardType.ASSASSIN:
            return {
                name: "Assassin",
                color: "black",
                icon: "🗡️",
            };

        case CardType.CAPTAIN:
            return {
                name: "Captain",
                color: "blue",
                icon: "⚓",
            };

        case CardType.AMBASSADOR:
            return {
                name: "Ambassador",
                color: "green",
                icon: "🤝",
            };

        case CardType.CONTESSA:
            return {
                name: "Contessa",
                color: "red",
                icon: "💄",
            };

        default:
            return {
                name: "Unknown",
                color: "gray",
                icon: "❓",
            };
    }
}
