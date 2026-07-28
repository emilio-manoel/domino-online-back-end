import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { joinRoom, leaveRoom, findRoomBySocket } from "./rooms";
import distributePieces, { createParts, CreateParts } from "./deviverParts";

const app = express();
app.use(cors());

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "https://emilio-manoel.github.io/domino-online-front-end/", 
    methods: ["GET", "POST"],
  },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

io.on("connection", (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  socket.on("join-room", () => {
    const { room, player } = joinRoom(socket);

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

      setTimeout(() => {
        const parts = createParts();
        const hands = distributePieces(parts);

        // Atribuir mãos aos jogadores e encontrar quem tem a 1-1
        let startingPlayer = 1;
        room.players.forEach((p, index) => {
          p.hand = hands[index];
          
          // Verifica se o jogador tem a peça 1-1
          const hasOneOne = p.hand.some(piece => piece.sideA === 1 && piece.sideB === 1);
          if (hasOneOne) {
            startingPlayer = p.playerNumber;
          }
        });

        room.currentTurn = startingPlayer;
        room.tableEnds = [];
        room.tablePieces = [];
        room.isPassing = false;

        io.to(room.id).emit("game-start", { roomId: room.id });

        // Manda a mão para cada jogador e a mesa vazia
        room.players.forEach((p) => {
          io.to(p.socketId).emit("your-hand", {
            pieces: p.hand,
          });
        });

        // Atualiza o turno para todos
        io.to(room.id).emit("turn-update", {
          currentTurn: room.currentTurn,
          tableEnds: room.tableEnds,
          tablePieces: room.tablePieces
        });

      }, 3000);
    }
  });

  socket.on("play-piece", (data: { pieceId: string, sideToPlay?: number }) => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.isPassing) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.playerNumber !== room.currentTurn) return;

    const pieceIndex = player.hand.findIndex(p => p.id === data.pieceId);
    if (pieceIndex === -1) return;

    const piece = player.hand[pieceIndex];

    // Validação da jogada e atualização das pontas e peças visuais
    if (room.tableEnds.length === 0) {
      room.tableEnds = [piece.sideA, piece.sideB];
      room.tablePieces.push(piece);
    } else {
      let played = false;
      if (data.sideToPlay !== undefined) {
        if (room.tableEnds[0] === data.sideToPlay && (piece.sideA === data.sideToPlay || piece.sideB === data.sideToPlay)) {
          // Jogou na ponta esquerda
          const otherSide = piece.sideA === data.sideToPlay ? piece.sideB : piece.sideA;
          room.tableEnds[0] = otherSide;
          // Para visualmente ficar correto na esquerda: [otherSide, data.sideToPlay]
          room.tablePieces.unshift({ id: piece.id, sideA: otherSide, sideB: data.sideToPlay });
          played = true;
        } else if (room.tableEnds[1] === data.sideToPlay && (piece.sideA === data.sideToPlay || piece.sideB === data.sideToPlay)) {
          // Jogou na ponta direita
          const otherSide = piece.sideA === data.sideToPlay ? piece.sideB : piece.sideA;
          room.tableEnds[1] = otherSide;
          // Para visualmente ficar correto na direita: [data.sideToPlay, otherSide]
          room.tablePieces.push({ id: piece.id, sideA: data.sideToPlay, sideB: otherSide });
          played = true;
        }
      } 
      
      // Se não jogou ainda (fallback ou fallback para lado não especificado)
      if (!played) {
        if (piece.sideA === room.tableEnds[1] || piece.sideB === room.tableEnds[1]) {
           // Tenta na direita
           const otherSide = piece.sideA === room.tableEnds[1] ? piece.sideB : piece.sideA;
           room.tablePieces.push({ id: piece.id, sideA: room.tableEnds[1], sideB: otherSide });
           room.tableEnds[1] = otherSide;
           played = true;
        } else if (piece.sideA === room.tableEnds[0] || piece.sideB === room.tableEnds[0]) {
           // Tenta na esquerda
           const otherSide = piece.sideA === room.tableEnds[0] ? piece.sideB : piece.sideA;
           room.tablePieces.unshift({ id: piece.id, sideA: otherSide, sideB: room.tableEnds[0] });
           room.tableEnds[0] = otherSide;
           played = true;
        }
      }

      if (!played) return; // Jogada inválida, a peça não combina com nenhuma ponta
    }

    // Remove da mão
    player.hand.splice(pieceIndex, 1);
    room.consecutivePasses = 0; // Zerou os passes pois houve uma jogada

    if (player.hand.length === 0) {
      io.to(room.id).emit("game-over", { winner: player.playerNumber });
      room.status = "waiting"; // Reseta o status da sala
      return;
    }

    // Passa a vez
    if (room.currentTurn !== null) {
      room.currentTurn = (room.currentTurn % 4) + 1;
    }

    // Atualiza a mão do jogador atual
    socket.emit("your-hand", { pieces: player.hand });

    // Envia o novo estado do turno
    io.to(room.id).emit("turn-update", {
      currentTurn: room.currentTurn,
      tableEnds: room.tableEnds,
      tablePieces: room.tablePieces
    });
  });

  socket.on("pass-turn", () => {
    const room = findRoomBySocket(socket.id);
    if (!room || room.isPassing) return;

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.playerNumber !== room.currentTurn) return;

    room.isPassing = true;

    // Avisa que o jogador atual está passando a vez (para mostrar a classe .pass)
    io.to(room.id).emit("player-passed", {
      playerNumber: player.playerNumber
    });

    // Espera 3 segundos antes de passar o turno real
    setTimeout(() => {
      room.consecutivePasses += 1;
      
      if (room.consecutivePasses >= 4) {
        io.to(room.id).emit("game-over", { tie: true });
        room.status = "waiting";
        room.isPassing = false;
        return;
      }

      if (room.currentTurn !== null) {
        room.currentTurn = (room.currentTurn % 4) + 1;
      }
      room.isPassing = false;

      io.to(room.id).emit("turn-update", {
        currentTurn: room.currentTurn,
        tableEnds: room.tableEnds,
        tablePieces: room.tablePieces
      });
    }, 3000);
  });

  socket.on("disconnect", () => {
    const room = leaveRoom(socket);
    if (room) {
      io.to(room.id).emit("room-update", {
        playersCount: room.players.length,
        maxPlayers: 4,
      });
    }
    console.log(`Jogador desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});