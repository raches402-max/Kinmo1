import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Brain,
  TrendingUp,
  DollarSign,
  Clock,
  MapPin,
  Sparkles,
  AlertCircle,
  Star,
  MessageCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupInsights } from "@/components/GroupInsights";

interface FeedbackSummary {
  totalResponses: number;
  budgetConcerns: number;
  timeConcerns: number;
  locationConcerns: number;
  activityTypeConcerns: number;
  otherConcerns: number;
  recentFeedback?: Array<{
    id: string;
    itineraryName: string;
    response: string;
    createdAt: string;
    feedback: { notes?: string };
  }>;
}

interface PostEventFeedbackSummary {
  totalResponses: number;
  averageRating: number;
  moreFrequent: number;
  justRight: number;
  lessFrequent: number;
  wouldDoAgainYes: number;
  wouldDoAgainMaybe: number;
  wouldDoAgainNo: number;
  recentComments?: Array<{
    id: string;
    itineraryName: string;
    rating: number;
    notes: string;
  }>;
}

interface FeedbackTabProps {
  groupId: string;
}

function FeedbackTabContent({ groupId }: FeedbackTabProps) {
  // Fetch feedback summary
  const { data: feedbackSummary, isLoading: feedbackLoading } = useQuery<FeedbackSummary>({
    queryKey: ["/api/groups", groupId, "feedback-summary"],
    enabled: !!groupId,
  });

  // Fetch post-event feedback summary
  const { data: postEventFeedbackSummary, isLoading: postEventFeedbackLoading } = useQuery<PostEventFeedbackSummary>({
    queryKey: ["/api/groups", groupId, "post-event-feedback-summary"],
    enabled: !!groupId,
  });

  return (
    <div className="space-y-6">
      {/* Learning Insights Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/50">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-bold">What We've Learned</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                See how the AI learns from your group's feedback to improve future suggestions.
                View blacklisted venues, member preferences, and engagement patterns.
              </p>
              <Link href={`/groups/${groupId}/learning`}>
                <Button className="gap-2">
                  <Brain className="h-4 w-4" />
                  View Learning Insights
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automated Group Insights */}
      <GroupInsights groupId={groupId} />

      {/* Divider */}
      <div className="border-t my-6" />

      {/* RSVP Feedback Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-4">RSVP Feedback</h3>
        {feedbackLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : feedbackSummary && feedbackSummary.totalResponses > 0 ? (
          <div className="space-y-6">
            {/* Overview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Feedback Overview
                </CardTitle>
                <CardDescription>
                  Patterns from {feedbackSummary.totalResponses} member {feedbackSummary.totalResponses === 1 ? 'response' : 'responses'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Budget Concerns */}
                {feedbackSummary.budgetConcerns > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Budget concerns</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feedbackSummary.budgetConcerns} {feedbackSummary.budgetConcerns === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                    <Progress
                      value={(feedbackSummary.budgetConcerns / feedbackSummary.totalResponses) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Time Concerns */}
                {feedbackSummary.timeConcerns > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Time doesn't work</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feedbackSummary.timeConcerns} {feedbackSummary.timeConcerns === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                    <Progress
                      value={(feedbackSummary.timeConcerns / feedbackSummary.totalResponses) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Location Concerns */}
                {feedbackSummary.locationConcerns > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Location is inconvenient</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feedbackSummary.locationConcerns} {feedbackSummary.locationConcerns === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                    <Progress
                      value={(feedbackSummary.locationConcerns / feedbackSummary.totalResponses) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Activity Type Concerns */}
                {feedbackSummary.activityTypeConcerns > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Not interested in these activities</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feedbackSummary.activityTypeConcerns} {feedbackSummary.activityTypeConcerns === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                    <Progress
                      value={(feedbackSummary.activityTypeConcerns / feedbackSummary.totalResponses) * 100}
                      className="h-2"
                    />
                  </div>
                )}

                {/* Other Concerns */}
                {feedbackSummary.otherConcerns > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Other reasons</Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {feedbackSummary.otherConcerns} {feedbackSummary.otherConcerns === 1 ? 'mention' : 'mentions'}
                      </span>
                    </div>
                    <Progress
                      value={(feedbackSummary.otherConcerns / feedbackSummary.totalResponses) * 100}
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Post-Event Feedback Card */}
            {!postEventFeedbackLoading && postEventFeedbackSummary && postEventFeedbackSummary.totalResponses > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Post-Event Feedback
                  </CardTitle>
                  <CardDescription>
                    Insights from {postEventFeedbackSummary.totalResponses} event {postEventFeedbackSummary.totalResponses === 1 ? 'attendee' : 'attendees'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Average Venue Rating */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <Label className="font-medium">Average venue rating</Label>
                      </div>
                      <span className="text-lg font-semibold">
                        {postEventFeedbackSummary.averageRating}/5
                      </span>
                    </div>
                  </div>

                  {/* Frequency Preferences */}
                  <div className="space-y-2">
                    <Label className="font-medium">Event frequency preferences</Label>
                    <div className="space-y-2">
                      {postEventFeedbackSummary.moreFrequent > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">More often</span>
                          <span className="text-sm text-muted-foreground">
                            {postEventFeedbackSummary.moreFrequent} {postEventFeedbackSummary.moreFrequent === 1 ? 'vote' : 'votes'}
                          </span>
                        </div>
                      )}
                      {postEventFeedbackSummary.justRight > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">This is perfect</span>
                          <span className="text-sm text-muted-foreground">
                            {postEventFeedbackSummary.justRight} {postEventFeedbackSummary.justRight === 1 ? 'vote' : 'votes'}
                          </span>
                        </div>
                      )}
                      {postEventFeedbackSummary.lessFrequent > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Less often</span>
                          <span className="text-sm text-muted-foreground">
                            {postEventFeedbackSummary.lessFrequent} {postEventFeedbackSummary.lessFrequent === 1 ? 'vote' : 'votes'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Willingness to Repeat */}
                  <div className="space-y-2">
                    <Label className="font-medium">Would do this again?</Label>
                    <div className="space-y-2">
                      {postEventFeedbackSummary.wouldDoAgainYes > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Yes</span>
                          <span className="text-sm text-muted-foreground">
                            {postEventFeedbackSummary.wouldDoAgainYes} {postEventFeedbackSummary.wouldDoAgainYes === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                      )}
                      {postEventFeedbackSummary.wouldDoAgainMaybe > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Maybe</span>
                          <span className="text-sm text-muted-foreground">
                            {postEventFeedbackSummary.wouldDoAgainMaybe} {postEventFeedbackSummary.wouldDoAgainMaybe === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                      )}
                      {postEventFeedbackSummary.wouldDoAgainNo > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm">No</span>
                          <span className="text-sm text-muted-foreground">
                            {postEventFeedbackSummary.wouldDoAgainNo} {postEventFeedbackSummary.wouldDoAgainNo === 1 ? 'response' : 'responses'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Improvement Suggestions */}
                  {postEventFeedbackSummary.recentComments && postEventFeedbackSummary.recentComments.length > 0 && (
                    <div className="space-y-2">
                      <Label className="font-medium">Recent improvement suggestions</Label>
                      <div className="space-y-3">
                        {postEventFeedbackSummary.recentComments.map((comment) => (
                          <div key={comment.id} className="border-l-2 border-primary/20 pl-4 py-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{comment.itineraryName}</span>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < comment.rating ? 'fill-current text-primary' : 'text-muted-foreground'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground italic">
                              "{comment.notes}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Recent Feedback Comments */}
            {feedbackSummary.recentFeedback && feedbackSummary.recentFeedback.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Recent Comments
                  </CardTitle>
                  <CardDescription>
                    Latest feedback from your group members
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {feedbackSummary.recentFeedback.map((item) => (
                    <div key={item.id} className="border-l-2 border-primary/20 pl-4 py-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.itineraryName}</span>
                        <Badge variant={item.response === 'yes' ? 'default' : item.response === 'maybe' ? 'secondary' : 'outline'}>
                          {item.response}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                      {item.feedback.notes && (
                        <p className="text-sm text-muted-foreground italic">
                          "{item.feedback.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">No Feedback Yet</CardTitle>
              <CardDescription className="text-base mt-2">
                Member feedback will appear here
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-8">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                When members RSVP with "maybe" or "can't make it" and provide feedback, you'll see patterns here to help plan better events.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders when parent state changes
export const FeedbackTab = memo(FeedbackTabContent);
