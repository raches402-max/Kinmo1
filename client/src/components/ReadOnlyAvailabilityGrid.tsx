const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["morning", "afternoon", "evening"] as const;
const TIME_LABELS = {
  morning: "Morning",
  afternoon: "Afternoon", 
  evening: "Evening"
};

type TimeSlot = typeof TIMES[number];
type AvailabilityGrid = {
  [key: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
};

interface ReadOnlyAvailabilityGridProps {
  value: AvailabilityGrid;
  compact?: boolean;
}

export function ReadOnlyAvailabilityGrid({ value, compact = false }: ReadOnlyAvailabilityGridProps) {
  if (compact) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-left text-xs font-medium text-muted-foreground w-16"></th>
              {DAYS.map(day => (
                <th key={day} className="p-1 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIMES.map(time => (
              <tr key={time}>
                <td className="p-1 text-xs text-muted-foreground">
                  {TIME_LABELS[time].substring(0, 3)}
                </td>
                {DAYS.map(day => (
                  <td key={`${day}-${time}`} className="p-1">
                    <div
                      className={`
                        w-full h-6 rounded border
                        ${value[day]?.[time] 
                          ? 'bg-primary/90 border-primary' 
                          : 'bg-muted/30 border-border'
                        }
                      `}
                      data-testid={`readonly-cell-${day.toLowerCase()}-${time}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 text-left text-sm font-medium text-muted-foreground w-24"></th>
            {DAYS.map(day => (
              <th key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIMES.map(time => (
            <tr key={time}>
              <td className="p-2 text-sm text-muted-foreground">
                {TIME_LABELS[time]}
              </td>
              {DAYS.map(day => (
                <td key={`${day}-${time}`} className="p-2">
                  <div
                    className={`
                      w-full h-10 rounded-md border
                      ${value[day]?.[time] 
                        ? 'bg-primary border-primary' 
                        : 'bg-muted/30 border-border'
                      }
                    `}
                    data-testid={`readonly-cell-${day.toLowerCase()}-${time}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
