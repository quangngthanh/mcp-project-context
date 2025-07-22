#!/usr/bin/env node
declare class ProjectContextServer {
    private server;
    private analyzer;
    private contextBuilder;
    private fileWatcher;
    private validator;
    private projectRoot;
    constructor();
    private setupHandlers;
    private handleGetCompleteContext;
    private handleValidateContext;
    private handleGetDependencyGraph;
    private handleIndexProject;
    run(): Promise<void>;
}
export { ProjectContextServer };
//# sourceMappingURL=index.d.ts.map