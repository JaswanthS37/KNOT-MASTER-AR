/**
 * OverhandKnotTutorial.ts
 *
 * Procedural 3D Rope implementation for the Overhand Knot tutorial on SPECS AR.
 * Generates dynamic tube geometry using MeshBuilder with parallel-transport framing.
 * Supports distinct coloring for the standing part (first 80%) vs working end (last 20%).
 */

@component
export class OverhandKnotTutorial extends BaseScriptComponent {
  @input material!: Material;

  // Tube geometry parameters
  private readonly ROPE_RADIUS = 0.75; // cm
  private readonly RADIAL_SEGMENTS = 12; // smooth cylindrical cross-section
  private readonly RESAMPLED_POINT_COUNT = 64; // 64 arc-length samples

  // Color scheme: Standing part (warm tan hemp) vs Working end (high-visibility crimson)
  private readonly COLOR_STANDING: [number, number, number, number] = [0.84, 0.64, 0.38, 1.0];
  private readonly COLOR_WORKING: [number, number, number, number] = [0.95, 0.18, 0.15, 1.0];
  private readonly WORKING_END_RATIO = 0.8; // last 20%

  // Mesh components
  private builder!: MeshBuilder;
  private rmv!: RenderMeshVisual;

  // Current curve points (in cm, relative to KnotRope origin at [0, 0, -60])
  private currentCurve: [number, number, number][] = [];

  onAwake(): void {
    // Ensure RenderMeshVisual is present
    this.rmv = this.sceneObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    if (!this.rmv) {
      this.rmv = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    }

    // Initialize initial straight rope (40 cm long, -20 to +20 cm)
    const initialWaypoints: [number, number, number][] = [
      [-20, 0, 0],
      [-10, 0, 0],
      [0, 0, 0],
      [10, 0, 0],
      [20, 0, 0],
    ];

    this.currentCurve = this.resampleByArcLength(initialWaypoints, this.RESAMPLED_POINT_COUNT);
    this.rebuildMesh(this.currentCurve);

    // Apply material if assigned
    if (this.material && this.rmv) {
      this.rmv.mainMaterial = this.material;
    }

    this.createEvent("OnStartEvent").bind(() => {
      console.log("[OverhandKnotTutorial] Stage 1 Ready: Procedural rope built (40cm long, 2-tone coloring).");
    });
  }

  /**
   * Resamples an arbitrary 3D polyline into N equidistant points by arc length.
   */
  public resampleByArcLength(
    points: [number, number, number][],
    targetCount: number
  ): [number, number, number][] {
    if (points.length < 2) return points;

    // Calculate cumulative segment distances
    const cumDist: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const dz = p1[2] - p0[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      cumDist.push(cumDist[i - 1] + (d > 1e-6 ? d : 1e-6));
    }

    const totalLength = cumDist[cumDist.length - 1];
    const resampled: [number, number, number][] = [];

    for (let j = 0; j < targetCount; j++) {
      const targetDist = (j / (targetCount - 1)) * totalLength;

      // Find segment containing targetDist
      let segIdx = 0;
      while (segIdx < cumDist.length - 2 && cumDist[segIdx + 1] < targetDist) {
        segIdx++;
      }

      const segLen = cumDist[segIdx + 1] - cumDist[segIdx];
      const frac = segLen > 1e-6 ? (targetDist - cumDist[segIdx]) / segLen : 0;

      const p0 = points[segIdx];
      const p1 = points[segIdx + 1];

      resampled.push([
        p0[0] + (p1[0] - p0[0]) * frac,
        p0[1] + (p1[1] - p0[1]) * frac,
        p0[2] + (p1[2] - p0[2]) * frac,
      ]);
    }

    return resampled;
  }

