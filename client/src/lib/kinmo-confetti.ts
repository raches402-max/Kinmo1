/**
 * Kinmo-branded confetti utilities
 *
 * Creates custom confetti shapes using the Kinmo sun icon with 6 seats,
 * representing friends gathering around a table.
 */

import confetti from 'canvas-confetti';

// Kinmo brand colors for confetti
export const KINMO_CONFETTI_COLORS = [
  '#F2C94C', // Primary gold
  '#E8A832', // Warm amber
  '#FFD700', // Bright gold accent
  '#FFF5E0', // Cream/light sparkle
  '#F5B041', // Rich gold
];

/**
 * Creates a custom Kinmo sun shape for canvas-confetti
 * The shape is a simplified version: center sun with 6 radiating points
 */
function createKinmoShape(): confetti.Shape {
  // Create an off-screen canvas to draw the shape
  const canvas = document.createElement('canvas');
  const size = 24;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const centerX = size / 2;
  const centerY = size / 2;

  // Draw center circle (the sun/table)
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.fill();

  // Draw 6 small circles around it (the seats/rays)
  const seatRadius = 2;
  const orbitRadius = 9;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6 - Math.PI / 2; // Start from top
    const x = centerX + Math.cos(angle) * orbitRadius;
    const y = centerY + Math.sin(angle) * orbitRadius;
    ctx.beginPath();
    ctx.arc(x, y, seatRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  return confetti.shapeFromPath({
    path: createKinmoSVGPath(),
  });
}

/**
 * Creates an SVG path string for the Kinmo icon
 * This is used for the confetti shape
 */
function createKinmoSVGPath(): string {
  // Simplified Kinmo icon as a single path
  // Center circle + 6 small circles around it
  const paths: string[] = [];

  // Center circle (r=14 at center 24,24)
  paths.push('M 38 24 A 14 14 0 1 1 10 24 A 14 14 0 1 1 38 24');

  // 6 seats around the table (simplified as small circles)
  const seatPositions = [
    { cx: 24, cy: 5 },   // Top
    { cx: 40, cy: 14 },  // Top-right
    { cx: 40, cy: 34 },  // Bottom-right
    { cx: 24, cy: 43 },  // Bottom
    { cx: 8, cy: 34 },   // Bottom-left
    { cx: 8, cy: 14 },   // Top-left
  ];

  seatPositions.forEach(({ cx, cy }) => {
    paths.push(`M ${cx + 4} ${cy} A 4 4 0 1 1 ${cx - 4} ${cy} A 4 4 0 1 1 ${cx + 4} ${cy}`);
  });

  return paths.join(' ');
}

// Cached shape for performance
let kinmoShape: confetti.Shape | null = null;

/**
 * Gets the Kinmo confetti shape, creating it if needed
 */
export function getKinmoShape(): confetti.Shape {
  if (!kinmoShape) {
    kinmoShape = createKinmoShape();
  }
  return kinmoShape;
}

/**
 * Fires a celebration burst of Kinmo-branded confetti
 *
 * @param options - Optional overrides for the confetti configuration
 */
export function fireKinmoConfetti(options?: {
  particleCount?: number;
  spread?: number;
  origin?: { x?: number; y?: number };
  includeShapes?: boolean;
}) {
  const {
    particleCount = 80,
    spread = 70,
    origin = { y: 0.6 },
    includeShapes = true,
  } = options || {};

  // Main center burst
  const baseConfig: confetti.Options = {
    particleCount,
    spread,
    origin,
    colors: KINMO_CONFETTI_COLORS,
    ticks: 200,
    gravity: 1,
    scalar: 1.2,
    drift: 0,
  };

  // Fire with custom shapes if supported, otherwise fall back to circles
  if (includeShapes) {
    try {
      const shape = getKinmoShape();
      confetti({
        ...baseConfig,
        shapes: [shape, 'circle'],
        scalar: 1.5,
      });
    } catch {
      // Fallback to regular confetti if custom shapes fail
      confetti(baseConfig);
    }
  } else {
    confetti(baseConfig);
  }

  // Side bursts after a short delay
  setTimeout(() => {
    // Left burst
    confetti({
      particleCount: Math.floor(particleCount * 0.5),
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: KINMO_CONFETTI_COLORS,
      ticks: 180,
      gravity: 1.1,
    });

    // Right burst
    confetti({
      particleCount: Math.floor(particleCount * 0.5),
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: KINMO_CONFETTI_COLORS,
      ticks: 180,
      gravity: 1.1,
    });
  }, 200);
}
