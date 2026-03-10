import { Game } from "../game/Game.js";
import { Player } from "../game/Player.js";
import { GamePhase, Ruleset } from "../../shared/types.js";
export class GameService {
    private games = new Map<string, Game>();

    public createGame(hostPlayerId: string, ruleset: Ruleset = Ruleset.STANDARD): string {
        const code = this.generateGameCode();
        const game = new Game(code, hostPlayerId, ruleset);
        this.games.set(code, game);
        return code;
    }

    public joinGame(gameCode: string, player: Player): boolean {
        const game = this.games.get(gameCode);
        if (!game) return false;
        return game.addPlayer(player);
    }

    public getGame(gameCode: string): Game | null {
        return this.games.get(gameCode) || null;
    }

    public removeGame(gameCode: string): void {
        this.games.delete(gameCode);
    }

    public cleanupInactiveGames(): void {
        const now = new Date();
        for (const [code, game] of this.games) {
            const timeSinceCreated = now.getTime() - game.createdAt.getTime();
            if (game.phase === GamePhase.ENDED || timeSinceCreated > 24 * 60 * 60 * 1000) {
                this.games.delete(code);
            }
        }
    }

    private generateGameCode(): string {
        let code: string;
        do {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (this.games.has(code)); // Ensure uniqueness

        return code;
    }
}
