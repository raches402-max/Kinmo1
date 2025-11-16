import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipProps {
  content: string;
  examples?: string[];
}

export function HelpTooltip({ content, examples }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center ml-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="sr-only">Help</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs" side="top">
        <p className="text-sm">{content}</p>
        {examples && examples.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <p className="font-medium">Examples:</p>
            <ul className="list-disc list-inside mt-1">
              {examples.map((example, i) => (
                <li key={i}>{example}</li>
              ))}
            </ul>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