  /**
   * Rebuilds the tube mesh from a list of 3D curve points.
   */
  public rebuildMesh(curve: [number, number, number][]): void {
    const N = curve.length;
    if (N < 2) return;

    this.builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ]);
    this.builder.topology = MeshTopology.Triangles;
    this.builder.indexType = MeshIndexType.UInt16;

    this.buildTubeWithCaps(
      this.builder,
      curve,
      this.ROPE_RADIUS,
      this.RADIAL_SEGMENTS
    );

    this.rmv.mesh = this.builder.getMesh();
    if (this.material) {
      this.rmv.mainMaterial = this.material;
    }
    this.builder.updateMesh();
  }

  /**
   * Generates tube geometry with parallel transport frames and closed hemisphere/cap ends.
   */
  private buildTubeWithCaps(
    builder: MeshBuilder,
    curve: [number, number, number][],
    radius: number,
    radialSegments: number
  ): void {
    const N = curve.length;
    const R = radialSegments + 1; // +1 to wrap around cleanly

    // 1. Calculate tangents along the curve
    const tangents: [number, number, number][] = [];
    for (let i = 0; i < N; i++) {
      const pPrev = curve[Math.max(0, i - 1)];
      const pNext = curve[Math.min(N - 1, i + 1)];
      const tx = pNext[0] - pPrev[0];
      const ty = pNext[1] - pPrev[1];
      const tz = pNext[2] - pPrev[2];
      const len = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      tangents.push([tx / len, ty / len, tz / len]);
    }

    // 2. Parallel-transport normal and binormal frames
    const frames: { n: [number, number, number]; b: [number, number, number] }[] = [];
    const t0 = tangents[0];

    // Arbitrary vector not parallel to t0
    const up: [number, number, number] = Math.abs(t0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const dot0 = up[0] * t0[0] + up[1] * t0[1] + up[2] * t0[2];
    let nf: [number, number, number] = [
      up[0] - dot0 * t0[0],
      up[1] - dot0 * t0[1],
      up[2] - dot0 * t0[2],
    ];
    let nlen = Math.sqrt(nf[0] * nf[0] + nf[1] * nf[1] + nf[2] * nf[2]) || 1;
    nf = [nf[0] / nlen, nf[1] / nlen, nf[2] / nlen];

    for (let i = 0; i < N; i++) {
      if (i > 0) {
        const tp = tangents[i - 1];
        const tc = tangents[i];
        // Rotation axis = cross(tp, tc)
        const ax = tp[1] * tc[2] - tp[2] * tc[1];
        const ay = tp[2] * tc[0] - tp[0] * tc[2];
        const az = tp[0] * tc[1] - tp[1] * tc[0];
        const alen = Math.sqrt(ax * ax + ay * ay + az * az);

        if (alen > 1e-5) {
          const kx = ax / alen;
          const ky = ay / alen;
          const kz = az / alen;
          const cosA = Math.max(-1, Math.min(1, tp[0] * tc[0] + tp[1] * tc[1] + tp[2] * tc[2]));
          const sinA = Math.sin(Math.acos(cosA));
          const oneMinusCos = 1 - cosA;

          // Rodrigues rotation of nf around k
          const kDotN = kx * nf[0] + ky * nf[1] + kz * nf[2];
          const kCrossNx = ky * nf[2] - kz * nf[1];
          const kCrossNy = kz * nf[0] - kx * nf[2];
          const kCrossNz = kx * nf[1] - ky * nf[0];

          nf = [
            nf[0] * cosA + kCrossNx * sinA + kx * kDotN * oneMinusCos,
            nf[1] * cosA + kCrossNy * sinA + ky * kDotN * oneMinusCos,
            nf[2] * cosA + kCrossNz * sinA + kz * kDotN * oneMinusCos,
          ];
        }
      }

      const t = tangents[i];
      const bf: [number, number, number] = [
        t[1] * nf[2] - t[2] * nf[1],
        t[2] * nf[0] - t[0] * nf[2],
        t[0] * nf[1] - t[1] * nf[0],
      ];
      frames.push({ n: [nf[0], nf[1], nf[2]], b: bf });
    }

    // 3. Emit vertices for tube rings
    const tubeVertexStart = 0;
    for (let i = 0; i < N; i++) {
      const p = curve[i];
      const { n, b } = frames[i];
      const s = i / (N - 1); // 0.0 at standing end, 1.0 at working end

      // Two-tone coloring: working end (last 20%) has distinct color
      const color = s >= this.WORKING_END_RATIO ? this.COLOR_WORKING : this.COLOR_STANDING;

      for (let j = 0; j < R; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const nx = n[0] * cosT + b[0] * sinT;
        const ny = n[1] * cosT + b[1] * sinT;
        const nz = n[2] * cosT + b[2] * sinT;

        builder.appendVerticesInterleaved([
          p[0] + nx * radius,
          p[1] + ny * radius,
          p[2] + nz * radius,
          nx,
          ny,
          nz,
          ...color,
        ]);
      }
    }

    // 4. Emit indices for tube rings
    const indices: number[] = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const bl = tubeVertexStart + i * R + j;
        const br = tubeVertexStart + i * R + (j + 1);
        const tl = tubeVertexStart + (i + 1) * R + j;
        const tr = tubeVertexStart + (i + 1) * R + (j + 1);
        indices.push(bl, br, tr, bl, tr, tl);
      }
    }

    // 5. Add start cap (standing end)
    const startCapCenterIdx = N * R;
    const pStart = curve[0];
    const tStart = tangents[0];
    builder.appendVerticesInterleaved([
      pStart[0] - tStart[0] * radius * 0.4,
      pStart[1] - tStart[1] * radius * 0.4,
      pStart[2] - tStart[2] * radius * 0.4,
      -tStart[0],
      -tStart[1],
      -tStart[2],
      ...this.COLOR_STANDING,
    ]);

    for (let j = 0; j < radialSegments; j++) {
      indices.push(
        startCapCenterIdx,
        tubeVertexStart + j + 1,
        tubeVertexStart + j
      );
    }

    // 6. Add end cap (working end)
    const endCapCenterIdx = startCapCenterIdx + 1;
    const pEnd = curve[N - 1];
    const tEnd = tangents[N - 1];
    builder.appendVerticesInterleaved([
      pEnd[0] + tEnd[0] * radius * 0.4,
      pEnd[1] + tEnd[1] * radius * 0.4,
      pEnd[2] + tEnd[2] * radius * 0.4,
      tEnd[0],
      tEnd[1],
      tEnd[2],
      ...this.COLOR_WORKING,
    ]);

    const lastRingStart = tubeVertexStart + (N - 1) * R;
    for (let j = 0; j < radialSegments; j++) {
      indices.push(
        endCapCenterIdx,
        lastRingStart + j,
        lastRingStart + j + 1
      );
    }

    builder.appendIndices(indices);
  }
}
