import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export const useSocket = (serverUrl: string) => {
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const newSocket = io(serverUrl, {
            transports: ["websocket", "polling"],
        });

        newSocket.on("game-started", () => {
            console.log("Game started");
        });

        newSocket.on("player-joined", () => {
            console.log("Player joined");
        });

        newSocket.on("player-disconnected", () => {
            console.log("Player disconnected");
        });

        newSocket.on("player-reconnected", () => {
            console.log("Player reconnected");
        });

        setSocket(newSocket);


        return () => {
            newSocket.disconnect();
        };
    }, [serverUrl]);

    return { socket };
};
