import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AvailabilityGrid, createEmptyAvailability } from "@/components/AvailabilityGrid";
import { Trash2, Plus, X, Wine, Mic2, Music, Coffee, Trophy, Mountain, PartyPopper, Gamepad2, Film, Laugh, GraduationCap, Palette, Users } from "lucide-react";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

type AvailabilityData = Record<string, { morning: boolean; afternoon: boolean; evening: boolean }>;

interface Member {
  id: string;
  name: string | null;
  email: string | null;
  isOrganizer?: boolean;
}

interface NewMember {
  name: string;
  email: string;
}

const groupEmojis = [
  "🎉", "🎊", "🎈", "🍕", "🍔", "🍰", "🎮", "🎬",
  "🎵", "🎨", "🏀", "⚽", "🎯", "🎭", "🎪", "🎤"
];

const activityCategories: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "concerts", label: "Concerts", icon: Music },
  { id: "karaoke", label: "Karaoke", icon: Mic2 },
  { id: "dancing", label: "Dancing / Clubs", icon: PartyPopper },
  { id: "comedy", label: "Comedy Shows", icon: Laugh },
  { id: "movies", label: "Movie Theaters", icon: Film },
  { id: "museums", label: "Museums / Art Galleries", icon: Palette },
  { id: "sports", label: "Sports Games", icon: Trophy },
  { id: "outdoors", label: "Hikes / Outdoors", icon: Mountain },
  { id: "game-nights", label: "Game Nights", icon: Gamepad2 },
  { id: "trivia", label: "Trivia Nights", icon: GraduationCap },
  { id: "family", label: "Family Activities", icon: Users },
];

interface GroupData {
  name: string;
  emoji: string;
  accentColor: string;
  locationBase: string;
  pastPreferences: string;
  additionalInstructions: string;
  mealEnabled: boolean;
  cafeEnabled: boolean;
  drinksEnabled: boolean;
  dessertEnabled: boolean;
  experiencesEnabled: boolean;
}

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: GroupData;
  initialBudgetRange: [number, number];
  initialFrequencyNumber: number;
  initialFrequencyUnit: string;
  initialNovelty: number;
  initialCategories: string[];
  initialAvailability: AvailabilityData;
  initialGeneralAvailability: string;
  members: Member[];
  onSave: (data: {
    updates: {
      name: string;
      emoji: string;
      accentColor: string;
      locationBase: string;
      budgetMin: number;
      budgetMax: number;
      meetingFrequency: string;
      noveltyPreference: number;
      activityCategories?: string[];
      availability: AvailabilityData;
      generalAvailability?: string;
      mealEnabled: boolean;
      cafeEnabled: boolean;
      drinksEnabled: boolean;
      dessertEnabled: boolean;
      experiencesEnabled: boolean;
      pastPreferences: string;
      additionalInstructions: string;
    };
    newMembers: NewMember[];
  }) => void;
  onDeleteMember: (memberId: string) => void;
  isSaving: boolean;
}

