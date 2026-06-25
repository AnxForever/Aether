/**
 * Complexity Analyzer - Cyclomatic complexity and code metrics
 */

import { createLogger } from '../utils/logger';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

const logger = createLogger('ComplexityAnalyzer');

/**
 * Function complexity
 */
export interface FunctionComplexity {
  name: string;
  complexity: number;
  line: number;
  parameters: number;
  statements: number;
  nesting: number;
  rating: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Complexity report
 */
export interface ComplexityReport {
  file: string;
  totalComplexity: number;
  averageComplexity: number;
  maxComplexity: number;
  functions: FunctionComplexity[];
  rating: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Complexity Analyzer
 */
export class ComplexityAnalyzer {
  /**
   * Analyze file complexity
   */
  async analyzeFile(filePath: string, content: string): Promise<ComplexityReport> {
    logger.info(`Analyzing complexity: ${filePath}`);

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      const functions = this.analyzeFunctions(ast);
      const totalComplexity = functions.reduce((sum, f) => sum + f.complexity, 0);
      const averageComplexity = functions.length > 0 ? totalComplexity / functions.length : 0;
      const maxComplexity = Math.max(...functions.map(f => f.complexity), 0);

      return {
        file: filePath,
        totalComplexity,
        averageComplexity,
        maxComplexity,
        functions: functions.sort((a, b) => b.complexity - a.complexity),
        rating: this.calculateRating(averageComplexity)
      };
    } catch (error: any) {
      logger.error(`Failed to analyze complexity: ${filePath}`, error as Error);
      throw error;
    }
  }

  /**
   * Analyze functions in AST
   */
  private analyzeFunctions(ast: any): FunctionComplexity[] {
    const functions: FunctionComplexity[] = [];

    traverse(ast, {
      FunctionDeclaration: (path) => {
        functions.push(this.analyzeFunction(path));
      },
      FunctionExpression: (path) => {
        functions.push(this.analyzeFunction(path));
      },
      ArrowFunctionExpression: (path) => {
        functions.push(this.analyzeFunction(path));
      },
      ClassMethod: (path) => {
        functions.push(this.analyzeFunction(path));
      }
    });

    return functions;
  }

  /**
   * Analyze single function
   */
  private analyzeFunction(path: any): FunctionComplexity {
    const node = path.node;
    const name = this.getFunctionName(node);
    const line = node.loc?.start.line || 0;
    const parameters = node.params?.length || 0;

    let complexity = 1; // Base complexity
    let statements = 0;
    let maxNesting = 0;

    // Traverse function body
    path.traverse({
      enter(innerPath: any) {
        // Count complexity
        if (
          t.isIfStatement(innerPath.node) ||
          t.isConditionalExpression(innerPath.node) ||
          t.isWhileStatement(innerPath.node) ||
          t.isForStatement(innerPath.node) ||
          t.isForInStatement(innerPath.node) ||
          t.isForOfStatement(innerPath.node) ||
          t.isSwitchCase(innerPath.node) ||
          t.isCatchClause(innerPath.node)
        ) {
          complexity++;
        }

        // Logical operators increase complexity
        if (t.isLogicalExpression(innerPath.node)) {
          complexity++;
        }

        // Count statements
        if (t.isStatement(innerPath.node)) {
          statements++;
        }

        // Calculate nesting depth
        const depth = this.calculateNestingDepth(innerPath);
        if (depth > maxNesting) {
          maxNesting = depth;
        }
      }
    });

    return {
      name,
      complexity,
      line,
      parameters,
      statements,
      nesting: maxNesting,
      rating: this.calculateRating(complexity)
    };
  }

  /**
   * Get function name
   */
  private getFunctionName(node: any): string {
    if (node.id && t.isIdentifier(node.id)) {
      return node.id.name;
    }

    if (node.key && t.isIdentifier(node.key)) {
      return node.key.name;
    }

    return '<anonymous>';
  }

  /**
   * Calculate nesting depth
   */
  private calculateNestingDepth(path: any): number {
    let depth = 0;
    let current = path;

    while (current.parentPath) {
      if (
        t.isIfStatement(current.node) ||
        t.isWhileStatement(current.node) ||
        t.isForStatement(current.node) ||
        t.isForInStatement(current.node) ||
        t.isForOfStatement(current.node) ||
        t.isSwitchStatement(current.node) ||
        t.isTryStatement(current.node)
      ) {
        depth++;
      }
      current = current.parentPath;
    }

    return depth;
  }

  /**
   * Calculate rating based on complexity
   */
  private calculateRating(complexity: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (complexity <= 5) return 'A';
    if (complexity <= 10) return 'B';
    if (complexity <= 20) return 'C';
    if (complexity <= 50) return 'D';
    return 'F';
  }

  /**
   * Generate complexity report
   */
  generateReport(reports: ComplexityReport[]): string {
    const totalFiles = reports.length;
    const avgComplexity = reports.reduce((sum, r) => sum + r.averageComplexity, 0) / totalFiles;
    const maxComplexity = Math.max(...reports.map(r => r.maxComplexity));

    const highComplexityFunctions = reports
      .flatMap(r => r.functions)
      .filter(f => f.complexity > 10)
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10);

    const report = [
      '=== Complexity Analysis Report ===',
      '',
      `Total Files: ${totalFiles}`,
      `Average Complexity: ${avgComplexity.toFixed(2)}`,
      `Maximum Complexity: ${maxComplexity}`,
      '',
      '--- Complexity Distribution ---'
    ];

    const ratings = ['A', 'B', 'C', 'D', 'F'];
    for (const rating of ratings) {
      const count = reports.filter(r => r.rating === rating).length;
      report.push(`  ${rating}: ${count} files`);
    }

    if (highComplexityFunctions.length > 0) {
      report.push('', '--- High Complexity Functions ---');
      highComplexityFunctions.forEach((func, i) => {
        report.push(
          `${i + 1}. ${func.name} (line ${func.line})`,
          `   Complexity: ${func.complexity} | Rating: ${func.rating}`,
          `   Statements: ${func.statements} | Nesting: ${func.nesting}`
        );
      });
    }

    return report.join('\n');
  }
}
