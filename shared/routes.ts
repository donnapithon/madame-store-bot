import { z } from "zod";

export const api = {
  // Minimal API for health checks or basic stats if needed
  health: {
    check: {
      method: "GET" as const,
      path: "/api/health" as const,
      responses: {
        200: z.object({ status: z.string() }),
      },
    },
  },
};

// Helper to match the template requirement
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
