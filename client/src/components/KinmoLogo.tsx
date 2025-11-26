/**
 * Kinmo Logo - Integrated wordmark with gathering table icon as the "O"
 * The logo represents: the letter O, a dining/gathering table with seats, and a warm sun
 */

interface KinmoLogoProps {
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const sizes = {
  sm: { fontSize: "1.05rem", iconSize: 16, letterSpacing: "2px" },
  md: { fontSize: "1.25rem", iconSize: 20, letterSpacing: "2px" },
  lg: { fontSize: "2rem", iconSize: 32, letterSpacing: "3px" },
};

export function KinmoLogo({ size = "md", color = "#F2C94C", className = "" }: KinmoLogoProps) {
  const { fontSize, iconSize, letterSpacing } = sizes[size];

  return (
    <div
      className={`flex items-center ${className}`}
      style={{
        fontFamily: "'Nunito', sans-serif",
        fontWeight: 700,
        fontSize,
        letterSpacing,
        color,
      }}
    >
      <span>Kinm</span>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        style={{ marginLeft: 0 }}
        aria-hidden="true"
      >
        {/* Center circle - the table/sun */}
        <circle cx="24" cy="24" r="14" fill={color} />
        {/* Six seats around the table */}
        <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={color} />
        <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={color} />
        <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={color} />
        <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={color} />
        <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={color} />
        <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={color} />
      </svg>
    </div>
  );
}

/**
 * Standalone logo icon without the wordmark
 */
export function KinmoIcon({ size = 24, color = "#F2C94C", className = "" }: { size?: number; color?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Kinmo"
    >
      <circle cx="24" cy="24" r="14" fill={color} />
      <path d="M19 5 A4 4 0 0 1 29 5 L24 5 Z" fill={color} />
      <path d="M38 10 A4 4 0 0 1 43 19 L40 14 Z" fill={color} />
      <path d="M43 29 A4 4 0 0 1 38 38 L40 34 Z" fill={color} />
      <path d="M29 43 A4 4 0 0 1 19 43 L24 43 Z" fill={color} />
      <path d="M10 38 A4 4 0 0 1 5 29 L8 34 Z" fill={color} />
      <path d="M5 19 A4 4 0 0 1 10 10 L8 14 Z" fill={color} />
    </svg>
  );
}
