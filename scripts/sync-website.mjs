import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const SITES = [
  '../website/apexrun',
  '../website/apexrun-zh',
];

const bundlePath = resolve('dist/runner-tools.global.js');

if (!existsSync(bundlePath)) {
  console.error('Error: dist/runner-tools.global.js not found. Run "npm run build" first.');
  process.exit(1);
}

let syncedCount = 0;
for (const relSite of SITES) {
  const siteDir = resolve(relSite);
  if (existsSync(siteDir)) {
    const targetDir = resolve(siteDir, 'static/js');
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    const targetPath = resolve(targetDir, 'runner-tools.global.js');
    copyFileSync(bundlePath, targetPath);
    console.log(`Synced bundle -> ${targetPath}`);

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
