import { Link } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { useEffect, useRef, useState } from "react";
import {
    ActionType,
    CardType,
    GamePhase,
    ResponseType,
    Ruleset,
    type Card,
    type GameState,
    type PlayerState,
} from "../../../server/shared/types";
import { useGame } from "../context/GameContext";

const ACTION_LABELS: Record<ActionType, string> = {
    [ActionType.INCOME]: "Income",
    [ActionType.FOREIGN_AID]: "Foreign Aid",
    [ActionType.COUP]: "Coup",
    [ActionType.TAX]: "Tax (Duke)",
    [ActionType.ASSASSINATE]: "Assassinate",
    [ActionType.STEAL]: "Steal",
    [ActionType.EXCHANGE]: "Exchange",
    [ActionType.BLOCK]: "Block",
};

const ACTION_HISTORY_LABELS: Record<ActionType, string> = {
    [ActionType.INCOME]: "took Income (+1 coin)",
    [ActionType.FOREIGN_AID]: "claims Foreign Aid (+2 coins)",
    [ActionType.COUP]: "launched a Coup on",
    [ActionType.TAX]: "claims Tax as Duke (+3 coins)",
    [ActionType.ASSASSINATE]: "claims Assassinate as Assassin on",
    [ActionType.STEAL]: "claims Steal as Captain from",
    [ActionType.EXCHANGE]: "claims Exchange as Ambassador",
    [ActionType.BLOCK]: "blocked",
};

const ACTION_COLORS: Record<ActionType, string> = {
    [ActionType.INCOME]: "border-l-gray-400 bg-gray-50",
    [ActionType.FOREIGN_AID]: "border-l-blue-400 bg-blue-50",
    [ActionType.COUP]: "border-l-red-500 bg-red-50",
    [ActionType.TAX]: "border-l-yellow-500 bg-yellow-50",
    [ActionType.ASSASSINATE]: "border-l-purple-500 bg-purple-50",
    [ActionType.STEAL]: "border-l-cyan-500 bg-cyan-50",
    [ActionType.EXCHANGE]: "border-l-emerald-500 bg-emerald-50",
    [ActionType.BLOCK]: "border-l-orange-500 bg-orange-50",
};

