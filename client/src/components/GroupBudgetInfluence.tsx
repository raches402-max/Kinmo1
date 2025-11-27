import { useState, useMemo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DollarSign, Users, TrendingDown, TrendingUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";

type MemberBudget = {
  memberId: string;
  memberName: string;
  budgetMin: number;
  budgetMax: number;
};

interface GroupBudgetInfluenceProps {
  /** All members' budget data */
  membersBudgets: MemberBudget[];
  /** Current user's member ID */
  currentMemberId: string;
  /** Group's default budget range */
  groupBudgetMin: number;
  groupBudgetMax: number;
  /** Current user's budget (null = using group default) */
  myBudget: { min: number; max: number } | null;
  /** Callback when user changes their budget */
  onMyBudgetChange: (budget: { min: number; max: number } | null) => void;
  /** Max budget for slider */
  maxBudget?: number;
}

// Budget level labels
const BUDGET_LABELS = [
  { max: 20, label: "Budget-friendly", emoji: "$" },
  { max: 40, label: "Moderate", emoji: "$$" },
  { max: 80, label: "Upscale", emoji: "$$$" },
  { max: 150, label: "Fine dining", emoji: "$$$$" },
  { max: 250, label: "Luxury", emoji: "$$$$$" },
];

function getBudgetLabel(amount: number): string {
  const level = BUDGET_LABELS.find(l => amount <= l.max);
  return level?.emoji || "$$$$$";
}

export function GroupBudgetInfluence({
  membersBudgets,
  currentMemberId,
  groupBudgetMin,
  groupBudgetMax,
  myBudget,
  onMyBudgetChange,
  maxBudget = 250,
}: GroupBudgetInfluenceProps) {
  // Optimistic local state for instant feedback
  const [optimisticBudget, setOptimisticBudget] = useState<{ min: number; max: number } | null>(null);

  // Use optimistic state if available
  const effectiveMyBudget = optimisticBudget ?? myBudget ?? { min: groupBudgetMin, max: groupBudgetMax };

  // Clear optimistic state when prop updates
  useEffect(() => {
    if (optimisticBudget !== null) {
      const timer = setTimeout(() => setOptimisticBudget(null), 100);
      return () => clearTimeout(timer);
    }
  }, [myBudget]);

  // Calculate group statistics with optimistic updates
  const stats = useMemo(() => {
    const budgets = membersBudgets.map(m => {
      // Use optimistic budget for current user
      if (m.memberId === currentMemberId) {
        return { ...m, budgetMax: effectiveMyBudget.max };
      }
      return m;
    });

    const maxValues = budgets.map(m => m.budgetMax);

    if (maxValues.length === 0) {
      return {
        average: groupBudgetMax,
        min: groupBudgetMin,
        max: groupBudgetMax,
        distribution: [] as { value: number; count: number; members: string[] }[],
        totalMembers: 0,
      };
    }

    const sum = maxValues.reduce((a, b) => a + b, 0);
    const average = Math.round(sum / maxValues.length);
    const min = Math.min(...maxValues);
    const max = Math.max(...maxValues);

    // Group by budget value for distribution
    const distributionMap = new Map<number, { count: number; members: string[] }>();
    budgets.forEach(m => {
      const existing = distributionMap.get(m.budgetMax) || { count: 0, members: [] };
      distributionMap.set(m.budgetMax, {
        count: existing.count + 1,
        members: [...existing.members, m.memberName],
      });
    });

    const distribution = Array.from(distributionMap.entries())
      .map(([value, data]) => ({ value, ...data }))
      .sort((a, b) => a.value - b.value);

    return { average, min, max, distribution, totalMembers: maxValues.length };
  }, [membersBudgets, currentMemberId, effectiveMyBudget, groupBudgetMin, groupBudgetMax]);

  // Handle budget change with optimistic update
  const handleBudgetChange = useCallback((values: number[]) => {
    const newBudget = { min: values[0], max: values[1] };
    setOptimisticBudget(newBudget);
    onMyBudgetChange(newBudget);
  }, [onMyBudgetChange]);

  // Calculate influence direction
  const influenceDirection = useMemo(() => {
    const groupMidpoint = (groupBudgetMin + groupBudgetMax) / 2;
    const myMidpoint = (effectiveMyBudget.min + effectiveMyBudget.max) / 2;

    if (myMidpoint < groupMidpoint - 10) return "budget-friendly";
    if (myMidpoint > groupMidpoint + 10) return "premium";
    return "balanced";
  }, [groupBudgetMin, groupBudgetMax, effectiveMyBudget]);

  // Position calculation helper
  const getPosition = (value: number) => Math.min(100, (value / maxBudget) * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Budget Preferences</h4>
            <p className="text-xs text-muted-foreground">
              {stats.totalMembers} {stats.totalMembers === 1 ? "member" : "members"} · Your preference shapes group suggestions
            </p>
          </div>
        </div>
      </div>

      {/* Main slider with distribution overlay */}
      <div className="space-y-2">
        <div className="relative pt-6 pb-2">
          {/* Distribution dots - show where other members are */}
          <div className="absolute top-0 left-0 right-0 h-5 pointer-events-none">
            {stats.distribution.map(({ value, count, members }) => {
              const isMe = members.length === 1 && membersBudgets.find(m => m.memberId === currentMemberId)?.budgetMax === value;
              const position = getPosition(value);

              return (
                <div
                  key={value}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${position}%` }}
                  title={`${members.join(", ")}: $${value}`}
                >
                  {/* Stack dots for multiple members at same value */}
                  <div className="flex flex-col-reverse gap-0.5">
                    {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-all",
                          isMe && i === 0
                            ? "bg-primary ring-2 ring-primary/30"
                            : "bg-muted-foreground/40"
                        )}
                      />
                    ))}
                    {count > 4 && (
                      <span className="text-[9px] text-muted-foreground font-medium">
                        +{count - 4}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Group average marker */}
            <div
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${getPosition(stats.average)}%` }}
            >
              <div className="flex flex-col items-center">
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-primary/60" />
              </div>
            </div>
          </div>

          {/* The slider */}
          <Slider
            min={0}
            max={maxBudget}
            step={10}
            value={[effectiveMyBudget.min, effectiveMyBudget.max]}
            onValueChange={handleBudgetChange}
            className="w-full"
          />

          {/* Group range indicator (subtle background) */}
          <div
            className="absolute bottom-2 h-1 bg-muted-foreground/10 rounded-full pointer-events-none"
            style={{
              left: `${getPosition(groupBudgetMin)}%`,
              width: `${getPosition(groupBudgetMax) - getPosition(groupBudgetMin)}%`,
            }}
          />
        </div>

        {/* Labels row */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">$0</span>
          <span className="text-muted-foreground">${maxBudget}+</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/30">
        {/* Your budget */}
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-0.5">Your range</div>
          <div className="font-semibold text-sm">
            ${effectiveMyBudget.min} - ${effectiveMyBudget.max >= 200 ? "200+" : effectiveMyBudget.max}
            <span className="ml-1.5 text-muted-foreground font-normal">
              {getBudgetLabel(effectiveMyBudget.max)}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-border" />

        {/* Group average */}
        <div className="flex-1 text-right">
          <div className="text-xs text-muted-foreground mb-0.5">Group average</div>
          <div className="font-semibold text-sm flex items-center justify-end gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            ${stats.average}
            <span className="text-muted-foreground font-normal">
              {getBudgetLabel(stats.average)}
            </span>
          </div>
        </div>
      </div>

      {/* Influence indicator - positive framing */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
        influenceDirection === "budget-friendly" && "bg-green-500/10 text-green-700 dark:text-green-400",
        influenceDirection === "premium" && "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        influenceDirection === "balanced" && "bg-primary/10 text-primary",
      )}>
        {influenceDirection === "budget-friendly" && (
          <>
            <TrendingDown className="h-3.5 w-3.5" />
            <span>You're helping the group discover budget-friendly options</span>
          </>
        )}
        {influenceDirection === "premium" && (
          <>
            <TrendingUp className="h-3.5 w-3.5" />
            <span>You're opening up more premium experiences for the group</span>
          </>
        )}
        {influenceDirection === "balanced" && (
          <>
            <DollarSign className="h-3.5 w-3.5" />
            <span>Your budget aligns with the group's sweet spot</span>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          <span>Other members</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/30" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-primary/60" />
          <span>Group avg</span>
        </div>
      </div>
    </div>
  );
}
