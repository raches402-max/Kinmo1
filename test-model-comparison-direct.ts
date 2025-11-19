import { parseSchedulingPromptWithHistory } from "./server/openai";

async function testModelComparison() {
  try {
    const prompt = "bottomless brunch this Saturday in Mission";
    const locationBase = "San Francisco, CA";

    // Use minimal group history for testing
    const groupHistory = {
      preferenceInsights: null,
      schedulingPreferences: null,
      closenessLevel: null,
    };

    console.log("Testing model comparison for:", prompt);
    console.log("Location:", locationBase);
    console.log("\n" + "=".repeat(80));

    // Force GPT-4o
    console.log("\n📊 Running GPT-4o...");
    const gpt4oStart = Date.now();
    const gpt4oResult = await parseSchedulingPromptWithHistory(
      prompt,
      locationBase,
      groupHistory,
      'gpt-4o'
    );
    const gpt4oTime = Date.now() - gpt4oStart;

    // Force mini
    console.log("📊 Running GPT-4o-mini...\n");
    const miniStart = Date.now();
    const miniResult = await parseSchedulingPromptWithHistory(
      prompt,
      locationBase,
      groupHistory,
      'gpt-4o-mini'
    );
    const miniTime = Date.now() - miniStart;

    console.log("=".repeat(80));
    console.log("PROMPT:", prompt);
    console.log("=".repeat(80));

    console.log("\n📊 GPT-4o RESULT:");
    console.log("-".repeat(80));
    console.log("Activity Type:", gpt4oResult.activityType);
    console.log("Category:", gpt4oResult.category);
    console.log("Time Preference:", gpt4oResult.timePreference);
    console.log("Day Constraints:", gpt4oResult.dayConstraints);
    console.log("Location:", gpt4oResult.location);
    console.log("Meal Modifiers:", gpt4oResult.mealModifiers);
    console.log("Context Keywords:", JSON.stringify(gpt4oResult.contextKeywords));
    console.log("Venue Attributes:", JSON.stringify(gpt4oResult.venueAttributes));
    console.log("History Applied:", JSON.stringify(gpt4oResult.historyApplied));
    console.log("Response Time:", gpt4oTime, "ms");
    console.log("Cached:", gpt4oResult.cached);

    console.log("\n📊 GPT-4o-mini RESULT:");
    console.log("-".repeat(80));
    console.log("Activity Type:", miniResult.activityType);
    console.log("Category:", miniResult.category);
    console.log("Time Preference:", miniResult.timePreference);
    console.log("Day Constraints:", miniResult.dayConstraints);
    console.log("Location:", miniResult.location);
    console.log("Meal Modifiers:", miniResult.mealModifiers);
    console.log("Context Keywords:", JSON.stringify(miniResult.contextKeywords));
    console.log("Venue Attributes:", JSON.stringify(miniResult.venueAttributes));
    console.log("History Applied:", JSON.stringify(miniResult.historyApplied));
    console.log("Response Time:", miniTime, "ms");
    console.log("Cached:", miniResult.cached);

    console.log("\n🔍 DIFFERENCES:");
    console.log("-".repeat(80));

    // Compare context keywords
    const gpt4oContextOnly = (gpt4oResult.contextKeywords || []).filter(k => !(miniResult.contextKeywords || []).includes(k));
    const miniContextOnly = (miniResult.contextKeywords || []).filter(k => !(gpt4oResult.contextKeywords || []).includes(k));
    const sameContext = (gpt4oResult.contextKeywords || []).filter(k => (miniResult.contextKeywords || []).includes(k));

    if (gpt4oContextOnly.length > 0) {
      console.log("✨ Context Keywords (GPT-4o only):", JSON.stringify(gpt4oContextOnly));
    }
    if (miniContextOnly.length > 0) {
      console.log("✨ Context Keywords (mini only):", JSON.stringify(miniContextOnly));
    }
    if (sameContext.length > 0) {
      console.log("✅ Context Keywords (both):", JSON.stringify(sameContext));
    }

    // Compare venue attributes
    const gpt4oVenueOnly = (gpt4oResult.venueAttributes || []).filter(k => !(miniResult.venueAttributes || []).includes(k));
    const miniVenueOnly = (miniResult.venueAttributes || []).filter(k => !(gpt4oResult.venueAttributes || []).includes(k));
    const sameVenue = (gpt4oResult.venueAttributes || []).filter(k => (miniResult.venueAttributes || []).includes(k));

    if (gpt4oVenueOnly.length > 0) {
      console.log("🏢 Venue Attributes (GPT-4o only):", JSON.stringify(gpt4oVenueOnly));
    }
    if (miniVenueOnly.length > 0) {
      console.log("🏢 Venue Attributes (mini only):", JSON.stringify(miniVenueOnly));
    }
    if (sameVenue.length > 0) {
      console.log("✅ Venue Attributes (both):", JSON.stringify(sameVenue));
    }

    // Compare history applied
    const gpt4oHistoryOnly = (gpt4oResult.historyApplied || []).filter(h => !(miniResult.historyApplied || []).includes(h));
    const miniHistoryOnly = (miniResult.historyApplied || []).filter(h => !(gpt4oResult.historyApplied || []).includes(h));
    const sameHistory = (gpt4oResult.historyApplied || []).filter(h => (miniResult.historyApplied || []).includes(h));

    if (gpt4oHistoryOnly.length > 0) {
      console.log("📚 History Applied (GPT-4o only):", JSON.stringify(gpt4oHistoryOnly));
    }
    if (miniHistoryOnly.length > 0) {
      console.log("📚 History Applied (mini only):", JSON.stringify(miniHistoryOnly));
    }
    if (sameHistory.length > 0) {
      console.log("✅ History Applied (both):", JSON.stringify(sameHistory));
    }

    // Compare basic fields
    if (gpt4oResult.activityType !== miniResult.activityType) {
      console.log("\n⚠️  Activity Type differs:");
      console.log("  GPT-4o:", gpt4oResult.activityType);
      console.log("  mini:", miniResult.activityType);
    } else {
      console.log("\n✅ Activity Type: SAME -", gpt4oResult.activityType);
    }

    if (gpt4oResult.timePreference !== miniResult.timePreference) {
      console.log("\n⚠️  Time Preference differs:");
      console.log("  GPT-4o:", gpt4oResult.timePreference);
      console.log("  mini:", miniResult.timePreference);
    } else {
      console.log("✅ Time Preference: SAME -", gpt4oResult.timePreference);
    }

    if (gpt4oResult.dayConstraints !== miniResult.dayConstraints) {
      console.log("\n⚠️  Day Constraints differs:");
      console.log("  GPT-4o:", gpt4oResult.dayConstraints);
      console.log("  mini:", miniResult.dayConstraints);
    } else {
      console.log("✅ Day Constraints: SAME -", gpt4oResult.dayConstraints);
    }

    console.log("\n⚡ PERFORMANCE:");
    console.log("-".repeat(80));
    console.log("GPT-4o Time:", gpt4oTime, "ms");
    console.log("Mini Time:", miniTime, "ms");
    console.log("Mini is", (gpt4oTime / miniTime).toFixed(2) + "x faster");

    console.log("\n💰 COST:");
    console.log("-".repeat(80));
    console.log("GPT-4o costs ~5-7x more than mini per request");

    console.log("\n" + "=".repeat(80));
    process.exit(0);

  } catch (error: any) {
    console.error("Error testing model comparison:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testModelComparison();
