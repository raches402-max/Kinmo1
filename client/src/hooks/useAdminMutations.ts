/**
 * useAdminMutations Hook
 * Centralized mutations for admin page operations
 * Follows the kinmo-mutation skill pattern
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getErrorToast } from "@/components/ErrorDisplay";

// ========== TYPES ==========

interface CachePhotosResponse {
  cached: number;
  total: number;
  errors: number;
}

interface CleanupVenuesResponse {
  stats: {
    removed: {
      total: number;
      nonVenues: number;
      missingPhotos: number;
      lowQuality: number;
      duplicates: number;
    };
    remaining: number;
  };
}

interface BackfillResponse {
  message?: string;
  updated?: number;
}

interface RecategorizeResponse {
  stats: {
    totalVenues: number;
    venuesUpdated: number;
  };
}

interface CleanupOrphanedResponse {
  message?: string;
  votingEventsDeleted?: number;
  votesDeleted?: number;
}

// ========== HOOK ==========

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Cache photos mutation
  const cachePhotos = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/cache-photos") as CachePhotosResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-costs"] });
      toast({
        title: "Photo caching complete!",
        description: `Successfully cached ${data.cached} of ${data.total} photos. ${data.errors > 0 ? `${data.errors} errors occurred.` : ''}`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Cleanup curated venues mutation
  const cleanupVenues = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/cleanup-curated-venues") as CleanupVenuesResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-costs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deleted-venues"] });
      toast({
        title: "Cleanup complete!",
        description: `Removed ${data.stats.removed.total} invalid venues (${data.stats.removed.nonVenues} non-social venues, ${data.stats.removed.missingPhotos} missing photos, ${data.stats.removed.lowQuality} low quality, ${data.stats.removed.duplicates} duplicates). ${data.stats.remaining} venues remaining.`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Backfill favorites coordinates mutation
  const backfillCoordinates = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/backfill-favorites-coordinates") as BackfillResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Backfill complete!",
        description: data.message || `Updated ${data.updated} favorites with coordinates`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Recategorize venues mutation
  const recategorizeVenues = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/recategorize-venues") as RecategorizeResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Recategorization complete!",
        description: `Checked ${data.stats.totalVenues} venues, updated ${data.stats.venuesUpdated} miscategorized venues`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Cleanup orphaned voting data mutation
  const cleanupOrphanedVotingData = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/cleanup-orphaned-voting-data") as CleanupOrphanedResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup complete!",
        description: data.message || `Removed ${data.votingEventsDeleted} orphaned voting events and ${data.votesDeleted} orphaned votes`,
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Create backup mutation
  const createBackup = useMutation({
    mutationFn: async (notes: string) => {
      return await apiRequest("POST", "/api/admin/create-backup", { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      toast({
        title: "Backup created!",
        description: "Database backup created successfully",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Restore backup mutation
  const restoreBackup = useMutation({
    mutationFn: async (backupId: string) => {
      return await apiRequest("POST", `/api/admin/restore/${backupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      toast({
        title: "Database restored!",
        description: "Database has been restored from backup",
      });
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  return {
    // Venue maintenance
    cachePhotos,
    cleanupVenues,
    backfillCoordinates,
    recategorizeVenues,
    cleanupOrphanedVotingData,
    // Database operations
    createBackup,
    restoreBackup,
  };
}

// ========== SCRAPED VENUES MUTATIONS ==========

interface UploadVenuesResponse {
  count: number;
}

interface ImportVenuesResponse {
  imported: number;
}

interface UseScrapedVenuesMutationsOptions {
  onUploadSuccess?: () => void;
  onClearSuccess?: () => void;
  onImportSuccess?: () => void;
}

export function useScrapedVenuesMutations(options?: UseScrapedVenuesMutationsOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Upload scraped venues mutation
  const uploadVenues = useMutation({
    mutationFn: async (venues: any[]) => {
      return await apiRequest("POST", "/api/admin/scraped-venues/upload", { venues }) as UploadVenuesResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `Uploaded ${data.count} venues for comparison`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scraped-venues/comparison"] });
      options?.onUploadSuccess?.();
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Clear scraped venues mutation
  const clearVenues = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/admin/scraped-venues/clear");
    },
    onSuccess: () => {
      toast({
        title: "Cleared",
        description: "All scraped venues cleared",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scraped-venues/comparison"] });
      options?.onClearSuccess?.();
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  // Import selected venues mutation
  const importVenues = useMutation({
    mutationFn: async (venues: any[]) => {
      return await apiRequest("POST", "/api/admin/scraped-venues/import", { venues }) as ImportVenuesResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `Imported ${data.imported} venues to curated cache`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scraped-venues/comparison"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venue-analytics"] });
      options?.onImportSuccess?.();
    },
    onError: (error: Error) => {
      toast(getErrorToast(error));
    },
  });

  return {
    uploadVenues,
    clearVenues,
    importVenues,
  };
}
