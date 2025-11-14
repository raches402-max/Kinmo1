/**
 * Confidence Weight Calibration System
 *
 * Uses gradient descent to optimize confidence factor weights based on prediction errors.
 * Adjusts weights to minimize Mean Absolute Error (MAE) between predicted and actual consensus.
 */

import { db } from './db';
import { confidencePredictions, groupConfidenceWeights } from '../shared/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import type { ConfidenceWeights } from './confidence-scoring';

/**
 * Calibration configuration with safety guardrails
 */
const CALIBRATION_CONFIG = {
  MIN_PREDICTIONS: 50,           // Minimum validated predictions before calibration
  LEARNING_RATE: 0.05,           // Maximum weight change per calibration (5%)
  MIN_WEIGHT: 0.10,              // Minimum weight for any factor (10%)
  MAX_WEIGHT: 0.40,              // Maximum weight for any factor (40%)
  TARGET_MAE: 15,                // Target mean absolute error (15 points)
  MAX_ITERATIONS: 10,            // Maximum gradient descent iterations
  CONVERGENCE_THRESHOLD: 0.01,  // Stop if improvement < 1%
} as const;

export interface CalibrationResult {
  success: boolean;
  groupId: string;
  previousWeights: ConfidenceWeights;
  newWeights: ConfidenceWeights;
  previousMAE: number;
  newMAE: number;
  improvement: number; // Percentage improvement
  iterationsUsed: number;
  predictionsAnalyzed: number;
  message: string;
}

/**
 * Run calibration for a specific group
 * Returns calibration result or null if not enough data
 */
