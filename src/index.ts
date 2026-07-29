import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import {
  joinRoom,
  leaveRoom,
  findRoomBySocket,
  nextValidTurn,
  getRoomsSnapshot,
  type Room,
} from "./rooms";
import distributePieces, { createParts } from "./deviverParts";

const app = express();
app.use(cors());

const buildPlayerHandCounts = (room: Room) =>
  room.players.reduce<Record<number, number>>(
    (acc, p) => ({ ...acc, [p.playerNumber]: p.hand.length }),
    {}
  );

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "https://emilio-manoel.github.io/domino-online-front-end/",
    methods: ["GET", "POST"],
  },
  // SEGURANÇA: Força desconexão de sockets zumbis após 20s sem ping
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", rooms: getRoomsSnapshot() });
});

// ─────────────────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  

  // ── join-room ──────────────────────────────────────────────────────────────
  socket.on("join-room", () => {
    const result = joinRoom(socket);

    // SEGURANÇA: joinRoom retorna null se o socket já está em sala ou ela está cheia
    if (!result) {
      socket.emit("join-error", { message: "Não foi possível entrar na sala." });
      return;
    }

    const { room, player } = result;

    socket.emit("player-assigned", {
      playerNumber: player.playerNumber,
      roomId: room.id,
    });

    io.to(room.id).emit("room-update", {
      playersCount: room.players.length,
      maxPlayers: 4,
    });

    if (room.status === "full") {
      room.status = "playing";

      io.to(room.id).emit("room-closed", {
        message: "Sala fechada. O jogo vai começar!",
        countdown: 3,
      });

      // SEGURANÇA: Guarda o timer para poder cancelá-lo se alguém desconectar
      room.gameStartTimer = setTimeout(() => {
        room.gameStartTimer = null;

        // SEGURANÇA: Re-verifica se a sala ainda tem 4 jogadores conectados
        if (room.players.length < 4) {
          console.warn(`[SEGURANÇA] Sala ${room.id} perdeu jogadores antes do início. Abortando.`);
          room.status = "waiting";
          io.to(room.id).emit("game-aborted", {
            message: "Um jogador saiu antes do início. Aguardando novos jogadores…",
          });
          return;
        }

        const parts = createParts();
        const hands = distributePieces(parts);

        let startingPlayer = room.players[0].playerNumber;
        room.players.forEach((p, index) => {
          p.hand = hands[index];
          const hasOneOne = p.hand.some(piece => piece.sideA === 1 && piece.sideB === 1);
          if (hasOneOne) startingPlayer = p.playerNumber;
        });

        room.currentTurn = startingPlayer;
        room.tableEnds = [];
        room.tablePieces = [];
        room.isPassing = false;
        room.consecutivePasses = 0;

        io.to(room.id).emit("game-start", { roomId: room.id });

        room.players.forEach((p) => {
          io.to(p.socketId).emit("your-hand", { pieces: p.hand });
        });

        const playerHandCounts = buildPlayerHandCounts(room);

        io.to(room.id).emit("turn-update", {
          currentTurn: room.currentTurn,
          tableEnds: room.tableEnds,
          tablePieces: room.tablePieces,
          playerHandCounts,
        });
        io.to(room.id).emit("player-hand-counts", { playerHandCounts });
      }, 3000);
    }
  });

  // ── play-piece ─────────────────────────────────────────────────────────────
  socket.on("play-piece", (data: { pieceId: string; sideToPlay?: number }) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.status !== "playing" || room.isPassing) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.playerNumber !== room.currentTurn) return;

    const pieceIndex = player.hand.findIndex(p => p.id === data.pieceId);
    if (pieceIndex === -1) return;

    const piece = player.hand[pieceIndex];

    // ── Validação e atualização da mesa ───────────────────────────────────────
    if (room.tableEnds.length === 0) {
      room.tableEnds = [piece.sideA, piece.sideB];
      room.tablePieces.push(piece);
    } else {
      let played = false;

      if (data.sideToPlay !== undefined) {
        if (
          room.tableEnds[0] === data.sideToPlay &&
          (piece.sideA === data.sideToPlay || piece.sideB === data.sideToPlay)
        ) {
          const otherSide = piece.sideA === data.sideToPlay ? piece.sideB : piece.sideA;
          room.tableEnds[0] = otherSide;
          room.tablePieces.unshift({ id: piece.id, sideA: otherSide, sideB: data.sideToPlay });
          played = true;
        } else if (
          room.tableEnds[1] === data.sideToPlay &&
          (piece.sideA === data.sideToPlay || piece.sideB === data.sideToPlay)
        ) {
          const otherSide = piece.sideA === data.sideToPlay ? piece.sideB : piece.sideA;
          room.tableEnds[1] = otherSide;
          room.tablePieces.push({ id: piece.id, sideA: data.sideToPlay, sideB: otherSide });
          played = true;
        }
      }

      if (!played) {
        if (piece.sideA === room.tableEnds[1] || piece.sideB === room.tableEnds[1]) {
          const otherSide = piece.sideA === room.tableEnds[1] ? piece.sideB : piece.sideA;
          room.tablePieces.push({ id: piece.id, sideA: room.tableEnds[1], sideB: otherSide });
          room.tableEnds[1] = otherSide;
          played = true;
        } else if (piece.sideA === room.tableEnds[0] || piece.sideB === room.tableEnds[0]) {
          const otherSide = piece.sideA === room.tableEnds[0] ? piece.sideB : piece.sideA;
          room.tablePieces.unshift({ id: piece.id, sideA: otherSide, sideB: room.tableEnds[0] });
          room.tableEnds[0] = otherSide;
          played = true;
        }
      }

      if (!played) return;
    }

    player.hand.splice(pieceIndex, 1);
    room.consecutivePasses = 0;

    if (player.hand.length === 0) {
      io.to(room.id).emit("game-over", { winner: player.playerNumber });
      room.status = "waiting";
      return;
    }

    // SEGURANÇA: Usa nextValidTurn para garantir que o próximo turno existe
    room.currentTurn = nextValidTurn(room);

    socket.emit("your-hand", { pieces: player.hand });

    const playerHandCounts = buildPlayerHandCounts(room);

    io.to(room.id).emit("turn-update", {
      currentTurn: room.currentTurn,
      tableEnds: room.tableEnds,
      tablePieces: room.tablePieces,
      playerHandCounts,
    });
    io.to(room.id).emit("player-hand-counts", { playerHandCounts });
  });

  // ── pass-turn ──────────────────────────────────────────────────────────────
  socket.on("pass-turn", () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.status !== "playing" || room.isPassing) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.playerNumber !== room.currentTurn) return;

    room.isPassing = true;

    io.to(room.id).emit("player-passed", {
      playerNumber: player.playerNumber,
    });

    // SEGURANÇA: Guarda o timer para poder cancelá-lo se alguém desconectar
    room.passTimer = setTimeout(() => {
      room.passTimer = null;

      // SEGURANÇA: Re-verifica se a sala ainda está jogando
      if (room.status !== "playing") {
        room.isPassing = false;
        return;
      }

      room.consecutivePasses += 1;

      if (room.consecutivePasses >= 4) {
        io.to(room.id).emit("game-over", { tie: true });
        room.status = "waiting";
        room.isPassing = false;
        return;
      }

      // SEGURANÇA: Usa nextValidTurn para turno circular com jogadores reais
      room.currentTurn = nextValidTurn(room);
      room.isPassing = false;

      const playerHandCounts = buildPlayerHandCounts(room);

      io.to(room.id).emit("turn-update", {
        currentTurn: room.currentTurn,
        tableEnds: room.tableEnds,
        tablePieces: room.tablePieces,
        playerHandCounts,
      });
      io.to(room.id).emit("player-hand-counts", { playerHandCounts });
    }, 3000);
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    

    const room = findRoomBySocket(socket.id);
    if (!room) return;

    const leavingPlayer = room.players.find(p => p.socketId === socket.id);
    const playerNumber = leavingPlayer?.playerNumber;
    const wasPlaying = room.status === "playing";

    const { room: updatedRoom } = leaveRoom(socket);

    if (wasPlaying) {
      // Partida interrompida: notifica quem ficou
      if (updatedRoom) {
        io.to(updatedRoom.id).emit("game-aborted", {
          message: `Jogador ${playerNumber ?? "?"} abandonou. Aguardando novos jogadores…`,
          disconnectedPlayer: playerNumber,
        });
        io.to(updatedRoom.id).emit("room-update", {
          playersCount: updatedRoom.players.length,
          maxPlayers: 4,
        });
      }
    } else if (updatedRoom) {
      io.to(updatedRoom.id).emit("room-update", {
        playersCount: updatedRoom.players.length,
        maxPlayers: 4,
      });
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
});