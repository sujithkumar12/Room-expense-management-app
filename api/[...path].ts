import type { VercelRequest, VercelResponse } from '@vercel/node';
import { routeRequest } from './_lib/router.js';

function extractApiPath(req: VercelRequest): string[] {
  const pathParam = req.query.path;
  if (pathParam) {
    const segments = (Array.isArray(pathParam) ? pathParam : [pathParam])
      .map(String)
      .filter(Boolean);
    if (segments.length > 0) return segments;
  }

  const pathname = (req.url ?? '').split('?')[0];
  if (pathname.startsWith('/api/')) {
    const rest = pathname.slice('/api/'.length);
    if (rest) return rest.split('/').filter(Boolean);
  }

  const trimmed = pathname.replace(/^\//, '');
  if (trimmed && trimmed !== 'api') {
    return trimmed.split('/').filter(Boolean);
  }

  return [];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return routeRequest(req, res, extractApiPath(req));
}
