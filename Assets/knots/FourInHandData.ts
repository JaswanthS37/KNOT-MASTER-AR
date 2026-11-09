/**
 * FourInHandData.ts
 *
 * EXPLODED-VIEW four-in-hand tie.
 * Every pass of the wide blade floats on its own depth layer, so the cloth
 * never touches itself and you can see exactly what goes where:
 *
 *   z = +3g   wide end falling over the front (step 5)
 *   z = +2g   second front band
 *   z = +1.5g wide end threaded between the two front bands (step 6)
 *   z = +1g   first front band
 *   z =  0    narrow tail (hangs straight down)
 *   z = -1g   back band (behind the narrow tail)
 *
 * In the last step the gaps are squeezed to almost nothing (g -> 0.45) and a
 * knot shape grows over the bundle: "pull it all together".
 *
 * Units: cm. x = right, y = up, z = toward the viewer.
 */

export type V3 = [number, number, number];

export interface TieStepData {
  stepNumber: number;
  title: string;
  caption: string;
  /** Control points of the wide blade (the script smooths them into a curve). */
  points: V3[];
  /** Per point: direction the outside (navy) face should point. */
  faces: V3[];
  /** 0..1: how much of the finished knot shape is visible. */
  knot: number;
}

export interface TieDefinition {
  knotName: string;
  description: string;
  steps: TieStepData[];
  step2to3Mid?: { points: V3[]; faces: V3[] };
  step4to5Mid?: { points: V3[]; faces: V3[] };
  step4to5Rear?: { points: V3[]; faces: V3[] };
  step4to5Up?: { points: V3[]; faces: V3[] };
}

const XC = 0.5; // centre of the knot (x), used when collapsing
const YC = 2.0; // centre of the knot (y), used when collapsing
const GAP = 2.8; // layer separation "g" in cm (visible air gap between layers)

/**
 * Builds the control points for one stage of the tie.
 * stage 1..6 = the tying steps, g = layer gap, sp = vertical spread, sx = horizontal spread.
 * (sp and sx below 1 squeeze the knot together.)
 */
function makeStage(stage: number, g: number, sp: number, sx: number): { points: V3[]; faces: V3[] } {
  const points: V3[] = [];
  const faces: V3[] = [];

  const add = (
    x: number, y: number, z: number,
    hx: number, hy: number, hz: number,
    anchored: boolean
  ): void => {
    const px = anchored ? x : XC + (x - XC) * sx;
    const py = anchored ? y : YC + (y - YC) * sp;
    points.push([px, py, z]);
    faces.push([hx, hy, hz]);
  };

  // Step 1: hanging straight down from the neck on the right.
  add(2.5, 9.0, 0, 0, 0, 1, true);
  if (stage === 1) {
    add(2.5, 5.0, 0, 0, 0, 1, true);
    add(2.5, 1.0, 0, 0, 0, 1, false);
    return { points, faces };
  }

  // Step 2: swing across the FRONT of the narrow tail, then bend down vertically.
  add(2.8, 6.0, 0.35 * g, 0, 0, 1, true);
  add(1.5, 3.0, g, 0, 0, 1, false);
  add(-0.5, 2.0, g, 0, 0, 1, false);
  add(-2.5, 0.5, g, 0, 0, 1, false);
  if (stage === 2) {
    add(-3.2, -2.5, g, 0, 0, 1, false);
    add(-3.2, -6.0, g, 0, 0, 1, false);
    return { points, faces };
  }

  // Step 2.5 WAYPOINT:
  // The wide blade swings wide around the outside left edge to the rear, completely clearing the narrow tail.
  if (stage === 2.5) {
    add(-4.8, -0.8, 0.4 * g, -1, 0, 0, false);
    add(-4.8, -2.8, -0.8 * g, -0.7, 0, -0.7, false);
    add(-4.2, -5.0, -1.2 * g, 0, 0, -1, false);
    add(-4.0, -8.0, -1.2 * g, 0, 0, -1, false);
    return { points, faces };
  }

  // Step 3: around the left edge and BEHIND the narrow tail, bending down vertically on the right.
  if (stage >= 3) {
    add(-3.8, -0.5, 0.0, -1, 0, 0, false);
    add(-3.0, -1.8, -g, 0, 0, -1, false);
    add(-0.5, -2.5, -g, 0, 0, -1, false);
    add(1.8, -3.2, -g, 0, 0, -1, false);
    if (stage === 3) {
      add(3.2, -4.5, -0.5 * g, 1, 0, 0, false);
      add(3.2, -7.5, -0.5 * g, 0, 0, 1, false);
      return { points, faces };
    }
  }

  // Step 4: across the FRONT again, lower and further forward, bending down vertically on the left.
  if (stage >= 4) {
    add(3.0, -5.0, 1.3 * g, 0.5, 0, 0.87, false);
    add(1.5, -5.8, 2 * g, 0, 0, 1, false);
    add(-1.0, -6.5, 2 * g, 0, 0, 1, false);
    if (stage === 4) {
      add(-2.8, -7.8, 2 * g, 0, 0, 1, false);
      add(-2.8, -11.0, 2 * g, 0, 0, 1, false);
      return { points, faces };
    }
  }

  // Step 4.3 WAYPOINT A:
  // The wide end swings around the outside left edge into the rear plane (behind narrow tail and all front bands).
  if (stage === 4.3) {
    add(-4.8, -8.0, 0.8 * g, -1, 0, 0, false);
    add(-4.8, -10.5, -0.6 * g, -0.7, 0, -0.7, false);
    add(-4.5, -13.0, -1.2 * g, 0, 0, -1, false);
    add(-4.5, -16.0, -1.2 * g, 0, 0, -1, false);
    return { points, faces };
  }

  // Step 4.7 WAYPOINT B:
  // The wide end passes under the knot in the deep rear plane and is pulled straight UP BEHIND all bands and narrow tail.
  if (stage === 4.7) {
    add(-4.8, -8.5, 0.5 * g, -1, 0, 0, false);
    add(-4.8, -10.5, -0.8 * g, -0.7, 0, -0.7, false);
    add(-4.2, -12.5, -1.2 * g, 0, 0, -1, false);
    add(-1.5, -12.5, -1.2 * g, 0, 0, -1, false);
    add(1.5, -11.5, -1.2 * g, 0, 0, -1, false);
    add(1.8, -5.0, -1.0 * g, 0, 0, -1, false);
    add(1.8, 0.0, -0.8 * g, 0, 0, -1, false);
    add(1.8, 5.0, -0.6 * g, 0, 0, -1, false);
    add(1.8, 9.5, -0.2 * g, 0, 0.7, 0.7, false);
    add(1.8, 13.0, 0.6 * g, 0, 0, 1, false);
    return { points, faces };
  }

  // Step 5: up BEHIND the front bands and BEHIND the narrow tail, through the neck loop, then over the top and down the front.
  // Step 6: the falling end is threaded between the two front bands.
  if (stage >= 5) {
    add(-4.8, -8.5, 0.5 * g, -1, 0, 0, false);
    add(-4.2, -10.5, -0.8 * g, -0.7, 0, -0.7, false);
    add(-1.5, -11.0, -0.9 * g, 0, 0, -1, false);
    add(1.2, -10.2, -0.9 * g, 0, 0, -1, false);
    add(1.8, -4.5, -0.8 * g, 0, 0, -1, false);
    add(1.8, 3.5, -0.6 * g, 0, 0, -1, false);
    add(1.8, 8.0, 0.2 * g, 0, 1, 0, false);
    if (stage === 5) {
      add(1.7, 5.5, 2.5 * g, 0, 0, 1, false);
      add(1.7, 2.0, 2.5 * g, 0, 0, 1, false);
    } else {
      add(1.6, 5.5, 1.4 * g, 0, 0, 1, false);
      add(1.6, 2.0, 1.4 * g, 0, 0, 1, false);
    }
  }

  return { points, faces };
}