export default function GamePage() {
    const { socket } = useSocket(
        import.meta.env.VITE_SERVER_URL || `http://localhost:${import.meta.env.VITE_SERVER_PORT || 8003}`,
    );
    const { gameData, playerData, setGameData } = useGame();
    const [pendingActionType, setPendingActionType] = useState<ActionType | null>(null);
    const [selectedExchangeCards, setSelectedExchangeCards] = useState<string[]>([]);
    const [chatMessages, setChatMessages] = useState<
        { id: string; playerId: string; playerName: string; text: string; timestamp: Date }[]
    >([]);
    const [chatInput, setChatInput] = useState("");
    const [isDoubleClaimMode, setIsDoubleClaimMode] = useState(false);
    const [coupTargetPlayerId, setCoupTargetPlayerId] = useState<string | null>(null);
    const [doubleContessaStep, setDoubleContessaStep] = useState<"pickTarget" | null>(null);
    const [doubleContessaRedirectId, setDoubleContessaRedirectId] = useState<string | null>(null);
    const [showFeed, setShowFeed] = useState(false);
    const feedBottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        feedBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages, gameData?.actionHistory?.length]);

    useEffect(() => {
        if (!socket) return;

        if (playerData && gameData?.code) {
            socket.emit(
                "reconnect-to-game",
                { playerId: playerData.id, gameCode: gameData.code },
                (response: { success: boolean; gameState: GameState; chatHistory?: typeof chatMessages }) => {
                    if (response.success) {
                        setGameData(response.gameState);
                        if (response.chatHistory) setChatMessages(response.chatHistory);
                    }
                },
            );
        }

        socket.on("game-state-update", (data: { gameState: GameState }) => {
            setGameData(data.gameState);
        });

        socket.on("game-started", (data: GameState) => {
            setGameData(data);
        });

        socket.on("player-reconnected", (data: { playerId: string; gameState: GameState }) => {
            if (data.gameState) setGameData(data.gameState);
        });

        socket.on(
            "chat-message",
            (msg: { id: string; playerId: string; playerName: string; text: string; timestamp: Date }) => {
                setChatMessages((prev) => [msg, ...prev]);
            },
        );

        return () => {
            socket.off("game-state-update");
            socket.off("game-started");
            socket.off("player-reconnected");
            socket.off("chat-message");
        };
    }, [socket]);

    if (!gameData?.players) {
        return (
            <div className="flex text-center items-center h-screen justify-center bg-gray-950 text-gray-400">
                game state is not set properly :(
            </div>
        );
    }

    // --- Derived state ---
    const myPlayer = gameData.players.find((p) => p.id === playerData?.id) as PlayerState | undefined;
    const myCards: Card[] = myPlayer?.cards ?? [];
    const phase = gameData.phase;
    const pendingAction = gameData.pendingAction;
    const myId = playerData?.id;

    const isMyTurn =
        gameData.currentPlayer?.id === myId && phase === GamePhase.PLAYING && !pendingAction?.exchangeOptions;
    const isActor = pendingAction?.action.playerId === myId;
    const canChallenge = !!pendingAction?.challengeableBy.includes(myId ?? "");
    const canBlock = !!pendingAction?.blockableBy.includes(myId ?? "");
    const hasRespondedToAction = !!(myId && pendingAction?.responses[myId] !== undefined);
    const isBlocker = pendingAction?.block?.blockerId === myId;
    const hasRespondedToBlock = !!(myId && pendingAction?.block?.responses[myId] !== undefined);
    const mustLoseCard = !!(myId && gameData.playersWhoMustLoseCard.includes(myId));
    const hasExchangeChoice = !!(
        pendingAction?.action.type === ActionType.EXCHANGE &&
        isActor &&
        pendingAction.exchangeOptions
    );
    const myCoins = myPlayer?.coins ?? 0;
    const mustCoup = myCoins >= 10 && gameData.ruleset !== Ruleset.WAUKEGAN;
    const isWaukegan = gameData.ruleset === Ruleset.WAUKEGAN;

    // --- Helpers ---
    const getPlayerName = (id?: string) => gameData.players.find((p) => p.id === id)?.name ?? "Unknown";

    const performAction = (actionType: ActionType, targetId?: string, isDouble?: boolean, coupTargetCard?: CardType) => {
        if (!socket) return;
        setPendingActionType(null);
        setCoupTargetPlayerId(null);
        setIsDoubleClaimMode(false);
        socket.emit("perform-action", { actionType, targetId, isDouble, coupTargetCard }, (res: { success: boolean; error?: string }) => {
            if (!res.success) console.error("Action failed:", res.error);
        });
    };

    const handleActionButtonClick = (actionType: ActionType) => {
        if ([ActionType.COUP, ActionType.STEAL, ActionType.ASSASSINATE].includes(actionType)) {
            setPendingActionType(actionType);
        } else {
            performAction(actionType, undefined, isDoubleClaimMode);
        }
    };

    const handleTargetClick = (targetId: string) => {
        if (!pendingActionType) return;
        // Waukegan coup: first pick player, then pick card type
        if (pendingActionType === ActionType.COUP && isWaukegan) {
            setCoupTargetPlayerId(targetId);
            return;
        }
        performAction(pendingActionType, targetId, isDoubleClaimMode);
    };

    const respondToAction = (response: ResponseType, cardClaimed?: CardType, isDouble?: boolean, redirectTargetId?: string) => {
        if (!socket) return;
        setDoubleContessaStep(null);
        setDoubleContessaRedirectId(null);
        socket.emit("respond-to-action", { response, cardClaimed, isDouble, redirectTargetId }, (res: { success: boolean; error?: string }) => {
            if (!res.success) console.error("Respond failed:", res.error);
        });
    };

    const respondToBlock = (response: ResponseType) => {
        if (!socket) return;
        socket.emit("respond-to-block", { response }, (res: { success: boolean; error?: string }) => {
            if (!res.success) console.error("Block respond failed:", res.error);
        });
    };

    const loseCard = (cardId: string) => {
        if (!socket) return;
        socket.emit("choose-card-to-lose", { cardId }, (res: { success: boolean; error?: string }) => {
            if (!res.success) console.error("Lose card failed:", res.error);
        });
    };

    const submitExchange = () => {
        if (!socket) return;
        socket.emit(
            "choose-exchange-cards",
            { keepCardIds: selectedExchangeCards },
            (res: { success: boolean; error?: string }) => {
                if (!res.success) console.error("Exchange failed:", res.error);
                else setSelectedExchangeCards([]);
            },
        );
    };

    const sendChat = () => {
        if (!socket || !chatInput.trim()) return;
        socket.emit("send-chat-message", { text: chatInput.trim() }, (res: { success: boolean }) => {
            if (res.success) setChatInput("");
        });
    };

    const toggleExchangeCard = (cardId: string) => {
        const keepCount = myCards.length;
        setSelectedExchangeCards((prev) => {
            if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
            if (prev.length >= keepCount) return prev;
            return [...prev, cardId];
        });
    };

    // --- Table positioning ---
    const getPlayerPosition = (index: number, totalPlayers: number) => {
        const currentPlayerIndex = gameData.players.findIndex((p) => p.id === myId);
        let relativeIndex = index - currentPlayerIndex;
        if (relativeIndex < 0) relativeIndex += totalPlayers;

        const positions: Record<number, React.CSSProperties[]> = {
            2: [
                { left: "50%", bottom: "10%", transform: "translateX(-50%)" },
                { left: "50%", top: "10%", transform: "translateX(-50%)" },
            ],
            3: [
                { left: "50%", bottom: "10%", transform: "translateX(-50%)" },
                { right: "15%", top: "30%" },
                { left: "15%", top: "30%" },
            ],
            4: [
                { left: "50%", bottom: "10%", transform: "translateX(-50%)" },
                { right: "10%", top: "50%", transform: "translateY(-50%)" },
                { left: "50%", top: "10%", transform: "translateX(-50%)" },
                { left: "10%", top: "50%", transform: "translateY(-50%)" },
            ],
            5: [
                { left: "50%", bottom: "10%", transform: "translateX(-50%)" },
                { right: "20%", bottom: "25%" },
                { right: "10%", top: "25%" },
                { left: "10%", top: "25%" },
                { left: "20%", bottom: "25%" },
            ],
            6: [
                { left: "50%", bottom: "10%", transform: "translateX(-50%)" },
                { right: "15%", bottom: "20%" },
                { right: "8%", top: "50%", transform: "translateY(-50%)" },
                { right: "15%", top: "20%" },
                { left: "15%", top: "20%" },
                { left: "8%", top: "50%", transform: "translateY(-50%)" },
            ],
        };

        const playerPositions = positions[totalPlayers] ?? positions[6];
        return playerPositions[relativeIndex] ?? playerPositions[0];
    };

    // --- Action bar rendering ---
    const renderActionBar = () => {
        // 1. Card loss selection (highest priority)
        if (mustLoseCard) {
            return (
                <div className="p-4 text-center">
                    <p className="font-semibold text-red-600 mb-3">
                        You must reveal a card. Choose which influence to lose:
                    </p>
                    <div className="flex gap-3 justify-center">
                        {myCards.map((card) => (
                            <button
                                key={card.id}
                                onClick={() => loseCard(card.id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-semibold capitalize shadow-md"
                            >
                                Reveal {card.type}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        // 2. Exchange card selection
        if (hasExchangeChoice && pendingAction?.exchangeOptions) {
            const keepCount = myCards.length;
            return (
                <div className="p-4 text-center">
                    <p className="font-semibold text-emerald-700 mb-1">Exchange: choose {keepCount} card(s) to keep</p>
                    <p className="text-xs text-gray-500 mb-3">
                        Selected: {selectedExchangeCards.length}/{keepCount}
                    </p>
                    <div className="flex gap-3 justify-center mb-3">
                        {pendingAction.exchangeOptions.map((card) => {
                            const isSelected = selectedExchangeCards.includes(card.id);
                            return (
                                <button
                                    key={card.id}
                                    onClick={() => toggleExchangeCard(card.id)}
                                    className={`px-5 py-3 rounded-lg font-semibold capitalize border-2 shadow-md transition-colors ${
                                        isSelected
                                            ? "bg-emerald-500 border-emerald-700 text-white"
                                            : "bg-white border-gray-300 text-gray-800 hover:border-emerald-400"
                                    }`}
                                >
                                    {card.type}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={submitExchange}
                        disabled={selectedExchangeCards.length !== keepCount}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-6 py-2 rounded font-semibold"
                    >
                        Confirm Exchange
                    </button>
                </div>
            );
        }

        // 3. Block phase responses
        if (phase === GamePhase.BLOCK_PHASE && pendingAction?.block) {
            const block = pendingAction.block;
            const blockerName = getPlayerName(block.blockerId);
            const actionName = ACTION_LABELS[pendingAction.action.type];
            const redirectName = block.redirectTargetId ? getPlayerName(block.redirectTargetId) : null;

            if (isBlocker) {
                return (
                    <div className="p-4 text-center text-gray-500">
                        You claimed {block.isDouble ? "Double " : ""}<span className="font-semibold capitalize">{block.cardClaimed}</span> to block{" "}
                        {actionName}{redirectName ? ` → redirecting to ${redirectName}` : ""}. Waiting for others to respond...
                    </div>
                );
            }
            if (hasRespondedToBlock) {
                return (
                    <div className="p-4 text-center text-gray-500">Waiting for others to respond to the block...</div>
                );
            }
            return (
                <div className="p-4 text-center">
                    <p className="font-semibold mb-3">
                        <span className="text-orange-600">{blockerName}</span> claims{" "}
                        {block.isDouble ? "Double " : ""}<span className="capitalize font-bold">{block.cardClaimed}</span> to block {actionName}
                        {redirectName ? <span className="text-yellow-600"> → redirecting to {redirectName}</span> : ""}.
                        Challenge it?
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => respondToBlock(ResponseType.CHALLENGE)}
                            className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded font-semibold"
                        >
                            Challenge Block
                        </button>
                        <button
                            onClick={() => respondToBlock(ResponseType.ALLOW)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2 rounded font-semibold"
                        >
                            Allow Block
                        </button>
                    </div>
                </div>
            );
        }

        // 4. Challenge phase responses
        if (phase === GamePhase.CHALLENGE_PHASE && pendingAction) {
            const actorName = getPlayerName(pendingAction.action.playerId);
            const actionName = ACTION_LABELS[pendingAction.action.type];
            const cardClaimed = pendingAction.action.cardClaimed;
            const actionType = pendingAction.action.type;
            const actionIsDouble = pendingAction.action.isDouble;

            if (isActor) {
                return (
                    <div className="p-4 text-center text-gray-500">
                        You declared {actionIsDouble ? "Double " : ""}<span className="font-semibold">{actionName}</span>. Waiting for others to
                        respond...
                    </div>
                );
            }
            if (hasRespondedToAction) {
                return <div className="p-4 text-center text-gray-500">Waiting for others to respond...</div>;
            }

            // Waukegan: Double Contessa redirect step — pick redirect target
            if (doubleContessaStep === "pickTarget" && canBlock && actionType === ActionType.ASSASSINATE) {
                const alivePlayers = gameData.players.filter((p) => p.isAlive && p.id !== myId && p.id !== pendingAction.action.playerId);
                return (
                    <div className="p-4 text-center">
                        <p className="font-semibold mb-2 text-yellow-600">Double Contessa: pick who to redirect the assassination to</p>
                        <div className="flex gap-2 justify-center flex-wrap mb-3">
                            {alivePlayers.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setDoubleContessaRedirectId(p.id)}
                                    className={`px-4 py-2 rounded font-semibold text-sm border-2 transition-colors ${
                                        doubleContessaRedirectId === p.id
                                            ? "bg-yellow-400 border-yellow-600 text-gray-950"
                                            : "bg-gray-800 border-gray-600 text-white hover:border-yellow-400"
                                    }`}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-center">
                            <button
                                onClick={() => {
                                    if (doubleContessaRedirectId) {
                                        respondToAction(ResponseType.BLOCK, CardType.CONTESSA, true, doubleContessaRedirectId);
                                    }
                                }}
                                disabled={!doubleContessaRedirectId}
                                className="bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 text-gray-950 px-5 py-2 rounded font-semibold"
                            >
                                Confirm Redirect
                            </button>
                            <button
                                onClick={() => { setDoubleContessaStep(null); setDoubleContessaRedirectId(null); }}
                                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                );
            }

            return (
                <div className="p-4 text-center">
                    <p className="font-semibold mb-1">
                        <span className="text-blue-600">{actorName}</span> wants to {actionIsDouble ? "Double " : ""}{actionName}
                        {cardClaimed && (
                            <span className="text-gray-500 text-sm">
                                {" "}
                                (claiming {actionIsDouble ? "Double " : ""}<span className="capitalize">{cardClaimed}</span>)
                            </span>
                        )}
                    </p>
                    {isWaukegan && actionType === ActionType.ASSASSINATE && (
                        <p className="text-xs text-red-500 mb-2">⚠ Dylan's Gambit: failing a Contessa bluff here loses ALL your cards</p>
                    )}
                    <div className="flex gap-3 justify-center flex-wrap">
                        {canChallenge && (
                            <button
                                onClick={() => respondToAction(ResponseType.CHALLENGE)}
                                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded font-semibold"
                            >
                                Challenge
                            </button>
                        )}
                        {canBlock && actionType === ActionType.FOREIGN_AID && (
                            <button
                                onClick={() => respondToAction(ResponseType.BLOCK, CardType.DUKE)}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded font-semibold"
                            >
                                Block (Duke)
                            </button>
                        )}
                        {canBlock && actionType === ActionType.ASSASSINATE && (
                            <>
                                {(!actionIsDouble || !isWaukegan) && (
                                    <button
                                        onClick={() => respondToAction(ResponseType.BLOCK, CardType.CONTESSA)}
                                        className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded font-semibold"
                                    >
                                        Block (Contessa)
                                    </button>
                                )}
                                {isWaukegan && (
                                    <button
                                        onClick={() => setDoubleContessaStep("pickTarget")}
                                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-5 py-2 rounded font-semibold"
                                    >
                                        Block (Double Contessa — redirect)
                                    </button>
                                )}
                            </>
                        )}
                        {canBlock && actionType === ActionType.STEAL && (
                            <>
                                <button
                                    onClick={() => respondToAction(ResponseType.BLOCK, CardType.AMBASSADOR)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded font-semibold"
                                >
                                    Block (Ambassador)
                                </button>
                                <button
                                    onClick={() => respondToAction(ResponseType.BLOCK, CardType.CAPTAIN)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded font-semibold"
                                >
                                    Block (Captain)
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => respondToAction(ResponseType.ALLOW)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2 rounded font-semibold"
                        >
                            Allow
                        </button>
                    </div>
                </div>
            );
        }

        // 5a. Waukegan coup — card type selection (after player was picked)
        if (coupTargetPlayerId && pendingActionType === ActionType.COUP && isWaukegan) {
            const targetPlayer = gameData.players.find((p) => p.id === coupTargetPlayerId);
            const cardTypes = [CardType.DUKE, CardType.ASSASSIN, CardType.CAPTAIN, CardType.AMBASSADOR, CardType.CONTESSA];
            return (
                <div className="p-4 text-center">
                    <p className="font-semibold text-red-600 mb-3">
                        Coup on <span className="font-bold">{targetPlayer?.name}</span> — which card are you targeting?
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap mb-3">
                        {cardTypes.map((card) => (
                            <button
                                key={card}
                                onClick={() => performAction(ActionType.COUP, coupTargetPlayerId, false, card)}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold capitalize text-sm"
                            >
                                {card}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { setCoupTargetPlayerId(null); }}
                        className="text-sm text-gray-500 underline"
                    >
                        Back
                    </button>
                </div>
            );
        }

        // 5b. Target selection mode
        if (pendingActionType) {
            return (
                <div className="p-4 text-center">
                    <p className="font-semibold text-blue-700 mb-2">
                        Select a target for{" "}
                        <span className="capitalize">
                            {isDoubleClaimMode ? "Double " : ""}{ACTION_LABELS[pendingActionType]}
                        </span>
                    </p>
                    <button
                        onClick={() => { setPendingActionType(null); setIsDoubleClaimMode(false); }}
                        className="text-sm text-gray-500 underline"
                    >
                        Cancel
                    </button>
                </div>
            );
        }

        // 6. My turn — action buttons
        if (isMyTurn) {
            return (
                <div className="p-4">
                    {mustCoup ? (
                        <p className="text-center text-red-600 font-semibold mb-2">
                            You have 10+ coins — you must Coup!
                        </p>
                    ) : (
                        <div className="flex items-center justify-center gap-3 mb-2">
                            <p className="text-center text-green-600 font-semibold">Your turn</p>
                            {isWaukegan && (
                                <button
                                    onClick={() => setIsDoubleClaimMode((prev) => !prev)}
                                    className={`text-xs px-3 py-1 rounded border font-semibold transition-colors ${
                                        isDoubleClaimMode
                                            ? "bg-yellow-400 border-yellow-600 text-gray-950"
                                            : "bg-gray-800 border-gray-600 text-gray-300 hover:border-yellow-400"
                                    }`}
                                >
                                    {isDoubleClaimMode ? "Double Claim ON" : "Double Claim OFF"}
                                </button>
                            )}
                        </div>
                    )}
                    <div className="flex justify-center gap-2 flex-wrap">
                        {!mustCoup && (
                            <>
                                {!(isWaukegan && myCoins >= 10) && (
                                    <button
                                        onClick={() => handleActionButtonClick(ActionType.INCOME)}
                                        className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
                                    >
                                        Income (+1)
                                    </button>
                                )}
                                {!(isWaukegan && myCoins >= 10) && (
                                    <button
                                        onClick={() => handleActionButtonClick(ActionType.FOREIGN_AID)}
                                        className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
                                    >
                                        Foreign Aid (+2)
                                    </button>
                                )}
                                <div className="border-l border-gray-300 mx-1" />
                                <button
                                    onClick={() => handleActionButtonClick(ActionType.TAX)}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded text-sm"
                                >
                                    {isDoubleClaimMode && isWaukegan ? "Double Duke (+5)" : "Tax — Duke (+3)"}
                                </button>
                                <button
                                    onClick={() => handleActionButtonClick(ActionType.STEAL)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                                >
                                    {isDoubleClaimMode && isWaukegan ? "Double Captain (steal 3)" : "Steal — Captain"}
                                </button>
                                <button
                                    onClick={() => handleActionButtonClick(ActionType.ASSASSINATE)}
                                    disabled={myCoins < 3}
                                    className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white px-4 py-2 rounded text-sm"
                                >
                                    {isDoubleClaimMode && isWaukegan ? "Double Assassin (-3)" : "Assassinate (-3)"}
                                </button>
                                <button
                                    onClick={() => handleActionButtonClick(ActionType.EXCHANGE)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded text-sm"
                                >
                                    {isDoubleClaimMode && isWaukegan ? "Double Ambassador (3 cards)" : "Exchange — Ambassador"}
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => handleActionButtonClick(ActionType.COUP)}
                            disabled={myCoins < 7}
                            className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded text-sm font-semibold"
                        >
                            Coup (-7)
                        </button>
                    </div>
                </div>
            );
        }

        // 7. Waiting / ended
        if (phase === GamePhase.ENDED || phase === GamePhase.WAITING) {
            const winner = gameData.winner;
            const isHost = myId === gameData.hostPlayerId;

            const resetGame = () => {
                if (!socket) return;
                socket.emit("reset-game", { gameCode: gameData.code }, (res: { success: boolean }) => {
                    if (!res.success) console.error("Reset failed");
                });
            };

            const startGame = () => {
                if (!socket) return;
                socket.emit("start-game", { gameCode: gameData.code }, (res: { success: boolean }) => {
                    if (!res.success) console.error("Failed to start game");
                });
            };

            if (phase === GamePhase.WAITING) {
                return (
                    <div className="p-4 text-center flex flex-col items-center gap-3">
                        <p className="text-sm text-gray-400">Waiting for host to start the next game...</p>
                        {isHost && (
                            <button
                                onClick={startGame}
                                className="bg-white text-gray-950 font-semibold px-6 py-2.5 rounded hover:bg-gray-200 transition-colors text-sm"
                            >
                                Start Game
                            </button>
                        )}
                    </div>
                );
            }

            return (
                <div className="p-4 text-center flex flex-col items-center gap-4">
                    <p className="text-xl font-bold">
                        {winner?.id === myId ? "You won!" : `${winner?.name ?? "Someone"} wins!`}
                    </p>
                    <button
                        onClick={resetGame}
                        className="bg-white text-gray-950 font-semibold px-6 py-2.5 rounded hover:bg-gray-200 transition-colors text-sm"
                    >
                        New Game
                    </button>
                </div>
            );
        }

        return (
            <div className="p-4 text-center text-gray-500">
                Waiting for <span className="font-semibold">{gameData.currentPlayer?.name}</span> to take their turn...
            </div>
        );
    };

    const isTargetSelectionMode = !!pendingActionType && !coupTargetPlayerId;

    return (
        <div className="flex flex-col h-screen bg-gray-950 text-white">
            {/* Header */}
            <div
                id="nav"
                className="flex items-center justify-between px-3 md:px-5 py-2 bg-gray-900 border-b border-gray-800 shrink-0"
            >
                <Link
                    to="/"
                    className="text-xl md:text-2xl font-bold tracking-tight text-white hover:text-gray-300 transition-colors"
                >
                    bluph
                </Link>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-base md:text-lg font-bold text-yellow-400 tracking-widest bg-gray-800 px-2 md:px-3 py-1 rounded">
                        {gameData.code}
                    </span>
                    {gameData.ruleset === Ruleset.WAUKEGAN && (
                        <span className="text-xs font-semibold bg-yellow-900/50 border border-yellow-700 text-yellow-300 px-2 py-0.5 rounded hidden sm:inline">
                            Waukegan
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                    <div className="text-xs md:text-sm text-gray-300 font-medium hidden sm:block">{myPlayer?.name}</div>
                    <div className="flex items-center gap-1 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-xs md:text-sm font-semibold px-1.5 md:px-2 py-0.5 rounded">
                        <span>{myPlayer?.coins ?? 0}</span>
                        <span className="text-xs">coins</span>
                    </div>
                    <div className="flex items-center gap-1 bg-blue-900/50 border border-blue-700 text-blue-300 text-xs md:text-sm font-semibold px-1.5 md:px-2 py-0.5 rounded">
                        <span>{myCards.length}</span>
                        <span className="text-xs">cards</span>
                    </div>
                    <button
                        onClick={() => setShowFeed((prev) => !prev)}
                        className="md:hidden bg-gray-800 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded hover:bg-gray-700"
                    >
                        Chat
                    </button>
                </div>
            </div>

            <div className="flex h-full w-full overflow-hidden">
                {/* Action Feed — mobile: full-screen overlay, desktop: sidebar */}
                <div
                    id="feed"
                    className={`flex-col overflow-hidden bg-gray-900 border-r border-gray-800
                        ${showFeed ? "flex fixed inset-0 z-50" : "hidden md:flex md:w-64 md:relative md:inset-auto md:z-auto"}`}
                >
                    <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Feed</span>
                        <button
                            onClick={() => setShowFeed(false)}
                            className="md:hidden text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
                        {(() => {
                            const actionItems = [...gameData.actionHistory].map((a) => ({
                                kind: "action" as const,
                                ts: new Date(a.timestamp).getTime(),
                                data: a,
                            }));
                            const chatItems = chatMessages.map((m) => ({
                                kind: "chat" as const,
                                ts: new Date(m.timestamp).getTime(),
                                data: m,
                            }));
                            const merged = [...actionItems, ...chatItems].sort((a, b) => a.ts - b.ts).slice(-40);

                            if (merged.length === 0)
                                return <div className="text-xs text-gray-600 text-center py-4">No activity yet</div>;

                            const fmt = (ts: number) =>
                                new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                            return merged.map((item, i) => {
                                if (item.kind === "action") {
                                    const action = item.data;
                                    const actorName = getPlayerName(action.playerId);
                                    const targetName = action.targetId ? getPlayerName(action.targetId) : "";
                                    const label = ACTION_HISTORY_LABELS[action.type];
                                    const colorClass = ACTION_COLORS[action.type];
                                    return (
                                        <div
                                            key={action.id ?? i}
                                            className={`text-xs text-gray-800 rounded border-l-2 px-2 py-1.5 ${colorClass}`}
                                        >
                                            <div className="flex items-start justify-between gap-1">
                                                <span>
                                                    <span className="font-bold text-gray-900">{actorName}</span>{" "}
                                                    <span className="text-gray-600">{label}</span>
                                                    {targetName && (
                                                        <span className="font-bold text-gray-900"> {targetName}</span>
                                                    )}
                                                </span>
                                                <span className="text-gray-400 shrink-0 mt-0.5">{fmt(item.ts)}</span>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    const msg = item.data;
                                    const isMe = msg.playerId === myId;
                                    return (
                                        <div
                                            key={msg.id}
                                            className="text-xs rounded border-l-2 border-l-gray-600 bg-gray-800 px-2 py-1.5"
                                        >
                                            <div className="flex items-start justify-between gap-1">
                                                <span>
                                                    <span
                                                        className={`font-bold ${isMe ? "text-blue-400" : "text-gray-300"}`}
                                                    >
                                                        {msg.playerName}
                                                    </span>
                                                    <span className="text-gray-500">: </span>
                                                    <span className="text-gray-200">{msg.text}</span>
                                                </span>
                                                <span className="text-gray-500 shrink-0 mt-0.5">{fmt(item.ts)}</span>
                                            </div>
                                        </div>
                                    );
                                }
                            });
                        })()}
                        <div ref={feedBottomRef} />
                    </div>
                    {/* Chat input */}
                    <div className="border-t border-gray-800 p-2 flex gap-1.5">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendChat()}
                            placeholder="Message..."
                            maxLength={200}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                        />
                        <button
                            onClick={sendChat}
                            disabled={!chatInput.trim()}
                            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-xs px-2 py-1 rounded"
                        >
                            Send
                        </button>
                    </div>
                </div>

                <div className="flex flex-col w-full h-full overflow-hidden">
                    {/* Table */}
                    <div id="table" className="w-full relative flex items-center justify-center flex-1 bg-gray-950">
                        <div className="w-[90%] h-[90%] bg-green-800 rounded-full border-8 border-yellow-600 shadow-2xl relative overflow-visible">
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                <div className="text-white text-lg font-bold">Bluph</div>
                                {pendingAction && (
                                    <div className="text-white text-xs bg-black/30 rounded px-2 py-1 max-w-[60%] text-center">
                                        {ACTION_LABELS[pendingAction.action.type]}
                                        {phase === GamePhase.BLOCK_PHASE && pendingAction.block && (
                                            <span className="block text-orange-300">
                                                → Blocked by {getPlayerName(pendingAction.block.blockerId)}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {gameData.players.map((player, index) => {
                                const isMe = player.id === myId;
                                const isCurrentTurnPlayer = player.id === gameData.currentPlayer?.id;
                                const isValidTarget = isTargetSelectionMode && !isMe && player.isAlive;
                                const faceUpCards = isMe ? ((player as PlayerState).cards ?? []) : null;
                                const cardCount = faceUpCards ? faceUpCards.length : ((player as any).cardCount ?? 0);
                                const position = getPlayerPosition(index, gameData.players.length);

                                const CARD_COLORS: Record<string, string> = {
                                    duke: "bg-yellow-600 border-yellow-400 text-white",
                                    assassin: "bg-purple-700 border-purple-400 text-white",
                                    captain: "bg-blue-600 border-blue-400 text-white",
                                    ambassador: "bg-emerald-600 border-emerald-400 text-white",
                                    contessa: "bg-red-600 border-red-400 text-white",
                                };

                                const renderCards = () => {
                                    if (faceUpCards && faceUpCards.length > 0) {
                                        return faceUpCards.map((card) => (
                                            <div
                                                key={card.id}
                                                className={`w-16 h-22 rounded-lg border-2 shadow-lg flex flex-col items-center justify-center gap-0.5 ${CARD_COLORS[card.type] ?? "bg-gray-700 border-gray-500 text-white"}`}
                                            >
                                                <span className="text-[10px] font-bold capitalize leading-tight text-center px-0.5">
                                                    {card.type}
                                                </span>
                                            </div>
                                        ));
                                    }
                                    if (cardCount === 0) {
                                        return (
                                            <div className="w-16 h-22 rounded-lg border border-dashed border-gray-600 opacity-30" />
                                        );
                                    }
                                    return Array.from({ length: cardCount }).map((_, i) => (
                                        <div
                                            key={i}
                                            className="w-16 h-22 rounded-lg border-2 border-gray-600 bg-gray-800 shadow-lg flex items-center justify-center"
                                        >
                                            <div className="w-7 h-11 rounded border border-gray-500 opacity-50 flex items-center justify-center">
                                                <div className="w-3 h-3 rounded-full border border-gray-400 opacity-60" />
                                            </div>
                                        </div>
                                    ));
                                };

                                return (
                                    <div
                                        key={player.id || index}
                                        style={position}
                                        className="absolute z-10"
                                        onClick={() => isValidTarget && handleTargetClick(player.id)}
                                    >
                                        <div
                                            className={`flex items-center gap-2 ${!player.isAlive ? "opacity-40" : ""} ${isValidTarget ? "cursor-pointer" : ""}`}
                                        >
                                            {/* Avatar + name + coins */}
                                            <div className="flex flex-col items-center gap-1">
                                                <div
                                                    className={`
                                                        w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg transition-all
                                                        ${isMe ? "bg-blue-500 ring-4 ring-blue-300" : "bg-gray-600"}
                                                        ${isCurrentTurnPlayer && phase === GamePhase.PLAYING ? "ring-4 ring-yellow-400" : ""}
                                                        ${isValidTarget ? "ring-4 ring-red-400 scale-110 bg-red-600" : ""}
                                                    `}
                                                >
                                                    {player.name.charAt(0).toUpperCase()}
                                                </div>

                                                <div
                                                    className={`px-2 py-0.5 rounded-full text-xs font-medium shadow-md whitespace-nowrap ${isMe ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"} ${!player.isAlive ? "line-through" : ""}`}
                                                >
                                                    {player.name}
                                                    {player.id === gameData.hostPlayerId && " 👑"}
                                                    {isMe && " (You)"}
                                                </div>

                                                <div className="text-xs text-yellow-400 font-semibold">
                                                    {player.coins} coins
                                                </div>
                                            </div>

                                            {/* Cards */}
                                            <div className="flex gap-1">{renderCards()}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions bar */}
                    <div id="actions" className="bg-gray-900 border-t border-gray-800 shrink-0">
                        {renderActionBar()}
                    </div>
                </div>
            </div>
        </div>
    );
}
