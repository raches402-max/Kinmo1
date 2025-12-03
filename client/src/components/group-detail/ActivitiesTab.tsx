import { VenueDiscoveryModule, type VenueData, type EventContext } from "@/components/venue-discovery";

interface ActivitiesTabProps {
  groupId: string;
  groupLocation: string;
  onCreateEvent: (venues: VenueData[]) => void;
  onStartSwipe: () => void;
  /** Group context for the summary strip */
  groupContext?: {
    name: string;
    emoji: string;
    memberCount?: number;
  };
  /** Event context for the summary strip */
  eventDate?: string | null;
  timezone?: string;
  occasionNote?: string;
  onChangeDate?: () => void;
  onEditNote?: (note: string) => void;
  /** Whether to show the summary strip */
  showSummaryStrip?: boolean;
}

export function ActivitiesTab({
  groupId,
  groupLocation,
  onCreateEvent,
  onStartSwipe,
  groupContext,
  eventDate,
  timezone,
  occasionNote,
  onChangeDate,
  onEditNote,
  showSummaryStrip = false,
}: ActivitiesTabProps) {
  // Build event context for the summary strip
  const eventContext: EventContext | undefined = groupContext && showSummaryStrip
    ? {
        group: {
          id: groupId,
          name: groupContext.name,
          emoji: groupContext.emoji,
          memberCount: groupContext.memberCount,
        },
        eventDate,
        timezone,
        occasionNote,
        onChangeDate,
        onEditNote,
      }
    : undefined;

  return (
    <VenueDiscoveryModule
      groupId={groupId}
      groupLocation={groupLocation}
      mode="select"
      inline={true}
      defaultTab="discover"
      onCreateEvent={onCreateEvent}
      onStartSwipe={onStartSwipe}
      showSummaryStrip={showSummaryStrip}
      eventContext={eventContext}
    />
  );
}
