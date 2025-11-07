import { db } from './db';
import { groups } from '../shared/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { storage } from './storage';

async function deleteGroup() {
  const targetGroupName = "AFC (Asian Food Crew)";

  console.log(`\n🔍 Searching for group: "${targetGroupName}"...\n`);

  // Find the group by name
  const foundGroups = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.name, targetGroupName),
        isNull(groups.deletedAt)
      )
    );

  if (foundGroups.length === 0) {
    console.log('❌ Group not found.');
    console.log('\nℹ️  Possible reasons:');
    console.log('   - Group name is different');
    console.log('   - Group has already been deleted');
    console.log('   - Group is soft-deleted (has deletedAt timestamp)');
    console.log('\nTip: Check all groups with:');
    console.log('   SELECT id, name, deleted_at FROM groups;');
    process.exit(1);
  }

  if (foundGroups.length > 1) {
    console.log(`⚠️  Warning: Found ${foundGroups.length} groups with this name:`);
    foundGroups.forEach(g => {
      console.log(`   - ID: ${g.id}, Created: ${g.createdAt}`);
    });
    console.log('\n❌ Multiple groups found. Update script to target specific ID.');
    process.exit(1);
  }

  const group = foundGroups[0];

  console.log('✅ Group found:\n');
  console.log('   📋 Name:', group.name);
  console.log('   🆔 ID:', group.id);
  console.log('   👤 Owner ID:', group.userId);
  console.log('   📅 Created:', group.createdAt);
  console.log('   📍 Location:', group.locationBase);
  console.log('   💰 Budget:', group.budgetMin ? `$${group.budgetMin}-$${group.budgetMax}` : `Up to $${group.budgetMax}`);

  // Get member count
  const members = await storage.getGroupMembers(group.id);
  console.log('   👥 Members:', members.length);

  console.log('\n⚠️  WARNING: This will PERMANENTLY delete:');
  console.log('   - The group');
  console.log('   - All members');
  console.log('   - All activities and voting events');
  console.log('   - All itineraries, RSVPs, and invites');
  console.log('   - All preference signals and history');
  console.log('\n✅ A backup will be created before deletion.');

  console.log('\n🗑️  Proceeding with deletion in 3 seconds...');

  // Wait 3 seconds to give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🔄 Deleting group...\n');

  try {
    await storage.hardDeleteGroup(group.id);
    console.log('✅ Group permanently deleted!');
    console.log('\nℹ️  Backup created for recovery if needed.');
    console.log('   Check group_backups table for recovery data.');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error deleting group:', error.message);
    console.error(error);
    process.exit(1);
  }
}

deleteGroup();
