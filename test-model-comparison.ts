const GROUP_ID = "84c2fdc3-a70c-4b9b-9b97-53b4f076fcb8";
const API_URL = "http://localhost:5000";

async function testModelComparison() {
  try {
    console.log("Testing model comparison for: 'bottomless brunch this Saturday in Mission'\n");

    const response = await fetch(`${API_URL}/api/groups/${GROUP_ID}/compare-models`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "bottomless brunch this Saturday in Mission",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("=".repeat(80));
    console.log("PROMPT:", data.prompt);
    console.log("=".repeat(80));

    console.log("\n📊 GPT-4o RESULT:");
    console.log("-".repeat(80));
    console.log("Activity Type:", data.gpt4o.activityType);
    console.log("Category:", data.gpt4o.category);
    console.log("Time Preference:", data.gpt4o.timePreference);
    console.log("Day Constraints:", data.gpt4o.dayConstraints);
    console.log("Location:", data.gpt4o.location);
    console.log("Meal Modifiers:", data.gpt4o.mealModifiers);
    console.log("Context Keywords:", JSON.stringify(data.gpt4o.contextKeywords));
    console.log("Venue Attributes:", JSON.stringify(data.gpt4o.venueAttributes));
    console.log("History Applied:", JSON.stringify(data.gpt4o.historyApplied));
    console.log("Response Time:", data.gpt4o.responseTimeMs, "ms");
    console.log("Cached:", data.gpt4o.cached);

    console.log("\n📊 GPT-4o-mini RESULT:");
    console.log("-".repeat(80));
    console.log("Activity Type:", data.mini.activityType);
    console.log("Category:", data.mini.category);
    console.log("Time Preference:", data.mini.timePreference);
    console.log("Day Constraints:", data.mini.dayConstraints);
    console.log("Location:", data.mini.location);
    console.log("Meal Modifiers:", data.mini.mealModifiers);
    console.log("Context Keywords:", JSON.stringify(data.mini.contextKeywords));
    console.log("Venue Attributes:", JSON.stringify(data.mini.venueAttributes));
    console.log("History Applied:", JSON.stringify(data.mini.historyApplied));
    console.log("Response Time:", data.mini.responseTimeMs, "ms");
    console.log("Cached:", data.mini.cached);

    console.log("\n🔍 DIFFERENCES:");
    console.log("-".repeat(80));

    if (data.differences.contextKeywords.gpt4oOnly.length > 0) {
      console.log("Context Keywords (GPT-4o only):", JSON.stringify(data.differences.contextKeywords.gpt4oOnly));
    }
    if (data.differences.contextKeywords.miniOnly.length > 0) {
      console.log("Context Keywords (mini only):", JSON.stringify(data.differences.contextKeywords.miniOnly));
    }
    if (data.differences.contextKeywords.same.length > 0) {
      console.log("Context Keywords (both):", JSON.stringify(data.differences.contextKeywords.same));
    }

    if (data.differences.venueAttributes.gpt4oOnly.length > 0) {
      console.log("Venue Attributes (GPT-4o only):", JSON.stringify(data.differences.venueAttributes.gpt4oOnly));
    }
    if (data.differences.venueAttributes.miniOnly.length > 0) {
      console.log("Venue Attributes (mini only):", JSON.stringify(data.differences.venueAttributes.miniOnly));
    }
    if (data.differences.venueAttributes.same.length > 0) {
      console.log("Venue Attributes (both):", JSON.stringify(data.differences.venueAttributes.same));
    }

    if (data.differences.historyApplied.gpt4oOnly.length > 0) {
      console.log("History Applied (GPT-4o only):", JSON.stringify(data.differences.historyApplied.gpt4oOnly));
    }
    if (data.differences.historyApplied.miniOnly.length > 0) {
      console.log("History Applied (mini only):", JSON.stringify(data.differences.historyApplied.miniOnly));
    }
    if (data.differences.historyApplied.same.length > 0) {
      console.log("History Applied (both):", JSON.stringify(data.differences.historyApplied.same));
    }

    if (data.differences.activityType) {
      console.log("Activity Type differs:");
      console.log("  GPT-4o:", data.differences.activityType.gpt4o);
      console.log("  mini:", data.differences.activityType.mini);
    }

    if (data.differences.timePreference) {
      console.log("Time Preference differs:");
      console.log("  GPT-4o:", data.differences.timePreference.gpt4o);
      console.log("  mini:", data.differences.timePreference.mini);
    }

    if (data.differences.dayConstraints) {
      console.log("Day Constraints differs:");
      console.log("  GPT-4o:", data.differences.dayConstraints.gpt4o);
      console.log("  mini:", data.differences.dayConstraints.mini);
    }

    console.log("\n⚡ PERFORMANCE:");
    console.log("-".repeat(80));
    console.log("GPT-4o Time:", data.differences.performance.gpt4oTimeMs, "ms");
    console.log("Mini Time:", data.differences.performance.miniTimeMs, "ms");
    console.log("Speed Factor:", data.differences.performance.speedupFactor);

    console.log("\n💰 COST:");
    console.log("-".repeat(80));
    console.log(data.costDifference);

    console.log("\n" + "=".repeat(80));

  } catch (error) {
    console.error("Error testing model comparison:", error);
    process.exit(1);
  }
}

testModelComparison();
