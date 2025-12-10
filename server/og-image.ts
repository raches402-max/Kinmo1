/**
 * OG Image Generator
 *
 * Generates dynamic Open Graph images for shareable links using Satori.
 * These images show in iMessage, WhatsApp, Slack, etc. previews.
 */

import satori from "satori";
import sharp from "sharp";
import fs from "fs";
import path from "path";

// Load fonts at module initialization
const fontsDir = path.join(import.meta.dirname, "fonts");
const interFontData = fs.readFileSync(path.join(fontsDir, "Inter-SemiBold.ttf"));
const emojiFontData = fs.readFileSync(path.join(fontsDir, "NotoColorEmoji.ttf"));

export type OGImageParams = {
  groupEmoji: string;
  groupName: string;
  city?: string;
  date?: string; // For RSVP links only
};

/**
 * Generate a PNG image for Open Graph meta tags
 */
export async function generateOGImage(params: OGImageParams): Promise<Buffer> {
  // Build children array dynamically
  const children: any[] = [];

  // Group emoji (large)
  children.push({
    type: "div",
    props: {
      style: {
        fontSize: 100,
        marginBottom: 8,
      },
      children: params.groupEmoji || "📅",
    },
  });

  // Group name
  children.push({
    type: "div",
    props: {
      style: {
        fontSize: 48,
        fontWeight: 600,
        color: "#1F2937",
        marginTop: 8,
        textAlign: "center",
        maxWidth: 1000,
      },
      children: params.groupName,
    },
  });

  // Add date if present (for RSVP links)
  if (params.date) {
    children.push({
      type: "div",
      props: {
        style: {
          fontSize: 32,
          color: "#1F2937",
          marginTop: 8,
        },
        children: params.date,
      },
    });
  }

  // Add city if present
  if (params.city) {
    children.push({
      type: "div",
      props: {
        style: {
          fontSize: 28,
          color: "#6B7280",
          marginTop: 8,
        },
        children: params.city,
      },
    });
  }

  // Kinmo branding with robot emoji at bottom
  children.push({
    type: "div",
    props: {
      style: {
        position: "absolute",
        bottom: 40,
        fontSize: 24,
        color: "#9CA3AF",
        display: "flex",
        alignItems: "center",
        gap: 8,
      },
      children: "🤖 kinmo.ai",
    },
  });

  const svg = await satori(
    {
      type: "div",
      props: {
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
        children,
      },
    },
    {
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
    }
  );

  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  return pngBuffer;
}

/**
 * Generate a default/fallback OG image for the app
 */
export async function generateDefaultOGImage(): Promise<Buffer> {
  const svg = await satori(
    {
      type: "div",
      props: {
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
        children: [
          {
            type: "div",
            props: {
              style: { fontSize: 100, marginBottom: 16 },
              children: "🤖",
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: 64,
                fontWeight: 600,
                color: "#1F2937",
              },
              children: "Kinmo",
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: 28,
                color: "#6B7280",
                marginTop: 16,
              },
              children: "AI-powered group event planning",
            },
          },
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: 40,
                fontSize: 24,
                color: "#9CA3AF",
              },
              children: "kinmo.ai",
            },
          },
        ],
      },
    },
    {
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
    }
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
