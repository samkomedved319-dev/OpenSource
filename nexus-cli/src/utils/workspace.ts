// ============================================================================
// openSource CLI — Adaptive Workspace Discovery
// Scan files · Resolve primary folders · Format ASCII trees · Auto-initialize
// ============================================================================

import { readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, relative, basename } from 'path';

export interface WorkspaceScanResult {
  primaryDir: string;
  files: string[];
  folders: string[];
  totalFiles: number;
  isEmpty: boolean;
  languages: Record<string, number>;
  treeString: string;
}

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.opensource',
  'out',
  'bin',
  'obj',
  'coverage',
  '.idea',
  '.vscode',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  // User profile directory names (in lowercase)
  'appdata',
  'localsettings',
  'application data',
  'cookies',
  'history',
  'nethood',
  'printhood',
  'recent',
  'sendto',
  'start menu',
  'templates',
  'onedrive',
  'virtualstore',
  '.gemini',
  '.config',
  '.local',
  '.cache',
  '.npm',
  '.node-gyp',
  '.yarn',
  '.pnpm',
]);

/**
 * Check if the directory matches the user home folder or a drive root
 */
export function checkIfHomeOrRoot(dir: string): boolean {
  const normalized = dir.replace(/[\\/]$/, '').toLowerCase();

  // Check user profile directory environment variables
  const userHome = (process.env.USERPROFILE || process.env.HOME || '').replace(/[\\/]$/, '').toLowerCase();
  if (userHome && normalized === userHome) {
    return true;
  }

  // Check C:\Users\<username> pattern, /Users/<username>, or /home/<username>
  if (/^[a-zA-Z]:\\users\\[^\\]+$/.test(normalized) || /^\/users\/[^\/]+$/.test(normalized) || /^\/home\/[^\/]+$/.test(normalized)) {
    return true;
  }

  // Check drive or system root
  if (normalized === '/' || /^[a-zA-Z]:$/.test(normalized) || /^[a-zA-Z]:\\$/.test(normalized)) {
    return true;
  }

  return false;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript (React)',
  js: 'JavaScript',
  jsx: 'JavaScript (React)',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  h: 'C/C++ Header',
  cs: 'C#',
  html: 'HTML',
  css: 'CSS',
  sh: 'Shell Script',
  bat: 'Batch Script',
  md: 'Markdown',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
};

/**
 * Safely check if path is a directory
 */
