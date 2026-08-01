export type IngredientId =
  | "berry"
  | "cheese"
  | "cracker"
  | "grape"
  | "salami"
  | "olive";

export type IngredientShape = "circle" | "square" | "disc" | "cluster";

export type PatternId = "smiley" | "heart" | "rainbow" | "spiral" | "initial";

export type PlacementRole =
  | "eye"
  | "mouth"
  | "outline"
  | "accent"
  | "letter"
  | "path";

export interface IngredientDefinition {
  id: IngredientId;
  label: string;
  pluralLabel: string;
  color: string;
  edgeColor: string;
  shape: IngredientShape;
  footprintMm: number;
  sourceZone: string;
  graspProfile: string;
}

export interface InventoryItem extends IngredientDefinition {
  available: number;
  enabled: boolean;
}

export interface BoardSpec {
  id: string;
  label: string;
  shape: "circle";
  diameterMm: number;
  marginMm: number;
  minSpacingMm: number;
  frameId: string;
  calibrated: boolean;
}

export interface LayoutIntent {
  pattern: PatternId;
  primaryIngredient: IngredientId;
  secondaryIngredient: IngredientId;
  density: number;
  initial: string;
  confidence: number;
  recognizedPhrases: string[];
}

export interface Placement {
  id: string;
  ingredientId: IngredientId;
  role: PlacementRole;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  locked: boolean;
}

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  code:
    | "OUT_OF_BOUNDS"
    | "COLLISION"
    | "DUPLICATE_ID"
    | "INVENTORY_EXCEEDED"
    | "FRAME_UNCALIBRATED"
    | "EMPTY_LAYOUT"
    | "LAYOUT_TRUNCATED"
    | "LOW_CONFIDENCE";
  message: string;
  placementIds: string[];
}

export interface LayoutResult {
  placements: Placement[];
  intent: LayoutIntent;
  truncatedByInventory: boolean;
}

export interface RobotPlacementStep {
  sequence: number;
  placementId: string;
  ingredientId: IngredientId;
  sourceZone: string;
  graspProfile: string;
  target: {
    frameId: string;
    xMm: number;
    yMm: number;
    zMm: number;
    yawDeg: number;
    hoverMm: number;
  };
}

export interface RobotBoardPlan {
  schema: "charcuterie-board-plan/v1";
  status: "ready" | "blocked";
  board: {
    id: string;
    frameId: string;
    diameterMm: number;
    coordinateConvention: "+x right, +y away from robot, origin at board center";
  };
  intent: Pick<
    LayoutIntent,
    "pattern" | "primaryIngredient" | "secondaryIngredient" | "initial"
  >;
  preflight: {
    frameCalibrated: boolean;
    errorCount: number;
    warningCount: number;
  };
  steps: RobotPlacementStep[];
}
