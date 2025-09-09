// server/middleware/timezone.ts
import type { Request, Response, NextFunction } from "express";
import { resolveBusinessTimeZone } from "../../shared/timezone.js";

declare global {
  namespace Express {
    interface Request {
      tz?: string;
    }
  }
}

export function timezoneMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Options: Header takes priority, then query, then body, then tenant default
  const headerTz = req.header("X-Timezone");
  const queryTz = typeof req.query.tz === "string" ? req.query.tz : undefined;
  const bodyTz = typeof (req.body?.timezone) === "string" ? req.body.timezone : undefined;

  req.tz = resolveBusinessTimeZone(headerTz || queryTz || bodyTz, false); // prefer AU default on server
  next();
}