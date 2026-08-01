import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  BoardSpec,
  IngredientId,
  InventoryItem,
  Placement,
  ValidationIssue,
  ValidationSeverity,
} from "../configurator/types";

export interface BoardPreviewProps {
  board: BoardSpec;
  inventory: InventoryItem[];
  placements: Placement[];
  issues: ValidationIssue[];
  selectedPlacementId: string | null;
  onSelectPlacement: (placementId: string) => void;
  onMovePlacement: (
    placementId: string,
    xMm: number,
    yMm: number,
  ) => void;
}

const SEVERITY_RANK: Record<ValidationSeverity, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

const SEVERITY_COLOR: Record<ValidationSeverity, string> = {
  info: "#2563eb",
  warning: "#b45309",
  error: "#dc2626",
};

interface BoardPoint {
  xMm: number;
  yMm: number;
}

interface DragState {
  pointerId: number;
  placementId: string;
  offsetXMm: number;
  offsetYMm: number;
  footprintMm: number;
}

function highestSeverity(
  placementIssues: ValidationIssue[],
): ValidationSeverity | null {
  let severity: ValidationSeverity | null = null;

  for (const issue of placementIssues) {
    if (!severity || SEVERITY_RANK[issue.severity] > SEVERITY_RANK[severity]) {
      severity = issue.severity;
    }
  }

  return severity;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampToBoard(
  xMm: number,
  yMm: number,
  boardRadiusMm: number,
  footprintMm: number,
): BoardPoint {
  const maximumCenterRadius = Math.max(0, boardRadiusMm - footprintMm / 2);
  const distance = Math.hypot(xMm, yMm);

  if (distance <= maximumCenterRadius || distance === 0) {
    return { xMm: roundToTenth(xMm), yMm: roundToTenth(yMm) };
  }

  const scale = maximumCenterRadius / distance;
  return {
    xMm: roundToTenth(xMm * scale),
    yMm: roundToTenth(yMm * scale),
  };
}

interface IngredientGlyphProps {
  ingredientId: IngredientId;
  item: InventoryItem | undefined;
  footprintMm: number;
  shadowId: string;
}

function IngredientGlyph({
  ingredientId,
  item,
  footprintMm,
  shadowId,
}: IngredientGlyphProps) {
  const size = footprintMm;
  const color = item?.color ?? "#64748b";
  const edgeColor = item?.edgeColor ?? "#334155";
  const common = {
    stroke: edgeColor,
    strokeWidth: Math.max(1, size * 0.055),
    vectorEffect: "non-scaling-stroke" as const,
  };

  if (ingredientId === "berry" || item?.shape === "cluster") {
    const berryRadius = size * 0.205;
    const berries = [
      [-0.19, -0.16],
      [0.17, -0.18],
      [-0.2, 0.15],
      [0.19, 0.14],
      [0, 0],
    ] as const;

    return (
      <g filter={`url(#${shadowId})`}>
        {berries.map(([x, y], index) => (
          <circle
            key={`${x}-${y}`}
            cx={x * size}
            cy={y * size}
            r={berryRadius}
            fill={index === 4 ? color : index % 2 ? "#93366d" : color}
            {...common}
          />
        ))}
        <path
          d={`M 0 ${-size * 0.25} Q ${size * 0.08} ${-size * 0.43} ${
            size * 0.2
          } ${-size * 0.4}`}
          fill="none"
          stroke="#365314"
          strokeLinecap="round"
          strokeWidth={Math.max(1, size * 0.06)}
        />
        <circle
          cx={-size * 0.055}
          cy={-size * 0.07}
          r={size * 0.045}
          fill="#ffffff"
          opacity={0.5}
        />
      </g>
    );
  }

  if (ingredientId === "cheese" || item?.shape === "square") {
    const side = size * 0.82;
    return (
      <g filter={`url(#${shadowId})`}>
        <rect
          x={-side / 2}
          y={-side / 2}
          width={side}
          height={side}
          rx={size * 0.11}
          fill={color}
          {...common}
        />
        <path
          d={`M ${-side / 2 + size * 0.08} ${-side / 2 + size * 0.12} H ${
            side / 2 - size * 0.1
          }`}
          stroke="#fff7bf"
          strokeLinecap="round"
          strokeWidth={size * 0.07}
          opacity={0.65}
        />
        <circle cx={-size * 0.19} cy={size * 0.13} r={size * 0.07} fill={edgeColor} opacity={0.42} />
        <circle cx={size * 0.17} cy={-size * 0.12} r={size * 0.052} fill={edgeColor} opacity={0.35} />
        <circle cx={size * 0.2} cy={size * 0.2} r={size * 0.036} fill={edgeColor} opacity={0.34} />
      </g>
    );
  }

  if (ingredientId === "cracker") {
    const points = Array.from({ length: 24 }, (_, index) => {
      const angle = (index / 24) * Math.PI * 2 - Math.PI / 2;
      const radius = size * (index % 2 === 0 ? 0.46 : 0.43);
      return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`;
    }).join(" ");

    return (
      <g filter={`url(#${shadowId})`}>
        <polygon points={points} fill={color} strokeLinejoin="round" {...common} />
        <circle r={size * 0.31} fill="none" stroke={edgeColor} strokeWidth={size * 0.025} opacity={0.45} />
        {[-0.17, 0, 0.17].flatMap((x) =>
          [-0.17, 0, 0.17].map((y) => (
            <circle key={`${x}-${y}`} cx={x * size} cy={y * size} r={size * 0.025} fill={edgeColor} opacity={0.6} />
          )),
        )}
      </g>
    );
  }

  if (ingredientId === "salami") {
    return (
      <g filter={`url(#${shadowId})`}>
        <circle r={size * 0.46} fill={color} {...common} />
        <circle r={size * 0.36} fill="none" stroke="#7f1d1d" strokeWidth={size * 0.025} opacity={0.55} />
        {[
          [-0.2, -0.13, 0.055],
          [0.17, -0.2, 0.045],
          [0.21, 0.13, 0.06],
          [-0.13, 0.2, 0.04],
          [0.03, 0.02, 0.05],
        ].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x * size} cy={y * size} r={r * size} fill="#f8d7c6" opacity={0.8} />
        ))}
      </g>
    );
  }

  if (ingredientId === "olive") {
    return (
      <g filter={`url(#${shadowId})`}>
        <ellipse rx={size * 0.43} ry={size * 0.34} fill={color} {...common} />
        <ellipse cx={size * 0.16} cy={-size * 0.03} rx={size * 0.09} ry={size * 0.075} fill="#11140b" opacity={0.9} />
        <path
          d={`M ${-size * 0.25} ${-size * 0.13} Q ${-size * 0.08} ${-size * 0.25} ${size * 0.04} ${-size * 0.19}`}
          fill="none"
          stroke="#ffffff"
          strokeLinecap="round"
          strokeWidth={size * 0.045}
          opacity={0.28}
        />
      </g>
    );
  }

  if (ingredientId === "grape") {
    return (
      <g filter={`url(#${shadowId})`}>
        <ellipse rx={size * 0.39} ry={size * 0.46} fill={color} {...common} />
        <path
          d={`M 0 ${-size * 0.43} Q ${size * 0.04} ${-size * 0.55} ${size * 0.15} ${-size * 0.57}`}
          fill="none"
          stroke="#365314"
          strokeLinecap="round"
          strokeWidth={Math.max(1, size * 0.055)}
        />
        <ellipse cx={-size * 0.13} cy={-size * 0.18} rx={size * 0.075} ry={size * 0.12} fill="#ffffff" opacity={0.35} />
      </g>
    );
  }

  return <circle r={size * 0.44} fill={color} {...common} filter={`url(#${shadowId})`} />;
}

