---
name: kinmo-form-builder
description: Generate React Hook Form components with Zod validation, shadcn/ui form fields, and proper error handling. Use when creating new forms or form sections in Kinmo.
---

# Kinmo Form Builder Patterns

When creating forms for Kinmo, follow these established patterns using React Hook Form + Zod + shadcn/ui.

## File Locations

- Page forms: `client/src/pages/*.tsx`
- Shared form components: `client/src/components/*Form.tsx` or inline in dialogs
- Validation schemas (if backend): `server/validation-schemas.ts`

## Required Imports

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
```

## Complete Form Template

```typescript
// 1. Define schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  amount: z.number().min(0, "Amount must be positive"),
  category: z.enum(["meal", "drinks", "experience"], {
    errorMap: () => ({ message: "Please select a category" }),
  }),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

// 2. Component
export function MyForm({ onSuccess }: { onSuccess?: () => void }) {
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      amount: 0,
      category: undefined,
      description: "",
      isActive: true,
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      // API call here
      await apiRequest("POST", "/api/endpoint", data);
      toast({ title: "Success", description: "Form submitted successfully" });
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Form fields here */}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit"
          )}
        </Button>
      </form>
    </Form>
  );
}
```

## Form Field Templates

### Text Input

```typescript
<FormField
  control={form.control}
  name="name"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Name</FormLabel>
      <FormControl>
        <Input placeholder="Enter name" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Email Input

```typescript
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input type="email" placeholder="email@example.com" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Number Input

```typescript
<FormField
  control={form.control}
  name="amount"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Amount</FormLabel>
      <FormControl>
        <Input
          type="number"
          placeholder="0"
          {...field}
          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Textarea

```typescript
<FormField
  control={form.control}
  name="description"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Description</FormLabel>
      <FormControl>
        <Textarea
          placeholder="Enter description..."
          className="resize-none"
          rows={4}
          {...field}
        />
      </FormControl>
      <FormDescription>Optional notes or context</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Select Dropdown

```typescript
<FormField
  control={form.control}
  name="category"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Category</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="meal">Meal</SelectItem>
          <SelectItem value="drinks">Drinks</SelectItem>
          <SelectItem value="experience">Experience</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Slider (for ranges like 1-5)

```typescript
<FormField
  control={form.control}
  name="rating"
  render={({ field }) => (
    <FormItem>
      <div className="flex items-center justify-between">
        <FormLabel>Rating</FormLabel>
        <span className="text-sm text-muted-foreground">{field.value}/5</span>
      </div>
      <FormControl>
        <Slider
          min={1}
          max={5}
          step={1}
          value={[field.value]}
          onValueChange={(value) => field.onChange(value[0])}
          className="py-4"
        />
      </FormControl>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low</span>
        <span>High</span>
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Switch/Toggle

```typescript
<FormField
  control={form.control}
  name="isActive"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <FormLabel className="text-base">Active</FormLabel>
        <FormDescription>Enable this feature</FormDescription>
      </div>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>
```

### Budget Range (Dual Slider)

```typescript
// Schema
const formSchema = z.object({
  budgetMin: z.number().min(0),
  budgetMax: z.number().min(0),
}).refine(data => data.budgetMin <= data.budgetMax, {
  message: "Min must be less than max",
  path: ["budgetMax"],
});

// Component state for slider
const [budgetRange, setBudgetRange] = useState([form.getValues("budgetMin"), form.getValues("budgetMax")]);

// Field
<FormItem>
  <div className="flex items-center justify-between">
    <FormLabel>Budget Range</FormLabel>
    <span className="text-sm text-muted-foreground">
      ${budgetRange[0]} - ${budgetRange[1]}
    </span>
  </div>
  <Slider
    min={0}
    max={150}
    step={5}
    value={budgetRange}
    onValueChange={(value) => {
      setBudgetRange(value);
      form.setValue("budgetMin", value[0]);
      form.setValue("budgetMax", value[1]);
    }}
    className="py-4"
  />
  <div className="flex justify-between text-xs text-muted-foreground">
    <span>$0</span>
    <span>$150+</span>
  </div>
</FormItem>
```

## Dynamic Array Fields (Members List)

```typescript
// Schema
const formSchema = z.object({
  members: z.array(z.object({
    name: z.string().min(1, "Name required"),
    email: z.string().email("Invalid email"),
  })).min(1, "At least one member required"),
});

// Component
const [members, setMembers] = useState([{ name: "", email: "" }]);

const addMember = () => {
  setMembers([...members, { name: "", email: "" }]);
};

