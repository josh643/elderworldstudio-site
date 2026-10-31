// Empty STATIC_ROOT= (env.example default) must still serve the site tree.
// `??` / a raw env() call treat "" as set, and path.resolve("") is cwd — /worlds/ 404s.
import path from 'node:path';

export function resolveStaticRoot(envVal, repo) {
  const v = String(envVal ?? '').trim();
  return path.resolve(v || path.join(repo, 'site'));
}
