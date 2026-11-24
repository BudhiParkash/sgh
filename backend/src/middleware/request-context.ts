import type { RequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { ulid } from "ulid";
import { logger } from "../config/logger.js";
import { hashIdentifier } from "../lib/crypto.js";

/** Request id (server-generated, never trusted from the client), hashed IP, structured access log. */
export const requestContext: RequestHandler[] = [
  pinoHttp({
    logger,
    genReqId: (_req, res) => {
      const id = ulid();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
    customProps: (req) => ({ ipHash: (req as unknown as { ipHash?: string }).ipHash }),
    serializers: {
      req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url.split("?")[0] }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  }),
  (req, _res, next) => {
    req.ipHash = hashIdentifier(req.ip);
    req.valid = {};
    next();
  },
];
