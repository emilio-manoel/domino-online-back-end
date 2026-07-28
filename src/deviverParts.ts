export interface CreateParts {
    id: string;
    sideA: number;
    sideB: number;
}

export function createParts(): CreateParts[] {
  let createParts: { id: string, sideA: number; sideB: number; }[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let e = i; e <= 6; e++) {
      createParts.push({
        id: i + "-" + e,
        sideA: i,
        sideB: e,
      });
    }
  }
  return randomPieces(createParts);
}

function randomPieces(createParts: CreateParts[]) {
  for (let i = createParts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [createParts[i], createParts[j]] = [createParts[j], createParts[i]];
  }
  return createParts;
}

export default function distributePieces(createParts: CreateParts[]) {
  let player1Pieces = createParts.slice(0, 7);
  let player2Pieces = createParts.slice(7, 14);
  let player3Pieces = createParts.slice(14, 21);
  let player4Pieces = createParts.slice(21, 28);

  return [player1Pieces, player2Pieces, player3Pieces, player4Pieces];
}