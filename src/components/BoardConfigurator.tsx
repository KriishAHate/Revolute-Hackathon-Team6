import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRobotPlan,
  generateLayout,
  parsePrompt,
  validateLayout,
} from "../configurator";
import { DEFAULT_BOARD, DEFAULT_INVENTORY } from "../configurator/defaults";
import type {
  IngredientId,
  InventoryItem,
  LayoutIntent,
  PatternId,
  Placement,
  ValidationSeverity,
} from "../configurator/types";
import { BoardPreview } from "./BoardPreview";

const STARTER_PROMPT =
  "Build a smiley face where berries are the eyes and cheese cubes make the smile.";

const PROMPT_SUGGESTIONS = [
  "Make a heart outline from cheese with berry accents.",
  "Arrange crackers and grapes in a rainbow.",
  "Create a spiral alternating grapes and cheese.",
  "Spell the initial A using cheese with berry accents.",
];

const PATTERNS: Array<{ id: PatternId; label: string }> = [
  { id: "smiley", label: "Smiley" },
  { id: "heart", label: "Heart" },
  { id: "rainbow", label: "Rainbow" },
  { id: "spiral", label: "Spiral" },
  { id: "initial", label: "Initial" },
];

function StatusDot({ severity }: { severity: ValidationSeverity }) {
  return <span className={`status-dot status-dot--${severity}`} aria-hidden="true" />;
}

function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <div className="stepper" aria-label={label}>
      <button
        type="button"
        className="stepper__button"
        onClick={() => onChange(Math.max(0, value - 1))}
        aria-label={`Remove one ${label}`}
      >
        −
      </button>
      <output className="stepper__value" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className="stepper__button"
        onClick={() => onChange(Math.min(30, value + 1))}
        aria-label={`Add one ${label}`}
      >
        +
      </button>
    </div>
  );
}

