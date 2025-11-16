import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  description: string;
}

interface OnboardingWizardProps {
  currentStep: number;
  totalSteps: number;
  steps: Step[];
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  backLabel?: string;
  canGoNext?: boolean;
  canGoBack?: boolean;
  showSkip?: boolean;
  isSubmitting?: boolean;
}

export function OnboardingWizard({
  currentStep,
  totalSteps,
  steps,
  children,
  onNext,
  onBack,
  onSkip,
  nextLabel = "Continue",
  backLabel = "Back",
  canGoNext = true,
  canGoBack = true,
  showSkip = false,
  isSubmitting = false,
}: OnboardingWizardProps) {
  const currentStepInfo = steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div
                key={index}
                className="flex items-center flex-1"
              >
                <div className="flex flex-col items-center flex-1">
                  {/* Step Circle */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "border-primary text-primary bg-primary/10",
                      !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="mt-2 text-center hidden md:block">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        isCurrent && "text-foreground",
                        !isCurrent && "text-muted-foreground"
                      )}
                    >
                      {step.title}
                    </p>
                  </div>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-colors",
                      index < currentStep ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current Step Info (Mobile) */}
        <div className="md:hidden text-center">
          <p className="text-sm font-medium text-foreground">
            {currentStepInfo.title}
          </p>
          <p className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {totalSteps}
          </p>
        </div>
      </div>

      {/* Step Header */}
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold mb-2">{currentStepInfo.title}</h2>
        <p className="text-muted-foreground">{currentStepInfo.description}</p>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {canGoBack && currentStep > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isSubmitting}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {backLabel}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showSkip && onSkip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              disabled={isSubmitting}
            >
              Skip tutorial
            </Button>
          )}

          <Button
            type="button"
            onClick={onNext}
            disabled={!canGoNext || isSubmitting}
          >
            {isSubmitting ? (
              "Creating..."
            ) : isLastStep ? (
              "Create Group"
            ) : (
              <>
                {nextLabel}
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
