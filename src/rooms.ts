import { Socket } from "socket.io";
import { CreateParts } from "./deviverParts";

export interface Player {
  socketId: string;
  playerNumber: number; // 1 a 4
  hand: CreateParts[];
  connected: boolean; // Rastreia se o jogador está conectado
  joinedAt: number;   // Timestamp de quando entrou (segurança anti-duplicata)
}

export interface Room {
  id: string;
  players: Player[];
  status: "waiting" | "full" | "playing" | "ended";
  currentTurn: number | null;
  tableEnds: number[];
  tablePieces: any[];
  isPassing: boolean;
  consecutivePasses: number;
  gameStartTimer: ReturnType<typeof setTimeout> | null; // Controle do timer de início
  passTimer: ReturnType<typeof setTimeout> | null;      // Controle do timer de passe
}

const MAX_PLAYERS = 4;
const rooms = new Map<string, Room>();

// ─── Índice reverso: socketId → roomId ───────────────────────────────────────
// Garante que um socket nunca entre em duas salas diferentes
const socketToRoom = new Map<string, string>();

function findOrCreateRoom(): Room {
  for (const room of rooms.values()) {
    if (room.status === "waiting" && room.players.length < MAX_PLAYERS) {
      return room;
    }
  }

  const newRoom: Room = {
    id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    players: [],
    status: "waiting",
    currentTurn: null,
    tableEnds: [],
    tablePieces: [],
    isPassing: false,
    consecutivePasses: 0,
    gameStartTimer: null,
    passTimer: null,
  };
  rooms.set(newRoom.id, newRoom);
  return newRoom;
}

// ─── joinRoom ─────────────────────────────────────────────────────────────────
export function joinRoom(socket: Socket): { room: Room; player: Player } | null {
  // SEGURANÇA 1: Impede que o mesmo socket entre em sala duas vezes
  if (socketToRoom.has(socket.id)) {
    const existingRoomId = socketToRoom.get(socket.id)!;
    const existingRoom = rooms.get(existingRoomId);
    if (existingRoom) {
      const existingPlayer = existingRoom.players.find(p => p.socketId === socket.id);
      if (existingPlayer) {
        console.warn(`[SEGURANÇA] Socket ${socket.id} tentou entrar em sala novamente. Ignorado.`);
        return { room: existingRoom, player: existingPlayer };
      }
    }
    // Sala sumiu — limpa o índice e deixa continuar
    socketToRoom.delete(socket.id);
  }

  const room = findOrCreateRoom();

  // SEGURANÇA 2: Não permite entrar em sala que não está aguardando
  if (room.status !== "waiting") {
    console.warn(`[SEGURANÇA] Socket ${socket.id} tentou entrar em sala ${room.id} com status "${room.status}". Ignorado.`);
    return null;
  }

  const occupiedNumbers = room.players.map(p => p.playerNumber);
  let playerNumber = 1;
  for (let i = 1; i <= MAX_PLAYERS; i++) {
    if (!occupiedNumbers.includes(i)) {
      playerNumber = i;
      break;
    }
  }

  const player: Player = {
    socketId: socket.id,
    playerNumber,
    hand: [],
    connected: true,
    joinedAt: Date.now(),
  };

  room.players.push(player);
  socket.join(room.id);
  socketToRoom.set(socket.id, room.id); // Registra no índice reverso

  if (room.players.length === MAX_PLAYERS) {
    room.status = "full";
  }

  return { room, player };
}

// ─── leaveRoom ────────────────────────────────────────────────────────────────
export function leaveRoom(socket: Socket): { room: Room | undefined; wasPlaying: boolean } {
  const roomId = socketToRoom.get(socket.id);
  socketToRoom.delete(socket.id);

  if (!roomId) return { room: undefined, wasPlaying: false };

  const room = rooms.get(roomId);
  if (!room) return { room: undefined, wasPlaying: false };

  const index = room.players.findIndex(p => p.socketId === socket.id);
  if (index === -1) return { room: undefined, wasPlaying: false };

  const wasPlaying = room.status === "playing";

  room.players.splice(index, 1);
  socket.leave(room.id);

  // SEGURANÇA 3: Cancela timers pendentes para evitar execução com estado inválido
  if (room.gameStartTimer) {
    clearTimeout(room.gameStartTimer);
    room.gameStartTimer = null;
  }
  if (room.passTimer) {
    clearTimeout(room.passTimer);
    room.passTimer = null;
    room.isPassing = false; // Libera trava de passe
  }

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return { room: undefined, wasPlaying };
  }

  room.status = "waiting";
  return { room, wasPlaying };
}

// ─── Próximo turno válido ─────────────────────────────────────────────────────
// SEGURANÇA 4: Nunca aponta turno para um jogador que não existe mais
export function nextValidTurn(room: Room): number | null {
  if (room.players.length === 0) return null;

  const connectedNumbers = room.players.map(p => p.playerNumber).sort((a, b) => a - b);
  if (connectedNumbers.length === 0) return null;

  if (room.currentTurn === null) return connectedNumbers[0];

  // Encontra o próximo número de jogador existente após o atual (ordem circular)
  const higherOrEqual = connectedNumbers.filter(n => n > room.currentTurn!);
  if (higherOrEqual.length > 0) return higherOrEqual[0];
  return connectedNumbers[0]; // Volta ao início
}

// ─── Getters seguros ──────────────────────────────────────────────────────────
export function findRoomBySocket(socketId: string): Room | undefined {
  const roomId = socketToRoom.get(socketId);
  if (!roomId) return undefined;
  return rooms.get(roomId);
}

export function findRoomById(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

// ─── Snapshot de debug (para logs) ───────────────────────────────────────────
export function getRoomsSnapshot(): object[] {
  return Array.from(rooms.values()).map(r => ({
    id: r.id,
    status: r.status,
    players: r.players.map(p => ({ number: p.playerNumber, socketId: p.socketId })),
    currentTurn: r.currentTurn,
  }));
}