export async function calibrateGroupWeights(groupId: string): Promise<CalibrationResult | null> {
  console.log(`[Calibration] Starting calibration for group ${groupId}`);

  // Get validated predictions that haven't been used for calibration yet
  const predictions = await db
    .select()
    .from(confidencePredictions)
    .where(
      and(
        eq(confidencePredictions.groupId, groupId),
        isNotNull(confidencePredictions.actualConsensus),
        isNotNull(confidencePredictions.validatedAt),
        eq(confidencePredictions.usedForCalibration, false)
      )
    );

  if (predictions.length < CALIBRATION_CONFIG.MIN_PREDICTIONS) {
    console.log(
      `[Calibration] Not enough data for group ${groupId}: ` +
      `${predictions.length}/${CALIBRATION_CONFIG.MIN_PREDICTIONS} predictions`
    );
    return null;
  }

  // Get current weights
  const [currentWeightsRow] = await db
    .select()
    .from(groupConfidenceWeights)
    .where(eq(groupConfidenceWeights.groupId, groupId))
    .limit(1);

  if (!currentWeightsRow) {
    console.error(`[Calibration] No weights found for group ${groupId}`);
    return null;
  }

  const previousWeights: ConfidenceWeights = {
    venueQuality: currentWeightsRow.venueQualityWeight,
    timeConsensus: currentWeightsRow.timeConsensusWeight,
    groupEngagement: currentWeightsRow.groupEngagementWeight,
    patternMatch: currentWeightsRow.patternMatchWeight,
    swipeConsensus: currentWeightsRow.swipeConsensusWeight,
  };

  // Calculate current MAE
  const previousMAE = calculateMAE(predictions, previousWeights);

  console.log(
    `[Calibration] Current MAE: ${previousMAE.toFixed(2)}, ` +
    `Analyzing ${predictions.length} predictions`
  );

  // Run gradient descent optimization
  const { optimizedWeights, finalMAE, iterations } = optimizeWeights(
    predictions,
    previousWeights,
    previousMAE
  );

  // Calculate improvement
  const improvement = ((previousMAE - finalMAE) / previousMAE) * 100;

  // Check if optimization actually improved things
  if (finalMAE >= previousMAE) {
    console.log(
      `[Calibration] Optimization did not improve MAE ` +
      `(${previousMAE.toFixed(2)} → ${finalMAE.toFixed(2)}), ` +
      `keeping current weights`
    );

    // Mark predictions as used even though we didn't update weights
    await markPredictionsAsUsed(predictions.map(p => p.id));

    return {
      success: false,
      groupId,
      previousWeights,
      newWeights: previousWeights,
      previousMAE,
      newMAE: finalMAE,
      improvement: 0,
      iterationsUsed: iterations,
      predictionsAnalyzed: predictions.length,
      message: 'Optimization did not improve accuracy - keeping current weights',
    };
  }

  // Update weights in database
  await db
    .update(groupConfidenceWeights)
    .set({
      venueQualityWeight: optimizedWeights.venueQuality,
      timeConsensusWeight: optimizedWeights.timeConsensus,
      groupEngagementWeight: optimizedWeights.groupEngagement,
      patternMatchWeight: optimizedWeights.patternMatch,
      swipeConsensusWeight: optimizedWeights.swipeConsensus,
      calibrationCount: sql`${groupConfidenceWeights.calibrationCount} + 1`,
      lastCalibrationAt: new Date(),
      totalPredictions: sql`${groupConfidenceWeights.totalPredictions} + ${predictions.length}`,
      meanAbsoluteError: finalMAE,
      accuracyRate: calculateAccuracyRate(predictions, optimizedWeights),
      updatedAt: new Date(),
    })
    .where(eq(groupConfidenceWeights.groupId, groupId));

  // Mark predictions as used for calibration
  await markPredictionsAsUsed(predictions.map(p => p.id));

  console.log(
    `[Calibration] ✅ Calibration complete for group ${groupId}:\n` +
    `  MAE: ${previousMAE.toFixed(2)} → ${finalMAE.toFixed(2)} (${improvement.toFixed(1)}% improvement)\n` +
    `  Iterations: ${iterations}\n` +
    `  Predictions used: ${predictions.length}\n` +
    `  New weights: VQ=${(optimizedWeights.venueQuality * 100).toFixed(0)}% ` +
    `TC=${(optimizedWeights.timeConsensus * 100).toFixed(0)}% ` +
    `GE=${(optimizedWeights.groupEngagement * 100).toFixed(0)}% ` +
    `PM=${(optimizedWeights.patternMatch * 100).toFixed(0)}% ` +
    `SC=${(optimizedWeights.swipeConsensus * 100).toFixed(0)}%`
  );

  return {
    success: true,
    groupId,
    previousWeights,
    newWeights: optimizedWeights,
    previousMAE,
    newMAE: finalMAE,
    improvement,
    iterationsUsed: iterations,
    predictionsAnalyzed: predictions.length,
    message: `Improved accuracy by ${improvement.toFixed(1)}%`,
  };
}

/**
 * Optimize weights using gradient descent
 */
function optimizeWeights(
  predictions: any[],
  initialWeights: ConfidenceWeights,
  currentMAE: number
): { optimizedWeights: ConfidenceWeights; finalMAE: number; iterations: number } {
  let weights = { ...initialWeights };
  let bestMAE = currentMAE;
  let bestWeights = { ...weights };
  let iteration = 0;

  for (iteration = 0; iteration < CALIBRATION_CONFIG.MAX_ITERATIONS; iteration++) {
    // Calculate gradients for each factor
    const gradients = calculateGradients(predictions, weights);

    // Update weights using gradient descent
    const newWeights: ConfidenceWeights = {
      venueQuality: weights.venueQuality - CALIBRATION_CONFIG.LEARNING_RATE * gradients.venueQuality,
      timeConsensus: weights.timeConsensus - CALIBRATION_CONFIG.LEARNING_RATE * gradients.timeConsensus,
      groupEngagement: weights.groupEngagement - CALIBRATION_CONFIG.LEARNING_RATE * gradients.groupEngagement,
      patternMatch: weights.patternMatch - CALIBRATION_CONFIG.LEARNING_RATE * gradients.patternMatch,
      swipeConsensus: weights.swipeConsensus - CALIBRATION_CONFIG.LEARNING_RATE * gradients.swipeConsensus,
    };

    // Apply guardrails: clamp weights to [MIN_WEIGHT, MAX_WEIGHT]
    const clampedWeights = clampWeights(newWeights);

    // Normalize weights to sum to 1.0
    const normalizedWeights = normalizeWeights(clampedWeights);

    // Calculate new MAE
    const newMAE = calculateMAE(predictions, normalizedWeights);

    // Check for improvement
    const improvement = (bestMAE - newMAE) / bestMAE;

    if (newMAE < bestMAE) {
      bestMAE = newMAE;
      bestWeights = { ...normalizedWeights };

      // Check for convergence
      if (improvement < CALIBRATION_CONFIG.CONVERGENCE_THRESHOLD) {
        console.log(`[Calibration] Converged after ${iteration + 1} iterations`);
        break;
      }
    } else {
      // No improvement, stop here
      console.log(`[Calibration] No improvement at iteration ${iteration + 1}, stopping`);
      break;
    }

    weights = { ...normalizedWeights };
  }

  return {
    optimizedWeights: bestWeights,
    finalMAE: bestMAE,
    iterations: iteration + 1,
  };
}

