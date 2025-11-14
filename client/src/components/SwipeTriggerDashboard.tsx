import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface TriggerOpportunities {
  postAI: { available: boolean; reason: string };
  favoritesOverflow: { available: boolean; reason: string };
  weeklyDigest: { available: boolean; reason: string };
}

interface Props {
  groupId: string;
  isOrganizer: boolean;
}

export function SwipeTriggerDashboard({ groupId, isOrganizer }: Props) {
  const [opportunities, setOpportunities] = useState<TriggerOpportunities | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const { toast } = useToast();

  const fetchOpportunities = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/swipe-triggers/status`);
      if (!response.ok) throw new Error('Failed to fetch trigger status');
      const data = await response.json();
      setOpportunities(data);
    } catch (error) {
      console.error('Error fetching trigger opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [groupId]);

  const handleTriggerWeeklyDigest = async () => {
    if (!isOrganizer) return;

    setTriggering(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/swipe-triggers/weekly-digest`, {
        method: 'POST',
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Weekly Digest Triggered',
          description: result.message,
        });
        await fetchOpportunities(); // Refresh status
      } else {
        toast({
          title: 'Cannot Trigger Digest',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!opportunities) {
    return null;
  }

  // Don't show if no triggers are available and user is not organizer
  const hasAnyAvailable =
    opportunities.postAI.available ||
    opportunities.favoritesOverflow.available ||
    opportunities.weeklyDigest.available;

  if (!hasAnyAvailable && !isOrganizer) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Member Engagement</h3>
          <p className="text-sm text-gray-600">
            Smart swipe sessions to gather feedback and improve AI predictions
          </p>
        </div>
      </div>

      {/* Trigger Status Grid */}
      <div className="space-y-3 mb-6">
        <TriggerStatusCard
          title="Post-AI Generation"
          description="Automatically triggers after AI creates new events"
          available={opportunities.postAI.available}
          reason={opportunities.postAI.reason}
          icon="🎯"
        />

        <TriggerStatusCard
          title="Favorites Overflow"
          description="Triggers when too many venues are saved"
          available={opportunities.favoritesOverflow.available}
          reason={opportunities.favoritesOverflow.reason}
          icon="📚"
        />

        <TriggerStatusCard
          title="Weekly Digest"
          description="Regular check-in for venue feedback"
          available={opportunities.weeklyDigest.available}
          reason={opportunities.weeklyDigest.reason}
          icon="📅"
          action={
            isOrganizer && opportunities.weeklyDigest.available ? (
              <button
                onClick={handleTriggerWeeklyDigest}
                disabled={triggering}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering ? 'Triggering...' : 'Trigger Now'}
              </button>
            ) : null
          }
        />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
        <h4 className="font-semibold text-blue-900 text-sm mb-2">How it works</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Swipe sessions are automatically triggered at strategic moments</li>
          <li>• Cooldowns prevent notification fatigue (12-24 hours between triggers)</li>
          <li>• Member feedback validates AI predictions and improves accuracy</li>
          <li>• Sessions expire after 2-7 days and auto-complete when enough members participate</li>
        </ul>
      </div>
    </div>
  );
}

interface TriggerStatusCardProps {
  title: string;
  description: string;
  available: boolean;
  reason: string;
  icon: string;
  action?: React.ReactNode;
}

function TriggerStatusCard({
  title,
  description,
  available,
  reason,
  icon,
  action
}: TriggerStatusCardProps) {
  return (
    <div className={`p-4 rounded-lg border-2 ${
      available
        ? 'bg-green-50 border-green-200'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-semibold text-sm text-gray-900">{title}</h4>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                available
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {available ? 'Ready' : 'On Cooldown'}
              </span>
            </div>
            <p className="text-xs text-gray-600 mb-1">{description}</p>
            <p className="text-xs text-gray-500 italic">{reason}</p>
          </div>
        </div>
        {action && (
          <div className="ml-4">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
