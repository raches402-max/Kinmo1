import { db } from "./db";
import { groups } from "@shared/schema";
import { eq, isNull } from "drizzle-orm";

const GROUP_COLOR_PALETTE = [
  '#60A5FA', // Soft Blue
  '#2DD4BF', // Teal
  '#34D399', // Green
  '#A3E635', // Lime
  '#FBBF24', // Amber
  '#FB923C', // Orange
  '#FB7185', // Rose
  '#F472B6', // Pink
  '#C084FC', // Purple
  '#818CF8', // Indigo
  '#94A3B8', // Slate
  '#22D3EE', // Cyan
];

function assignGroupColor(groupId: string): string {
  // Use hash of group ID to consistently pick from palette
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = ((hash << 5) - hash) + groupId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % GROUP_COLOR_PALETTE.length;
  return GROUP_COLOR_PALETTE[index];
}

async function assignAccentColors() {
  console.log("Finding groups without accent colors...");

  // Get all groups without accent colors
  const groupsWithoutColors = await db
    .select()
    .from(groups)
    .where(isNull(groups.accentColor));

  console.log(`Found ${groupsWithoutColors.length} groups without accent colors.`);

  // Update each group with an accent color
  for (const group of groupsWithoutColors) {
    const accentColor = assignGroupColor(group.id);
    await db
      .update(groups)
      .set({ accentColor })
      .where(eq(groups.id, group.id));

    console.log(`Assigned color ${accentColor} to group ${group.name} (${group.id})`);
  }

  console.log("Done!");
  process.exit(0);
}

assignAccentColors().catch((error) => {
  console.error("Error assigning accent colors:", error);
  process.exit(1);
});
