// src/context/GameContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { GameState, PlayerState } from "../../../server/shared/types";

interface GameContextType {
    playerData: PlayerState | null;
    gameData: GameState | null;

    setPlayerData: (data: PlayerState) => void;
    setGameData: (data: GameState) => void;
    clearAllData: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = "bluph-game-data";

export function GameProvider({ children }: { children: ReactNode }) {
    const [gameData, setGameDataState] = useState<{
        playerState: PlayerState | null;
        gameState: GameState | null;
    }>(() => {
        // Load from sessionStorage on initialization
        try {
            const saved = sessionStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error("Error loading game data:", error);
        }

        return {
            playerState: null,
            gameState: null,
        };
    });

    // Save to sessionStorage whenever data changes
    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
        } catch (error) {
            console.error("Error saving game data:", error);
        }
    }, [gameData]);

    const setPlayerData = (data: PlayerState) => {
        setGameDataState((prev) => ({ ...prev, playerState: data }));
    };

    const setGameData = (data: GameState) => {
        setGameDataState((prev) => ({ ...prev, gameState: data }));
    };

    const clearAllData = () => {
        setGameDataState({
            playerState: null,
            gameState: null,
        });
        sessionStorage.removeItem(STORAGE_KEY);
    };

    const value: GameContextType = {
        playerData: gameData.playerState,
        gameData: gameData.gameState,
        setPlayerData,
        setGameData,
        clearAllData,
    };

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error("useGame must be used within a GameProvider");
    }
    return context;
};
