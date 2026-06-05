/**
 * Sidebar — KSK-style sidebar for GPCSK.
 *
 * Contents (top→bottom):
 *  1. GPCSK logo (centered, h-16)
 *  2. + New chat button
 *  3. Search input
 *  4. Scrollable chat history (This week / Earlier groups)
 *  5. Profile pill at the bottom
 *
 * NOTE: The full sidebar logic now lives inline in SuperHomePage.tsx.
 * This file is kept as a re-export shim so any legacy import of
 * "shell/Sidebar" does not break the build. The real implementation is
 * in SuperHomePage.
 */

// This module intentionally exports nothing — the sidebar is rendered
// inline in SuperHomePage.tsx as part of the 2-column Shell component.
export {}
