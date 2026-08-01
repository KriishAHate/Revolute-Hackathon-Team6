import { describe, expect, it } from "vitest";

import { DEFAULT_INVENTORY } from "./defaults";
import { parsePrompt } from "./promptParser";

describe("parsePrompt", () => {
  it.each([
    ["make a happy smiley face", "smiley"],
    ["arrange this as a heart", "heart"],
    ["build a rainbow", "rainbow"],
    ["create a swirling spiral", "spiral"],
    ["make the letter R", "initial"],
  ] as const)("recognizes %s", (prompt, pattern) => {
    expect(parsePrompt(prompt, DEFAULT_INVENTORY).pattern).toBe(pattern);
  });

  it("maps ingredient-role phrases to smiley semantics regardless of mention order", () => {
    const intent = parsePrompt(
      "Build a smiley face where the cheese is the smile and berries are the eyes",
      DEFAULT_INVENTORY,
    );

    expect(intent.primaryIngredient).toBe("berry");
    expect(intent.secondaryIngredient).toBe("cheese");
    expect(intent.recognizedPhrases).toEqual(
      expect.arrayContaining([expect.stringContaining("cheese"), expect.stringContaining("berries")]),
    );
  });

  it("understands role-first phrasing", () => {
    const intent = parsePrompt(
      "Make a heart: the outline uses grapes and the center uses cheese",
      DEFAULT_INVENTORY,
    );

    expect(intent.primaryIngredient).toBe("grape");
    expect(intent.secondaryIngredient).toBe("cheese");
  });

  it("extracts and normalizes an initial and explicit density", () => {
    const intent = parsePrompt("A letter q filled to 20% with crackers", DEFAULT_INVENTORY);

    expect(intent.pattern).toBe("initial");
    expect(intent.initial).toBe("Q");
    expect(intent.density).toBe(0.35);
    expect(intent.primaryIngredient).toBe("cracker");
  });

  it("does not select a disabled or empty ingredient", () => {
    const inventory = DEFAULT_INVENTORY.map((item) =>
      item.id === "salami" ? { ...item, enabled: false, available: 8 } : { ...item },
    );
    const intent = parsePrompt("a salami spiral", inventory);

    expect(intent.primaryIngredient).not.toBe("salami");
    expect(intent.secondaryIngredient).not.toBe("salami");
  });

  it("is deterministic", () => {
    const prompt = "dense rainbow arcs of berries with cheese accents";
    expect(parsePrompt(prompt, DEFAULT_INVENTORY)).toEqual(
      parsePrompt(prompt, DEFAULT_INVENTORY),
    );
  });
});
