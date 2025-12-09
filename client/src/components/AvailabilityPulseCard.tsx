import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Check, Clock, Users } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface PulseData {
  pulse: {
    id: string;
    startDate: string;
    endDate: string;
    targetEventDate: string | null;
    status: string;
    memberCount: number;
    responseCount: number;
    expiresAt: string;
  } | null;
  myResponse: {
    id: string;
    availability: Record<string, any>;
    notes: string | null;
    responseToken: string;
    updatedAt: string;
  } | null;
  aggregatedAvailability: Record<string, { morning: number; afternoon: number; evening: number }>;
  totalResponses: number;
}

interface AvailabilityPulseCardProps {
  groupId: string;
  className?: string;
}

export function AvailabilityPulseCard({ groupId, className }: AvailabilityPulseCardProps) {
  const { data, isLoading, error } = useQuery<PulseData>({
    queryKey: ["availability-pulse", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/availability-pulse`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error("Failed to fetch pulse");
      }
      return res.json();
    },
  });

  // Don't show anything if loading, error, or no active pulse
  if (isLoading || error || !data?.pulse) {
    return null;
  }

  const { pulse, myResponse, totalResponses } = data;
  const targetDate = pulse.targetEventDate ? parseISO(pulse.targetEventDate) : null;
  const expiresAt = parseISO(pulse.expiresAt);
  const daysUntilExpiry = differenceInDays(expiresAt, new Date());
  const hasResponded = myResponse && Object.keys(myResponse.availability || {}).length > 0;

  // Count slots in my response
  const mySlotCount = myResponse
    ? Object.values(myResponse.availability || {}).reduce((acc: number, slots: any) => {
        return acc + (slots.morning ? 1 : 0) + (slots.afternoon ? 1 : 0) + (slots.evening ? 1 : 0);
      }, 0)
    : 0;

  return (
    <Card className={cn("border-primary/30 bg-primary/5", className)}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">
                {targetDate ? `Planning for ${format(targetDate, 'MMMM d')}` : 'Availability Check'}
              </h3>
              {hasResponded && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                  <Check className="h-3 w-3" />
                  Submitted
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {hasResponded
                ? `You marked ${mySlotCount} time slots as available`
                : "Let us know when you're free for the next hangout"}
            </p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {totalResponses}/{pulse.memberCount} responded
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {daysUntilExpiry > 0 ? `${daysUntilExpiry}d left` : 'Closing soon'}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          {myResponse?.responseToken ? (
            <Link href={`/availability/${pulse.id}/${myResponse.responseToken}`}>
              <Button variant={hasResponded ? "outline" : "default"} size="sm" className="w-full">
                {hasResponded ? "Update Availability" : "Share Your Availability"}
              </Button>
            </Link>
          ) : (
            <Button variant="default" size="sm" className="w-full" disabled>
              Loading...
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