export function isDirectorySafe(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Safely check if path is a file
 */
export function isFileSafe(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Detect the primary source folder dynamically in sequence
 */
export function detectPrimarySourceDir(workdir: string): string {
  const alternatives = ['src', 'app', 'server', 'client', 'backend', 'frontend', 'api', 'lib'];
  for (const alt of alternatives) {
    const fullPath = join(workdir, alt);
    if (isDirectorySafe(fullPath)) {
      return alt;
    }
  }
  return '.';
}

/**
 * Perform a dynamic scan of the active workspace directory
 */
export function scanWorkspace(workdir: string): WorkspaceScanResult {
  const files: string[] = [];
  const folders: string[] = [];
  const languages: Record<string, number> = {};
  let totalFiles = 0;

  const isHomeOrRoot = checkIfHomeOrRoot(workdir);
  const maxDepth = isHomeOrRoot ? 0 : 4;

  function walk(current: string, depth = 0) {
    if (depth > maxDepth) return; // Prevent infinite or excessively deep loops

    try {
      const entries = readdirSync(current, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (EXCLUDE_DIRS.has(entry.name.toLowerCase()) || entry.name.toLowerCase().startsWith('ntuser')) continue;

        const fullPath = join(current, entry.name);
        const relPath = relative(workdir, fullPath);

        if (entry.isDirectory()) {
          folders.push(relPath);
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          files.push(relPath);
          totalFiles++;

          // Classify language metrics
          const ext = entry.name.split('.').pop()?.toLowerCase() || '';
          if (ext in LANGUAGE_MAP) {
            const lang = LANGUAGE_MAP[ext];
            languages[lang] = (languages[lang] || 0) + 1;
          }
        }
      }
    } catch {
      // Gracefully ignore unreadable dirs
    }
  }

  if (existsSync(workdir)) {
    walk(workdir);
  }

  const primaryDir = detectPrimarySourceDir(workdir);
  const isEmpty = totalFiles === 0 && folders.length === 0;

  // Build clean visual representation string
  const treeString = buildASCIITree(workdir, primaryDir);

  return {
    primaryDir,
    files,
    folders,
    totalFiles,
    isEmpty,
    languages,
    treeString,
  };
}

/**
 * Generates a beautiful ASCII tree of the workspace structure
 */
export function buildASCIITree(workdir: string, primaryDir: string): string {
  const treeLines: string[] = [];
  const rootName = basename(workdir) || 'root';

  treeLines.push(`◈ ${rootName}/`);

  const isHomeOrRoot = checkIfHomeOrRoot(workdir);
  const maxDepth = isHomeOrRoot ? 0 : 2;

  function formatBranch(dirPath: string, prefix: string, depth = 0) {
    if (depth > maxDepth) return; // Limit depth for aesthetic clarity inside terminal

    try {
      const items = readdirSync(dirPath, { withFileTypes: true })
        .filter(item => !item.name.startsWith('.') && !EXCLUDE_DIRS.has(item.name.toLowerCase()) && !item.name.toLowerCase().startsWith('ntuser'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      const maxItems = 25;
      const itemsToRender = items.slice(0, maxItems);
      const isTruncated = items.length > maxItems;

      itemsToRender.forEach((item, index) => {
        const isLast = (index === itemsToRender.length - 1) && !isTruncated;
        const pointer = isLast ? '└── ' : '├── ';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        
        let suffix = '';
        if (item.isDirectory() && item.name === primaryDir && primaryDir !== '.') {
          suffix = ' (primary source)';
        }

        treeLines.push(`${prefix}${pointer}${item.name}${item.isDirectory() ? '/' : ''}${suffix}`);

        if (item.isDirectory()) {
          formatBranch(join(dirPath, item.name), newPrefix, depth + 1);
        }
      });

      if (isTruncated) {
        treeLines.push(`${prefix}└── ... and ${items.length - maxItems} more files/folders`);
      }
    } catch {
      // Ignore unreadable
    }
  }

  if (existsSync(workdir)) {
    formatBranch(workdir, '  ');
  }

  if (isHomeOrRoot) {
    treeLines.push(`\n  ⚠ Running in User Home/Root Directory. Deep scanning restricted to root level only to protect performance.\n  Run opensource inside a specific project folder.`);
  }

  return treeLines.join('\n');
}

/**
 * Initialize a premium project skeleton for empty directories
 */
export function initEmptyProject(workdir: string): void {
  if (!existsSync(workdir)) {
    mkdirSync(workdir, { recursive: true });
  }

  // 1. Create a beautiful readme
  const readmeContent = `# Dynamic Project Codebase

This is a fresh local workspace monitored by the **openSource** CLI AI Coding Agent.

## Getting Started

1. Start editing files or adding code directories.
2. Run your development workflows or trigger commands.
3. Use the \`opensource\` command to pair-program and automate edits!
`;
  writeFileSync(join(workdir, 'README.md'), readmeContent);

  // 2. Create standard package.json
  const packageJson = {
    name: basename(workdir) || 'my-opensource-project',
    version: '1.0.0',
    description: 'Developed dynamically with openSource CLI',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      test: 'echo "Error: no test specified" && exit 0'
    },
    keywords: [],
    author: '',
    license: 'ISC'
  };
  writeFileSync(join(workdir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // 3. Create main script index.js
  const indexJs = `// Main Entry Point
console.log("Hello from openSource CLI initialized project!");
`;
  writeFileSync(join(workdir, 'index.js'), indexJs);

  // 4. Create standard .gitignore
  const gitignore = `node_modules/
dist/
.env
.DS_Store
`;
  writeFileSync(join(workdir, '.gitignore'), gitignore);

  // 5. Create .opensource folder and default instructions
  const osFolder = join(workdir, '.opensource');
  if (!existsSync(osFolder)) mkdirSync(osFolder, { recursive: true });

  const opensourceMd = `# Project Rules & Context
- Coding Language: JavaScript (Node.js)
- Entry point: index.js
- Run test: npm test
- Development style: Keep files modular and cleanly structured.
`;
  writeFileSync(join(workdir, 'OPENSOURCE.md'), opensourceMd);
}
