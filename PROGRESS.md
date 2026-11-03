# Overhand Knot Lens Development Progress

## Overview
Developing the interactive Overhand Knot tutorial for the Learn AR with SPECS Devpost hackathon.

---

## Current Status: BLOCKED (Awaiting MCP Session Registration)

- **Blocker:** Lens Studio MCP tools (`ExecuteEditorCode`, `VirtualScene`, `CaptureRuntimeViewTool`, `RecompileTypeScriptTool`) are not registered in the active assistant session.
- **Rule Enforcement:** Per project `AGENTS.md` Hard Rules, raw HTTP/REST workarounds are prohibited when MCP tools are unavailable, and development cannot advance to Stage 1 without live Preview verification.
- **Next Action:** Open `test4` in Lens Studio, restart/reload the assistant session with `test4` as the workspace so MCP tools are bound at startup, then resume Stage 1.

---

## Stage Tracking

### STAGE 1 - Rope proof
- [ ] Procedural rope: thin tube following smooth curve through 3D points
- [ ] Placed ~60 cm in front of camera, ~40 cm long
- [ ] Last 20% ("working end") colored differently from standing part (80%)
- [ ] Verified rendering in preview

### STAGE 2 - Knot as data
- [ ] knots/overhand.json data file with 4 steps (title, caption, 3D points in cm)
- [ ] Load-time arc-length resampling to 64 points
- [ ] Step 1: Straight rope ((-20,0,0) to (20,0,0))
- [ ] Step 2: Loop crossing over standing part
- [ ] Step 3: Working end passing behind and up through loop
- [ ] Step 4: Trefoil curve tightening (exact mathematical trefoil + 8cm tails)

### STAGE 3 - Step animation
- [ ] 1.2s smooth ease-in/out interpolation between shapes
- [ ] Step caption text displayed under rope
- [ ] Advance and replay from previous step shape
- [ ] Verified in preview

### STAGE 4 - Controls
- [ ] 3D cube buttons under rope: Previous, Replay, Next
- [ ] Title text above rope: "Overhand Knot"
- [ ] Start Over and Main Menu cubes off to side
- [ ] Button enable/disable state (Previous disabled on step 1, Next on last step)

### STAGE 5 - Rotation
- [ ] 360-degree rotation of rope model around vertical axis (for inspection)
