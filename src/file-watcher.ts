import chokidar from 'chokidar';
import * as path from 'path';

export class FileWatcher {
  private watcher?: chokidar.FSWatcher;
  private watchedPaths = new Set<string>();

  async watch(projectRoot: string, onChange: (changedFiles: string[]) => void): Promise<void> {
    console.error(`Starting file watcher for: ${projectRoot}`);

    // Close existing watcher if any
    if (this.watcher) {
      await this.watcher.close();
    }

    // Create focused patterns for specific languages only
    const focusedPatterns = [
      // Node.js/JavaScript/TypeScript
      path.join(projectRoot, '**/*.js'),
      path.join(projectRoot, '**/*.jsx'), 
      path.join(projectRoot, '**/*.ts'),
      path.join(projectRoot, '**/*.tsx'),
      
      // Backend languages
      path.join(projectRoot, '**/*.go'),       // Golang
      path.join(projectRoot, '**/*.php'),      // PHP  
      path.join(projectRoot, '**/*.java'),     // Java
      path.join(projectRoot, '**/*.py'),     // Python
      
      // Frontend files
      path.join(projectRoot, '**/*.html'),     // HTML
      path.join(projectRoot, '**/*.htm'),      // HTML
      path.join(projectRoot, '**/*.css'),      // CSS
      path.join(projectRoot, '**/*.scss'),     // SCSS
      path.join(projectRoot, '**/*.sass'),     // SASS
      
      // Config & Documentation files
      path.join(projectRoot, '**/*.json'),     // JSON configs
      path.join(projectRoot, '**/*.yaml'),     // YAML configs
      path.join(projectRoot, '**/*.yml'),      // YAML configs
      path.join(projectRoot, '**/*.ini'),      // INI configs
      path.join(projectRoot, '**/*.cfg'),      // Config files
      path.join(projectRoot, '**/*.conf'),     // Config files
      path.join(projectRoot, '**/*.config'),   // Config files
      path.join(projectRoot, '**/*.md'),       // Markdown
      path.join(projectRoot, '**/*.txt'),      // Text files
    ];

    // Create new watcher with focused patterns
    this.watcher = chokidar.watch(focusedPatterns, {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/target/**',        // Java build directory
        '**/vendor/**',        // PHP vendor directory
        '**/.git/**',
        '**/coverage/**',
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    let changeQueue: string[] = [];
    let changeTimeout: NodeJS.Timeout | null = null;

    const processChanges = () => {
      if (changeQueue.length > 0) {
        console.error(`File changes detected: ${changeQueue.length} files`);
        onChange([...changeQueue]);
        changeQueue = [];
      }
      changeTimeout = null;
    };

    const queueChange = (filePath: string) => {
      if (!changeQueue.includes(filePath)) {
        changeQueue.push(filePath);
      }
      
      // Debounce changes
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      changeTimeout = setTimeout(processChanges, 500);
    };

    this.watcher
      .on('add', (filePath) => {
        console.error(`File added: ${path.relative(projectRoot, filePath)}`);
        queueChange(filePath);
      })
      .on('change', (filePath) => {
        console.error(`File changed: ${path.relative(projectRoot, filePath)}`);
        queueChange(filePath);
      })
      .on('unlink', (filePath) => {
        console.error(`File deleted: ${path.relative(projectRoot, filePath)}`);
        queueChange(filePath);
      })
      .on('error', (error) => {
        console.error('File watcher error:', error);
      })
      .on('ready', () => {
        console.error('File watcher ready - monitoring for changes');
      });

    this.watchedPaths.add(projectRoot);
  }

  async stopWatching(): Promise<void> {
    if (this.watcher) {
      console.error('Stopping file watcher');
      await this.watcher.close();
      this.watcher = undefined;
      this.watchedPaths.clear();
    }
  }

  isWatching(projectRoot: string): boolean {
    return this.watchedPaths.has(projectRoot);
  }

  getWatchedPaths(): string[] {
    return Array.from(this.watchedPaths);
  }
}
