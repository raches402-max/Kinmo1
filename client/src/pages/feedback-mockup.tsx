import { FeedbackSurveyMockup } from "@/components/FeedbackSurveyMockup";
import { useToast } from "@/hooks/use-toast";

/**
 * Preview page for the redesigned feedback survey mockup
 * Access at: /feedback-mockup
 */
export default function FeedbackMockupPage() {
  const { toast } = useToast();

  const handleSubmit = (data: any) => {
    console.log("Feedback submitted:", data);
    toast({
      title: "Feedback submitted!",
      description: "Thank you for your feedback.",
    });
  };

  const handleCancel = () => {
    toast({
      title: "Feedback skipped",
      description: "You can always leave feedback later.",
    });
  };

  return (
    <FeedbackSurveyMockup
      eventName="Wine Tasting at Corkscrew"
      groupName="The Usual Suspects"
      eventDate={new Date(2025, 11, 5, 19, 0)}
      venueName="Corkscrew Wine Bar"
      onSubmit={handleSubmit}
      onCancel={handleCancel}
    />
  );
}
