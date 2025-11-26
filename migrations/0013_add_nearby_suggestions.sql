-- Add nearby_suggestions column to itinerary_options table
ALTER TABLE itinerary_options ADD COLUMN nearby_suggestions jsonb;
