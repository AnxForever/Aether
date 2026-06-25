/**
 * Dependency Analyzer - Analyze project dependencies and relationships
 */

import { createLogger } from '../utils/logger';
import { readFile } from 'fs/promises';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

const logger = createLogger('DependencyAnalyzer');

/**
 * Dependency info
 */
export interface Dependency {
  source: string;
  target: string;
  type: 'import' | 'require' | 'dynamic';
  line: number;
  isExternal: boolean;
}

/**
 * Module info
 */
export interface ModuleInfo {
  path: string;
  imports: Dependency[];
  exports: string[];
  dependencies: string[];
  dependents: string[];
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  modules: Map<string, ModuleInfo>;
  circular: string[][];
  orphans: string[];
  hubs: string[];
}

/**
 * Dependency Analyzer
 */
export class DependencyAnalyzer {
  private modules = new Map<string, ModuleInfo>();

  /**
   * Analyze file dependencies
   */
  async analyzeFile(filePath: string): Promise<ModuleInfo> {
    logger.info(`Analyzing dependencies: ${filePath}`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'dynamicImport']
      });

      const imports: Dependency[] = [];
      const exports: string[] = [];

      traverse(ast, {
        ImportDeclaration(path) {
          imports.push({
            source: filePath,
            target: path.node.source.value,
            type: 'import',
            line: path.node.loc?.start.line || 0,
            isExternal: !path.node.source.value.startsWith('.')
          });
        },

        CallExpression(path) {
          // require()
          if (t.isIdentifier(path.node.callee, { name: 'require' })) {
            const arg = path.node.arguments[0];
            if (t.isStringLiteral(arg)) {
              imports.push({
                source: filePath,
                target: arg.value,
                type: 'require',
                line: path.node.loc?.start.line || 0,
                isExternal: !arg.value.startsWith('.')
              });
            }
          }

          // import()
          if (t.isImport(path.node.callee)) {
            const arg = path.node.arguments[0];
            if (t.isStringLiteral(arg)) {
              imports.push({
                source: filePath,
                target: arg.value,
                type: 'dynamic',
                line: path.node.loc?.start.line || 0,
                isExternal: !arg.value.startsWith('.')
              });
            }
          }
        },

        ExportNamedDeclaration(path) {
          if (path.node.declaration) {
            if (t.isVariableDeclaration(path.node.declaration)) {
              path.node.declaration.declarations.forEach(decl => {
                if (t.isIdentifier(decl.id)) {
                  exports.push(decl.id.name);
                }
              });
            } else if (t.isFunctionDeclaration(path.node.declaration)) {
              if (path.node.declaration.id) {
                exports.push(path.node.declaration.id.name);
              }
            }
          }
        },

        ExportDefaultDeclaration() {
          exports.push('default');
        }
      });

      const info: ModuleInfo = {
        path: filePath,
        imports,
        exports,
        dependencies: [...new Set(imports.map(i => i.target))],
        dependents: []
      };

      this.modules.set(filePath, info);

      return info;
    } catch (error: any) {
      logger.error(`Failed to analyze dependencies: ${filePath}`, error as Error);
      throw error;
    }
  }

  /**
   * Analyze multiple files
   */
  async analyzeFiles(filePaths: string[]): Promise<DependencyGraph> {
    // Analyze all files
    await Promise.all(
      filePaths.map(path =>
        this.analyzeFile(path).catch(error => {
          logger.warn(`Skipping file: ${path}`, error as Error);
          return null;
        })
      )
    );

    // Build dependency relationships
    this.buildDependencyGraph();

    // Detect circular dependencies
    const circular = this.detectCircularDependencies();

    // Find orphan modules (no imports or exports)
    const orphans = this.findOrphans();

    // Find hub modules (highly connected)
    const hubs = this.findHubs();

    return {
      modules: this.modules,
      circular,
      orphans,
      hubs
    };
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(): void {
    for (const [path, info] of this.modules.entries()) {
      for (const dep of info.dependencies) {
        const depInfo = this.modules.get(dep);
        if (depInfo) {
          depInfo.dependents.push(path);
        }
      }
    }
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(): string[][] {
    const circular: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (path: string): void => {
      if (recursionStack.has(path)) {
        // Found cycle: extract the cycle from currentPath
        const cycleStart = currentPath.indexOf(path);
        if (cycleStart !== -1) {
          circular.push([...currentPath.slice(cycleStart), path]);
        }
        return;
      }

      if (visited.has(path)) return;

      visited.add(path);
      recursionStack.add(path);
      currentPath.push(path);

      const info = this.modules.get(path);
      if (info) {
        for (const dep of info.dependencies) {
          if (this.modules.has(dep)) {
            dfs(dep);
          }
        }
      }

      // Backtrack: remove from recursion stack and current path
      currentPath.pop();
      recursionStack.delete(path);
    };

    for (const path of this.modules.keys()) {
      if (!visited.has(path)) {
        dfs(path);
      }
    }

    return circular;
  }

  /**
   * Find orphan modules
   */
  private findOrphans(): string[] {
    const orphans: string[] = [];

    for (const [path, info] of this.modules.entries()) {
      if (info.dependencies.length === 0 && info.dependents.length === 0) {
        orphans.push(path);
      }
    }

    return orphans;
  }

  /**
   * Find hub modules
   */
  private findHubs(threshold: number = 5): string[] {
    const hubs: string[] = [];

    for (const [path, info] of this.modules.entries()) {
      const connections = info.dependencies.length + info.dependents.length;
      if (connections >= threshold) {
        hubs.push(path);
      }
    }

    return hubs.sort((a, b) => {
      const aConnections = this.modules.get(a)!.dependencies.length + this.modules.get(a)!.dependents.length;
      const bConnections = this.modules.get(b)!.dependencies.length + this.modules.get(b)!.dependents.length;
      return bConnections - aConnections;
    });
  }

  /**
   * Generate dependency report
   */
  generateReport(graph: DependencyGraph): string {
    const totalModules = graph.modules.size;
    const totalDependencies = Array.from(graph.modules.values()).reduce(
      (sum, m) => sum + m.dependencies.length,
      0
    );

    const avgDependencies = totalDependencies / totalModules;

    const report = [
      '=== Dependency Analysis Report ===',
      '',
      `Total Modules: ${totalModules}`,
      `Total Dependencies: ${totalDependencies}`,
      `Average Dependencies per Module: ${avgDependencies.toFixed(2)}`,
      ''
    ];

    if (graph.circular.length > 0) {
      report.push('--- Circular Dependencies ---');
      graph.circular.forEach((cycle, i) => {
        report.push(`${i + 1}. ${cycle.join(' → ')} → ${cycle[0]}`);
      });
      report.push('');
    }

    if (graph.hubs.length > 0) {
      report.push('--- Hub Modules (Highly Connected) ---');
      graph.hubs.slice(0, 10).forEach((hub, i) => {
        const info = graph.modules.get(hub)!;
        const connections = info.dependencies.length + info.dependents.length;
        report.push(
          `${i + 1}. ${hub}`,
          `   Dependencies: ${info.dependencies.length} | Dependents: ${info.dependents.length} | Total: ${connections}`
        );
      });
      report.push('');
    }

    if (graph.orphans.length > 0) {
      report.push('--- Orphan Modules (No Dependencies) ---');
      graph.orphans.slice(0, 10).forEach((orphan, i) => {
        report.push(`${i + 1}. ${orphan}`);
      });
    }

    return report.join('\n');
  }

  /**
   * Export graph as DOT format (for Graphviz)
   */
  exportDOT(graph: DependencyGraph): string {
    const lines = ['digraph Dependencies {', '  node [shape=box];', ''];

    for (const [path, info] of graph.modules.entries()) {
      const label = path.split('/').pop() || path;
      lines.push(`  "${label}";`);
    }

    lines.push('');

    for (const [path, info] of graph.modules.entries()) {
      const sourceLabel = path.split('/').pop() || path;
      for (const dep of info.dependencies) {
        const targetLabel = dep.split('/').pop() || dep;
        if (graph.modules.has(dep)) {
          lines.push(`  "${sourceLabel}" -> "${targetLabel}";`);
        }
      }
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Clear analysis cache
   */
  clear(): void {
    this.modules.clear();
  }
}
