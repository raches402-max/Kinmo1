import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ConfidenceWeights {
  venueQuality: number;
  timeConsensus: number;
  groupEngagement: number;
  patternMatch: number;
  swipeConsensus: number;
}

interface CalibrationData {
  count: number;
  lastCalibrationAt: string | null;
  totalPredictions: number;
  meanAbsoluteError: number | null;
  accuracyRate: number | null;
  autoCalibrationEnabled: boolean;
}

interface PredictionStats {
  total: number;
  validated: number;
  unused: number;
  averageError: number | null;
}

interface WeightsData {
  weights: ConfidenceWeights;
  calibration: CalibrationData;
  predictions: PredictionStats;
}

interface Props {
  groupId: string;
  isOrganizer: boolean;
}

export function ConfidenceWeightsDashboard({ groupId, isOrganizer }: Props) {
  const [data, setData] = useState<WeightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const { toast } = useToast();

  const fetchWeights = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/confidence-weights`);
      if (!response.ok) {
        if (response.status === 404) {
          setData(null);
          return;
        }
        throw new Error('Failed to fetch weights');
      }
      const weightsData = await response.json();
      setData(weightsData);
    } catch (error) {
      console.error('Error fetching weights:', error);
      toast({
        title: 'Error',
        description: 'Failed to load confidence data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeights();
  }, [groupId]);

  const handleCalibrate = async () => {
    if (!isOrganizer) return;

    setCalibrating(true);
    try {
      const response = await fetch(`/api/groups/${groupId}/calibrate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Calibration failed');
      }

      const result = await response.json();

      toast({
        title: 'Calibration Complete',
        description: `${result.message} - MAE improved by ${result.improvement.toFixed(1)}%`,
      });

      // Refresh data
      await fetchWeights();
    } catch (error: any) {
      toast({
        title: 'Calibration Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCalibrating(false);
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
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-2">Performance Insights</h3>
        <p className="text-gray-600 text-sm">
          No data yet. Insights will appear after members swipe on venues and events are created.
        </p>
      </div>
    );
  }

  const { weights, calibration, predictions } = data;

  const canCalibrate = predictions.unused >= 50;
  const needsMoreData = predictions.unused < 50;
  const progressToCalibration = Math.min((predictions.unused / 50) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Event Success Metrics</h3>
            <p className="text-sm text-gray-600">
              Understanding what makes events successful
            </p>
          </div>
          {isOrganizer && canCalibrate && (
            <button
              onClick={handleCalibrate}
              disabled={calibrating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {calibrating ? 'Calibrating...' : 'Recalibrate Now'}
            </button>
          )}
        </div>

        {/* Calibration Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">
              {calibration.count}
            </div>
            <div className="text-xs text-gray-600 mt-1">Calibrations Run</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">
              {calibration.meanAbsoluteError !== null
                ? `±${calibration.meanAbsoluteError.toFixed(1)}`
                : 'N/A'}
            </div>
            <div className="text-xs text-gray-600 mt-1">Avg Error (pts)</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">
              {calibration.accuracyRate !== null
                ? `${(calibration.accuracyRate * 100).toFixed(0)}%`
                : 'N/A'}
            </div>
            <div className="text-xs text-gray-600 mt-1">Accuracy Rate</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">
              {predictions.validated}
            </div>
            <div className="text-xs text-gray-600 mt-1">Predictions Validated</div>
          </div>
        </div>

        {/* Progress to Next Calibration */}
        {needsMoreData && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progress to next calibration
              </span>
              <span className="text-sm text-gray-600">
                {predictions.unused} / 50 predictions
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressToCalibration}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              System will auto-calibrate when you reach 50 validated predictions
            </p>
          </div>
        )}

        {calibration.lastCalibrationAt && (
          <p className="text-xs text-gray-500">
            Last calibration: {new Date(calibration.lastCalibrationAt).toLocaleDateString()} at{' '}
            {new Date(calibration.lastCalibrationAt).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Confidence Factor Weights */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h4 className="font-semibold mb-4">Confidence Factors</h4>
        <p className="text-sm text-gray-600 mb-6">
          How much each factor influences event confidence predictions. Weights are automatically adjusted as the system learns.
        </p>

        <div className="space-y-4">
          <WeightBar
            label="Venue Quality"
            weight={weights.venueQuality}
            description="Based on ratings, feedback, and visit history"
            color="bg-purple-600"
          />
          <WeightBar
            label="Time Consensus"
            weight={weights.timeConsensus}
            description="Based on member availability and scheduling density"
            color="bg-blue-600"
          />
          <WeightBar
            label="Group Engagement"
            weight={weights.groupEngagement}
            description="Based on RSVP rates and attendance history"
            color="bg-green-600"
          />
          <WeightBar
            label="Pattern Match"
            weight={weights.patternMatch}
            description="How well venues match group preferences"
            color="bg-orange-600"
          />
          <WeightBar
            label="Member Swipes"
            weight={weights.swipeConsensus}
            description="Based on recent member swipe votes"
            color="bg-pink-600"
          />
        </div>
      </div>

      {/* Insights */}
      <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
        <h4 className="font-semibold mb-3 text-blue-900">What the AI has learned</h4>
        <div className="space-y-2 text-sm text-blue-800">
          {getInsights(weights, calibration)}
        </div>
      </div>
    </div>
  );
}

interface WeightBarProps {
  label: string;
  weight: number;
  description: string;
  color: string;
}

function WeightBar({ label, weight, description, color }: WeightBarProps) {
  const percentage = Math.round(weight * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1">
          <div className="font-medium text-sm text-gray-900">{label}</div>
          <div className="text-xs text-gray-600">{description}</div>
        </div>
        <div className="text-lg font-bold text-gray-900 ml-4">{percentage}%</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`${color} h-3 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function getInsights(weights: ConfidenceWeights, calibration: CalibrationData): JSX.Element[] {
  const insights: JSX.Element[] = [];

  // Find the most influential factor
  const factors = [
    { name: 'venue quality', weight: weights.venueQuality },
    { name: 'time consensus', weight: weights.timeConsensus },
    { name: 'group engagement', weight: weights.groupEngagement },
    { name: 'pattern matching', weight: weights.patternMatch },
    { name: 'member swipes', weight: weights.swipeConsensus },
  ];
  const topFactor = factors.reduce((max, f) => (f.weight > max.weight ? f : max));

  insights.push(
    <div key="top-factor" className="flex items-start">
      <span className="mr-2">•</span>
      <span>
        <strong>{topFactor.name}</strong> is the most predictive factor ({Math.round(topFactor.weight * 100)}% weight)
      </span>
    </div>
  );

  // Member swipe influence
  if (weights.swipeConsensus >= 0.15) {
    insights.push(
      <div key="swipe-high" className="flex items-start">
        <span className="mr-2">•</span>
        <span>Member swipe votes are highly predictive of event success</span>
      </div>
    );
  } else if (weights.swipeConsensus <= 0.05) {
    insights.push(
      <div key="swipe-low" className="flex items-start">
        <span className="mr-2">•</span>
        <span>Venue ratings matter more than member swipes for this group</span>
      </div>
    );
  }

  // Accuracy insights
  if (calibration.accuracyRate !== null) {
    if (calibration.accuracyRate >= 0.75) {
      insights.push(
        <div key="accuracy-high" className="flex items-start">
          <span className="mr-2">•</span>
          <span>System is highly accurate at predicting event success (±15 points)</span>
        </div>
      );
    } else if (calibration.accuracyRate < 0.5) {
      insights.push(
        <div key="accuracy-low" className="flex items-start">
          <span className="mr-2">•</span>
          <span>System needs more data to improve prediction accuracy</span>
        </div>
      );
    }
  }

  // Calibration count insights
  if (calibration.count === 0) {
    insights.push(
      <div key="no-calibration" className="flex items-start">
        <span className="mr-2">•</span>
        <span>Using default weights - system will calibrate automatically once enough data is collected</span>
      </div>
    );
  } else if (calibration.count >= 5) {
    insights.push(
      <div key="mature" className="flex items-start">
        <span className="mr-2">•</span>
        <span>System has calibrated {calibration.count} times and is well-tuned for your group</span>
      </div>
    );
  }

  // MAE insights
  if (calibration.meanAbsoluteError !== null) {
    if (calibration.meanAbsoluteError < 10) {
      insights.push(
        <div key="mae-excellent" className="flex items-start">
          <span className="mr-2">•</span>
          <span>Excellent prediction accuracy (±{calibration.meanAbsoluteError.toFixed(1)} points average error)</span>
        </div>
      );
    } else if (calibration.meanAbsoluteError > 20) {
      insights.push(
        <div key="mae-needs-work" className="flex items-start">
          <span className="mr-2">•</span>
          <span>Predictions are still learning - encourage members to swipe on venues</span>
        </div>
      );
    }
  }

  return insights;
}