const removeMember = (index: number) => {
  if (members.length > 1) {
    setMembers(members.filter((_, i) => i !== index));
  }
};

const updateMember = (index: number, field: "name" | "email", value: string) => {
  const updated = [...members];
  updated[index][field] = value;
  setMembers(updated);
  form.setValue("members", updated);
};

// JSX
<div className="space-y-4">
  <Label>Members</Label>
  {members.map((member, index) => (
    <div key={index} className="flex gap-2 items-start">
      <Input
        placeholder="Name"
        value={member.name}
        onChange={(e) => updateMember(index, "name", e.target.value)}
        className="flex-1"
      />
      <Input
        type="email"
        placeholder="Email"
        value={member.email}
        onChange={(e) => updateMember(index, "email", e.target.value)}
        className="flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => removeMember(index)}
        disabled={members.length === 1}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  ))}
  <Button type="button" variant="outline" size="sm" onClick={addMember}>
    <Plus className="h-4 w-4 mr-2" />
    Add Member
  </Button>
</div>
```

## Form in Dialog/Modal

```typescript
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription, ResponsiveDialogFooter } from "@/components/ResponsiveDialog";

function EditDialog({ open, onOpenChange, initialData }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData,
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && initialData) {
      form.reset(initialData);
    }
  }, [open, initialData]);

  const onSubmit = async (data: FormValues) => {
    // ... save logic
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Edit Item</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Make changes to your item
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Form fields */}

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
```

## Form with Mutation Hook

```typescript
import { useGroupMutations } from "@/hooks/useGroupMutations";

function GroupEditForm({ groupId, onSuccess }: Props) {
  const mutations = useGroupMutations({
    groupId,
    callbacks: {
      onEditGroupSuccess: onSuccess,
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { /* ... */ },
  });

  const onSubmit = (data: FormValues) => {
    mutations.updateGroup.mutate({
      updates: data,
      newMembers: [],
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* Fields */}
        <Button
          type="submit"
          disabled={mutations.updateGroup.isPending}
        >
          {mutations.updateGroup.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      </form>
    </Form>
  );
}
```

## Common Zod Schema Patterns

```typescript
// String with constraints
name: z.string().min(1, "Required").max(100, "Too long").trim(),

// Optional with default
description: z.string().optional().default(""),

// Enum with custom error
status: z.enum(["draft", "active", "completed"], {
  errorMap: () => ({ message: "Please select a status" }),
}),

// Number range
rating: z.number().int().min(1).max(5),

// Budget/price
budget: z.number().min(0, "Must be positive").max(1000, "Too high"),

// Email
email: z.string().email("Invalid email").toLowerCase(),

// URL
website: z.string().url("Invalid URL").optional().or(z.literal("")),

// Date string
date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),

// DateTime
datetime: z.string().datetime("Invalid datetime"),

// Array with min/max
tags: z.array(z.string()).min(1, "At least one tag").max(5, "Max 5 tags"),

// Nested object
address: z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  zip: z.string().regex(/^\d{5}$/, "Invalid ZIP"),
}),

// Cross-field validation
.refine(data => data.budgetMin <= data.budgetMax, {
  message: "Min budget must be less than max",
  path: ["budgetMax"],
})
```

## Form Layout Patterns

### Two-Column Layout

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <FormField name="firstName" ... />
  <FormField name="lastName" ... />
</div>
```

### Section Groups

```typescript
<div className="space-y-6">
  <div>
    <h3 className="text-lg font-medium mb-4">Basic Info</h3>
    <div className="space-y-4">
      {/* Basic fields */}
    </div>
  </div>

  <Separator />

  <div>
    <h3 className="text-lg font-medium mb-4">Preferences</h3>
    <div className="space-y-4">
      {/* Preference fields */}
    </div>
  </div>
</div>
```

### Card-Wrapped Sections

```typescript
<Card>
  <CardHeader>
    <CardTitle>Contact Information</CardTitle>
    <CardDescription>How we can reach you</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Form fields */}
  </CardContent>
</Card>
```

## Form Checklist

When creating a new form:

- [ ] Define Zod schema with appropriate constraints
- [ ] Create TypeScript type from schema (`z.infer<typeof schema>`)
- [ ] Set up useForm with zodResolver
- [ ] Provide sensible defaultValues for all fields
- [ ] Use FormField wrapper for each field
- [ ] Include FormMessage for error display
- [ ] Add loading state to submit button
- [ ] Handle onSubmit with try/catch
- [ ] Show success/error toasts
- [ ] Close dialog on success (if in modal)
- [ ] Reset form if needed (for create flows)
