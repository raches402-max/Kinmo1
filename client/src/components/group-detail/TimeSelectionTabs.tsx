import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Edit2 } from "lucide-react";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import type { TimeOption } from "@/hooks/useSchedulingFlow";

interface TimeSelectionTabsProps {
  scheduleMethod: 'manual' | 'ai';
  onMethodChange: (method: 'manual' | 'ai') => void;
  eventDate: string;
  onEventDateChange: (date: string) => void;
  eventTime: string;
  onEventTimeChange: (time: string) => void;
  aiTimeOptions: TimeOption[];
  selectedTimeOptionIds: string[];
  onToggleTimeOption: (optionId: string) => void;
  onGetAiSuggestions: () => void;
  onGetDifferentOptions: () => void;
  isLoadingAi: boolean;
  testIdPrefix?: string;
  // Editable mode props (optional)
  editable?: boolean;
  editingOptionId?: string | null;
  onEditOption?: (optionId: string | null) => void;
  onUpdateOption?: (optionId: string, updates: Partial<TimeOption>) => void;
  timezone?: string;
  timezoneName?: string;
}

export function TimeSelectionTabs({
  scheduleMethod,
  onMethodChange,
  eventDate,
  onEventDateChange,
  eventTime,
  onEventTimeChange,
  aiTimeOptions,
  selectedTimeOptionIds,
  onToggleTimeOption,
  onGetAiSuggestions,
  onGetDifferentOptions,
  isLoadingAi,
  testIdPrefix = "",
  // Editable mode props
  editable = false,
  editingOptionId = null,
  onEditOption,
  onUpdateOption,
  timezone = 'America/Los_Angeles',
  timezoneName = 'Pacific Time',
}: TimeSelectionTabsProps) {
  const prefix = testIdPrefix ? `${testIdPrefix}-` : "";

  const handleDateChange = (option: TimeOption, newDateStr: string) => {
    if (!onUpdateOption) return;

    const utcDate = new Date(option.eventDate);
    const localDate = toZonedTime(utcDate, timezone);
    const [year, month, day] = newDateStr.split('-').map(Number);
    const newLocalDate = new Date(year, month - 1, day, localDate.getHours(), localDate.getMinutes(), 0, 0);
    const newUtcDate = fromZonedTime(newLocalDate, timezone);

    onUpdateOption(option.id, {
      eventDate: newUtcDate.toISOString(),
      dayLabel: toZonedTime(newUtcDate, timezone).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: timezone
      }),
    });
  };

  const handleTimeChange = (option: TimeOption, newTimeStr: string) => {
    if (!onUpdateOption) return;

    const utcDate = new Date(option.eventDate);
    const localDate = toZonedTime(utcDate, timezone);
    const [hours, minutes] = newTimeStr.split(':').map(Number);
    const newLocalDate = new Date(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      hours,
      minutes,
      0,
      0
    );
    const newUtcDate = fromZonedTime(newLocalDate, timezone);

    onUpdateOption(option.id, {
      eventDate: newUtcDate.toISOString(),
      timeLabel: toZonedTime(newUtcDate, timezone).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: timezone
      }),
    });
  };

  const getLocalDateValue = (eventDateStr: string) => {
    const utcDate = new Date(eventDateStr);
    const localDate = toZonedTime(utcDate, timezone);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalTimeValue = (eventDateStr: string) => {
    const utcDate = new Date(eventDateStr);
    const localDate = toZonedTime(utcDate, timezone);
    const hours = String(localDate.getHours()).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <Tabs
      value={scheduleMethod}
      onValueChange={(v) => onMethodChange(v as 'manual' | 'ai')}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2 h-9">
        <TabsTrigger value="manual" className="text-xs" data-testid={`tab-manual-time-${prefix}`.replace(/-$/, '')}>
          Pick Date/Time
        </TabsTrigger>
        <TabsTrigger value="ai" className="text-xs" data-testid={`tab-ai-time-${prefix}`.replace(/-$/, '')}>
          AI Suggestions
        </TabsTrigger>
      </TabsList>

      <TabsContent value="manual" className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`event-date-${prefix}`} className="text-xs">Date</Label>
            <Input
              id={`event-date-${prefix}`}
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={eventDate}
              onChange={(e) => onEventDateChange(e.target.value)}
              className="h-9"
              data-testid={`input-event-date-${prefix}`.replace(/-$/, '')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`event-time-${prefix}`} className="text-xs">Time</Label>
            <Input
              id={`event-time-${prefix}`}
              type="time"
              value={eventTime}
              onChange={(e) => onEventTimeChange(e.target.value)}
              className="h-9"
              data-testid={`input-event-time-${prefix}`.replace(/-$/, '')}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="ai" className="mt-4 space-y-3">
        {aiTimeOptions.length === 0 && !isLoadingAi && (
          <Button
            onClick={onGetAiSuggestions}
            className="w-full gap-2"
            data-testid={`button-get-ai-suggestion-${prefix}`.replace(/-$/, '')}
          >
            <Bot className="h-4 w-4" />
            Get AI Suggestions
          </Button>
        )}

        {isLoadingAi && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Analyzing group availability...
          </div>
        )}

        {aiTimeOptions.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Select one or more times to send:</p>
              <div className="grid grid-cols-2 gap-2">
                {aiTimeOptions.map((option) => (
                  <div key={option.id} className="relative">
                    {editable && editingOptionId === option.id ? (
                      // Editing mode
                      <div className="p-3 rounded-lg border-2 border-primary bg-primary/15 space-y-2">
                        <div className="text-xs text-muted-foreground mb-1">
                          Times shown in {timezoneName}
                        </div>
                        <Input
                          type="date"
                          value={getLocalDateValue(option.eventDate)}
                          onChange={(e) => handleDateChange(option, e.target.value)}
                          className="text-sm"
                          data-testid={`edit-date-${option.id}`}
                        />
                        <Input
                          type="time"
                          value={getLocalTimeValue(option.eventDate)}
                          onChange={(e) => handleTimeChange(option, e.target.value)}
                          className="text-sm"
                          data-testid={`edit-time-${option.id}`}
                        />
                        <Button
                          size="sm"
                          onClick={() => onEditOption?.(null)}
                          className="w-full"
                          data-testid={`done-edit-${option.id}`}
                        >
                          Done
                        </Button>
                      </div>
                    ) : (
                      // Display mode
                      <div
                        onClick={() => onToggleTimeOption(option.id)}
                        className={`w-full p-3 rounded-lg border-2 cursor-pointer text-left transition-colors ${
                          selectedTimeOptionIds.includes(option.id)
                            ? 'border-primary bg-primary/15'
                            : 'border-border'
                        }`}
                        data-testid={`time-option-${prefix}${option.id}`}
                      >
                        <div className={`flex items-start ${editable ? 'justify-between' : ''} gap-2`}>
                          <div className="flex items-start gap-2 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedTimeOptionIds.includes(option.id)}
                              onChange={() => {}}
                              className="mt-0.5"
                              data-testid={`checkbox-time-${prefix}${option.id}`}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-sm">{option.dayLabel}</p>
                              <p className="text-sm text-muted-foreground">{option.timeLabel}</p>
                            </div>
                          </div>
                          {editable && onEditOption && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditOption(option.id);
                              }}
                              className="h-6 w-6 shrink-0"
                              data-testid={`edit-button-${option.id}`}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {selectedTimeOptionIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedTimeOptionIds.length} time{selectedTimeOptionIds.length === 1 ? '' : 's'} selected
                </p>
              )}
            </div>
            <Button
              variant="outline"
              onClick={onGetDifferentOptions}
              className="w-full gap-2"
              disabled={isLoadingAi}
              data-testid={`button-try-different-times-${prefix}`.replace(/-$/, '')}
            >
              <Bot className="h-4 w-4" />
              Get Different Options
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