export function EditGroupDialog({
  open,
  onOpenChange,
  initialData,
  initialBudgetRange,
  initialFrequencyNumber,
  initialFrequencyUnit,
  initialNovelty,
  initialCategories,
  initialAvailability,
  initialGeneralAvailability,
  members,
  onSave,
  onDeleteMember,
  isSaving,
}: EditGroupDialogProps) {
  // Form state
  const [groupData, setGroupData] = useState<GroupData>(initialData);
  const [budgetRange, setBudgetRange] = useState<number[]>([initialBudgetRange[0], initialBudgetRange[1]]);
  const [frequencyNumber, setFrequencyNumber] = useState(initialFrequencyNumber);
  const [frequencyUnit, setFrequencyUnit] = useState(initialFrequencyUnit);
  const [novelty, setNovelty] = useState(initialNovelty);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [availability, setAvailability] = useState<AvailabilityData>(initialAvailability);
  const [generalAvailability, setGeneralAvailability] = useState(initialGeneralAvailability);
  const [newMembers, setNewMembers] = useState<NewMember[]>([]);

  // Reset state when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setGroupData(initialData);
      setBudgetRange([initialBudgetRange[0], initialBudgetRange[1]]);
      setFrequencyNumber(initialFrequencyNumber);
      setFrequencyUnit(initialFrequencyUnit);
      setNovelty(initialNovelty);
      setCategories(initialCategories);
      setAvailability(initialAvailability);
      setGeneralAvailability(initialGeneralAvailability);
      setNewMembers([]);
    }
  }, [open, initialData, initialBudgetRange, initialFrequencyNumber, initialFrequencyUnit, initialNovelty, initialCategories, initialAvailability, initialGeneralAvailability]);

  const toggleCategory = (categoryId: string) => {
    setCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const addNewMember = () => {
    setNewMembers(prev => [...prev, { name: "", email: "" }]);
  };

  const removeNewMember = (index: number) => {
    setNewMembers(prev => prev.filter((_, i) => i !== index));
  };

  const updateNewMember = (index: number, field: "name" | "email", value: string) => {
    setNewMembers(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleSave = () => {
    const updates = {
      name: groupData.name,
      emoji: groupData.emoji,
      accentColor: groupData.accentColor,
      locationBase: groupData.locationBase,
      budgetMin: budgetRange[0],
      budgetMax: budgetRange[1],
      meetingFrequency: `${frequencyNumber}x ${frequencyUnit}`,
      noveltyPreference: novelty,
      activityCategories: categories.length > 0 ? categories : undefined,
      availability,
      generalAvailability: generalAvailability.trim() || undefined,
      mealEnabled: groupData.mealEnabled,
      cafeEnabled: groupData.cafeEnabled,
      drinksEnabled: groupData.drinksEnabled,
      dessertEnabled: groupData.dessertEnabled,
      experiencesEnabled: groupData.experiencesEnabled,
      pastPreferences: groupData.pastPreferences,
      additionalInstructions: groupData.additionalInstructions,
    };

    const validNewMembers = newMembers.filter(m => m.name.trim() || m.email.trim());

    onSave({ updates, newMembers: validNewMembers });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-group">
        <DialogHeader>
          <DialogTitle>Edit Group Details</DialogTitle>
          <DialogDescription>
            Update your group's information and preferences
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Group Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Group Details</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-group-name">Group Name</Label>
                <Input
                  id="edit-group-name"
                  value={groupData.name}
                  onChange={(e) => setGroupData({ ...groupData, name: e.target.value })}
                  data-testid="input-edit-group-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-group-emoji">Group Icon</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">{groupData.emoji || "🎉"}</div>
                    <Input
                      id="edit-group-emoji"
                      value={groupData.emoji}
                      onChange={(e) => setGroupData({ ...groupData, emoji: e.target.value })}
                      placeholder="🎉"
                      className="w-20 text-center text-2xl"
                      data-testid="input-edit-group-emoji"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {groupEmojis.map((emoji) => (
                      <Button
                        key={emoji}
                        type="button"
                        variant={groupData.emoji === emoji ? "default" : "outline"}
                        size="sm"
                        onClick={() => setGroupData({ ...groupData, emoji })}
                        className="text-xl h-10 w-10 p-0"
                        data-testid={`button-edit-emoji-${emoji}`}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location Base</Label>
                <Input
                  id="edit-location"
                  value={groupData.locationBase}
                  onChange={(e) => setGroupData({ ...groupData, locationBase: e.target.value })}
                  data-testid="input-edit-location"
                />
              </div>
              <div className="space-y-3">
                <Label>Budget Range (per person)</Label>
                <div className="space-y-3">
                  <Slider
                    min={0}
                    max={250}
                    step={10}
                    value={budgetRange}
                    onValueChange={setBudgetRange}
                    className="w-full"
                    data-testid="slider-edit-budget"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="font-medium" data-testid="text-edit-budget-min">
                      {budgetRange[0] >= 200 ? "$200+" : `$${budgetRange[0]}`}
                    </span>
                    <span className="font-medium" data-testid="text-edit-budget-max">
                      {budgetRange[1] >= 200 ? "$200+" : `$${budgetRange[1]}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>How Often to Meet</Label>
                <div className="flex items-center gap-2">
                  <div className="w-20">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={frequencyNumber}
                      onChange={(e) => setFrequencyNumber(parseInt(e.target.value) || 1)}
                      data-testid="input-edit-frequency-number"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">x each</span>
                  <Select value={frequencyUnit} onValueChange={setFrequencyUnit}>
                    <SelectTrigger className="flex-1" data-testid="select-edit-frequency-unit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">day</SelectItem>
                      <SelectItem value="week">week</SelectItem>
                      <SelectItem value="month">month</SelectItem>
                      <SelectItem value="year">year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Group Availability</Label>
                <AvailabilityGrid
                  value={availability}
                  onChange={setAvailability}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-general-availability">General Availability (Optional)</Label>
                <Input
                  id="edit-general-availability"
                  value={generalAvailability}
                  onChange={(e) => setGeneralAvailability(e.target.value)}
                  placeholder="e.g., Weekday evenings, Weekends, Friday/Saturday nights"
                  data-testid="input-edit-general-availability"
                />
                <p className="text-xs text-muted-foreground">
                  Simple description to help AI pick the best time for your group
                </p>
              </div>
            </div>
          </div>

          {/* Preferences Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Group Preferences</h3>
            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base">How willing is your group to try new things?</Label>
                <div className="space-y-3">
                  <div className="text-center text-sm text-muted-foreground">
                    Group Openness to New Experiences
                  </div>
                  <Slider
                    min={1}
                    max={5}
                    step={1}
                    value={[novelty]}
                    onValueChange={(value) => setNovelty(value[0])}
                    className="w-full"
                    data-testid="slider-edit-novelty"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground px-1">
                    <span>We like our usual spots</span>
                    <span>Open sometimes</span>
                    <span>Always up for new things!</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base">What types of activities interest your group?</Label>
                <p className="text-sm text-muted-foreground">Select all that apply (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {activityCategories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <Button
                        key={category.id}
                        type="button"
                        variant={categories.includes(category.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleCategory(category.id)}
                        className="gap-1.5"
                        data-testid={`button-edit-category-${category.id}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{category.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-past-preferences">What Has Your Group Enjoyed in the Past?</Label>
                <Textarea
                  id="edit-past-preferences"
                  value={groupData.pastPreferences}
                  onChange={(e) => setGroupData({ ...groupData, pastPreferences: e.target.value })}
                  placeholder="e.g., Trying new restaurants, outdoor activities, board game cafes, art museums..."
                  className="resize-none h-24"
                  data-testid="textarea-edit-past-preferences"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-additional-instructions">Additional Instructions for AI (Optional)</Label>
                <Textarea
                  id="edit-additional-instructions"
                  value={groupData.additionalInstructions}
                  onChange={(e) => setGroupData({ ...groupData, additionalInstructions: e.target.value })}
                  placeholder="e.g., Must be accessible by public transit, prefer venues with outdoor seating, avoid crowded places..."
                  className="resize-none h-24"
                  data-testid="textarea-edit-additional-instructions"
                />
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold">Members</h3>

            {/* Existing Members */}
            {members.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Current Members</Label>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/25 text-primary text-xs">
                          {member.name?.[0]?.toUpperCase() || member.email?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name || "Member"}</p>
                        {member.email && (
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        )}
                      </div>
                      {member.isOrganizer ? (
                        <Badge variant="secondary" className="text-xs">Organizer</Badge>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                            >
                              <Trash2 className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Member</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {member.name || member.email || "this member"} from the group?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteMember(member.id)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Members */}
            {newMembers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">New Members to Add</Label>
                {newMembers.map((member, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input
                        placeholder="Name (optional)"
                        value={member.name}
                        onChange={(e) => updateNewMember(index, "name", e.target.value)}
                        data-testid={`input-new-member-name-${index}`}
                      />
                      <Input
                        type="email"
                        placeholder="Email (optional)"
                        value={member.email}
                        onChange={(e) => updateNewMember(index, "email", e.target.value)}
                        data-testid={`input-new-member-email-${index}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => removeNewMember(index)}
                      data-testid={`button-remove-new-member-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNewMember}
              className="w-full"
              data-testid="button-add-new-member"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-group"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
