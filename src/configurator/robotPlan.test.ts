import { describe, expect, it } from "vitest";

import { DEFAULT_BOARD, DEFAULT_INVENTORY } from "./defaults";
import { buildRobotPlan } from "./robotPlan";
import type { LayoutIntent, Placement, ValidationIssue } from "./types";

const intent: LayoutIntent = {
  pattern: "smiley",
  primaryIngredient: "berry",
  secondaryIngredient: "cheese",
  density: 0.75,
  initial: "A",
  confidence: 0.9,
  recognizedPhrases: [],
};

function placement(id: string, xMm: number, yMm: number): Placement {
  return {
    id,
    ingredientId: id === "middle" ? "cheese" : "berry",
    role: "path",
    xMm,
    yMm,
    rotationDeg: 15,
    locked: false,
  };
}

describe("buildRobotPlan", () => {
  it("orders placements from far to near using +y away from the robot", () => {
    const placements = [
      placement("near", 0, -40),
      placement("far", 0, 60),
      placement("middle", 10, 5),
    ];
    const plan = buildRobotPlan(
      { ...DEFAULT_BOARD, calibrated: true },
      DEFAULT_INVENTORY,
      intent,
      placements,
      [],
    );

    expect(plan.status).toBe("ready");
    expect(plan.steps.map((step) => step.placementId)).toEqual(["far", "middle", "near"]);
    expect(plan.steps.map((step) => step.sequence)).toEqual([1, 2, 3]);
    expect(plan.steps[1]).toMatchObject({
      sourceZone: "tray.cheese",
      graspProfile: "rigid-medium",
      target: {
        frameId: DEFAULT_BOARD.frameId,
        xMm: 10,
        yMm: 5,
        zMm: 0,
        yawDeg: 15,
        hoverMm: 60,
      },
    });
  });

  it("blocks execution and emits no steps when validation has an error", () => {
    const error: ValidationIssue = {
      id: "collision:a:b",
      severity: "error",
      code: "COLLISION",
      message: "collision",
      placementIds: ["a", "b"],
    };
    const plan = buildRobotPlan(
      DEFAULT_BOARD,
      DEFAULT_INVENTORY,
      intent,
      [placement("near", 0, 0)],
      [error],
    );

    expect(plan.status).toBe("blocked");
    expect(plan.preflight.errorCount).toBe(1);
    expect(plan.steps).toEqual([]);
  });

  it("hard-blocks execution until the board frame is calibrated", () => {
    const warning: ValidationIssue = {
      id: "frame-uncalibrated",
      severity: "warning",
      code: "FRAME_UNCALIBRATED",
      message: "calibrate",
      placementIds: [],
    };
    const plan = buildRobotPlan(
      DEFAULT_BOARD,
      DEFAULT_INVENTORY,
      intent,
      [placement("near", 0, 0)],
      [warning],
    );

    expect(plan.status).toBe("blocked");
    expect(plan.preflight).toEqual({
      frameCalibrated: false,
      errorCount: 0,
      warningCount: 1,
    });
    expect(plan.steps).toEqual([]);
  });
});
