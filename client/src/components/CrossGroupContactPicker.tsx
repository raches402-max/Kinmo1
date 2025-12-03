import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, ChevronDown, ChevronRight } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
  memberId: string;
  sourceGroupId: string;
  sourceGroupName: string;
  sourceGroupEmoji: string | null;
}

interface CrossGroupContactPickerProps {
  selectedContacts: Contact[];
  onSelectionChange: (contacts: Contact[]) => void;
  maxSelections?: number;
}

export function CrossGroupContactPicker({
  selectedContacts,
  onSelectionChange,
  maxSelections,
}: CrossGroupContactPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/user/contacts"],
  });

  // Group contacts by source group
  const contactsByGroup = useMemo(() => {
    const grouped = new Map<string, { groupName: string; emoji: string | null; contacts: Contact[] }>();

    for (const contact of contacts) {
      const existing = grouped.get(contact.sourceGroupId);
      if (existing) {
        existing.contacts.push(contact);
      } else {
        grouped.set(contact.sourceGroupId, {
          groupName: contact.sourceGroupName,
          emoji: contact.sourceGroupEmoji,
          contacts: [contact],
        });
      }
    }

    return grouped;
  }, [contacts]);

  // Filter contacts by search query
  const filteredContactsByGroup = useMemo(() => {
    if (!searchQuery.trim()) return contactsByGroup;

    const query = searchQuery.toLowerCase();
    const filtered = new Map<string, { groupName: string; emoji: string | null; contacts: Contact[] }>();

    contactsByGroup.forEach((group, groupId) => {
      const matchingContacts = group.contacts.filter(
        (c: Contact) =>
          c.name.toLowerCase().includes(query) ||
          (c.email && c.email.toLowerCase().includes(query))
      );

      if (matchingContacts.length > 0) {
        filtered.set(groupId, { ...group, contacts: matchingContacts });
      }
    });

    return filtered;
  }, [contactsByGroup, searchQuery]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const isSelected = (contact: Contact) =>
    selectedContacts.some((c) => c.id === contact.id);

  const toggleContact = (contact: Contact) => {
    if (isSelected(contact)) {
      onSelectionChange(selectedContacts.filter((c) => c.id !== contact.id));
    } else {
      if (maxSelections && selectedContacts.length >= maxSelections) return;
      onSelectionChange([...selectedContacts, contact]);
    }
  };

  const selectAllInGroup = (groupId: string) => {
    const group = filteredContactsByGroup.get(groupId);
    if (!group) return;

    const newSelected = [...selectedContacts];
    for (const contact of group.contacts) {
      if (!isSelected(contact)) {
        if (maxSelections && newSelected.length >= maxSelections) break;
        newSelected.push(contact);
      }
    }
    onSelectionChange(newSelected);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <span className="animate-pulse">Loading contacts...</span>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mb-2" />
        <p>No contacts found</p>
        <p className="text-sm">Add members to your groups first</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Selected count */}
      {selectedContacts.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedContacts.length} selected
            {maxSelections && ` / ${maxSelections} max`}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectionChange([])}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Contact list grouped by source group */}
      <ScrollArea className="h-[300px] border rounded-md">
        <div className="p-2">
          {Array.from(filteredContactsByGroup.entries()).map(([groupId, group]) => (
            <div key={groupId} className="mb-2">
              {/* Group header */}
              <button
                onClick={() => toggleGroup(groupId)}
                className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                {expandedGroups.has(groupId) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="text-lg">{group.emoji || "👥"}</span>
                <span className="font-medium">{group.groupName}</span>
                <Badge variant="outline" className="ml-auto">
                  {group.contacts.length}
                </Badge>
              </button>

              {/* Group contacts */}
              {expandedGroups.has(groupId) && (
                <div className="ml-6 mt-1 space-y-1">
                  <button
                    onClick={() => selectAllInGroup(groupId)}
                    className="text-xs text-primary hover:underline mb-2"
                  >
                    Select all
                  </button>
                  {group.contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected(contact)}
                        onCheckedChange={() => toggleContact(contact)}
                        disabled={
                          !isSelected(contact) &&
                          maxSelections !== undefined &&
                          selectedContacts.length >= maxSelections
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{contact.name}</p>
                        {contact.email && (
                          <p className="text-sm text-muted-foreground truncate">
                            {contact.email}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          {filteredContactsByGroup.size === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No contacts match your search
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
