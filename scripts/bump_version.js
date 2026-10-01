#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const funcPkgPath = path.join(rootDir, 'functions', 'package.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const funcPkg = JSON.parse(fs.readFileSync(funcPkgPath, 'utf8'));

const arg = process.argv[2] || 'patch';

let [major, minor, patch] = pkg.version.split('.').map(Number);

if (arg === 'major') major++;
else if (arg === 'minor') { minor++; patch = 0; }
else if (arg === 'patch') patch++;
else if (/^\d+\.\d+\.\d+$/.test(arg)) {
  const parts = arg.split('.').map(Number);
  major = parts[0]; minor = parts[1]; patch = parts[2];
} else {
  console.error(`Uso: node scripts/bump_version.js [patch|minor|major|x.y.z]`);
  process.exit(1);
}

const newVersion = `${major}.${minor}.${patch}`;
console.log(`🚀 Incrementando versión de ${pkg.version} -> ${newVersion}`);

pkg.version = newVersion;
funcPkg.version = newVersion;

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(funcPkgPath, JSON.stringify(funcPkg, null, 2) + '\n');

console.log(`✅ Versión sincronizada en package.json y functions/package.json a ${newVersion}.`);