export function BoardPreview({
  board,
  inventory,
  placements,
  issues,
  selectedPlacementId,
  onSelectPlacement,
  onMovePlacement,
}: BoardPreviewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const woodGradientId = `${id}-wood-gradient`;
  const woodLightId = `${id}-wood-light`;
  const grainId = `${id}-wood-grain`;
  const shadowId = `${id}-piece-shadow`;
  const axisArrowId = `${id}-axis-arrow`;

  const diameterMm = Math.max(1, finiteOr(board.diameterMm, 300));
  const radiusMm = diameterMm / 2;
  const unit = diameterMm / 300;
  const paddingMm = 30 * unit;
  const previewRadiusMm = radiusMm + paddingMm;
  const safeRadiusMm = Math.max(
    1,
    radiusMm - Math.max(0, finiteOr(board.marginMm, 0)),
  );
  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const placementIssueMap = new Map<string, ValidationIssue[]>();

  for (const issue of issues) {
    for (const placementId of issue.placementIds) {
      const current = placementIssueMap.get(placementId) ?? [];
      current.push(issue);
      placementIssueMap.set(placementId, current);
    }
  }

  const globalIssues = issues.filter((issue) => issue.placementIds.length === 0);
  const globalSeverity = highestSeverity(globalIssues);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  function clientToBoardPoint(clientX: number, clientY: number): BoardPoint | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const localPoint = point.matrixTransform(matrix.inverse());

    return {
      xMm: localPoint.x,
      // SVG y increases down the screen. Board +y points away from the robot,
      // which is displayed upward in this preview.
      yMm: -localPoint.y,
    };
  }

  function beginDrag(
    event: ReactPointerEvent<SVGGElement>,
    placement: Placement,
    footprintMm: number,
  ) {
    onSelectPlacement(placement.id);
    event.currentTarget.focus();

    if (placement.locked || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    const point = clientToBoardPoint(event.clientX, event.clientY);
    if (!point) return;

    dragRef.current = {
      pointerId: event.pointerId,
      placementId: placement.id,
      offsetXMm: placement.xMm - point.xMm,
      offsetYMm: placement.yMm - point.yMm,
      footprintMm,
    };
    setDraggingId(placement.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function continueDrag(event: ReactPointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const point = clientToBoardPoint(event.clientX, event.clientY);
    if (!point) return;

    const next = clampToBoard(
      point.xMm + drag.offsetXMm,
      point.yMm + drag.offsetYMm,
      radiusMm,
      drag.footprintMm,
    );
    onMovePlacement(drag.placementId, next.xMm, next.yMm);
  }

  function endDrag(event: ReactPointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setDraggingId(null);
  }

  function handlePlacementKeyDown(
    event: ReactKeyboardEvent<SVGGElement>,
    placement: Placement,
    footprintMm: number,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectPlacement(placement.id);
      return;
    }

    if (placement.locked || !event.key.startsWith("Arrow")) return;

    const stepMm = event.shiftKey ? 10 : 2;
    let xMm = placement.xMm;
    let yMm = placement.yMm;

    switch (event.key) {
      case "ArrowRight":
        xMm += stepMm;
        break;
      case "ArrowLeft":
        xMm -= stepMm;
        break;
      case "ArrowUp":
        yMm += stepMm;
        break;
      case "ArrowDown":
        yMm -= stepMm;
        break;
      default:
        return;
    }

    event.preventDefault();
    onSelectPlacement(placement.id);
    const next = clampToBoard(xMm, yMm, radiusMm, footprintMm);
    onMovePlacement(placement.id, next.xMm, next.yMm);
  }

  const statusLabel = [
    `${placements.length} placement${placements.length === 1 ? "" : "s"}`,
    errorCount ? `${errorCount} error${errorCount === 1 ? "" : "s"}` : "",
    warningCount
      ? `${warningCount} warning${warningCount === 1 ? "" : "s"}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="board-preview"
      style={{ width: "100%", minWidth: 0 }}
      data-placement-count={placements.length}
    >
      <svg
        ref={svgRef}
        viewBox={`${-previewRadiusMm} ${-previewRadiusMm} ${
          previewRadiusMm * 2
        } ${previewRadiusMm * 2}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-labelledby={`${titleId} ${descriptionId}`}
        data-testid="board-preview"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          aspectRatio: "1 / 1",
          overflow: "visible",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <title id={titleId}>{board.label} layout preview</title>
        <desc id={descriptionId}>
          {statusLabel}. Board coordinates use the center as the origin, positive x
          to the right, and positive y away from the robot. Tab to a placement,
          press Enter or Space to select it, and use the arrow keys to move it.
        </desc>

        <defs>
          <linearGradient id={woodGradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e4c493" />
            <stop offset="38%" stopColor="#cf9f63" />
            <stop offset="72%" stopColor="#bc8247" />
            <stop offset="100%" stopColor="#d5a66b" />
          </linearGradient>
          <radialGradient id={woodLightId} cx="38%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#fff6df" stopOpacity={0.35} />
            <stop offset="68%" stopColor="#8b572a" stopOpacity={0} />
            <stop offset="100%" stopColor="#6f421f" stopOpacity={0.18} />
          </radialGradient>
          <pattern
            id={grainId}
            width={44 * unit}
            height={22 * unit}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-8)"
          >
            <path
              d={`M ${-3 * unit} ${5 * unit} C ${8 * unit} ${-1 * unit}, ${
                20 * unit
              } ${11 * unit}, ${47 * unit} ${3 * unit}`}
              fill="none"
              stroke="#74451f"
              strokeWidth={0.7 * unit}
              opacity={0.22}
            />
            <path
              d={`M ${-4 * unit} ${15 * unit} C ${12 * unit} ${8 * unit}, ${
                26 * unit
              } ${22 * unit}, ${48 * unit} ${13 * unit}`}
              fill="none"
              stroke="#fff2cf"
              strokeWidth={0.55 * unit}
              opacity={0.2}
            />
          </pattern>
          <filter
            id={shadowId}
            x="-40%"
            y="-40%"
            width="180%"
            height="190%"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow
              dx={0.8 * unit}
              dy={1.8 * unit}
              stdDeviation={1.4 * unit}
              floodColor="#3d2411"
              floodOpacity={0.32}
            />
          </filter>
          <marker
            id={axisArrowId}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b4c2d" opacity={0.58} />
          </marker>
        </defs>

        <style>{`
          .board-preview-placement { outline: none; }
          .board-preview-placement .board-preview-focus-ring { opacity: 0; }
          .board-preview-placement:focus-visible .board-preview-focus-ring { opacity: 1; }
          .board-preview-placement:hover .board-preview-hover-ring { opacity: 0.55; }
        `}</style>

        <circle
          r={radiusMm + 2.5 * unit}
          fill="#6f421f"
          opacity={0.3}
          transform={`translate(0 ${3 * unit})`}
          aria-hidden="true"
        />
        <circle
          r={radiusMm}
          fill={`url(#${woodGradientId})`}
          stroke={globalSeverity ? SEVERITY_COLOR[globalSeverity] : "#76502c"}
          strokeWidth={(globalSeverity ? 3 : 1.8) * unit}
          aria-hidden="true"
        />
        <circle r={radiusMm} fill={`url(#${grainId})`} aria-hidden="true" />
        <circle r={radiusMm} fill={`url(#${woodLightId})`} aria-hidden="true" />
        <circle
          r={radiusMm - 5 * unit}
          fill="none"
          stroke="#fff5dc"
          strokeWidth={0.8 * unit}
          opacity={0.28}
          aria-hidden="true"
        />

        <g opacity={0.42} aria-hidden="true">
          <line
            x1={-safeRadiusMm}
            y1={0}
            x2={safeRadiusMm}
            y2={0}
            stroke="#6b4c2d"
            strokeWidth={0.65 * unit}
            strokeDasharray={`${2.5 * unit} ${4 * unit}`}
            markerEnd={`url(#${axisArrowId})`}
          />
          <line
            x1={0}
            y1={safeRadiusMm}
            x2={0}
            y2={-safeRadiusMm}
            stroke="#6b4c2d"
            strokeWidth={0.65 * unit}
            strokeDasharray={`${2.5 * unit} ${4 * unit}`}
            markerEnd={`url(#${axisArrowId})`}
          />
          <text
            x={safeRadiusMm - 1 * unit}
            y={-4 * unit}
            textAnchor="end"
            fill="#5b3a20"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={7.5 * unit}
            fontWeight="700"
          >
            +X
          </text>
          <text
            x={4 * unit}
            y={-safeRadiusMm + 8 * unit}
            fill="#5b3a20"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize={7.5 * unit}
            fontWeight="700"
          >
            +Y · AWAY
          </text>
          <circle r={2.2 * unit} fill="#5b3a20" />
          <circle r={5 * unit} fill="none" stroke="#5b3a20" strokeWidth={0.7 * unit} />
        </g>

        <circle
          r={safeRadiusMm}
          fill="none"
          stroke="#f8f1df"
          strokeWidth={1.15 * unit}
          strokeDasharray={`${5 * unit} ${4 * unit}`}
          opacity={0.72}
          aria-hidden="true"
        />
        <g
          transform={`translate(${-(safeRadiusMm * 0.69)} ${-(safeRadiusMm * 0.72)})`}
          aria-hidden="true"
        >
          <rect
            x={-4 * unit}
            y={-8.3 * unit}
            width={63 * unit}
            height={14 * unit}
            rx={7 * unit}
            fill="#6f421f"
            opacity={0.72}
          />
          <text
            x={27.5 * unit}
            y={1.1 * unit}
            textAnchor="middle"
            fill="#fff8e8"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={7.3 * unit}
            fontWeight="700"
            letterSpacing={0.45 * unit}
          >
            SAFE MARGIN
          </text>
        </g>

        {placements.length === 0 && (
          <g aria-hidden="true" pointerEvents="none">
            <circle
              r={31 * unit}
              fill="#fff8e8"
              stroke="#8b623d"
              strokeWidth={1.1 * unit}
              strokeDasharray={`${4 * unit} ${4 * unit}`}
              opacity={0.82}
            />
            <path
              d={`M ${-12 * unit} ${3 * unit} Q 0 ${-10 * unit} ${12 * unit} ${3 * unit}`}
              fill="none"
              stroke="#79512f"
              strokeWidth={2 * unit}
              strokeLinecap="round"
              opacity={0.7}
            />
            <circle cx={-10 * unit} cy={-9 * unit} r={2.2 * unit} fill="#79512f" opacity={0.7} />
            <circle cx={10 * unit} cy={-9 * unit} r={2.2 * unit} fill="#79512f" opacity={0.7} />
            <text
              x={0}
              y={47 * unit}
              textAnchor="middle"
              fill="#5d3b20"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize={9.5 * unit}
              fontWeight="750"
            >
              Your layout will appear here
            </text>
            <text
              x={0}
              y={60 * unit}
              textAnchor="middle"
              fill="#765535"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              fontSize={7.6 * unit}
            >
              Describe a pattern to start arranging
            </text>
          </g>
        )}

        {placements.map((placement, placementIndex) => {
          const item = inventoryById.get(placement.ingredientId);
          const footprintMm = Math.max(
            6 * unit,
            finiteOr(item?.footprintMm ?? 24, 24),
          );
          const xMm = finiteOr(placement.xMm, 0);
          const yMm = finiteOr(placement.yMm, 0);
          const placementIssues = placementIssueMap.get(placement.id) ?? [];
          const severity = highestSeverity(placementIssues);
          const selected = placement.id === selectedPlacementId;
          const dragging = placement.id === draggingId;
          const ringRadius = footprintMm / 2 + 4.2 * unit;
          const issueSummary = placementIssues.map((issue) => issue.message).join("; ");
          const label = item?.label ?? placement.ingredientId;
          const accessibilityLabel = `${label}, placement ${placementIndex + 1}, ${
            placement.role
          }, x ${roundToTenth(xMm)} millimeters, y ${roundToTenth(yMm)} millimeters${
            placement.locked ? ", locked" : ""
          }${issueSummary ? `. Issue: ${issueSummary}` : ""}`;

          return (
            <g
              key={placement.id}
              className="board-preview-placement"
              data-placement-id={placement.id}
              data-ingredient-id={placement.ingredientId}
              transform={`translate(${xMm} ${-yMm})`}
              role="button"
              tabIndex={0}
              aria-label={accessibilityLabel}
              aria-pressed={selected}
              aria-keyshortcuts="Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight"
              onFocus={() => onSelectPlacement(placement.id)}
              onPointerDown={(event) => beginDrag(event, placement, footprintMm)}
              onPointerMove={continueDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onLostPointerCapture={() => {
                if (dragRef.current?.placementId === placement.id) {
                  dragRef.current = null;
                  setDraggingId(null);
                }
              }}
              onKeyDown={(event) =>
                handlePlacementKeyDown(event, placement, footprintMm)
              }
              style={{
                cursor: placement.locked ? "pointer" : dragging ? "grabbing" : "grab",
              }}
            >
              <title>{accessibilityLabel}</title>
              <circle
                className="board-preview-hover-ring"
                r={ringRadius}
                fill="transparent"
                stroke="#fffdf7"
                strokeWidth={1.2 * unit}
                opacity={0}
                pointerEvents="none"
              />
              <circle
                r={ringRadius}
                fill="none"
                stroke={severity ? SEVERITY_COLOR[severity] : "transparent"}
                strokeWidth={(severity === "error" ? 3.1 : 2.4) * unit}
                strokeDasharray={severity === "warning" ? `${4 * unit} ${3 * unit}` : undefined}
                opacity={severity ? 0.95 : 0}
                pointerEvents="none"
              />
              <circle
                r={ringRadius + 2.7 * unit}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth={2.1 * unit}
                strokeDasharray={`${5 * unit} ${2.5 * unit}`}
                opacity={selected ? 0.95 : 0}
                pointerEvents="none"
              />
              <circle
                className="board-preview-focus-ring"
                r={ringRadius + 5.4 * unit}
                fill="none"
                stroke="#0f172a"
                strokeWidth={1.8 * unit}
                strokeDasharray={`${2.5 * unit} ${2.5 * unit}`}
                pointerEvents="none"
              />

              <g transform={`rotate(${finiteOr(placement.rotationDeg, 0)})`}>
                <IngredientGlyph
                  ingredientId={placement.ingredientId}
                  item={item}
                  footprintMm={footprintMm}
                  shadowId={shadowId}
                />
              </g>

              {severity && (
                <g
                  transform={`translate(${ringRadius * 0.73} ${-ringRadius * 0.73})`}
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  <circle
                    r={6.2 * unit}
                    fill={SEVERITY_COLOR[severity]}
                    stroke="#fffdf8"
                    strokeWidth={1.5 * unit}
                  />
                  <text
                    x={0}
                    y={2.8 * unit}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    fontSize={9 * unit}
                    fontWeight="900"
                  >
                    !
                  </text>
                </g>
              )}

              {placement.locked && (
                <g
                  transform={`translate(${-ringRadius * 0.76} ${ringRadius * 0.76})`}
                  pointerEvents="none"
                  aria-hidden="true"
                >
                  <circle r={6.2 * unit} fill="#fffdf8" stroke="#475569" strokeWidth={1.1 * unit} />
                  <rect
                    x={-2.6 * unit}
                    y={-0.5 * unit}
                    width={5.2 * unit}
                    height={4 * unit}
                    rx={0.8 * unit}
                    fill="#475569"
                  />
                  <path
                    d={`M ${-1.8 * unit} ${-0.5 * unit} V ${-2.1 * unit} A ${
                      1.8 * unit
                    } ${1.8 * unit} 0 0 1 ${1.8 * unit} ${-2.1 * unit} V ${
                      -0.5 * unit
                    }`}
                    fill="none"
                    stroke="#475569"
                    strokeWidth={1.2 * unit}
                  />
                </g>
              )}
            </g>
          );
        })}

        <g
          transform={`translate(0 ${radiusMm + 16 * unit})`}
          aria-hidden="true"
          opacity={0.74}
        >
          <path
            d={`M ${-16 * unit} 0 H ${16 * unit}`}
            stroke="#705136"
            strokeWidth={1 * unit}
          />
          <path
            d={`M ${-4 * unit} ${-3 * unit} L 0 0 L ${-4 * unit} ${3 * unit}`}
            fill="none"
            stroke="#705136"
            strokeWidth={1 * unit}
          />
          <text
            x={22 * unit}
            y={2.6 * unit}
            fill="#705136"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            fontSize={7.2 * unit}
            fontWeight="700"
            letterSpacing={0.45 * unit}
          >
            ROBOT SIDE
          </text>
        </g>
      </svg>
    </div>
  );
}

export default BoardPreview;
