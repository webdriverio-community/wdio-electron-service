import * as fs from 'node:fs';
import * as path from 'node:path';

interface UpdateDocsOptions {
  /** The new LTS branch name (e.g., 'v8') */
  newLtsBranch: string;
  /** The old LTS branch to archive (e.g., 'v7') */
  oldLtsBranch?: string;
  /** Either 'maintenance' or 'archive' */
  mode: 'maintenance' | 'archive';
}

/**
 * Updates documentation for maintenance branches
 */
function updateDocs(options: UpdateDocsOptions): void {
  const { newLtsBranch, oldLtsBranch, mode } = options;

  console.log(`Running in ${mode} mode for branch: ${mode === 'maintenance' ? newLtsBranch : oldLtsBranch}`);

  // Paths
  const rootDir = process.cwd();
  const templatesDir = path.join(rootDir, '.github', 'templates');
  const readmePath = path.join(rootDir, 'README.md');
  const maintenancePath = path.join(rootDir, 'MAINTENANCE.md');
  const archivedPath = path.join(rootDir, 'ARCHIVED.md');

  // Check if README exists
  if (!fs.existsSync(readmePath)) {
    console.error('README.md not found!');
    process.exit(1);
  }

  if (mode === 'maintenance') {
    // Create MAINTENANCE.md from template
    const maintenanceTemplate = fs.readFileSync(path.join(templatesDir, 'maintenance-template.md'), 'utf8');

    // Replace variables in the template
    const maintenanceContent = maintenanceTemplate.replace(/\${NEW_LTS_BRANCH}/g, newLtsBranch);
    fs.writeFileSync(maintenancePath, maintenanceContent);
    console.log(`✅ Created MAINTENANCE.md for ${newLtsBranch}`);

    // Update README.md with maintenance notice
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    const maintenanceNotice = `> **Maintenance Notice**: This version is on a maintenance branch (${newLtsBranch}).\n> See [MAINTENANCE.md](./MAINTENANCE.md) for details about the maintenance policy.\n\n`;

    // Add notice at the top of README
    const updatedReadme = maintenanceNotice + readmeContent;
    fs.writeFileSync(readmePath, updatedReadme);
    console.log(`✅ Updated README.md with maintenance notice for ${newLtsBranch}`);
  } else if (mode === 'archive') {
    if (!oldLtsBranch) {
      console.error('oldLtsBranch is required for archive mode');
      process.exit(1);
    }

    // Create ARCHIVED.md from template
    const archivedTemplate = fs.readFileSync(path.join(templatesDir, 'archived-template.md'), 'utf8');

    // Replace variables in the template
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const archivedContent = archivedTemplate
      .replace(/\${OLD_LTS_BRANCH}/g, oldLtsBranch)
      .replace(/\${NEW_LTS_BRANCH}/g, newLtsBranch)
      .replace(/\$\(date \+"%Y-%m-%d"\)/g, today);

    // Write to ARCHIVED.md
    fs.writeFileSync(archivedPath, archivedContent);
    console.log(`✅ Created ARCHIVED.md for ${oldLtsBranch}`);

    // Update README.md with archive notice
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    const archiveNotice = `> ⚠️ **ARCHIVED**: This branch (${oldLtsBranch}) is no longer maintained.\n> See [ARCHIVED.md](./ARCHIVED.md) for details about the archival status.\n\n`;

    // Add notice at the top of README
    const updatedReadme = archiveNotice + readmeContent;
    fs.writeFileSync(readmePath, updatedReadme);
    console.log(`✅ Updated README.md with archive notice for ${oldLtsBranch}`);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const mode = args[0] as 'maintenance' | 'archive';
const newLtsBranch = args[1];
const oldLtsBranch = args[2];

updateDocs({ mode, newLtsBranch, oldLtsBranch });
