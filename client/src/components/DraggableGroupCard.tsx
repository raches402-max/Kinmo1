import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GroupCard } from "./GroupCard";
import { GripVertical } from "lucide-react";
import type { Group, GroupCollection } from "@shared/schema";

type SafeMember = {
  id: string;
  name: string | null;
  email: string | null;
  openToHosting?: boolean;
  profileCompleted?: boolean;
  isOrganizer?: boolean;
};

interface DraggableGroupCardProps {
  group: Group & { members: SafeMember[] };
  showMenu?: boolean;
  collections?: GroupCollection[];
  currentUserMemberId?: string;
  onMoveToCollection?: (groupId: string, collectionId: string | null) => void;
  onDeleteGroup?: (groupId: string) => void;
  onLeaveGroup?: (groupId: string, memberId: string) => void;
  isSelected?: boolean;
  onSelect?: (groupId: string, isMultiSelect: boolean) => void;
  isDragging?: boolean;
}

export function DraggableGroupCard({
  group,
  showMenu = true,
  collections = [],
  currentUserMemberId,
  onMoveToCollection,
  onDeleteGroup,
  onLeaveGroup,
  isSelected = false,
  onSelect,
  isDragging = false,
}: DraggableGroupCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging || isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      onClick={(e) => {
        // Handle selection with Shift key
        if (e.shiftKey && onSelect) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(group.id, true);
        }
      }}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <div className="bg-background/80 backdrop-blur-sm p-1 rounded border border-border shadow-sm">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <GroupCard
        group={group}
        showMenu={showMenu}
        collections={collections}
        currentUserMemberId={currentUserMemberId}
        onMoveToCollection={onMoveToCollection}
        onDeleteGroup={onDeleteGroup}
        onLeaveGroup={onLeaveGroup}
      />

      {/* Selection indicator badge */}
      {isSelected && (
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full shadow-md">
          Selected
        </div>
      )}
    </div>
  );
}
