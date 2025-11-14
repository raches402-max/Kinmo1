/**
 * Test script for confidence calibration
 * Run with: npx tsx server/test-calibration.ts <groupId>
 */

import { calibrateGroupWeights, shouldTriggerCalibration, calibrateAllGroups } from './confidence-calibration';
import { getGroupConfidenceWeights } from './confidence-scoring';

async function main() {
  const groupId = process.argv[2];

  if (!groupId || groupId === '--all') {
    console.log('🔄 Running calibration for all groups...\n');
    const results = await calibrateAllGroups();

    if (results.length === 0) {
      console.log('✅ No groups have enough data for calibration yet\n');
      return;
    }

    console.log(`\n📊 Calibration Summary:\n`);
    for (const result of results) {
      console.log(`Group: ${result.groupId}`);
      console.log(`  ${result.success ? '✅' : '❌'} ${result.message}`);
      if (result.success) {
        console.log(`  Predictions analyzed: ${result.predictionsAnalyzed}`);
        console.log(`  MAE: ${result.previousMAE.toFixed(2)} → ${result.newMAE.toFixed(2)}`);
        console.log(`  Improvement: ${result.improvement.toFixed(1)}%`);
      }
      console.log('');
    }

    return;
  }

  console.log(`🔍 Checking calibration status for group: ${groupId}\n`);

  // Check if calibration is possible
  const canCalibrate = await shouldTriggerCalibration(groupId);
  console.log(`Can calibrate: ${canCalibrate ? '✅ Yes' : '❌ No (need 50+ validated predictions)'}\n`);

  if (!canCalibrate) {
    console.log('💡 To enable calibration:');
    console.log('  1. Create auto-scheduled events');
    console.log('  2. Have members swipe on venues');
    console.log('  3. Complete swipe sessions to validate predictions');
    console.log('  4. Once you have 50+ validated predictions, calibration will run automatically\n');
    return;
  }

  // Show current weights
  console.log('📊 Current weights:');
  const currentWeights = await getGroupConfidenceWeights(groupId);
  console.log(`  Venue Quality:    ${(currentWeights.venueQuality * 100).toFixed(0)}%`);
  console.log(`  Time Consensus:   ${(currentWeights.timeConsensus * 100).toFixed(0)}%`);
  console.log(`  Group Engagement: ${(currentWeights.groupEngagement * 100).toFixed(0)}%`);
  console.log(`  Pattern Match:    ${(currentWeights.patternMatch * 100).toFixed(0)}%`);
  console.log(`  Swipe Consensus:  ${(currentWeights.swipeConsensus * 100).toFixed(0)}%\n`);

  // Run calibration
  console.log('🔄 Running calibration...\n');
  const result = await calibrateGroupWeights(groupId);

  if (!result) {
    console.log('❌ Calibration failed\n');
    return;
  }

  // Show results
  console.log('✅ Calibration complete!\n');
  console.log(`📈 Results:`);
  console.log(`  Predictions analyzed: ${result.predictionsAnalyzed}`);
  console.log(`  Iterations used: ${result.iterationsUsed}`);
  console.log(`  MAE: ${result.previousMAE.toFixed(2)} → ${result.newMAE.toFixed(2)}`);
  console.log(`  Improvement: ${result.improvement.toFixed(1)}%\n`);

  console.log('🎯 New weights:');
  console.log(`  Venue Quality:    ${(result.newWeights.venueQuality * 100).toFixed(0)}% (was ${(result.previousWeights.venueQuality * 100).toFixed(0)}%)`);
  console.log(`  Time Consensus:   ${(result.newWeights.timeConsensus * 100).toFixed(0)}% (was ${(result.previousWeights.timeConsensus * 100).toFixed(0)}%)`);
  console.log(`  Group Engagement: ${(result.newWeights.groupEngagement * 100).toFixed(0)}% (was ${(result.previousWeights.groupEngagement * 100).toFixed(0)}%)`);
  console.log(`  Pattern Match:    ${(result.newWeights.patternMatch * 100).toFixed(0)}% (was ${(result.previousWeights.patternMatch * 100).toFixed(0)}%)`);
  console.log(`  Swipe Consensus:  ${(result.newWeights.swipeConsensus * 100).toFixed(0)}% (was ${(result.previousWeights.swipeConsensus * 100).toFixed(0)}%)\n`);

  console.log('💡 Interpretation:');
  if (result.newWeights.swipeConsensus > result.previousWeights.swipeConsensus) {
    console.log('  → Member swipe preferences are becoming MORE predictive');
  }
  if (result.newWeights.venueQuality < result.previousWeights.venueQuality) {
    console.log('  → Venue ratings are becoming LESS predictive');
  }
  if (result.improvement > 10) {
    console.log('  → Significant accuracy improvement! System is learning well.');
  }
  console.log('');
}

main()
  .then(() => {
    console.log('✅ Done\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
