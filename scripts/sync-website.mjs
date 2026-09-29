import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const SITES = [
  '../website/apexrun',
  '../website/apexrun-zh',
];

const artifacts = [
  'runner-tools.global.js',
  'runner-tools.global.js.map',
  'runner-tools.worker.js',
  'runner-tools.worker.js.map',
];

for (const artifact of artifacts) {
  if (!existsSync(resolve('dist', artifact))) {
    console.error(`Error: dist/${artifact} not found. Run "npm run build" first.`);
    process.exit(1);
  }
}

let syncedCount = 0;
for (const relSite of SITES) {
  const siteDir = resolve(relSite);
  if (existsSync(siteDir)) {
    const targetDir = resolve(siteDir, 'static/js');
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    for (const artifact of artifacts) {
      const targetPath = resolve(targetDir, artifact);
      copyFileSync(resolve('dist', artifact), targetPath);
      console.log(`Synced artifact -> ${targetPath}`);
    }

    const licenseSrc = resolve('LICENSE');
    if (existsSync(licenseSrc)) {
      const licenseTarget = resolve(targetDir, 'runner-tools.LICENSE');
      copyFileSync(licenseSrc, licenseTarget);
      console.log(`Synced license -> ${licenseTarget}`);
    }
    syncedCount++;
  } else {
    console.warn(`Skipping missing site directory: ${siteDir}`);
  }
}

console.log(`Explicit sync finished for ${syncedCount} website(s).`);
