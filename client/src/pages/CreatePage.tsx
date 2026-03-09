import { useEffect, useState, type ChangeEvent } from "react";
import { useSocket } from "../hooks/useSocket";
import type { GameState, PlayerState, PublicPlayerState } from "../../../shared/types";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export default function CreatePage() {
    const navigate = useNavigate();
    const { socket } = useSocket(`http://localhost:${import.meta.env.VITE_SERVER_PORT || 8003}`);
    const [name, setName] = useState<string>("");
    const [gameCode, setGameCode] = useState<string>("");
    const { gameData, setPlayerData, setGameData } = useGame();

    useEffect(() => {
        if (!socket) return;

        socket.on("player-joined", (data: { _gamePlayer: PublicPlayerState; gameState: GameState }) => {
            setGameData(data.gameState);
            console.log(`player joined - ${data.gameState}`);
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
                console.log("Create game response:", response);
            }
        );
    };

    const startGame = () => {
        console.log("handle start game here!");
        if (!socket) return;
        // Navigation happens via the game-started event handler to ensure game state is saved first
        socket.emit("start-game", { gameCode: gameCode }, (response: { success: boolean }) => {
            if (!response.success) {
                console.error("Failed to start game");
            }
        });
    };

    return gameCode ? (
        <div className="mt-40 flex flex-col items-center space-y-4 w-60 m-auto">
            <Link to="/" className="text-[100px]">
                bluph
            </Link>

            <div className="flex space-x-2 items-center">
                <p>game code:</p>
                <input type="text" value={gameCode} disabled className="border-1 w-24 text-center p-2 rounded-md" />
            </div>

            <hr className="w-full" />

            {gameData?.players && (
                <div className="flex flex-col space-y-2 w-full">
                    {gameData.players.map((player, index) => (
                        <div key={player.id || index} className="border-1 p-2 rounded-md">
                            {player.name} {gameData.hostPlayerId == player.id && "(host)"}
                        </div>
                    ))}
                </div>
            )}

            <button onClick={startGame} className="bg-black text-white w-full p-2 rounded-md">
                start
            </button>
        </div>
    ) : (
        <div className="mt-40 flex flex-col items-center space-y-2">
            <Link to="/" className="text-[100px]">
                bluph
            </Link>
            <div className="flex space-x-4">
                <input
                    type="text"
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                    placeholder="username"
                    className="border-1 rounded-md p-2"
                />
                <button onClick={createGame} className="border-1 p-2 rounded-md">
                    Create Game
                </button>
            </div>
        </div>
    );
}
