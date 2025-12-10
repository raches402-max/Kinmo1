/**
 * OG Image Generator
 *
 * Generates dynamic Open Graph images for shareable links using Satori.
 * These images show in iMessage, WhatsApp, Slack, etc. previews.
 */

import satori, { type SatoriOptions } from "satori";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import type { ReactNode } from "react";

// Load fonts at module initialization
const fontsDir = path.join(import.meta.dirname, "fonts");
const interFontData = fs.readFileSync(path.join(fontsDir, "Inter-SemiBold.ttf"));
const emojiFontData = fs.readFileSync(path.join(fontsDir, "NotoColorEmoji.ttf"));

const satoriOptions: SatoriOptions = {
  width: 1200,
  height: 630,
  fonts: [
    {
      name: "Inter",
      data: interFontData,
      weight: 600,
      style: "normal",
    },
    {
      name: "Noto Color Emoji",
      data: emojiFontData,
      weight: 400,
      style: "normal",
    },
  ],
};

export type OGImageParams = {
  groupEmoji: string;
  groupName: string;
  city?: string;
  date?: string; // For RSVP links only
};

/**
 * Helper to create element structure that Satori accepts
 */
function h(
  type: string,
  props: Record<string, any>,
  ...children: any[]
): ReactNode {
  return {
    type,
    props: {
      ...props,
      children: children.length === 1 ? children[0] : children.length > 0 ? children : undefined,
    },
  } as unknown as ReactNode;
}

/**
 * Generate a PNG image for Open Graph meta tags
 */
export async function generateOGImage(params: OGImageParams): Promise<Buffer> {
  // Build children array dynamically
  const children: ReactNode[] = [];

  // Group emoji (large)
  children.push(
    h("div", {
      style: {
        fontSize: 100,
        marginBottom: 8,
      },
    }, params.groupEmoji || "📅")
  );

  // Group name
  children.push(
    h("div", {
      style: {
        fontSize: 48,
        fontWeight: 600,
        color: "#1F2937",
        marginTop: 8,
        textAlign: "center",
        maxWidth: 1000,
      },
    }, params.groupName)
  );

  // Add date if present (for RSVP links)
  if (params.date) {
    children.push(
      h("div", {
        style: {
          fontSize: 32,
          color: "#1F2937",
          marginTop: 8,
        },
      }, params.date)
    );
  }

  // Add city if present
  if (params.city) {
    children.push(
      h("div", {
        style: {
          fontSize: 28,
          color: "#6B7280",
          marginTop: 8,
        },
      }, params.city)
    );
  }

  // Kinmo branding with robot emoji at bottom
  children.push(
    h("div", {
      style: {
        position: "absolute",
        bottom: 40,
        fontSize: 24,
        color: "#9CA3AF",
        display: "flex",
        alignItems: "center",
        gap: 8,
      },
    }, "🤖 kinmo.ai")
  );

  const element = h("div", {
    style: {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FEF3C7", // Kinmo yellow/amber
      fontFamily: "Inter",
      position: "relative",
    },
  }, ...children);

  const svg = await satori(element, satoriOptions);

  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return pngBuffer;
}

/**
 * Generate a default/fallback OG image for the app
 */
export async function generateDefaultOGImage(): Promise<Buffer> {
  const element = h("div", {
    style: {
      width: 1200,
      height: 630,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FEF3C7",
      fontFamily: "Inter",
      position: "relative",
    },
  },
    h("div", { style: { fontSize: 100, marginBottom: 16 } }, "🤖"),
    h("div", {
      style: {
        fontSize: 64,
        fontWeight: 600,
        color: "#1F2937",
      },
    }, "Kinmo"),
    h("div", {
      style: {
        fontSize: 28,
        color: "#6B7280",
        marginTop: 16,
      },
    }, "AI-powered group event planning"),
    h("div", {
      style: {
        position: "absolute",
        bottom: 40,
        fontSize: 24,
        color: "#9CA3AF",
      },
    }, "kinmo.ai")
  );

  const svg = await satori(element, satoriOptions);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
