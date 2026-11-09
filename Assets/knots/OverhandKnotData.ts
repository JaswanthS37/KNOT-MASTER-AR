export interface KnotStep {
  stepNumber: number;
  title: string;
  caption: string;
  points: [number, number, number][];
}

export interface KnotDefinition {
  knotName: string;
  description: string;
  steps: KnotStep[];
}

export const OVERHAND_KNOT_DATA: KnotDefinition = {
  knotName: "Overhand Knot",
  description: "The simplest of all knots, forming the foundation of many practical knots.",
  steps: [
    {
      stepNumber: 1,
      title: "",
      caption: "Lay the rope flat and straight. The colored end is the working end.",
      points: [
        [-20.0, 0.0, 0.0],
        [-10.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [10.0, 0.0, 0.0],
        [20.0, 0.0, 0.0]
      ]
    },
    {
      stepNumber: 2,
      title: "",
      caption: "Cross the working end over the standing part to form a loop.",
      points: [
        [-20.0, 0.0, 0.0],
        [-12.0, 0.0, 0.0],
        [-4.0, 0.0, 0.0],
        [3.0, 0.0, 0.0],
        [8.0, 4.0, 0.4],
        [6.0, 10.5, 0.8],
        [-0.5, 11.5, 1.2],
        [-5.5, 7.0, 2.0],
        [-5.5, 0.0, 2.2],
        [-5.5, -6.0, 2.2]
      ]
    },
    {
      stepNumber: 3,
      title: "",
      caption: "Pass the working end behind the loop and bring it up through the center.",
      points: [
        [-20.0, 0.0, 0.0],
        [-12.0, 0.0, 0.0],
        [-4.0, 0.0, 0.0],
        [2.5, 0.0, 0.0],
        [6.0, 3.0, 0.4],
        [4.5, 7.5, 0.8],
        [-0.5, 8.5, 1.2],
        [-4.5, 5.0, 2.0],
        [-4.5, 0.0, 2.2],
        [-4.0, -3.5, 0.8],
        [-2.0, -6.0, -2.5],
        [1.5, -4.5, -2.5],
        [1.5, 0.5, -2.5],
        [1.5, 4.5, 0.5],
        [1.5, 8.5, 2.5]
      ]
    },
    {
      stepNumber: 4,
      title: "",
      caption: "Pull both ends firmly in opposite directions to cinch the knot.",
      points: [
        [-8.0, -0.734, 0.0],
        [-4.0, -0.734, 0.0],
        [0.0, -0.734, 0.0],
        [0.476, -0.69, -0.281],
        [0.924, -0.562, -0.519],
        [1.319, -0.36, -0.678],
        [1.638, -0.098, -0.734],
        [1.865, 0.202, -0.678],
        [1.987, 0.519, -0.519],
        [2.0, 0.827, -0.281],
        [1.907, 1.101, 0.0],
        [1.716, 1.319, 0.281],
        [1.443, 1.461, 0.519],
        [1.108, 1.514, 0.678],
        [0.734, 1.468, 0.734],
        [0.348, 1.322, 0.678],
        [-0.025, 1.081, 0.519],
        [-0.36, 0.757, 0.281],
        [-0.636, 0.367, 0.0],
        [-0.836, -0.067, -0.281],
        [-0.949, -0.519, -0.519],
        [-0.971, -0.962, -0.678],
        [-0.904, -1.369, -0.734],
        [-0.757, -1.716, -0.678],
        [-0.544, -1.98, -0.519],
        [-0.284, -2.145, -0.281],
        [0.0, -2.202, 0.0],
        [0.284, -2.145, 0.281],
        [0.544, -1.98, 0.519],
        [0.757, -1.716, 0.678],
        [0.904, -1.369, 0.734],
        [0.971, -0.962, 0.678],
        [0.949, -0.519, 0.519],
        [0.836, -0.067, 0.281],
        [0.636, 0.367, 0.0],
        [0.36, 0.757, -0.281],
        [0.025, 1.081, -0.519],
        [-0.348, 1.322, -0.678],
        [-0.734, 1.468, -0.734],
        [-1.108, 1.514, -0.678],
        [-1.443, 1.461, -0.519],
        [-1.716, 1.319, -0.281],
        [-1.907, 1.101, 0.0],
        [-2.0, 0.827, 0.281],
        [-1.987, 0.519, 0.519],
        [-1.865, 0.202, 0.678],
        [-1.638, -0.098, 0.734],
        [-1.319, -0.36, 0.678],
        [-0.924, -0.562, 0.519],
        [-0.476, -0.69, 0.281],
        [0.0, -0.734, 0.0],
        [4.0, -0.734, 0.0],
        [8.0, -0.734, 0.0]
      ]
    }
  ]
};

// Intermediate waypoint for Step 2 -> 3 transition:
// Working end dips gently and swings behind into -Z (Z <= -2.5) while the loop starts narrowing
export const OVERHAND_WAYPOINT_2_TO_3: [number, number, number][] = [
  [-20.0, 0.0, 0.0],
  [-12.0, 0.0, 0.0],
  [-4.0, 0.0, 0.0],
  [3.0, 0.0, 0.0],
  [7.5, 3.5, 0.4],
  [5.5, 9.5, 0.8],
  [-0.5, 10.5, 1.2],
  [-5.5, 6.0, 2.0],
  [-5.5, 0.0, 2.2],
  [-5.0, -4.5, 1.2],
  [-2.5, -7.5, -2.5],
  [1.5, -6.5, -2.5],
  [1.5, -2.0, -2.5]
];

// Intermediate waypoint for Step 3 -> 4 tightening transition:
// Working end stays threaded through the loop aperture, bending forward-right as the loop contracts
export const OVERHAND_WAYPOINT_3_TO_4: [number, number, number][] = [
  [-14.0, -0.4, 0.0],
  [-8.0, -0.4, 0.0],
  [-2.5, -0.4, 0.0],
  [1.5, -0.4, -0.2],
  [3.5, 1.5, -0.2],
  [2.5, 4.5, 0.3],
  [-0.5, 4.8, 0.7],
  [-2.5, 3.0, 1.2],
  [-2.5, 0.0, 1.5],
  [-2.0, -2.0, 0.5],
  [-1.0, -3.5, -1.5],
  [0.5, -2.5, -1.5],
  [0.5, 0.2, -1.0],
  [1.0, 1.5, 1.2],
  [3.5, 0.2, 0.8],
  [6.0, -0.7, 0.2]
];