/**
 * Calculate gradients for gradient descent
 * Gradient = derivative of MAE with respect to each weight
 */
function calculateGradients(
  predictions: any[],
  weights: ConfidenceWeights
): ConfidenceWeights {
  const gradients: ConfidenceWeights = {
    venueQuality: 0,
    timeConsensus: 0,
    groupEngagement: 0,
    patternMatch: 0,
    swipeConsensus: 0,
  };

  for (const prediction of predictions) {
    const factors = prediction.predictedFactors as any;
    const actual = prediction.actualConsensus as number;

    // Calculate predicted score with current weights
    const predicted = calculateWeightedScore(factors, weights);

    // Calculate error
    const error = predicted - actual;

    // Gradient for each weight = error * factor_value
    // (derivative of squared error with respect to weight)
    gradients.venueQuality += error * (factors.venueQuality || 0);
    gradients.timeConsensus += error * (factors.timeConsensus || 0);
    gradients.groupEngagement += error * (factors.groupEngagement || 0);
    gradients.patternMatch += error * (factors.patternMatch || 0);
    gradients.swipeConsensus += error * (factors.swipeConsensus || 0);
  }

  // Average gradients
  const n = predictions.length;
  gradients.venueQuality /= n;
  gradients.timeConsensus /= n;
  gradients.groupEngagement /= n;
  gradients.patternMatch /= n;
  gradients.swipeConsensus /= n;

  return gradients;
}

/**
 * Calculate weighted score from factors and weights
 */
function calculateWeightedScore(
  factors: any,
  weights: ConfidenceWeights
): number {
  // Handle null swipe consensus (redistribute weight)
  if (factors.swipeConsensus === null) {
    const totalWithoutSwipe = 1 - weights.swipeConsensus;
    return Math.round(
      (factors.venueQuality || 0) * (weights.venueQuality / totalWithoutSwipe) +
      (factors.timeConsensus || 0) * (weights.timeConsensus / totalWithoutSwipe) +
      (factors.groupEngagement || 0) * (weights.groupEngagement / totalWithoutSwipe) +
      (factors.patternMatch || 0) * (weights.patternMatch / totalWithoutSwipe)
    );
  }

  return Math.round(
    (factors.venueQuality || 0) * weights.venueQuality +
    (factors.timeConsensus || 0) * weights.timeConsensus +
    (factors.groupEngagement || 0) * weights.groupEngagement +
    (factors.patternMatch || 0) * weights.patternMatch +
    (factors.swipeConsensus || 0) * weights.swipeConsensus
  );
}

/**
 * Calculate Mean Absolute Error
 */
function calculateMAE(predictions: any[], weights: ConfidenceWeights): number {
  let totalError = 0;

  for (const prediction of predictions) {
    const factors = prediction.predictedFactors;
    const actual = prediction.actualConsensus;
    const predicted = calculateWeightedScore(factors, weights);
    totalError += Math.abs(predicted - actual);
  }

  return totalError / predictions.length;
}

/**
 * Calculate accuracy rate (% of predictions within ±15 points)
 */
