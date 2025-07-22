import chokidar from 'chokidar';
import * as path from 'path';
export class FileWatcher {
    constructor() {
        this.watchedPaths = new Set();
    }
    async watch(projectRoot, onChange) {
        console.error(`Starting file watcher for: ${projectRoot}`);
        // Close existing watcher if any
        if (this.watcher) {
            await this.watcher.close();
        }
        // Create new watcher
        this.watcher = chokidar.watch([
            path.join(projectRoot, '**/*.ts'),
            path.join(projectRoot, '**/*.js'),
            path.join(projectRoot, '**/*.tsx'),
            path.join(projectRoot, '**/*.jsx'),
            path.join(projectRoot, '**/*.py'),
            path.join(projectRoot, '**/*.json'),
        ], {
            ignored: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
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
        let changeQueue = [];
        let changeTimeout = null;
        const processChanges = () => {
            if (changeQueue.length > 0) {
                console.error(`File changes detected: ${changeQueue.length} files`);
                onChange([...changeQueue]);
                changeQueue = [];
            }
            changeTimeout = null;
        };
        const queueChange = (filePath) => {
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
    async stopWatching() {
        if (this.watcher) {
            console.error('Stopping file watcher');
            await this.watcher.close();
            this.watcher = undefined;
            this.watchedPaths.clear();
        }
    }
    isWatching(projectRoot) {
        return this.watchedPaths.has(projectRoot);
    }
    getWatchedPaths() {
        return Array.from(this.watchedPaths);
    }
}
//# sourceMappingURL=file-watcher.js.map