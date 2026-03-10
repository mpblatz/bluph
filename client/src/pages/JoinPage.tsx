import { useEffect, useState, type ChangeEvent } from "react";
import { useSocket } from "../hooks/useSocket";
import { type GameState, type PlayerState, type PublicPlayerState } from "../../../server/shared/types";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export default function JoinPage() {
    const navigate = useNavigate();
    const { socket } = useSocket(import.meta.env.VITE_SERVER_URL || `http://localhost:${import.meta.env.VITE_SERVER_PORT || 8003}`);
    const [name, setName] = useState<string>("");
    const [gameCode, setGameCode] = useState<string>("");
    const { gameData, setPlayerData, setGameData } = useGame();

    useEffect(() => {
        if (!socket) return;

        socket.on("player-joined", (data: { gameState: GameState; _playerState: PublicPlayerState }) => {
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

    const joinGame = () => {
        if (!socket || !name || !gameCode) return;
        socket.emit(
            "join-game",
            { playerName: name, gameCode: gameCode },
            (response: { success: boolean; gameCode: string; gameState: GameState; playerState: PlayerState }) => {
                if (response.success) {
                    setGameData(response.gameState);
                    setPlayerData(response.playerState);
                } else {
                    setGameCode("");
                    console.log("Failed to join game");
                }
            },
        );
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

                {gameData?.code ? (
                    <>
                        <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col gap-4">
                            <div className="text-center">
                                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Game Code</p>
                                <p className="font-mono text-3xl font-bold text-yellow-400 tracking-widest">
                                    {gameData.code}
                                </p>
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

                            <p className="text-xs text-gray-500 text-center">Waiting for the host to start...</p>
                        </div>
                    </>
                ) : (
                    <div className="w-full bg-gray-900 border border-gray-800 rounded-lg p-5 flex flex-col gap-3">
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Join a game</p>
                        <input
                            type="text"
                            value={name}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                            placeholder="Your name"
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                        />
                        <input
                            type="text"
                            value={gameCode}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setGameCode(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && joinGame()}
                            placeholder="Game code"
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 font-mono tracking-widest uppercase"
                        />
                        <button
                            onClick={joinGame}
                            disabled={!name.trim() || !gameCode.trim()}
                            className="bg-white text-gray-950 font-semibold py-2.5 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors text-sm"
                        >
                            Join Game
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
