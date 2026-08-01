import { describe, expect, it } from "vitest";

import { DEFAULT_BOARD, DEFAULT_INVENTORY } from "./defaults";
import type { Placement } from "./types";
import { validateLayout } from "./validation";

function placement(id: string, xMm: number, yMm: number): Placement {
  return {
    id,
    ingredientId: "berry",
    role: "path",
    xMm,
    yMm,
    rotationDeg: 0,
    locked: false,
  };
}

describe("validateLayout", () => {
  it("reports an empty layout error and frame calibration warning", () => {
    const issues = validateLayout(DEFAULT_BOARD, DEFAULT_INVENTORY, []);
    expect(issues.map((issue) => issue.code)).toEqual([
      "EMPTY_LAYOUT",
      "FRAME_UNCALIBRATED",
    ]);
  });

  it("accounts for item footprint and board margin at the boundary", () => {
    const issues = validateLayout(
      { ...DEFAULT_BOARD, calibrated: true },
      DEFAULT_INVENTORY,
      [placement("outside", 118, 0)],
    );
    expect(issues.find((issue) => issue.code === "OUT_OF_BOUNDS")?.placementIds).toEqual([
      "outside",
    ]);
  });

  it("reports each colliding pair", () => {
    const issues = validateLayout(
      { ...DEFAULT_BOARD, calibrated: true },
      DEFAULT_INVENTORY,
      [placement("left", 0, 0), placement("right", 20, 0)],
    );
    const collision = issues.find((issue) => issue.code === "COLLISION");
    expect(collision?.placementIds).toEqual(["left", "right"]);
  });

  it("reports duplicate placement IDs", () => {
    const issues = validateLayout(
      { ...DEFAULT_BOARD, calibrated: true },
      DEFAULT_INVENTORY,
      [placement("repeated", -40, 0), placement("repeated", 40, 0)],
    );

    expect(issues).toContainEqual({
      id: "duplicate-id:repeated",
      severity: "error",
      code: "DUPLICATE_ID",
      message: "2 placements share the ID repeated. Every placement ID must be unique.",
      placementIds: ["repeated"],
    });
  });

  it("reports unavailable and overdrawn inventory", () => {
    const disabledOlive: Placement = {
      ...placement("olive", -50, 0),
      ingredientId: "olive",
    };
    const inventory = DEFAULT_INVENTORY.map((item) =>
      item.id === "berry" ? { ...item, available: 1 } : item,
    );
    const issues = validateLayout(
      { ...DEFAULT_BOARD, calibrated: true },
      inventory,
      [placement("berry-1", 0, 0), placement("berry-2", 40, 0), disabledOlive],
    );

    expect(
      issues.filter((issue) => issue.code === "INVENTORY_EXCEEDED").map((issue) => issue.id),
    ).toEqual(["inventory-exceeded:berry", "inventory-exceeded:olive"]);
  });

  it("accepts a valid calibrated layout", () => {
    expect(
      validateLayout(
        { ...DEFAULT_BOARD, calibrated: true },
        DEFAULT_INVENTORY,
        [placement("one", -30, 0), placement("two", 30, 0)],
      ),
    ).toEqual([]);
  });
});
