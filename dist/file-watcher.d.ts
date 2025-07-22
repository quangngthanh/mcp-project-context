export declare class FileWatcher {
    private watcher?;
    private watchedPaths;
    watch(projectRoot: string, onChange: (changedFiles: string[]) => void): Promise<void>;
    stopWatching(): Promise<void>;
    isWatching(projectRoot: string): boolean;
    getWatchedPaths(): string[];
}
//# sourceMappingURL=file-watcher.d.ts.map