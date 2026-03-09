import { Server, Socket } from "socket.io";
import { ResponseType } from "../../../shared/types";
import { Game } from "../game/Game";
import { GameService } from "../services/GameService";
import { PlayerService } from "../services/PlayerService";

function broadcastToGame(io: Server, game: Game, _playerService: PlayerService): void {
    io.to(game.code).emit("game-state-update", { gameState: game.getGameState() });
}

function handleCreateGame(socket: Socket, _io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { playerName } = data;
            if (!playerName || typeof playerName !== "string") {
                return callback({ success: false, error: "Invalid player name" });
            }
            const player = playerService.createPlayer(playerName, socket.id);
            const gameCode = gameService.createGame(player.id);
            const game = gameService.getGame(gameCode);
            if (game && game.addPlayer(player)) {
                playerService.setPlayerGame(player.id, gameCode);
                socket.join(gameCode);
                callback({
                    success: true,
                    gameCode,
                    gameState: game.getGameState(player.id),
                    playerState: player.getPrivateState(),
                });
            } else {
                callback({ success: false, error: "Failed to create game" });
            }
        } catch (error) {
            console.error("Error creating game:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleJoinGame(socket: Socket, _io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { gameCode, playerName } = data;
            if (!gameCode || !playerName) {
                return callback({ success: false, error: "Missing required fields" });
            }
            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            const player = playerService.createPlayer(playerName, socket.id);
            if (game.addPlayer(player)) {
                playerService.setPlayerGame(player.id, gameCode);
                socket.join(gameCode);
                socket.to(gameCode).emit("player-joined", {
                    player: player.getPublicState(),
                    gameState: game.getGameState(),
                });
                callback({
                    success: true,
                    gameState: game.getGameState(player.id),
                    playerState: player.getPrivateState(),
                });
            } else {
                callback({ success: false, error: "Cannot join game" });
            }
        } catch (error) {
            console.error("Error joining game:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleStartGame(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { gameCode } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });
            if (game.hostPlayerId !== player.id) {
                return callback({ success: false, error: "Only host can start game" });
            }
            if (game.startGame()) {
                // Emit game-started to all players in the room so they can navigate to the game page
                io.to(gameCode).emit("game-started", game.getGameState());
                callback({ success: true });
            } else {
                callback({ success: false, error: "Cannot start game" });
            }
        } catch (error) {
            console.error("Error starting game:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleDisconnect(socket: Socket, _io: Server, _gameService: GameService, playerService: PlayerService) {
    return () => {
        try {
            const player = playerService.getPlayerBySocket(socket.id);
            if (player) {
                player.setConnectionStatus(false);
                player.updateLastSeen();
                const gameCode = playerService.getPlayerGameCode(player.id);
                if (gameCode) {
                    socket.to(gameCode).emit("player-disconnected", player.name);
                }
                console.log(`Player ${player.name} disconnected`);
            }
        } catch (error) {
            console.error("Error handling disconnect:", error);
        }
    };
}

function handleReconnect(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { playerId, gameCode } = data;
            if (!playerId || !gameCode) {
                return callback({ success: false, error: "Missing reconnection data" });
            }
            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            if (game.reconnectPlayer(playerId, socket.id)) {
                playerService.updatePlayerSocket(playerId, socket.id);
                socket.join(gameCode);
                // Broadcast personalized state to every player so no one loses their cards
                broadcastToGame(io, game, playerService);
                callback({ success: true, gameState: game.getGameState(playerId) });
            } else {
                callback({ success: false, error: "Cannot reconnect" });
            }
        } catch (error) {
            console.error("Error handling reconnect:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleGetGameState(socket: Socket, _io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { gameCode } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            callback({ success: true, gameCode, gameState: game.getGameState(player.id) });
        } catch (error) {
            console.error("Error getting game state:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handlePerformAction(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { actionType, targetId } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const gameCode = playerService.getPlayerGameCode(player.id);
            if (!gameCode) return callback({ success: false, error: "Not in a game" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            const result = game.declareAction(player.id, actionType, targetId);
            if (!result.success) return callback({ success: false, error: result.error });

            broadcastToGame(io, game, playerService);
            callback({ success: true, immediate: result.immediate });
        } catch (error) {
            console.error("Error performing action:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleRespondToAction(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { response, cardClaimed } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const gameCode = playerService.getPlayerGameCode(player.id);
            if (!gameCode) return callback({ success: false, error: "Not in a game" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            const result = game.respondToAction(player.id, response as ResponseType, cardClaimed);
            if (!result.success) return callback({ success: false, error: result.error });

            // When all players allowed, finalize the action
            if (result.event === "action_resolved") {
                game.finalizePendingResolution();
            }

            broadcastToGame(io, game, playerService);
            callback({ success: true, event: result.event });
        } catch (error) {
            console.error("Error responding to action:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleRespondToBlock(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { response } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const gameCode = playerService.getPlayerGameCode(player.id);
            if (!gameCode) return callback({ success: false, error: "Not in a game" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            const result = game.respondToBlock(player.id, response as ResponseType);
            if (!result.success) return callback({ success: false, error: result.error });

            // When all players allowed the block (block stands, action fails), finalize
            if (result.event === "block_stands") {
                game.finalizePendingResolution();
            }

            broadcastToGame(io, game, playerService);
            callback({ success: true, event: result.event });
        } catch (error) {
            console.error("Error responding to block:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleChooseCardToLose(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { cardId } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const gameCode = playerService.getPlayerGameCode(player.id);
            if (!gameCode) return callback({ success: false, error: "Not in a game" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            const result = game.loseCard(player.id, cardId);
            if (!result.success) return callback({ success: false, error: result.error });

            // finalizePendingResolution is called internally by loseCard when no more pending losses
            broadcastToGame(io, game, playerService);
            callback({ success: true, eliminated: result.eliminated, gameOver: result.gameOver });
        } catch (error) {
            console.error("Error choosing card to lose:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleChooseExchangeCards(socket: Socket, io: Server, gameService: GameService, playerService: PlayerService) {
    return async (data: any, callback: Function) => {
        try {
            const { keepCardIds } = data;
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const gameCode = playerService.getPlayerGameCode(player.id);
            if (!gameCode) return callback({ success: false, error: "Not in a game" });

            const game = gameService.getGame(gameCode);
            if (!game) return callback({ success: false, error: "Game not found" });

            const result = game.performExchange(player.id, keepCardIds);
            if (!result.success) return callback({ success: false, error: result.error });

            broadcastToGame(io, game, playerService);
            callback({ success: true });
        } catch (error) {
            console.error("Error choosing exchange cards:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

function handleChatMessage(socket: Socket, io: Server, _gameService: GameService, playerService: PlayerService) {
    return (data: any, callback: Function) => {
        try {
            const { text } = data;
            if (!text || typeof text !== "string" || text.trim().length === 0) {
                return callback({ success: false, error: "Invalid message" });
            }
            const player = playerService.getPlayerBySocket(socket.id);
            if (!player) return callback({ success: false, error: "Player not found" });

            const gameCode = playerService.getPlayerGameCode(player.id);
            if (!gameCode) return callback({ success: false, error: "Not in a game" });

            io.to(gameCode).emit("chat-message", {
                id: `${Date.now()}-${Math.random()}`,
                playerId: player.id,
                playerName: player.name,
                text: text.trim().slice(0, 200),
                timestamp: new Date(),
            });
            callback({ success: true });
        } catch (error) {
            console.error("Error sending chat message:", error);
            callback({ success: false, error: "Server error" });
        }
    };
}

export function registerGameHandlers(
    socket: Socket,
    io: Server,
    gameService: GameService,
    playerService: PlayerService
) {
    // Lobby events
    socket.on("create-game", handleCreateGame(socket, io, gameService, playerService));
    socket.on("join-game", handleJoinGame(socket, io, gameService, playerService));
    socket.on("start-game", handleStartGame(socket, io, gameService, playerService));

    // Game action events
    socket.on("perform-action", handlePerformAction(socket, io, gameService, playerService));
    socket.on("respond-to-action", handleRespondToAction(socket, io, gameService, playerService));
    socket.on("respond-to-block", handleRespondToBlock(socket, io, gameService, playerService));
    socket.on("choose-card-to-lose", handleChooseCardToLose(socket, io, gameService, playerService));
    socket.on("choose-exchange-cards", handleChooseExchangeCards(socket, io, gameService, playerService));

    // Chat events
    socket.on("send-chat-message", handleChatMessage(socket, io, gameService, playerService));

    // Connection events
    socket.on("disconnect", handleDisconnect(socket, io, gameService, playerService));
    socket.on("reconnect-to-game", handleReconnect(socket, io, gameService, playerService));
    socket.on("get-game-state", handleGetGameState(socket, io, gameService, playerService));

    console.log(`Registered game handlers for socket ${socket.id}`);
}
