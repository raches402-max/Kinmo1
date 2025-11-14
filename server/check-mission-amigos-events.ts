import { storage } from "./storage";
import { pool } from "./db";

async function checkMissionAmigosEvents() {
  console.log("Checking Mission Amigos events...\n");

  try {
    const groups = await storage.getUserGroups("47724077");
    const missionAmigos = groups.find(g => g.name === "Mission Amigos");

    if (!missionAmigos) {
      console.log("Mission Amigos not found");
      return;
    }

    console.log(`Group: ${missionAmigos.name} (${missionAmigos.id})\n`);

    // Check for itineraries
    const itineraries = await storage.getGroupItineraries(missionAmigos.id);
    console.log(`Total itineraries: ${itineraries.length}`);

    // Filter for proposed/scheduled
    const proposedOrScheduled = itineraries.filter(i =>
      i.status === 'proposed' || i.status === 'scheduled'
    );

    console.log(`Proposed/Scheduled itineraries: ${proposedOrScheduled.length}\n`);

    if (proposedOrScheduled.length > 0) {
      console.log("Found proposed/scheduled events:");
      proposedOrScheduled.forEach((i, idx) => {
        console.log(`\n${idx + 1}. ${i.name}`);
        console.log(`   ID: ${i.id}`);
        console.log(`   Status: ${i.status}`);
        console.log(`   Created: ${i.createdAt}`);
        console.log(`   Event Date: ${i.eventDate || 'Not set'}`);
      });
      console.log("\n⚠️  This is why the 'Now' button fails - high-cadence groups can only have 1 event at a time.");
      console.log("   You need to cancel or complete these events before creating a new one.\n");
    } else {
      console.log("✅ No proposed/scheduled events found - 'Now' button should work!\n");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

checkMissionAmigosEvents();
