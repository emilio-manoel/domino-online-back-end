import { Socket } from "socket.io";
import { CreateParts } from "./deviverParts";

export interface Player {
  socketId: string;
  playerNumber: number; // 1 a 4
  hand: CreateParts[];
}

export interface Room {
  id: string;
  players: Player[];
  status: "waiting" | "full" | "playing";
  currentTurn: number | null;
  tableEnds: number[]; // Pontas abertas na mesa. Vazio se for a 1a jogada
  tablePieces: any[]; // Rastreamento simples das peças na mesa
  isPassing: boolean;
  consecutivePasses: number; // Para detectar empate
}

const MAX_PLAYERS = 4;
const rooms = new Map<string, Room>();

// Acha uma sala com vaga ou cria uma nova
function findOrCreateRoom(): Room {
  for (const room of rooms.values()) {
    if (room.status === "waiting" && room.players.length < MAX_PLAYERS) {
      return room;
    }
  }

  const newRoom: Room = {
    id: `room-${Date.now()}`,
    players: [],
    status: "waiting",
    currentTurn: null,
    tableEnds: [],
    tablePieces: [],
    isPassing: false,
    consecutivePasses: 0
  };
  rooms.set(newRoom.id, newRoom);
  return newRoom;
}

export function joinRoom(socket: Socket): { room: Room; player: Player } {
  const room = findOrCreateRoom();

  // Encontra o primeiro número de jogador disponível (de 1 a 4) que não está ocupado
  const occupiedNumbers = room.players.map((p) => p.playerNumber);
  let playerNumber = 1;
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!occupiedNumbers.includes(i)) {
      playerNumber = i;
      break;
    }
  }

  const player: Player = { socketId: socket.id, playerNumber, hand: [] };

  room.players.push(player);
  socket.join(room.id);

  if (room.players.length === MAX_PLAYERS) {
    room.status = "full";
  }

  return { room, player };
}

export function leaveRoom(socket: Socket): Room | undefined {
  for (const [roomId, room] of rooms.entries()) {
    const index = room.players.findIndex((p) => p.socketId === socket.id);
    if (index !== -1) {
      room.players.splice(index, 1);
      socket.leave(room.id);

      // Se a sala ficou vazia, remove ela do mapa
      if (room.players.length === 0) {
        rooms.delete(roomId);
        return undefined;
      }

      room.status = "waiting";
      return room;
    }
  }
  return undefined;
}

export function findRoomBySocket(socketId: string): Room | undefined {
  for (const room of rooms.values()) {
    if (room.players.some((p) => p.socketId === socketId)) {
      return room;
    }
  }
  return undefined;
}