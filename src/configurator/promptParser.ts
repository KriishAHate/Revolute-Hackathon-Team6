import type {
  IngredientId,
  InventoryItem,
  LayoutIntent,
  PatternId,
  PlacementRole,
} from "./types";

const DEFAULT_DENSITY = 0.75;

const INGREDIENT_ALIASES: Record<IngredientId, readonly string[]> = {
  berry: [
    "berry",
    "berries",
    "strawberry",
    "strawberries",
    "blueberry",
    "blueberries",
    "raspberry",
    "raspberries",
  ],
  cheese: ["cheese", "cheeses", "cheese cube", "cheese cubes", "chess"],
  cracker: ["cracker", "crackers", "biscuit", "biscuits"],
  grape: ["grape", "grapes"],
  salami: ["salami", "salami round", "salami rounds", "pepperoni"],
  olive: ["olive", "olives"],
};

const ROLE_ALIASES: Record<PlacementRole, readonly string[]> = {
  eye: ["eye", "eyes"],
  mouth: ["mouth", "smile", "smiley mouth"],
  outline: ["outline", "border", "edge", "perimeter"],
  accent: ["accent", "accents", "center", "centre", "fill", "filling", "inside"],
  letter: ["letter", "initial", "monogram"],
  path: ["path", "arc", "arcs", "curve", "curves", "stripe", "stripes"],
};

const CONNECTOR =
  "(?:(?:is|are|as|for|to|make|makes|form|forms|be|become|becomes|used|using|use|the|my|our|should|will|with|of)\\s+){0,5}";

interface IngredientMention {
  id: IngredientId;
  index: number;
  end: number;
  text: string;
}

interface PatternMatch {
  pattern: PatternId;
  index: number;
  text: string;
}

interface RoleAssignment {
  id: IngredientId;
  role: PlacementRole;
  index: number;
  text: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePrompt(prompt: string): string {
  return prompt
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .toLowerCase();
}

function aliasesForInventory(inventory: InventoryItem[]): Record<IngredientId, string[]> {
  const result = Object.fromEntries(
    (Object.keys(INGREDIENT_ALIASES) as IngredientId[]).map((id) => [
      id,
      [...INGREDIENT_ALIASES[id]],
    ]),
  ) as Record<IngredientId, string[]>;

  for (const item of inventory) {
    result[item.id].push(item.label.toLowerCase(), item.pluralLabel.toLowerCase());
  }

  for (const id of Object.keys(result) as IngredientId[]) {
    result[id] = [...new Set(result[id])].sort((a, b) => b.length - a.length);
  }

  return result;
}

function findIngredientMentions(
  prompt: string,
  aliases: Record<IngredientId, string[]>,
): IngredientMention[] {
  const candidates: IngredientMention[] = [];

  for (const id of Object.keys(aliases) as IngredientId[]) {
    for (const alias of aliases[id]) {
      const expression = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "g");
      for (const match of prompt.matchAll(expression)) {
        const index = match.index ?? 0;
        candidates.push({ id, index, end: index + match[0].length, text: match[0] });
      }
    }
  }

  // Prefer the longest alias when entries overlap ("cheese cube" over "cheese").
  return candidates
    .sort((a, b) => a.index - b.index || b.text.length - a.text.length || a.id.localeCompare(b.id))
    .filter(
      (candidate, index, all) =>
        !all
          .slice(0, index)
          .some(
            (other) =>
              other.index <= candidate.index &&
              other.end >= candidate.end &&
              (other.index !== candidate.index || other.end !== candidate.end),
          ),
    )
    .filter(
      (candidate, index, all) =>
        !all
          .slice(0, index)
          .some(
            (other) => other.id === candidate.id && other.index === candidate.index && other.end === candidate.end),
    );
}

function firstMatch(prompt: string, expression: RegExp): RegExpMatchArray | null {
  const flags = expression.flags.includes("g") ? expression.flags : `${expression.flags}g`;
  return [...prompt.matchAll(new RegExp(expression.source, flags))][0] ?? null;
}

