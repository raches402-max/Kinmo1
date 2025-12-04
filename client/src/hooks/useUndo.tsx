/**
 * Undo Hook
 * Provides undo functionality with toast notification
 * Delays action execution to allow user to cancel
 */

import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

interface UseUndoOptions {
  /**
   * Time in milliseconds before action is executed (default: 5000ms)
   */
  delay?: number;
  /**
   * Message to show in the toast
   */
  message: string;
  /**
   * Optional description for the toast
   */
  description?: string;
}

export function useUndo() {
  const { toast, dismiss } = useToast();
  const [pendingAction, setPendingAction] = useState<{
    timeoutId: NodeJS.Timeout;
    toastId: string;
  } | null>(null);
  const actionRef = useRef<(() => void | Promise<void>) | null>(null);
  const rollbackRef = useRef<(() => void | Promise<void>) | null>(null);

  /**
   * Execute an action with undo capability
   * @param action Function to execute after delay
   * @param rollback Function to execute if user clicks undo
   * @param options Configuration options
   */
  const executeWithUndo = useCallback(
    async (
      action: () => void | Promise<void>,
      rollback: () => void | Promise<void>,
      options: UseUndoOptions
    ) => {
      const { delay = 5000, message, description } = options;

      // Cancel any pending action
      if (pendingAction) {
        clearTimeout(pendingAction.timeoutId);
        dismiss(pendingAction.toastId);
      }

      // Store action and rollback
      actionRef.current = action;
      rollbackRef.current = rollback;

      // Show toast with undo button
      const { id: toastId } = toast({
        title: message,
        description: description || "Click undo to reverse this action",
        action: (
          <ToastAction
            altText="Undo"
            onClick={async () => {
              // Cancel the pending action
              if (pendingAction) {
                clearTimeout(pendingAction.timeoutId);
                setPendingAction(null);
              }

              // Execute rollback
              if (rollbackRef.current) {
                await rollbackRef.current();
              }

              // Show confirmation
              toast({
                title: "Action undone",
                description: "The action has been cancelled",
              });
            }}
          >
            Undo
          </ToastAction>
        ),
        duration: delay,
      });

      // Schedule action execution
      const timeoutId = setTimeout(async () => {
        if (actionRef.current) {
          await actionRef.current();
        }
        setPendingAction(null);
        dismiss(toastId);
      }, delay);

      setPendingAction({ timeoutId, toastId });
    },
    [pendingAction, toast, dismiss]
  );

  /**
   * Cancel any pending action
   */
  const cancel = useCallback(() => {
    if (pendingAction) {
      clearTimeout(pendingAction.timeoutId);
      dismiss(pendingAction.toastId);
      setPendingAction(null);
    }
  }, [pendingAction, dismiss]);

  return {
    executeWithUndo,
    cancel,
    hasPendingAction: !!pendingAction,
  };
}
