import {
  UtensilsCrossed,
  Coffee,
  Wine,
  Beer,
  Music,
  Cake,
  IceCream,
  Film,
  Palette,
  Landmark,
  Trees,
  Dumbbell,
  Sparkles,
  ShoppingBag,
  MapPin,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  restaurant: UtensilsCrossed,
  meal_takeaway: UtensilsCrossed,
  meal_delivery: UtensilsCrossed,
  food: UtensilsCrossed,
  cafe: Coffee,
  coffee_shop: Coffee,
  bakery: Cake,
  dessert_shop: IceCream,
  ice_cream_shop: IceCream,
  bar: Wine,
  wine_bar: Wine,
  brewery: Beer,
  distillery: Wine,
  pub: Beer,
  night_club: Music,
  movie_theater: Film,
  bowling_alley: Sparkles,
  museum: Landmark,
  art_gallery: Palette,
  park: Trees,
  spa: Sparkles,
  gym: Dumbbell,
  shopping_mall: ShoppingBag,
  store: ShoppingBag,
};

export function iconForVenueType(venueType: string | null | undefined): LucideIcon {
  if (!venueType) return MapPin;
  const key = venueType.toLowerCase().replace(/\s+/g, "_");
  return ICONS[key] ?? MapPin;
}

export function hasMeaningfulVenueType(venueType: string | null | undefined): boolean {
  return Boolean(venueType) && venueType !== "venue";
}
