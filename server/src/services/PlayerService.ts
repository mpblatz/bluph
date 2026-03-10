import { Player } from "../game/Player.js";

export class PlayerService {
    private players = new Map<string, Player>();
    private socketToPlayer = new Map<string, string>(); // socketId -> playerId
    private playerToGame = new Map<string, string>(); // playerId -> gameCode

    public createPlayer(name: string, socketId: string): Player {
        const playerId = crypto.randomUUID();
        const player = new Player(playerId, name, socketId);
        this.players.set(playerId, player);
        this.socketToPlayer.set(socketId, playerId);
        return player;
    }

    public getPlayerBySocket(socketId: string): Player | null {
        const playerId = this.socketToPlayer.get(socketId);
        return playerId ? this.players.get(playerId) || null : null;
    }

    public updatePlayerSocket(playerId: string, newSocketId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            // Remove old socket mapping
            this.socketToPlayer.delete(player.socketId);
            // Update player and add new mapping
            player.socketId = newSocketId;
            this.socketToPlayer.set(newSocketId, playerId);
        }
    }

    public removePlayer(playerId: string): void {
        const player = this.players.get(playerId);
        if (player) {
            this.socketToPlayer.delete(player.socketId);
            this.players.delete(playerId);
        }
    }

    public setPlayerGame(playerId: string, gameCode: string): void {
        this.playerToGame.set(playerId, gameCode);
    }

    public getPlayerGameCode(playerId: string): string | null {
        return this.playerToGame.get(playerId) || null;
    }

    public removePlayerFromGame(playerId: string): void {
        this.playerToGame.delete(playerId);
    }

    public getPlayersInGame(gameCode: string): string[] {
        return Array.from(this.playerToGame.entries())
            .filter(([_, code]) => code === gameCode)
            .map(([playerId, _]) => playerId);
    }
}