const s1 = makeStage(1, GAP, 1, 1);
const s2 = makeStage(2, GAP, 1, 1);
const s2_mid = makeStage(2.5, GAP, 1, 1);
const s3 = makeStage(3, GAP, 1, 1);
const s4 = makeStage(4, GAP, 1, 1);
const s4_rear = makeStage(4.3, GAP, 1, 1);
const s4_up = makeStage(4.7, GAP, 1, 1);
const s5 = makeStage(5, GAP, 1, 1);
const s6 = makeStage(6, GAP, 1, 1);
// Final step: same path as step 6, with the gaps squeezed shut.
const s7 = makeStage(6, 0.45, 0.4, 0.4);

export const FOUR_IN_HAND_DATA: TieDefinition = {
  knotName: "Four-in-Hand Knot",
  description: "The everyday necktie knot, shown with gaps between every layer so each move is easy to follow.",
  step2to3Mid: s2_mid,
  step4to5Rear: s4_rear,
  step4to5Up: s4_up,
  steps: [
    {
      stepNumber: 1,
      title: "",
      caption: "Drape the tie around your neck. The wide end hangs on your right, well below the narrow end.",
      points: s1.points, faces: s1.faces, knot: 0,
    },
    {
      stepNumber: 2,
      title: "",
      caption: "Swing the wide end across the front of the narrow end, right to left. The gap shows it stays in front.",
      points: s2.points, faces: s2.faces, knot: 0,
    },
    {
      stepNumber: 3,
      title: "",
      caption: "Take the wide end around behind the narrow end and back out to the right.",
      points: s3.points, faces: s3.faces, knot: 0,
    },
    {
      stepNumber: 4,
      title: "",
      caption: "Bring the wide end across the front a second time, a little lower than before.",
      points: s4.points, faces: s4.faces, knot: 0,
    },
    {
      stepNumber: 5,
      title: "",
      caption: "Take the wide end up behind the front bands and through the neck loop, resting vertically above the front loop.",
      points: s5.points, faces: s5.faces, knot: 0,
    },
    {
      stepNumber: 6,
      title: "",
      caption: "Pass the wide end down through the loop in front, between the two front bands.",
      points: s6.points, faces: s6.faces, knot: 0,
    },
    {
      stepNumber: 7,
      title: "",
      caption: "Hold the narrow end and slide the knot up to snug it. The gaps close and the knot forms.",
      points: s7.points, faces: s7.faces, knot: 1,
    },
  ],
};