function findPattern(prompt: string): PatternMatch | null {
  const expressions: Array<[PatternId, RegExp]> = [
    ["smiley", /\b(?:smiley|smiling|happy)(?:\s+face)?\b|\bsmile(?:y)?\s+face\b/i],
    ["heart", /\bheart(?:-shaped)?\b|\blove\s+heart\b/i],
    ["rainbow", /\brainbow\b/i],
    ["spiral", /\b(?:spiral|swirl|swirling)\b/i],
    ["initial", /\b(?:initial|monogram)\b|\bletter\s+["']?[a-z](?:["']|\b)/i],
  ];

  const matches = expressions.flatMap(([pattern, expression]) => {
    const match = firstMatch(prompt, expression);
    return match
      ? [{ pattern, index: match.index ?? 0, text: match[0] } satisfies PatternMatch]
      : [];
  });

  return matches.sort((a, b) => a.index - b.index || a.pattern.localeCompare(b.pattern))[0] ?? null;
}

function extractInitial(prompt: string): { initial: string; phrase?: string } {
  const expressions = [
    /\b(?:initial|letter|monogram)(?:\s+(?:of|is|should\s+be))?\s*[:=\-]?\s*["']?([a-z])(?:["']|\b)/i,
    /\b([a-z])\s+(?:initial|monogram)\b/i,
  ];

  for (const expression of expressions) {
    const match = prompt.match(expression);
    if (match?.[1]) {
      return { initial: match[1].toUpperCase(), phrase: match[0] };
    }
  }

  return { initial: "A" };
}

function extractDensity(prompt: string): { density: number; phrase?: string } {
  const explicit =
    prompt.match(/\b(?:density|filled?|fill)\s*(?:of|at|to|:|=)?\s*(\d{1,3})\s*%/i) ??
    prompt.match(/\b(\d{1,3})\s*%\s*(?:density|full|filled)\b/i);

  if (explicit?.[1]) {
    const density = Math.min(1, Math.max(0.35, Number(explicit[1]) / 100));
    return { density, phrase: explicit[0] };
  }

  const descriptors: Array<[RegExp, number]> = [
    [/\b(?:dense|densely|packed|full|abundant)\b/i, 1],
    [/\b(?:sparse|sparsely|minimal|simple|lightly)\b/i, 0.5],
    [/\b(?:medium|moderate|balanced)\b/i, DEFAULT_DENSITY],
  ];

  for (const [expression, density] of descriptors) {
    const match = prompt.match(expression);
    if (match) return { density, phrase: match[0] };
  }

  return { density: DEFAULT_DENSITY };
}

function roleExpression(): string {
  return Object.values(ROLE_ALIASES)
    .flatMap((aliases) => [...aliases])
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}

function roleFromText(value: string): PlacementRole | undefined {
  const normalized = value.toLowerCase();
  return (Object.keys(ROLE_ALIASES) as PlacementRole[]).find((role) =>
    ROLE_ALIASES[role].includes(normalized),
  );
}

function findRoleAssignments(
  prompt: string,
  mentions: IngredientMention[],
): RoleAssignment[] {
  const assignments: RoleAssignment[] = [];
  const roles = roleExpression();

  for (const mention of mentions) {
    const after = prompt.slice(mention.end);
    const afterMatch = after.match(new RegExp(`^\\s*${CONNECTOR}(${roles})\\b`, "i"));
    if (afterMatch?.[1]) {
      const role = roleFromText(afterMatch[1]);
      if (role) {
        assignments.push({
          id: mention.id,
          role,
          index: mention.index,
          text: prompt.slice(mention.index, mention.end + (afterMatch.index ?? 0) + afterMatch[0].length),
        });
      }
    }

    const before = prompt.slice(0, mention.index);
    const beforeMatch = before.match(new RegExp(`(${roles})\\b\\s*${CONNECTOR}$`, "i"));
    if (beforeMatch?.[1]) {
      const role = roleFromText(beforeMatch[1]);
      if (role) {
        const index = mention.index - beforeMatch[0].length;
        assignments.push({
          id: mention.id,
          role,
          index,
          text: prompt.slice(index, mention.end),
        });
      }
    }
  }

  return assignments
    .sort((a, b) => a.index - b.index || a.role.localeCompare(b.role))
    .filter(
      (assignment, index, all) =>
        !all
          .slice(0, index)
          .some(
            (other) =>
              other.id === assignment.id &&
              other.role === assignment.role &&
              other.index === assignment.index,
          ),
    );
}

function slotForRole(role: PlacementRole): "primary" | "secondary" {
  return role === "mouth" || role === "accent" ? "secondary" : "primary";
}

function uniquePhrases(phrases: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const phrase of phrases) {
    const cleaned = phrase?.trim().replace(/\s+/g, " ");
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    result.push(cleaned);
  }

  return result;
}

/**
 * Parse a spoken or typed board request without network access.
 *
 * The result is deliberately small enough to validate before any robot motion.
 * In smileys, `primaryIngredient` means eyes and `secondaryIngredient` means
 * mouth. For other patterns, primary is the outline/path/letter and secondary
 * is the accent.
 */
export function parsePrompt(prompt: string, inventory: InventoryItem[]): LayoutIntent {
  const normalized = normalizePrompt(prompt);
  const patternMatch = findPattern(normalized);
  const pattern = patternMatch?.pattern ?? "smiley";
  const { initial, phrase: initialPhrase } = extractInitial(normalized);
  const { density, phrase: densityPhrase } = extractDensity(normalized);

  const aliases = aliasesForInventory(inventory);
  const mentions = findIngredientMentions(normalized, aliases);
  const enabledIds = new Set(
    inventory.filter((item) => item.enabled && item.available > 0).map((item) => item.id),
  );
  const enabledMentions = mentions.filter((mention) => enabledIds.has(mention.id));
  const assignments = findRoleAssignments(normalized, enabledMentions);

  let primaryIngredient: IngredientId | undefined;
  let secondaryIngredient: IngredientId | undefined;

  for (const assignment of assignments) {
    const slot = slotForRole(assignment.role);
    if (slot === "primary" && !primaryIngredient) primaryIngredient = assignment.id;
    if (slot === "secondary" && !secondaryIngredient) secondaryIngredient = assignment.id;
  }

  const mentionedIds = [...new Set(enabledMentions.map((mention) => mention.id))];
  if (!primaryIngredient) {
    primaryIngredient = mentionedIds.find((id) => id !== secondaryIngredient);
  }
  if (!secondaryIngredient) {
    secondaryIngredient = mentionedIds.find((id) => id !== primaryIngredient);
  }

  const enabledInventory = inventory.filter((item) => item.enabled && item.available > 0);
  primaryIngredient ??= enabledInventory.find((item) => item.id !== secondaryIngredient)?.id;
  secondaryIngredient ??= enabledInventory.find((item) => item.id !== primaryIngredient)?.id;
  primaryIngredient ??= secondaryIngredient ?? inventory[0]?.id ?? "berry";
  secondaryIngredient ??= primaryIngredient;

  const recognizedPhrases = uniquePhrases([
    patternMatch?.text,
    pattern === "initial" ? initialPhrase : undefined,
    densityPhrase,
    ...assignments.map((assignment) => assignment.text),
    ...enabledMentions.map((mention) => mention.text),
  ]);

  let confidence = 0.45;
  if (patternMatch) confidence += 0.2;
  if (mentionedIds.length > 0) confidence += 0.12;
  if (mentionedIds.length > 1) confidence += 0.08;
  if (assignments.length > 0) confidence += 0.08;
  if (pattern === "initial" && initialPhrase) confidence += 0.04;

  return {
    pattern,
    primaryIngredient,
    secondaryIngredient,
    density,
    initial,
    confidence: Math.min(0.99, Number(confidence.toFixed(2))),
    recognizedPhrases,
  };
}
