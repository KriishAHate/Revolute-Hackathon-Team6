import type {
  BoardSpec,
  IngredientId,
  InventoryItem,
  LayoutIntent,
  LayoutResult,
  Placement,
  PlacementRole,
} from "./types";

interface Candidate {
  key: string;
  role: PlacementRole;
  slot: "primary" | "secondary";
  nx: number;
  ny: number;
  rotationDeg: number;
}

const INITIAL_GLYPHS: Record<string, readonly string[]> = {
  A: [".#.", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: [".##", "#..", "#..", "#..", ".##"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: [".##", "#..", "#.#", "#.#", ".##"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", ".#."],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["#.#", "###", "###", "#.#", "#.#"],
  O: [".#.", "#.#", "#.#", "#.#", ".#."],
  P: ["##.", "#.#", "##.", "#..", "#.."],
  Q: [".#.", "#.#", "#.#", "###", "..#"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: [".##", "#..", ".#.", "..#", "##."],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
};

function roundCoordinate(value: number): number {
  return Number(value.toFixed(2));
}

function clampedDensity(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0.35, value)) : 0.75;
}

function smileyCandidates(density: number): Candidate[] {
  const candidates: Candidate[] = [
    {
      key: "left",
      role: "eye",
      slot: "primary",
      nx: -0.34,
      ny: 0.3,
      rotationDeg: 0,
    },
    {
      key: "right",
      role: "eye",
      slot: "primary",
      nx: 0.34,
      ny: 0.3,
      rotationDeg: 0,
    },
  ];
  const mouthCount = Math.round(3 + density * 2);

  for (let index = 0; index < mouthCount; index += 1) {
    const t = mouthCount === 1 ? 0 : -1 + (2 * index) / (mouthCount - 1);
    const nx = t * 0.58;
    const ny = -0.35 + 0.45 * Math.pow(Math.abs(t), 1.6);
    const slope = t === 0 ? 0 : 0.72 * Math.sign(t) * Math.pow(Math.abs(t), 0.6);
    candidates.push({
      key: String(index + 1).padStart(2, "0"),
      role: "mouth",
      slot: "secondary",
      nx,
      ny,
      rotationDeg: (Math.atan(slope) * 180) / Math.PI,
    });
  }

  return candidates;
}

function heartCandidates(density: number): Candidate[] {
  const outlineCount = Math.round(6 + density * 6);
  const candidates: Candidate[] = [];

  for (let index = 0; index < outlineCount; index += 1) {
    const t = (Math.PI * 2 * index) / outlineCount;
    const nx = 0.74 * Math.pow(Math.sin(t), 3);
    const ny =
      (0.74 *
        (13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t))) /
      17;
    candidates.push({
      key: String(index + 1).padStart(2, "0"),
      role: "outline",
      slot: "primary",
      nx,
      ny,
      rotationDeg: (t * 180) / Math.PI,
    });
  }

  candidates.push({
    key: "center",
    role: "accent",
    slot: "secondary",
    nx: 0,
    ny: -0.08,
    rotationDeg: 0,
  });
  if (density >= 0.9) {
    candidates.push(
      {
        key: "left",
        role: "accent",
        slot: "secondary",
        nx: -0.2,
        ny: -0.16,
        rotationDeg: 0,
      },
      {
        key: "right",
        role: "accent",
        slot: "secondary",
        nx: 0.2,
        ny: -0.16,
        rotationDeg: 0,
      },
    );
  }

  return candidates;
}

function arcCandidates(
  count: number,
  radius: number,
  yOffset: number,
  role: PlacementRole,
  slot: "primary" | "secondary",
): Candidate[] {
  const start = (18 * Math.PI) / 180;
  const end = (162 * Math.PI) / 180;
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0.5 : index / (count - 1);
    const angle = start + (end - start) * ratio;
    return {
      key: String(index + 1).padStart(2, "0"),
      role,
      slot,
      nx: radius * Math.cos(angle),
      ny: yOffset + radius * Math.sin(angle),
      rotationDeg: (angle * 180) / Math.PI - 90,
    };
  });
}

function rainbowCandidates(density: number): Candidate[] {
  const outerCount = Math.round(4 + density * 3);
  const innerCount = Math.round(3 + density * 3);
  return [
    // The generous radial gap is intentional. At the default board size it
    // keeps a 38 mm cracker arc clear of a 24 mm grape arc plus the 6 mm
    // configured spacing, so neither arc is silently pruned.
    ...arcCandidates(outerCount, 0.86, -0.22, "path", "primary"),
    ...arcCandidates(innerCount, 0.46, -0.22, "accent", "secondary"),
  ];
}

function spiralCandidates(density: number): Candidate[] {
  const count = Math.round(6 + density * 5);
  let pathIndex = 0;
  let accentIndex = 0;

  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const radius = 0.18 + 0.67 * ratio;
    const angle = index * ((85 * Math.PI) / 180);
    const isPrimary = index % 2 === 0;
    const ordinal = isPrimary ? ++pathIndex : ++accentIndex;
    return {
      key: String(ordinal).padStart(2, "0"),
      role: isPrimary ? "path" : "accent",
      slot: isPrimary ? "primary" : "secondary",
      nx: radius * Math.cos(angle),
      ny: radius * Math.sin(angle),
      rotationDeg: (angle * 180) / Math.PI + 90,
    };
  });
}

