import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const routesDir = path.join(repoRoot, 'server', 'routes');
const routesIndexPath = path.join(routesDir, 'index.ts');
const monolithPath = path.join(repoRoot, 'server', 'routes.ts');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const METHOD_PATTERN = HTTP_METHODS.join('|');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizePath(routePath) {
  if (!routePath.startsWith('/')) return `/${routePath}`;
  return routePath.replace(/\/$/, '') || '/';
}

function normalizeEndpoint(method, routePath) {
  return `${method.toUpperCase()} ${normalizePath(routePath)}`;
}

function extractMounts() {
  const source = read(routesIndexPath);
  const importMatches = [...source.matchAll(/import\s+(\w+)\s+from\s+["']\.\/(.+?)["'];/g)];
  const imports = new Map(importMatches.map((match) => [match[1], match[2]]));

  const mountMatches = [...source.matchAll(/app\.use\(["']([^"']+)["'],\s*(\w+)\);/g)];
  return mountMatches.map((match) => {
    const mountPath = normalizePath(match[1]);
    const routerIdentifier = match[2];
    const fileStem = imports.get(routerIdentifier);

    if (!fileStem) {
      throw new Error(`Could not resolve router import for ${routerIdentifier}`);
    }

    return {
      mountPath,
      routerIdentifier,
      fileStem,
      filePath: path.join(routesDir, `${fileStem}.ts`),
    };
  });
}

function extractRouterEndpoints(filePath, mountPath, fileStem) {
  const source = read(filePath);
  const regex = new RegExp(`router\\.(${METHOD_PATTERN})\\(\\s*(["'])(.*?)\\2`, 'g');
  return [...source.matchAll(regex)].map((match) => ({
    endpoint: normalizeEndpoint(match[1], `${mountPath}${match[3]}`),
    file: fileStem,
    localPath: normalizePath(match[3]),
  }));
}

function extractMonolithEndpoints() {
  const source = read(monolithPath);
  const regex = new RegExp(`app\\.(${METHOD_PATTERN})\\(\\s*(["'])(\\/api.*?|\\/__health.*?)\\2`, 'g');
  return [...source.matchAll(regex)].map((match) => ({
    endpoint: normalizeEndpoint(match[1], match[3]),
    path: normalizePath(match[3]),
  }));
}

const mounts = extractMounts();
const subRouteEntries = mounts.flatMap((mount) =>
  extractRouterEndpoints(mount.filePath, mount.mountPath, mount.fileStem)
);
const monolithEntries = extractMonolithEndpoints();

const subRouteMap = new Map();
for (const entry of subRouteEntries) {
  const list = subRouteMap.get(entry.endpoint) ?? [];
  list.push(entry.file);
  subRouteMap.set(entry.endpoint, list);
}

const monolithSet = new Set(monolithEntries.map((entry) => entry.endpoint));
const subRouteSet = new Set(subRouteEntries.map((entry) => entry.endpoint));

const overlaps = [...subRouteSet].filter((endpoint) => monolithSet.has(endpoint)).sort();
const subRouteOnly = [...subRouteSet].filter((endpoint) => !monolithSet.has(endpoint)).sort();
const monolithOnly = [...monolithSet].filter((endpoint) => !subRouteSet.has(endpoint)).sort();
const duplicateSubRoutes = [...subRouteMap.entries()]
  .filter(([, files]) => files.length > 1)
  .sort((a, b) => a[0].localeCompare(b[0]));

console.log(`Mounted routers: ${mounts.length}`);
console.log(`Sub-router endpoints: ${subRouteSet.size}`);
console.log(`Monolith endpoints: ${monolithSet.size}`);
console.log(`Overlaps (dead inline duplicates): ${overlaps.length}`);
console.log(`Sub-router only endpoints: ${subRouteOnly.length}`);
console.log(`Monolith only endpoints: ${monolithOnly.length}`);
console.log(`Duplicate sub-router endpoints: ${duplicateSubRoutes.length}`);

if (duplicateSubRoutes.length) {
  console.log('\nDuplicate sub-router endpoints:');
  for (const [endpoint, files] of duplicateSubRoutes) {
    console.log(`  ${endpoint} <- ${files.join(', ')}`);
  }
}

if (monolithOnly.length) {
  console.log('\nPotentially unmigrated monolith endpoints:');
  for (const endpoint of monolithOnly) {
    console.log(`  ${endpoint}`);
  }
}

if (subRouteOnly.length) {
  console.log('\nSub-router endpoints not found inline in server/routes.ts:');
  for (const endpoint of subRouteOnly) {
    console.log(`  ${endpoint}`);
  }
}
