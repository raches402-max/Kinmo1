import { db } from "./server/db";
import { groups } from "@shared/schema";

async function checkGroupColors() {
  console.log("Fetching all groups and their accent colors...\n");

  const allGroups = await db
    .select({
      id: groups.id,
      name: groups.name,
      emoji: groups.emoji,
      accentColor: groups.accentColor
    })
    .from(groups);

  console.log("Groups and their colors:");
  console.log("========================");
  allGroups.forEach(group => {
    console.log(`${group.emoji} ${group.name}: ${group.accentColor || 'NO COLOR'}`);
  });

  console.log(`\nTotal groups: ${allGroups.length}`);
  process.exit(0);
}

checkGroupColors().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
