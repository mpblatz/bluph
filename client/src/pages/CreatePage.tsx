import { useEffect, useState, type ChangeEvent } from "react";
import { useSocket } from "../hooks/useSocket";
import type { GameState, PlayerState, PublicPlayerState } from "../../../server/shared/types";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export default function CreatePage() {
    const navigate = useNavigate();
    const { socket } = useSocket(import.meta.env.VITE_SERVER_URL || `http://localhost:${import.meta.env.VITE_SERVER_PORT || 8003}`);
    const [name, setName] = useState<string>("");
    const [gameCode, setGameCode] = useState<string>("");
    const { gameData, setPlayerData, setGameData } = useGame();

    useEffect(() => {
        if (!socket) return;

        socket.on("player-joined", (data: { _gamePlayer: PublicPlayerState; gameState: GameState }) => {
            setGameData(data.gameState);
        });

        socket.on("game-started", (data: GameState) => {
            setGameData(data);
            navigate("/game");
        });

        return () => {
            socket.off("player-joined");
            socket.off("game-started");
        };
    }, [socket]);

    const createGame = () => {
        if (!socket || !name) return;
        socket.emit(
            "create-game",
            { playerName: name },
            (response: { success: boolean; gameCode: string; gameState: GameState; playerState: PlayerState }) => {
                setGameCode(response.gameCode);
                setGameData(response.gameState);
                setPlayerData(response.playerState);
            },
        );
    };

    const startGame = () => {
        if (!socket) return;
        socket.emit("start-game", { gameCode: gameCode }, (response: { success: boolean }) => {
            if (!response.success) console.error("Failed to start game");
        });
    };

    return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center">
            <div className="flex flex-col items-center gap-8 w-80">
                <Link
                    to="/"
                    className="text-5xl font-bold tracking-tight text-white hover:text-gray-300 transition-colors"
                >
                    bluph
                </Link>

                {gameCode ? (
                    <>
                        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col gap-4">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Game Code</p>
                                <p className="font-mono text-3xl font-bold text-yellow-400 tracking-widest">
                                    {gameCode}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">Share this with your friends</p>
                            </div>

                            <hr className="border-gray-800" />

                            <div className="flex flex-col gap-1.5">
                                <p className="text-xs text-gray-500 uppercase tracking-widest">Players</p>
                                {gameData?.players?.map((player, index) => (
                                    <div
                                        key={player.id || index}
                                        className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                                    >
                                        <span>{player.name}</span>
                                        {gameData.hostPlayerId === player.id && (
                                            <span className="text-xs text-yellow-500 font-medium">host</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={startGame}
                            className="w-full bg-white text-gray-950 font-semibold py-2.5 rounded hover:bg-gray-200 transition-colors text-sm"
                        >
                            Start Game
                        </button>
                    </>
                ) : (
                    <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col gap-3">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Create a new game</p>
                        <input
                            type="text"
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && createGame()}
                            placeholder="Your name"
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                        />
                        <button
                            onClick={createGame}
                            disabled={!name.trim()}
                            className="bg-white text-gray-950 font-semibold py-2.5 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors text-sm"
                        >
                            Create Game
                        </button>
                        <Link
                            to="/"
                            className="text-center text-xs text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            Back
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