function initialCandidates(initial: string, spacing: number): Candidate[] {
  const glyph = INITIAL_GLYPHS[initial] ?? INITIAL_GLYPHS.A;
  const candidates: Candidate[] = [];

  glyph.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== "#") return;
      candidates.push({
        key: `r${rowIndex + 1}c${columnIndex + 1}`,
        role: "letter",
        slot: "primary",
        nx: (columnIndex - 1) * spacing,
        ny: (2 - rowIndex) * spacing,
        rotationDeg: 0,
      });
    });
  });

  // Side accents sit outside the 3x5 glyph's stroke grid. They keep the
  // secondary ingredient visible without obscuring the requested initial.
  candidates.push(
    {
      key: "left",
      role: "accent",
      slot: "secondary",
      nx: -0.9,
      ny: 0,
      rotationDeg: 0,
    },
    {
      key: "right",
      role: "accent",
      slot: "secondary",
      nx: 0.9,
      ny: 0,
      rotationDeg: 0,
    },
  );

  return candidates;
}

function makeCandidates(
  intent: LayoutIntent,
  density: number,
  initialSpacing: number,
): Candidate[] {
  switch (intent.pattern) {
    case "heart":
      return heartCandidates(density);
    case "rainbow":
      return rainbowCandidates(density);
    case "spiral":
      return spiralCandidates(density);
    case "initial":
      return initialCandidates(intent.initial, initialSpacing);
    case "smiley":
    default:
      return smileyCandidates(density);
  }
}

function inventoryLimit(item: InventoryItem): number {
  return item.enabled && Number.isFinite(item.available)
    ? Math.max(0, Math.floor(item.available))
    : item.enabled && item.available === Number.POSITIVE_INFINITY
      ? Number.POSITIVE_INFINITY
      : 0;
}

function collides(
  candidate: Placement,
  candidateItem: InventoryItem,
  placements: Placement[],
  byId: Map<IngredientId, InventoryItem>,
  minimumSpacing: number,
): boolean {
  return placements.some((placement) => {
    const item = byId.get(placement.ingredientId);
    if (!item) return false;
    const distance = Math.hypot(candidate.xMm - placement.xMm, candidate.yMm - placement.yMm);
    const required = (candidateItem.footprintMm + item.footprintMm) / 2 + minimumSpacing;
    return distance + 1e-6 < required;
  });
}

/** Generate a deterministic, board-relative layout from a parsed intent. */
export function generateLayout(
  intent: LayoutIntent,
  board: BoardSpec,
  inventory: InventoryItem[],
): LayoutResult {
  const usable = inventory.filter((item) => inventoryLimit(item) > 0);
  if (usable.length === 0) {
    return { placements: [], intent: { ...intent }, truncatedByInventory: true };
  }

  const requestedPrimary = usable.find((item) => item.id === intent.primaryIngredient);
  const primary = requestedPrimary ?? usable[0];
  const requestedSecondary = usable.find((item) => item.id === intent.secondaryIngredient);
  const secondary = requestedSecondary ?? usable.find((item) => item.id !== primary.id) ?? primary;
  const normalizedIntent: LayoutIntent = {
    ...intent,
    initial: /^[A-Z]$/i.test(intent.initial) ? intent.initial.toUpperCase() : "A",
    primaryIngredient: primary.id,
    secondaryIngredient: secondary.id,
  };

  const byId = new Map(inventory.map((item) => [item.id, item]));
  const maxFootprint = Math.max(primary.footprintMm, secondary.footprintMm);
  const insideRadius = Math.max(0, board.diameterMm / 2 - board.marginMm);
  const layoutRadius = Math.max(0, insideRadius - maxFootprint / 2);
  const requiredStep = (maxFootprint + Math.max(0, board.minSpacingMm)) / Math.max(layoutRadius, 1);
  const initialSpacing = Math.min(0.44, Math.max(0.3, requiredStep));
  const candidates = makeCandidates(
    normalizedIntent,
    clampedDensity(normalizedIntent.density),
    initialSpacing,
  );
  const remaining = new Map(usable.map((item) => [item.id, inventoryLimit(item)]));
  const placements: Placement[] = [];
  let truncatedByInventory = false;

  for (const candidate of candidates) {
    const item = candidate.slot === "primary" ? primary : secondary;
    const available = remaining.get(item.id) ?? 0;
    if (available <= 0) {
      truncatedByInventory = true;
      continue;
    }

    const placement: Placement = {
      id: `${normalizedIntent.pattern}-${candidate.role}-${candidate.key}`,
      ingredientId: item.id,
      role: candidate.role,
      xMm: roundCoordinate(candidate.nx * layoutRadius),
      yMm: roundCoordinate(candidate.ny * layoutRadius),
      rotationDeg: roundCoordinate(candidate.rotationDeg),
      locked: false,
    };

    const outside =
      !Number.isFinite(placement.xMm) ||
      !Number.isFinite(placement.yMm) ||
      Math.hypot(placement.xMm, placement.yMm) + item.footprintMm / 2 > insideRadius + 1e-6;
    if (outside || collides(placement, item, placements, byId, board.minSpacingMm)) {
      continue;
    }

    placements.push(placement);
    remaining.set(item.id, available - 1);
  }

  return { placements, intent: normalizedIntent, truncatedByInventory };
}
