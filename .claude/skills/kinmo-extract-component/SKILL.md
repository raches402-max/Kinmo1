---
name: kinmo-extract-component
description: Extract React components from large files in Kinmo. Use when refactoring to split components into separate files with proper TypeScript interfaces, imports, and Kinmo conventions.
---

# Kinmo Component Extraction Patterns

When extracting components from large files (especially `group-detail.tsx`), follow these patterns.

## File Locations

- Components: `client/src/components/`
- UI primitives: `client/src/components/ui/` (shadcn components)
- Hooks: `client/src/hooks/`
- Utilities: `client/src/lib/`

## Component Structure Template

```typescript
/**
 * ComponentName
 * Brief description of what this component does
 */

import React from "react";
import { LucideIcon } from "lucide-react";  // Icon type if needed
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ========== TYPES ==========

interface ComponentNameProps {
  /**
   * JSDoc description of prop
   */
  requiredProp: string;
  /**
   * Optional prop with default
   */
  optionalProp?: boolean;
  /**
   * Callback functions
   */
  onAction?: () => void;
  /**
   * For styling customization
   */
  className?: string;
}

// ========== COMPONENT ==========

export function ComponentName({
  requiredProp,
  optionalProp = false,
  onAction,
  className,
}: ComponentNameProps) {
  // Component logic here

  return (
    <div className={cn("base-styles", className)}>
      {/* Content */}
    </div>
  );
}
```

## Extracting from group-detail.tsx

### Step 1: Identify the component boundaries

Look for:
- Self-contained JSX blocks
- Local state that only affects one section
- Repeated UI patterns
- Sections with clear data dependencies

### Step 2: Define the interface

Pull out all required props:
```typescript
// Before: inline in group-detail.tsx
const handleDelete = () => { ... };
const isDeleting = deleteMutation.isPending;

// After: ComponentProps interface
interface MyComponentProps {
  onDelete: () => void;
  isDeleting: boolean;
  item: ItemType;
}
```

### Step 3: Move dependencies

Common patterns:

```typescript
// Pass down data instead of using query hooks inside
interface EventsTableProps {
  events: Event[];  // Pass the data
  onDelete: (id: string) => void;  // Pass mutation handlers
  isLoading: boolean;
}

// For components that need their own queries
interface VenuePreviewProps {
  placeId: string;  // Pass ID, component fetches details
  onClose: () => void;
}
```

## Common Kinmo Component Types

### Display Components (stateless)

```typescript
// EmptyState pattern
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-12 text-center">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
```

### Modal/Dialog Components

```typescript
interface MyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Data needed for the modal
  groupId: string;
  // Callbacks
  onSuccess?: () => void;
}

export function MyModal({ open, onOpenChange, groupId, onSuccess }: MyModalProps) {
  // Modal's own state
  const [formData, setFormData] = useState({});

  // Modal's own mutations (using the hook pattern)
  const mutation = useMutation({
    mutationFn: async (data) => { ... },
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Content */}
      </DialogContent>
    </Dialog>
  );
}
```

### List/Table Components

```typescript
interface ItemListProps {
  items: Item[];
  onItemClick?: (item: Item) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function ItemList({ items, onItemClick, onDelete, isLoading, emptyMessage }: ItemListProps) {
  if (isLoading) {
    return <LoadingState />;
  }

  if (items.length === 0) {
    return <EmptyState title={emptyMessage || "No items"} />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} onClick={() => onItemClick?.(item)} />
      ))}
    </div>
  );
}
```

## Import Conventions

```typescript
// React
import React, { useState, useEffect, useMemo, useCallback } from "react";

// Icons (Lucide)
import { Plus, Trash2, Settings, ChevronRight } from "lucide-react";

// UI Components (shadcn)
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Custom Components
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";

// Hooks
import { useGroupMutations } from "@/hooks/useGroupMutations";
import { useToast } from "@/hooks/use-toast";

// Utils
import { cn } from "@/lib/utils";
import { formatEventDate } from "@/lib/formatting";
import { apiRequest } from "@/lib/queryClient";

// Types
import type { Group, Member, Itinerary } from "@shared/schema";
```

## Checklist for Extraction

- [ ] Create new file in `client/src/components/`
- [ ] Define TypeScript interface for props
- [ ] Add JSDoc comments for complex props
- [ ] Move only the JSX and directly related logic
- [ ] Keep hooks/queries in parent unless component is self-contained
- [ ] Update imports in original file
- [ ] Add the component to any index.ts if exists
- [ ] Test that it renders correctly
- [ ] Check for any TypeScript errors

## File Naming

```
ComponentName.tsx           # Main component file
ComponentName.test.tsx      # Tests (if applicable)
```

Use PascalCase for component files matching the export name.