function calculateAccuracyRate(predictions: any[], weights: ConfidenceWeights): number {
  let accurate = 0;

  for (const prediction of predictions) {
    const factors = prediction.predictedFactors;
    const actual = prediction.actualConsensus;
    const predicted = calculateWeightedScore(factors, weights);
    const error = Math.abs(predicted - actual);

    if (error <= 15) {
      accurate++;
    }
  }

  return accurate / predictions.length;
}

/**
 * Clamp weights to min/max bounds
 */
function clampWeights(weights: ConfidenceWeights): ConfidenceWeights {
  return {
    venueQuality: Math.max(CALIBRATION_CONFIG.MIN_WEIGHT, Math.min(CALIBRATION_CONFIG.MAX_WEIGHT, weights.venueQuality)),
    timeConsensus: Math.max(CALIBRATION_CONFIG.MIN_WEIGHT, Math.min(CALIBRATION_CONFIG.MAX_WEIGHT, weights.timeConsensus)),
    groupEngagement: Math.max(CALIBRATION_CONFIG.MIN_WEIGHT, Math.min(CALIBRATION_CONFIG.MAX_WEIGHT, weights.groupEngagement)),
    patternMatch: Math.max(CALIBRATION_CONFIG.MIN_WEIGHT, Math.min(CALIBRATION_CONFIG.MAX_WEIGHT, weights.patternMatch)),
    swipeConsensus: Math.max(CALIBRATION_CONFIG.MIN_WEIGHT, Math.min(CALIBRATION_CONFIG.MAX_WEIGHT, weights.swipeConsensus)),
  };
}

/**
 * Normalize weights to sum to 1.0
 */
function normalizeWeights(weights: ConfidenceWeights): ConfidenceWeights {
  const sum =
    weights.venueQuality +
    weights.timeConsensus +
    weights.groupEngagement +
    weights.patternMatch +
    weights.swipeConsensus;

  return {
    venueQuality: weights.venueQuality / sum,
    timeConsensus: weights.timeConsensus / sum,
    groupEngagement: weights.groupEngagement / sum,
    patternMatch: weights.patternMatch / sum,
    swipeConsensus: weights.swipeConsensus / sum,
  };
}

/**
 * Mark predictions as used for calibration
 */
async function markPredictionsAsUsed(predictionIds: string[]): Promise<void> {
  if (predictionIds.length === 0) return;

  const { inArray } = await import('drizzle-orm');

  await db
    .update(confidencePredictions)
    .set({ usedForCalibration: true })
    .where(inArray(confidencePredictions.id, predictionIds));
}

/**
 * Check if a group has enough predictions to trigger calibration
 */
export async function shouldTriggerCalibration(groupId: string): Promise<boolean> {
  const unusedPredictions = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(confidencePredictions)
    .where(
      and(
        eq(confidencePredictions.groupId, groupId),
        isNotNull(confidencePredictions.actualConsensus),
        eq(confidencePredictions.usedForCalibration, false)
      )
    );

  const count = unusedPredictions[0]?.count || 0;
  return count >= CALIBRATION_CONFIG.MIN_PREDICTIONS;
}

/**
 * Run calibration for all groups that have enough data
 */
export async function calibrateAllGroups(): Promise<CalibrationResult[]> {
  console.log('[Calibration] Checking all groups for calibration opportunities...');

  // Get all unique group IDs with unused validated predictions
  const groupsWithPredictions = await db
    .select({ groupId: confidencePredictions.groupId })
    .from(confidencePredictions)
    .where(
      and(
        isNotNull(confidencePredictions.actualConsensus),
        eq(confidencePredictions.usedForCalibration, false)
      )
    )
    .groupBy(confidencePredictions.groupId);

  const results: CalibrationResult[] = [];

  for (const { groupId } of groupsWithPredictions) {
    if (await shouldTriggerCalibration(groupId)) {
      const result = await calibrateGroupWeights(groupId);
      if (result) {
        results.push(result);
      }
    }
  }

  console.log(`[Calibration] Calibrated ${results.length} groups`);
  return results;
}
