import { useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { MapPin } from 'lucide-react';

interface FavoriteVenue {
  id: string;
  title: string;
  venueType: string | null;
  venueAddress: string | null;
  latitude: string | null;
  longitude: string | null;
  rating: string | null;
  reviewCount: number | null;
  photoUrl: string | null;
}

interface FavoritesMapProps {
  venues: FavoriteVenue[];
  hoveredVenueId?: string | null;
  onMarkerHover?: (venueId: string | null) => void;
  onMarkerClick?: (venueId: string) => void;
}

export function FavoritesMap({ venues, hoveredVenueId, onMarkerHover, onMarkerClick }: FavoritesMapProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  
  // Get API key from environment
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  
  if (!apiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg border">
        <div className="text-center p-6">
          <p className="text-sm text-muted-foreground">Google Maps API key not configured</p>
          <p className="text-xs text-muted-foreground mt-1">Add VITE_GOOGLE_MAPS_API_KEY to enable map view</p>
        </div>
      </div>
    );
  }
  
  // Filter venues with valid coordinates
  const validVenues = venues.filter(v => v.latitude && v.longitude);
  
  if (validVenues.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted rounded-lg border">
        <div className="text-center p-6">
          <p className="text-sm text-muted-foreground">No venues with locations</p>
          <p className="text-xs text-muted-foreground mt-1">Add venues from Activities tab</p>
        </div>
      </div>
    );
  }
  
  // Calculate center point (average of all coordinates)
  const center = {
    lat: validVenues.reduce((sum, v) => sum + parseFloat(v.latitude!), 0) / validVenues.length,
    lng: validVenues.reduce((sum, v) => sum + parseFloat(v.longitude!), 0) / validVenues.length
  };
  
  const selectedVenue = validVenues.find(v => v.id === selectedVenueId);
  
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        mapId="favorites-map"
        defaultCenter={center}
        defaultZoom={12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        className="h-full w-full rounded-lg"
      >
        {validVenues.map((venue) => {
          const position = {
            lat: parseFloat(venue.latitude!),
            lng: parseFloat(venue.longitude!)
          };
          
          const isHovered = hoveredVenueId === venue.id;
          const isSelected = selectedVenueId === venue.id;
          
          return (
            <AdvancedMarker
              key={venue.id}
              position={position}
              onMouseEnter={() => onMarkerHover?.(venue.id)}
              onMouseLeave={() => onMarkerHover?.(null)}
              onClick={() => {
                setSelectedVenueId(venue.id);
                onMarkerClick?.(venue.id);
              }}
            >
              <div
                style={{
                  background: isHovered || isSelected ? '#6419e6' : '#ff385c',
                  borderRadius: '50%',
                  width: isHovered ? '44px' : isSelected ? '40px' : '36px',
                  height: isHovered ? '44px' : isSelected ? '40px' : '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `3px solid ${isHovered || isSelected ? '#4a0fb3' : '#d42f51'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              >
                <MapPin 
                  size={isHovered ? 24 : isSelected ? 22 : 20} 
                  color="white" 
                  fill="white"
                />
              </div>
            </AdvancedMarker>
          );
        })}
        
        {selectedVenue && (
          <InfoWindow
            position={{
              lat: parseFloat(selectedVenue.latitude!),
              lng: parseFloat(selectedVenue.longitude!)
            }}
            onCloseClick={() => setSelectedVenueId(null)}
          >
            <div className="p-2 min-w-[200px]">
              {selectedVenue.photoUrl && (
                <img 
                  src={selectedVenue.photoUrl} 
                  alt={selectedVenue.title}
                  className="w-full h-32 object-cover rounded-md mb-2"
                />
              )}
              <h3 className="font-semibold text-sm mb-1">{selectedVenue.title}</h3>
              {selectedVenue.venueType && (
                <p className="text-xs text-gray-600 mb-1">{selectedVenue.venueType}</p>
              )}
              {selectedVenue.rating && (
                <p className="text-xs text-gray-600">
                  ⭐ {selectedVenue.rating}
                  {selectedVenue.reviewCount && ` (${selectedVenue.reviewCount})`}
                </p>
              )}
              {selectedVenue.venueAddress && (
                <p className="text-xs text-gray-500 mt-1">{selectedVenue.venueAddress}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
