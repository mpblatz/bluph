import { useEffect, useState, type ChangeEvent } from "react";
import { useSocket } from "../hooks/useSocket";
import { type GameState, type PlayerState, type PublicPlayerState } from "../../../shared/types";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "../context/GameContext";

export default function JoinPage() {
    const navigate = useNavigate();
    const { socket } = useSocket(`http://localhost:${import.meta.env.VITE_SERVER_PORT || 8003}`);
    const [name, setName] = useState<string>("");
    const [gameCode, setGameCode] = useState<string>("");
    const { gameData, setPlayerData, setGameData } = useGame();

    useEffect(() => {
        if (!socket) return;

        socket.on("player-joined", (data: { gameState: GameState; _playerState: PublicPlayerState }) => {
            setGameData(data.gameState);
            console.log(`player joined - ${data}`);
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

                console.log("Join game response:", response);
            }
        );
    };

    const readyUp = () => {
        console.log("handle ready up here!");
    };

    return gameData?.code ? (
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

            <button onClick={readyUp} className="bg-black text-white w-full p-2 rounded-md">
                ready
            </button>
        </div>
    ) : (
        <div className="mt-40 flex flex-col items-center space-y-2">
            <Link to="/" className="text-[100px]">
                bluph
            </Link>
            <div className="flex flex-col space-y-4">
                <div className="flex space-x-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                        placeholder="username"
                        className="border-1 rounded-md p-2"
                    />
                    <input
                        type="text"
                        value={gameCode}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setGameCode(e.target.value)}
                        placeholder="game code"
                        className="border-1 rounded-md p-2"
                    />
                </div>
                <button onClick={joinGame} className="border-1 p-2 rounded-md">
                    Join Game
                </button>
            </div>
        </div>
    );
}
