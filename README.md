# Prompt to Platter

Real-time charcuterie-board configuration for the reBot B601-RS hackathon project. The app turns a short natural-language request into a board-relative layout, lets an operator refine it, runs preflight checks, and exports a deterministic robot handoff plan.

## Run it

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test
npm run build
```

## What is implemented

- Offline prompt interpretation for smileys, hearts, rainbows, spirals, and initials.
- Ingredient-role parsing such as “berries are the eyes” and “cheese makes the smile.”
- Live inventory and density controls.
- A draggable, keyboard-accessible 300 mm board preview.
- Bounds, spacing, inventory, duplicate-ID, prompt-confidence, and calibration gates.
- Far-to-near placement ordering using the convention `+x right, +y away from robot`.
- Copyable and downloadable `charcuterie-board-plan/v1` JSON.

## Architecture

```text
prompt + inventory
        |
        v
  intent parser
        |
        v
 deterministic layout ----> operator edits
        |                         |
        +-----------+-------------+
                    v
             preflight checks
                    |
                    v
       board-relative JSON plan
                    |
                    v
   Jetson adapter + placement policy
```

The configuration domain is intentionally pure and independent of React:

- `src/configurator/promptParser.ts` — prompt to structured intent.
- `src/configurator/layoutEngine.ts` — intent to board-relative placements.
- `src/configurator/validation.ts` — execution preflight.
- `src/configurator/robotPlan.ts` — versioned robot handoff schema.
- `src/components/BoardConfigurator.tsx` — operator workflow.
- `src/components/BoardPreview.tsx` — interactive SVG board.

## Jetson handoff

The exported plan contains semantic source zones, grasp profiles, and target poses in the `charcuterie_board` frame. It is not a joint-space command and must not be sent directly to the arm.

The Jetson-side adapter should:

1. Load the exported `charcuterie-board-plan/v1` object.
2. Reject any plan whose status is not `ready`.
3. Resolve each `sourceZone` through perception or a calibrated tray pose.
4. Transform board-frame targets into the robot base frame.
5. Execute each pick-and-place with the learned placement skill or a guarded motion primitive.
6. Re-observe after each placement and stop on grasp, obstruction, or frame-confidence failure.

`Simulate calibration` is a UI-only stand-in. Replace it with the actual board-frame calibration state before connecting execution.

## Suggested five-person split

1. Configurator and JSON contract.
2. Board/tray perception and frame calibration.
3. B601-RS pick-and-place executor and safety stops.
4. Demonstration collection and ACT placement policy.
5. Jetson integration, evaluation, and demo narrative.

For the weekend MVP, keep generative planning and motor learning separate: this app decides *where* pieces go; the policy learns *how* to place one piece at a supplied target reliably.

## Jetson Thor data collection

The traditional-engineer handoff for Hugging Face data collection lives in [`jetson-thor-data-collection/`](jetson-thor-data-collection/README.md). It includes a single `./collector` command, diagnostics, session lifecycle tools, and team operations documentation. Application code belongs in GitHub; recorded sessions belong in the private Hugging Face dataset.
