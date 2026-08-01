import { describe, expect, it } from "vitest";

import { DEFAULT_BOARD, DEFAULT_INVENTORY } from "./defaults";
import { generateLayout } from "./layoutEngine";
import { parsePrompt } from "./promptParser";
import type { LayoutIntent, PatternId } from "./types";
import { validateLayout } from "./validation";

function intent(pattern: PatternId): LayoutIntent {
  return {
    pattern,
    primaryIngredient: "berry",
    secondaryIngredient: "cheese",
    density: 0.75,
    initial: "R",
    confidence: 0.9,
    recognizedPhrases: [],
  };
}

describe("generateLayout", () => {
  it.each(["smiley", "heart", "rainbow", "spiral", "initial"] as const)(
    "generates a valid %s layout",
    (pattern) => {
      const result = generateLayout(
        intent(pattern),
        { ...DEFAULT_BOARD, calibrated: true },
        DEFAULT_INVENTORY,
      );

      expect(result.placements.length).toBeGreaterThan(0);
      expect(new Set(result.placements.map((placement) => placement.id)).size).toBe(
        result.placements.length,
      );
      expect(
        result.placements.every((placement) =>
          DEFAULT_INVENTORY.some(
            (item) => item.id === placement.ingredientId && item.enabled && item.available > 0,
          ),
        ),
      ).toBe(true);
      expect(
        validateLayout(
          { ...DEFAULT_BOARD, calibrated: true },
          DEFAULT_INVENTORY,
          result.placements,
        ).filter((issue) => issue.severity === "error"),
      ).toEqual([]);
    },
  );

  it("uses stable semantic placement IDs", () => {
    const first = generateLayout(intent("smiley"), DEFAULT_BOARD, DEFAULT_INVENTORY);
    const second = generateLayout(intent("smiley"), DEFAULT_BOARD, DEFAULT_INVENTORY);

    expect(first.placements.map((placement) => placement.id)).toEqual(
      second.placements.map((placement) => placement.id),
    );
    expect(first.placements.map((placement) => placement)).toEqual(second.placements);
  });

  it("never exceeds inventory and reports truncation", () => {
    const inventory = DEFAULT_INVENTORY.map((item) => ({
      ...item,
      available: item.id === "berry" || item.id === "cheese" ? 1 : 0,
      enabled: item.id === "berry" || item.id === "cheese",
    }));
    const result = generateLayout(intent("rainbow"), DEFAULT_BOARD, inventory);

    expect(result.truncatedByInventory).toBe(true);
    expect(result.placements.filter((placement) => placement.ingredientId === "berry")).toHaveLength(1);
    expect(result.placements.filter((placement) => placement.ingredientId === "cheese")).toHaveLength(1);
  });

  it("falls back from disabled requested ingredients", () => {
    const result = generateLayout(
      { ...intent("heart"), primaryIngredient: "salami", secondaryIngredient: "olive" },
      DEFAULT_BOARD,
      DEFAULT_INVENTORY,
    );

    expect(result.intent.primaryIngredient).not.toBe("salami");
    expect(result.intent.secondaryIngredient).not.toBe("olive");
    expect(result.placements.every((placement) => placement.ingredientId !== "salami")).toBe(true);
  });

  it("returns an empty, truncated result when nothing is usable", () => {
    const inventory = DEFAULT_INVENTORY.map((item) => ({ ...item, enabled: false }));
    expect(generateLayout(intent("smiley"), DEFAULT_BOARD, inventory)).toMatchObject({
      placements: [],
      truncatedByInventory: true,
    });
  });

  it("keeps both default cracker and grape rainbow arcs complete", () => {
    const parsed = parsePrompt(
      "Make a 75% rainbow with cracker arcs and grape accents",
      DEFAULT_INVENTORY,
    );
    const result = generateLayout(
      parsed,
      { ...DEFAULT_BOARD, calibrated: true },
      DEFAULT_INVENTORY,
    );

    expect(result.intent.primaryIngredient).toBe("cracker");
    expect(result.intent.secondaryIngredient).toBe("grape");
    expect(result.placements.filter((placement) => placement.role === "path")).toHaveLength(6);
    expect(result.placements.filter((placement) => placement.role === "accent")).toHaveLength(5);
    expect(result.truncatedByInventory).toBe(false);
    expect(
      validateLayout(
        { ...DEFAULT_BOARD, calibrated: true },
        DEFAULT_INVENTORY,
        result.placements,
      ),
    ).toEqual([]);
  });

  it("decorates initials with the requested secondary ingredient", () => {
    const parsed = parsePrompt(
      "Make the letter A in cheese with berry accents",
      DEFAULT_INVENTORY,
    );
    const result = generateLayout(
      parsed,
      { ...DEFAULT_BOARD, calibrated: true },
      DEFAULT_INVENTORY,
    );
    const letters = result.placements.filter((placement) => placement.role === "letter");
    const accents = result.placements.filter((placement) => placement.role === "accent");

    expect(letters).toHaveLength(10);
    expect(letters.every((placement) => placement.ingredientId === "cheese")).toBe(true);
    expect(accents.map((placement) => placement.id)).toEqual([
      "initial-accent-left",
      "initial-accent-right",
    ]);
    expect(accents.every((placement) => placement.ingredientId === "berry")).toBe(true);
    expect(
      validateLayout(
        { ...DEFAULT_BOARD, calibrated: true },
        DEFAULT_INVENTORY,
        result.placements,
      ),
    ).toEqual([]);
  });
});