function DraftNumberInput({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
}) {
  const displayValue = String(Math.round(value));
  const [draft, setDraft] = useState(displayValue);

  useEffect(() => setDraft(displayValue), [displayValue]);

  function commit() {
    const numericValue = Number(draft);
    if (!Number.isFinite(numericValue)) {
      setDraft(displayValue);
      return;
    }

    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, numericValue));
    setDraft(String(clamped));
    onCommit(clamped);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(displayValue);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function BoardConfigurator() {
  const [prompt, setPrompt] = useState(STARTER_PROMPT);
  const [inventory, setInventory] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [board, setBoard] = useState(DEFAULT_BOARD);
  const [autoInterpret, setAutoInterpret] = useState(true);
  const parsedIntent = useMemo(() => parsePrompt(prompt, inventory), [prompt, inventory]);
  const [manualIntent, setManualIntent] = useState<LayoutIntent>(() =>
    parsePrompt(STARTER_PROMPT, DEFAULT_INVENTORY),
  );
  const requestedIntent = autoInterpret ? parsedIntent : manualIntent;
  const generatedLayout = useMemo(
    () => generateLayout(requestedIntent, board, inventory),
    [
      requestedIntent,
      inventory,
      board.diameterMm,
      board.marginMm,
      board.minSpacingMm,
    ],
  );
  const intent = generatedLayout.intent;
  const [placements, setPlacements] = useState<Placement[]>(generatedLayout.placements);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState("Copy JSON");
  const duplicateCounter = useRef(0);

  useEffect(() => {
    setPlacements(generatedLayout.placements);
    setSelectedPlacementId(null);
  }, [generatedLayout]);

  const issues = useMemo(() => {
    const nextIssues = validateLayout(board, inventory, placements);

    if (generatedLayout.truncatedByInventory) {
      nextIssues.unshift({
        id: "layout-truncated",
        severity: "error",
        code: "LAYOUT_TRUNCATED",
        message: "There is not enough enabled inventory to complete this pattern.",
        placementIds: [],
      });
    }

    if (autoInterpret && requestedIntent.confidence < 0.65) {
      nextIssues.unshift({
        id: "low-confidence",
        severity: "error",
        code: "LOW_CONFIDENCE",
        message: `Prompt match is only ${Math.round(requestedIntent.confidence * 100)}%. Adjust the prompt or turn Live off to confirm the interpretation.`,
        placementIds: [],
      });
    }

    return nextIssues;
  }, [
    board,
    inventory,
    placements,
    generatedLayout.truncatedByInventory,
    autoInterpret,
    requestedIntent.confidence,
  ]);
  const robotPlan = useMemo(
    () => buildRobotPlan(board, inventory, intent, placements, issues),
    [board, inventory, intent, placements, issues],
  );
  const selectedPlacement = placements.find(({ id }) => id === selectedPlacementId) ?? null;

  const errorCount = issues.filter(({ severity }) => severity === "error").length;
  const warningCount = issues.filter(({ severity }) => severity === "warning").length;
  const enabledIngredients = inventory.filter(({ enabled, available }) => enabled && available > 0);
  const placementCounts = useMemo(
    () =>
      placements.reduce<Partial<Record<IngredientId, number>>>((counts, placement) => {
        counts[placement.ingredientId] = (counts[placement.ingredientId] ?? 0) + 1;
        return counts;
      }, {}),
    [placements],
  );

  function updateIntent(patch: Partial<LayoutIntent>) {
    setManualIntent({ ...intent, ...patch, confidence: 1 });
    setAutoInterpret(false);
  }

  function updateInventory(id: IngredientId, patch: Partial<InventoryItem>) {
    setInventory((current) =>
      current.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...patch } : ingredient,
      ),
    );
  }

  function updatePlacement(id: string, patch: Partial<Placement>) {
    setPlacements((current) =>
      current.map((placement) =>
        placement.id === id ? { ...placement, ...patch } : placement,
      ),
    );
  }

  function removePlacement(id: string) {
    setPlacements((current) => current.filter((placement) => placement.id !== id));
    setSelectedPlacementId(null);
  }

  function duplicatePlacement(placement: Placement) {
    duplicateCounter.current += 1;
    const duplicate: Placement = {
      ...placement,
      id: `${placement.id}-copy-${duplicateCounter.current}`,
      xMm: placement.xMm + 12,
      yMm: placement.yMm + 12,
      locked: false,
    };
    setPlacements((current) => [...current, duplicate]);
    setSelectedPlacementId(duplicate.id);
  }

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(robotPlan, null, 2));
      setCopyLabel("Copied");
    } catch {
      setCopyLabel("Copy failed");
    }
    window.setTimeout(() => setCopyLabel("Copy JSON"), 1500);
  }

  function downloadPlan() {
    const blob = new Blob([JSON.stringify(robotPlan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `board-plan-${intent.pattern}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="eyebrow">Prompt to Platter</p>
            <h1>Live board configuration</h1>
          </div>
        </div>
        <div className="topbar__status">
          <span className={`readiness-chip readiness-chip--${robotPlan.status}`}>
            <span className="readiness-chip__pulse" />
            {robotPlan.status === "ready" ? "Plan ready" : "Needs attention"}
          </span>
          <span className="revision-label">Plan v1</span>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="control-panel" aria-label="Board configuration controls">
          <section className="panel-section panel-section--prompt">
            <div className="section-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Describe the board</h2>
              </div>
              <label className="link-toggle">
                <input
                  type="checkbox"
                  checked={autoInterpret}
                  onChange={(event) => {
                    if (!event.target.checked) {
                      setManualIntent(parsedIntent);
                    }
                    setAutoInterpret(event.target.checked);
                  }}
                />
                <span>Live</span>
              </label>
            </div>
            <label className="sr-only" htmlFor="board-prompt">
              Board description
            </label>
            <textarea
              id="board-prompt"
              className="prompt-input"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={5}
              placeholder="Describe a pattern and which ingredients should make each part…"
            />
            <div className="interpretation-row">
              <span>
                Interpreted as <strong>{PATTERNS.find(({ id }) => id === intent.pattern)?.label}</strong>
              </span>
              <span className="confidence-label">
                {Math.round(intent.confidence * 100)}% match
              </span>
            </div>
            <div className="suggestion-list" aria-label="Prompt examples">
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  className="suggestion-chip"
                  key={suggestion}
                  onClick={() => {
                    setPrompt(suggestion);
                    setAutoInterpret(true);
                  }}
                >
                  {suggestion.split(" ").slice(0, 4).join(" ")}…
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-number">02</span>
                <h2>Shape & roles</h2>
              </div>
              {!autoInterpret && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAutoInterpret(true)}
                >
                  Sync prompt
                </button>
              )}
            </div>
            <div className="field-grid">
              <label className="field-label">
                Pattern
                <select
                  value={intent.pattern}
                  onChange={(event) => updateIntent({ pattern: event.target.value as PatternId })}
                >
                  {PATTERNS.map((pattern) => (
                    <option key={pattern.id} value={pattern.id}>
                      {pattern.label}
                    </option>
                  ))}
                </select>
              </label>
              {intent.pattern === "initial" && (
                <label className="field-label">
                  Initial
                  <input
                    className="small-input"
                    value={intent.initial}
                    maxLength={1}
                    onChange={(event) =>
                      updateIntent({ initial: event.target.value.toUpperCase() || "A" })
                    }
                  />
                </label>
              )}
              <label className="field-label">
                Primary
                <select
                  value={intent.primaryIngredient}
                  onChange={(event) =>
                    updateIntent({ primaryIngredient: event.target.value as IngredientId })
                  }
                >
                  {enabledIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.pluralLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Secondary
                <select
                  value={intent.secondaryIngredient}
                  onChange={(event) =>
                    updateIntent({ secondaryIngredient: event.target.value as IngredientId })
                  }
                >
                  {enabledIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.pluralLabel}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="range-field">
              <span>
                Density <strong>{Math.round(intent.density * 100)}%</strong>
              </span>
              <input
                type="range"
                min="0.35"
                max="1"
                step="0.05"
                value={intent.density}
                onChange={(event) => updateIntent({ density: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="section-number">03</span>
                <h2>Available pieces</h2>
              </div>
              <span className="section-meta">{enabledIngredients.length} trays</span>
            </div>
            <div className="inventory-list">
              {inventory.map((ingredient) => (
                <div
                  className={`inventory-row ${ingredient.enabled ? "" : "inventory-row--disabled"}`}
                  key={ingredient.id}
                >
                  <label className="ingredient-toggle">
                    <input
                      type="checkbox"
                      checked={ingredient.enabled}
                      onChange={(event) =>
                        updateInventory(ingredient.id, { enabled: event.target.checked })
                      }
                    />
                    <span
                      className="ingredient-swatch"
                      style={{ backgroundColor: ingredient.color, borderColor: ingredient.edgeColor }}
                    />
                    <span>
                      <strong>{ingredient.pluralLabel}</strong>
                      <small>{placementCounts[ingredient.id] ?? 0} planned</small>
                    </span>
                  </label>
                  <Stepper
                    value={ingredient.available}
                    label={ingredient.pluralLabel}
                    onChange={(available) => updateInventory(ingredient.id, { available })}
                  />
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="preview-panel" aria-label="Live board preview">
          <div className="preview-toolbar">
            <div>
              <p className="eyebrow">Live preview</p>
              <h2>{board.label}</h2>
            </div>
            <div className="preview-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPlacements(generatedLayout.placements);
                  setSelectedPlacementId(null);
                }}
              >
                Reset edits
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  setBoard((current) => ({ ...current, calibrated: !current.calibrated }))
                }
              >
                {board.calibrated ? "Frame calibrated" : "Simulate calibration"}
              </button>
            </div>
          </div>

          <div className="board-stage">
            <BoardPreview
              board={board}
              inventory={inventory}
              placements={placements}
              issues={issues}
              selectedPlacementId={selectedPlacementId}
              onSelectPlacement={setSelectedPlacementId}
              onMovePlacement={(id, xMm, yMm) => updatePlacement(id, { xMm, yMm })}
            />
          </div>

          <div className="preview-footer">
            <span>Drag pieces to fine-tune</span>
            <span className="coordinate-note">Origin: board center · units: mm</span>
            <span>{placements.length} placements</span>
          </div>

          {selectedPlacement && (
            <div className="placement-editor" aria-label="Selected placement editor">
              <div className="placement-editor__title">
                <span
                  className="ingredient-swatch"
                  style={{
                    backgroundColor:
                      inventory.find(({ id }) => id === selectedPlacement.ingredientId)?.color,
                  }}
                />
                <div>
                  <p className="eyebrow">Selected piece</p>
                  <strong>{selectedPlacement.id}</strong>
                </div>
              </div>
              <label className="compact-field">
                Ingredient
                <select
                  value={selectedPlacement.ingredientId}
                  onChange={(event) =>
                    updatePlacement(selectedPlacement.id, {
                      ingredientId: event.target.value as IngredientId,
                    })
                  }
                >
                  {enabledIngredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="compact-field">
                X mm
                <DraftNumberInput
                  value={Math.round(selectedPlacement.xMm)}
                  onCommit={(xMm) => updatePlacement(selectedPlacement.id, { xMm })}
                />
              </label>
              <label className="compact-field">
                Y mm
                <DraftNumberInput
                  value={Math.round(selectedPlacement.yMm)}
                  onCommit={(yMm) => updatePlacement(selectedPlacement.id, { yMm })}
                />
              </label>
              <label className="compact-field">
                Rotation
                <DraftNumberInput
                  min={-180}
                  max={180}
                  value={Math.round(selectedPlacement.rotationDeg)}
                  onCommit={(rotationDeg) =>
                    updatePlacement(selectedPlacement.id, { rotationDeg })
                  }
                />
              </label>
              <div className="placement-editor__actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => duplicatePlacement(selectedPlacement)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => removePlacement(selectedPlacement.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="plan-panel" aria-label="Validation and robot plan">
          <section className="readiness-card">
            <div className="readiness-card__header">
              <div className={`readiness-icon readiness-icon--${robotPlan.status}`} aria-hidden="true">
                {robotPlan.status === "ready" ? "✓" : "!"}
              </div>
              <div>
                <p className="eyebrow">Execution status</p>
                <h2>{robotPlan.status === "ready" ? "Ready to hand off" : "Plan is blocked"}</h2>
              </div>
            </div>
            <div className="metric-grid">
              <div>
                <strong>{placements.length}</strong>
                <span>moves</span>
              </div>
              <div>
                <strong>{errorCount}</strong>
                <span>errors</span>
              </div>
              <div>
                <strong>{warningCount}</strong>
                <span>warnings</span>
              </div>
            </div>
          </section>

          <section className="plan-section">
            <div className="section-heading">
              <div>
                <span className="section-number">Checks</span>
                <h2>Preflight</h2>
              </div>
              <span className="section-meta">Live</span>
            </div>
            <div className="check-list" aria-live="polite">
              {issues.length === 0 ? (
                <div className="check-row">
                  <StatusDot severity="info" />
                  <span>No layout issues detected.</span>
                </div>
              ) : (
                issues.map((issue) =>
                  issue.placementIds.length > 0 ? (
                    <button
                      type="button"
                      className="check-row check-row--button"
                      key={issue.id}
                      onClick={() => setSelectedPlacementId(issue.placementIds[0])}
                    >
                      <StatusDot severity={issue.severity} />
                      <span>{issue.message}</span>
                    </button>
                  ) : (
                    <div className="check-row" key={issue.id}>
                      <StatusDot severity={issue.severity} />
                      <span>{issue.message}</span>
                    </div>
                  ),
                )
              )}
            </div>
          </section>

          <section className="plan-section plan-section--sequence">
            <div className="section-heading">
              <div>
                <span className="section-number">Sequence</span>
                <h2>Placement order</h2>
              </div>
              <span className="section-meta">Far → near</span>
            </div>
            <ol className="sequence-list">
              {robotPlan.steps.slice(0, 8).map((step) => {
                const ingredient = inventory.find(({ id }) => id === step.ingredientId);
                return (
                  <li key={step.placementId}>
                    <span className="sequence-index">{String(step.sequence).padStart(2, "0")}</span>
                    <span
                      className="ingredient-swatch ingredient-swatch--small"
                      style={{ backgroundColor: ingredient?.color }}
                    />
                    <div>
                      <strong>{ingredient?.label ?? step.ingredientId}</strong>
                      <small>
                        x {Math.round(step.target.xMm)} · y {Math.round(step.target.yMm)}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ol>
            {robotPlan.steps.length > 8 && (
              <p className="sequence-overflow">+{robotPlan.steps.length - 8} more placements</p>
            )}
          </section>

          <section className="plan-section plan-section--output">
            <div className="section-heading">
              <div>
                <span className="section-number">Output</span>
                <h2>Robot plan</h2>
              </div>
              <span className="schema-chip">v1 JSON</span>
            </div>
            <pre className="json-preview" tabIndex={0}>
              {JSON.stringify(robotPlan, null, 2)}
            </pre>
            <div className="output-actions">
              <button type="button" className="secondary-button" onClick={copyPlan}>
                {copyLabel}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={robotPlan.status === "blocked"}
                onClick={downloadPlan}
              >
                Export plan
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
