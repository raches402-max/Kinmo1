import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, X, Users } from "lucide-react";
import { Link } from "wouter";

const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  locationBase: z.string().min(1, "Location is required"),
  budgetMin: z.number().min(0),
  budgetMax: z.number().min(0),
  meetingFrequency: z.string().min(1, "Meeting frequency is required"),
  availability: z.string().min(1, "Availability is required"),
  closenessLevel: z.number().min(1).max(5),
  noveltyPreference: z.number().min(1).max(5),
  pastPreferences: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type MemberInput = {
  name: string;
  email: string;
};

const closenessLabels = ["Acquaintances", "Friends", "Good Friends", "Close Friends", "Best Friends"];
const noveltyLabels = ["Familiar Favorites", "Mostly Familiar", "Mix of Both", "Try New Things", "Always Novel"];

export default function CreateGroup() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberInput[]>([{ name: "", email: "" }]);
  const [budgetRange, setBudgetRange] = useState<number[]>([50, 200]);
  const [closeness, setCloseness] = useState(3);
  const [novelty, setNovelty] = useState(3);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      locationBase: "",
      budgetMin: 50,
      budgetMax: 200,
      meetingFrequency: "",
      availability: "",
      closenessLevel: 3,
      noveltyPreference: 3,
      pastPreferences: "",
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: FormValues & { members: MemberInput[] }) => {
      return await apiRequest("POST", "/api/groups", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: "Group created successfully!",
        description: "Generating AI-powered activity suggestions...",
      });
      navigate(`/group/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormValues) => {
    const validMembers = members.filter(m => m.name || m.email);
    createGroupMutation.mutate({
      ...data,
      budgetMin: budgetRange[0],
      budgetMax: budgetRange[1],
      closenessLevel: closeness,
      noveltyPreference: novelty,
      members: validMembers,
    });
  };

  const addMember = () => {
    setMembers([...members, { name: "", email: "" }]);
  };

  const removeMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: "name" | "email", value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Create Your Group</h1>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Group Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Group Details</CardTitle>
                <CardDescription>Tell us about your group</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Friday Night Crew" {...field} data-testid="input-group-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="locationBase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Base</FormLabel>
                      <FormControl>
                        <Input placeholder="San Francisco, CA" {...field} data-testid="input-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <Label>Budget Range (per person)</Label>
                  <div className="space-y-4">
                    <Slider
                      min={0}
                      max={500}
                      step={10}
                      value={budgetRange}
                      onValueChange={setBudgetRange}
                      className="w-full"
                      data-testid="slider-budget"
                    />
                    <div className="flex justify-between text-sm">
                      <span className="font-medium" data-testid="text-budget-min">${budgetRange[0]}</span>
                      <span className="font-medium" data-testid="text-budget-max">${budgetRange[1]}</span>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="meetingFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>How Often to Meet</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usual Availability</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-availability">
                            <SelectValue placeholder="Select availability" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekday-evenings">Weekday Evenings</SelectItem>
                          <SelectItem value="weekends">Weekends</SelectItem>
                          <SelectItem value="weekend-mornings">Weekend Mornings</SelectItem>
                          <SelectItem value="weekend-afternoons">Weekend Afternoons</SelectItem>
                          <SelectItem value="any-time">Flexible / Any Time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle>Group Preferences</CardTitle>
                <CardDescription>Help us understand your group's vibe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <Label>How Close Is This Group?</Label>
                  <div className="space-y-4">
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[closeness]}
                      onValueChange={(value) => setCloseness(value[0])}
                      className="w-full"
                      data-testid="slider-closeness"
                    />
                    <div className="text-center">
                      <span className="text-sm font-medium text-primary" data-testid="text-closeness-level">
                        {closenessLabels[closeness - 1]}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>New Experiences vs Familiar Places</Label>
                  <div className="space-y-4">
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[novelty]}
                      onValueChange={(value) => setNovelty(value[0])}
                      className="w-full"
                      data-testid="slider-novelty"
                    />
                    <div className="text-center">
                      <span className="text-sm font-medium text-primary" data-testid="text-novelty-level">
                        {noveltyLabels[novelty - 1]}
                      </span>
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="pastPreferences"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What Has Your Group Enjoyed in the Past?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                          className="resize-none h-24"
                          {...field}
                          data-testid="textarea-past-preferences"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Members Card */}
            <Card>
              <CardHeader>
                <CardTitle>Group Members (Optional)</CardTitle>
                <CardDescription>Add member names and emails to send invitations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {members.map((member, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Name"
                        value={member.name}
                        onChange={(e) => updateMember(index, "name", e.target.value)}
                        data-testid={`input-member-name-${index}`}
                      />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={member.email}
                        onChange={(e) => updateMember(index, "email", e.target.value)}
                        data-testid={`input-member-email-${index}`}
                      />
                    </div>
                    {members.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMember(index)}
                        data-testid={`button-remove-member-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMember}
                  className="w-full"
                  data-testid="button-add-member"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Member
                </Button>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={createGroupMutation.isPending}
                data-testid="button-create-submit"
              >
                {createGroupMutation.isPending ? (
                  <>
                    <Users className="mr-2 h-5 w-5 animate-spin" />
                    Creating Group...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-5 w-5" />
                    Create Group & Get Suggestions
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
