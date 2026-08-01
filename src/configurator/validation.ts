import type {
  BoardSpec,
  IngredientId,
  InventoryItem,
  Placement,
  ValidationIssue,
} from "./types";

const EPSILON = 1e-6;

function availableCount(item: InventoryItem | undefined): number {
  if (!item?.enabled) return 0;
  if (item.available === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  return Number.isFinite(item.available) ? Math.max(0, Math.floor(item.available)) : 0;
}

function footprint(item: InventoryItem | undefined): number {
  return item && Number.isFinite(item.footprintMm) ? Math.max(0, item.footprintMm) : 0;
}

/** Run all preflight checks without mutating the proposed placements. */
export function validateLayout(
  board: BoardSpec,
  inventory: InventoryItem[],
  placements: Placement[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const inventoryById = new Map<IngredientId, InventoryItem>(
    inventory.map((item) => [item.id, item]),
  );

  if (placements.length === 0) {
    issues.push({
      id: "empty-layout",
      severity: "error",
      code: "EMPTY_LAYOUT",
      message: "Add at least one placement before generating a robot plan.",
      placementIds: [],
    });
  }

  const idCounts = new Map<string, number>();
  for (const placement of placements) {
    idCounts.set(placement.id, (idCounts.get(placement.id) ?? 0) + 1);
  }
  for (const [id, count] of [...idCounts.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (count < 2) continue;
    issues.push({
      id: `duplicate-id:${id}`,
      severity: "error",
      code: "DUPLICATE_ID",
      message: `${count} placements share the ID ${id}. Every placement ID must be unique.`,
      placementIds: [id],
    });
  }

  const allowedCenterRadius = board.diameterMm / 2 - board.marginMm;
  const outOfBounds = placements.filter((placement) => {
    const item = inventoryById.get(placement.ingredientId);
    const distance = Math.hypot(placement.xMm, placement.yMm);
    return (
      !Number.isFinite(distance) ||
      !Number.isFinite(allowedCenterRadius) ||
      distance + footprint(item) / 2 > allowedCenterRadius + EPSILON
    );
  });
  if (outOfBounds.length > 0) {
    issues.push({
      id: "out-of-bounds",
      severity: "error",
      code: "OUT_OF_BOUNDS",
      message: `${outOfBounds.length} placement${outOfBounds.length === 1 ? " is" : "s are"} outside the board's safe margin.`,
      placementIds: outOfBounds.map((placement) => placement.id),
    });
  }

  for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
    const left = placements[leftIndex];
    const leftItem = inventoryById.get(left.ingredientId);
    for (let rightIndex = leftIndex + 1; rightIndex < placements.length; rightIndex += 1) {
      const right = placements[rightIndex];
      const rightItem = inventoryById.get(right.ingredientId);
      const distance = Math.hypot(left.xMm - right.xMm, left.yMm - right.yMm);
      const minimumDistance =
        (footprint(leftItem) + footprint(rightItem)) / 2 + Math.max(0, board.minSpacingMm);
      if (!Number.isFinite(distance) || distance + EPSILON >= minimumDistance) continue;

      const pair = [left.id, right.id].sort();
      issues.push({
        id: `collision:${pair[0]}:${pair[1]}`,
        severity: "error",
        code: "COLLISION",
        message: `Placements ${left.id} and ${right.id} are too close together.`,
        placementIds: [left.id, right.id],
      });
    }
  }

  const usedByIngredient = new Map<IngredientId, Placement[]>();
  for (const placement of placements) {
    const used = usedByIngredient.get(placement.ingredientId) ?? [];
    used.push(placement);
    usedByIngredient.set(placement.ingredientId, used);
  }

  for (const [ingredientId, used] of [...usedByIngredient.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const item = inventoryById.get(ingredientId);
    const available = availableCount(item);
    if (used.length <= available) continue;
    issues.push({
      id: `inventory-exceeded:${ingredientId}`,
      severity: "error",
      code: "INVENTORY_EXCEEDED",
      message: item?.enabled
        ? `${used.length} ${item.pluralLabel.toLowerCase()} requested, but only ${available} available.`
        : `${item?.pluralLabel ?? ingredientId} is not enabled in inventory.`,
      placementIds: used.map((placement) => placement.id),
    });
  }

  if (!board.calibrated) {
    issues.push({
      id: "frame-uncalibrated",
      severity: "warning",
      code: "FRAME_UNCALIBRATED",
      message: `Calibrate the ${board.frameId} frame before executing this plan.`,
      placementIds: [],
    });
  }

  return issues;
}
