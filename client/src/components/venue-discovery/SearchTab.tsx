/**
 * SearchTab - Free-text venue search
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { VenueData } from "./VenueCard";
import { VenueGrid } from "./VenueGrid";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  venueName: string;
  googlePlaceId: string;
  venueAddress: string;
  rating?: number | string;
  reviewCount?: number | string;
  priceLevel?: number | string;
  photoUrl?: string;
  venueType?: string;
  category?: string;
}

interface SearchTabProps {
  groupId: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  location: string;
  radius: number;
  mode: 'select' | 'curate';
  className?: string;
}

// Transform search result to VenueData
function toVenueData(result: SearchResult): VenueData {
  return {
    id: result.googlePlaceId,
    name: result.venueName,
    address: result.venueAddress,
    photoUrl: result.photoUrl,
    rating: result.rating,
    reviewCount: result.reviewCount,
    priceLevel: result.priceLevel,
    googlePlaceId: result.googlePlaceId,
    category: result.category,
    venueType: result.venueType,
    source: 'search',
  };
}

export function SearchTab({
  groupId,
  selectedIds,
  onToggle,
  location,
  radius,
  mode,
  className,
}: SearchTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Search query
  const { data: searchResults = [], isLoading, isFetching } = useQuery<SearchResult[]>({
    queryKey: [`/api/groups/${groupId}/venues/search`, debouncedQuery, location, radius],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        location: location || "",
        radius: radius.toString(),
      });
      return apiRequest("GET", `/api/groups/${groupId}/search-venues?${params}`);
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Transform to VenueData
  const venues = useMemo(() =>
    searchResults.map(toVenueData),
    [searchResults]
  );

  const isSearching = debouncedQuery.length >= 2;
  const showLoading = isSearching && (isLoading || isFetching);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for a specific venue..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11"
        />
        {showLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results or prompt */}
      {!isSearching ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-medium mb-1">Search for Venues</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Type at least 2 characters to search for restaurants, bars, cafes, and more
          </p>
        </div>
      ) : (
        <VenueGrid
          venues={venues}
          selectedIds={selectedIds}
          onToggle={onToggle}
          isLoading={showLoading}
          layout="grid"
          size="lg"
          selectionMode={mode === 'select' ? 'checkbox' : 'heart'}
          emptyState={{
            icon: 'search',
            title: 'No results found',
            description: `No venues found for "${debouncedQuery}". Try a different search term.`,
          }}
        />
      )}
    </div>
  );
}

export default SearchTab;
