import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeRequest } from './_lib/router.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam)
    ? pathParam
    : pathParam
      ? [pathParam]
      : [];

  return routeRequest(req, res, path);
}
