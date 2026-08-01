import type {
  BoardSpec,
  InventoryItem,
  LayoutIntent,
  Placement,
  RobotBoardPlan,
  ValidationIssue,
} from "./types";

const TARGET_SURFACE_Z_MM = 0;
const DEFAULT_HOVER_MM = 60;

/** Convert a validated layout into the deterministic robot handoff schema. */
export function buildRobotPlan(
  board: BoardSpec,
  inventory: InventoryItem[],
  intent: LayoutIntent,
  placements: Placement[],
  issues: ValidationIssue[],
): RobotBoardPlan {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const hasUnmappedIngredient = placements.some(
    (placement) => !inventoryById.has(placement.ingredientId),
  );
  // Calibration remains a warning in the editable layout, but it is a hard
  // execution gate: board-relative millimetres are unsafe without a frame.
  const blocked = errorCount > 0 || !board.calibrated || hasUnmappedIngredient;

  const ordered = [...placements].sort(
    (left, right) =>
      right.yMm - left.yMm ||
      Math.abs(right.xMm) - Math.abs(left.xMm) ||
      left.xMm - right.xMm ||
      left.id.localeCompare(right.id),
  );

  return {
    schema: "charcuterie-board-plan/v1",
    status: blocked ? "blocked" : "ready",
    board: {
      id: board.id,
      frameId: board.frameId,
      diameterMm: board.diameterMm,
      coordinateConvention: "+x right, +y away from robot, origin at board center",
    },
    intent: {
      pattern: intent.pattern,
      primaryIngredient: intent.primaryIngredient,
      secondaryIngredient: intent.secondaryIngredient,
      initial: intent.initial,
    },
    preflight: {
      frameCalibrated: board.calibrated,
      errorCount: errorCount + (hasUnmappedIngredient && errorCount === 0 ? 1 : 0),
      warningCount,
    },
    steps: blocked
      ? []
      : ordered.map((placement, index) => {
          const item = inventoryById.get(placement.ingredientId);
          if (!item) {
            // The blocked branch above guarantees this is unreachable.
            throw new Error(`Missing inventory definition for ${placement.ingredientId}`);
          }
          return {
            sequence: index + 1,
            placementId: placement.id,
            ingredientId: placement.ingredientId,
            sourceZone: item.sourceZone,
            graspProfile: item.graspProfile,
            target: {
              frameId: board.frameId,
              xMm: placement.xMm,
              yMm: placement.yMm,
              zMm: TARGET_SURFACE_Z_MM,
              yawDeg: placement.rotationDeg,
              hoverMm: DEFAULT_HOVER_MM,
            },
          };
        }),
  };
}
