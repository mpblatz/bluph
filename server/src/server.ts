import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { PlayerService } from "./services/PlayerService.js";
import { GameService } from "./services/GameService.js";
import { registerGameHandlers } from "./socket/socketHandlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env.local") });
dotenv.config({ path: resolve(__dirname, "../../.env.local") });

const app = express();
const server = createServer(app);

const CLIENT_PORT = process.env.VITE_CLIENT_PORT || 8002;
const SERVER_PORT = process.env.VITE_SERVER_PORT || 8003;

const io = new Server(server, {
    cors: {
        origin: `http://localhost:${CLIENT_PORT}`,
        methods: ["GET", "POST"],
    },
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const playerService = new PlayerService();
const gameService = new GameService();

// Basic routes
app.get("/health", (req, res) => {
    res.json({ status: "Server is running!" });
});

// Socket.io handling
io.on("connection", (socket) => {
    registerGameHandlers(socket, io, gameService, playerService);

    socket.on("message", (data) => {
        console.log("Received message:", data);
        socket.emit("message", { message: `Server received: ${data.message}` });
    });
});

server.listen(SERVER_PORT, () => {
    console.log(`Bluph game server running on port ${SERVER_PORT}`);
    console.log(`Health check: http://localhost:${SERVER_PORT}/health`);
});
