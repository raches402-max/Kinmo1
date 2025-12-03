import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, Save, Send } from "lucide-react";
import { TimeSelectionTabs } from "./TimeSelectionTabs";
import { ReadOnlyAvailabilityGrid } from "@/components/ReadOnlyAvailabilityGrid";
import type { TimeOption } from "@/hooks/useSchedulingFlow";

interface GroupAvailability {
  availability?: unknown;
  generalAvailability?: string | null;
  meetingFrequency?: string | null;
}

interface InlineSchedulingCardProps {
  // Group info
  group: GroupAvailability | null;
  formatMeetingFrequency: (freq: string) => string;

  // Scheduling state
  scheduleMethod: 'manual' | 'ai';
  onMethodChange: (method: 'manual' | 'ai') => void;
  eventDate: string;
  onEventDateChange: (date: string) => void;
  eventTime: string;
  onEventTimeChange: (time: string) => void;

  // AI time options
  aiTimeOptions: TimeOption[];
  onAiTimeOptionsChange: (options: TimeOption[]) => void;
  selectedTimeOptionIds: string[];
  onSelectedTimeOptionIdsChange: (ids: string[]) => void;
  onToggleTimeOption: (optionId: string) => void;
  onGetAiSuggestions: () => void;
  isLoadingAi: boolean;

  // Actions
  onSaveForLater: () => void;
  onSendToGroup: () => Promise<void>;
  isSending: boolean;

  // Test ID prefix
  testIdPrefix?: string;
}

export function InlineSchedulingCard({
  group,
  formatMeetingFrequency,
  scheduleMethod,
  onMethodChange,
  eventDate,
  onEventDateChange,
  eventTime,
  onEventTimeChange,
  aiTimeOptions,
  onAiTimeOptionsChange,
  selectedTimeOptionIds,
  onSelectedTimeOptionIdsChange,
  onToggleTimeOption,
  onGetAiSuggestions,
  isLoadingAi,
  onSaveForLater,
  onSendToGroup,
  isSending,
  testIdPrefix = "inline",
}: InlineSchedulingCardProps) {
  const isDisabled =
    isSending ||
    (scheduleMethod === 'manual' && (!eventDate || !eventTime)) ||
    (scheduleMethod === 'ai' && selectedTimeOptionIds.length === 0);

  const getButtonLabel = () => {
    if (isSending) return "Sending...";
    if (scheduleMethod === 'ai' && selectedTimeOptionIds.length > 1) {
      return `Send ${selectedTimeOptionIds.length} Time Options`;
    }
    return "Send to Group";
  };

  return (
    <Card id="inline-schedule-section" className="mt-6" data-testid={`card-${testIdPrefix}-schedule`}>
      <CardHeader>
        <CardTitle className="text-lg">Schedule This Event</CardTitle>
        <CardDescription>Choose when to meet with your group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">When to Meet</Label>
            {/* Compact Availability Reference */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-7 text-xs text-muted-foreground"
                  data-testid={`button-view-availability-${testIdPrefix}`}
                >
                  <Calendar className="h-3 w-3" />
                  View Availability
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="p-3 bg-muted/30 rounded-md border space-y-3">
                  {!!group?.availability && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Group Availability</p>
                      <ReadOnlyAvailabilityGrid
                        value={group.availability as Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>}
                        compact={true}
                      />
                    </div>
                  )}
                  {group?.generalAvailability && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Notes</p>
                      <p className="text-xs text-muted-foreground">{group.generalAvailability}</p>
                    </div>
                  )}
                  {group?.meetingFrequency && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Frequency</p>
                      <p className="text-xs text-muted-foreground">{formatMeetingFrequency(group.meetingFrequency)}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Time Selection Tabs */}
          <TimeSelectionTabs
            scheduleMethod={scheduleMethod}
            onMethodChange={(method) => {
              onMethodChange(method);
              onAiTimeOptionsChange([]);
              onSelectedTimeOptionIdsChange([]);
            }}
            eventDate={eventDate}
            onEventDateChange={onEventDateChange}
            eventTime={eventTime}
            onEventTimeChange={onEventTimeChange}
            aiTimeOptions={aiTimeOptions}
            selectedTimeOptionIds={selectedTimeOptionIds}
            onToggleTimeOption={onToggleTimeOption}
            onGetAiSuggestions={onGetAiSuggestions}
            onGetDifferentOptions={async () => {
              onAiTimeOptionsChange([]);
              onSelectedTimeOptionIdsChange([]);
              onGetAiSuggestions();
            }}
            isLoadingAi={isLoadingAi}
            testIdPrefix={testIdPrefix}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onSaveForLater}
              className="flex-1"
              data-testid={`button-save-for-later-${testIdPrefix}`}
            >
              <Save className="h-4 w-4 mr-2" />
              Save for Later
            </Button>
            <Button
              onClick={onSendToGroup}
              disabled={isDisabled}
              className="flex-[2]"
              data-testid={`button-send-to-group-${testIdPrefix}`}
            >
              <Send className="h-4 w-4 mr-2" />
              {getButtonLabel()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
