/**
 * Code Analyzer - Static code analysis and quality metrics
 */

import { createLogger } from '../utils/logger';
import { readFile } from 'fs/promises';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

const logger = createLogger('CodeAnalyzer');

/**
 * Analysis result
 */
export interface AnalysisResult {
  file: string;
  metrics: CodeMetrics;
  issues: CodeIssue[];
  suggestions: string[];
}

/**
 * Code metrics
 */
export interface CodeMetrics {
  linesOfCode: number;
  comments: number;
  functions: number;
  classes: number;
  complexity: number;
  maintainabilityIndex: number;
  duplicates: number;
}

/**
 * Code issue
 */
export interface CodeIssue {
  type: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'maintainability' | 'style';
  message: string;
  line?: number;
  column?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Code Analyzer
 */
export class CodeAnalyzer {
  /**
   * Analyze file
   */
  async analyzeFile(filePath: string): Promise<AnalysisResult> {
    logger.info(`Analyzing file: ${filePath}`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const ast = this.parseCode(content, filePath);

      const metrics = this.calculateMetrics(ast, content);
      const issues = this.detectIssues(ast, content);
      const suggestions = this.generateSuggestions(metrics, issues);

      return {
        file: filePath,
        metrics,
        issues,
        suggestions
      };
    } catch (error: any) {
      logger.error(`Failed to analyze file: ${filePath}`, error as Error);
      throw error;
    }
  }

  /**
   * Analyze multiple files
   */
  async analyzeFiles(filePaths: string[]): Promise<AnalysisResult[]> {
    const results = await Promise.all(
      filePaths.map(path => this.analyzeFile(path).catch(error => {
        logger.warn(`Skipping file: ${path}`, error as Error);
        return null;
      }))
    );

    return results.filter((r): r is AnalysisResult => r !== null);
  }

  /**
   * Generate summary report
   */
  generateReport(results: AnalysisResult[]): string {
    const totalFiles = results.length;
    const totalLOC = results.reduce((sum, r) => sum + r.metrics.linesOfCode, 0);
    const avgComplexity = results.reduce((sum, r) => sum + r.metrics.complexity, 0) / totalFiles;
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);

    const criticalIssues = results.reduce(
      (sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length,
      0
    );

    const report = [
      '=== Code Analysis Report ===',
      '',
      `Total Files: ${totalFiles}`,
      `Total Lines of Code: ${totalLOC}`,
      `Average Complexity: ${avgComplexity.toFixed(2)}`,
      `Total Issues: ${totalIssues}`,
      `  Critical: ${criticalIssues}`,
      '',
      '--- Issues by Category ---'
    ];

    const categories = ['security', 'performance', 'maintainability', 'style'];
    for (const category of categories) {
      const count = results.reduce(
        (sum, r) => sum + r.issues.filter(i => i.category === category).length,
        0
      );
      report.push(`  ${category}: ${count}`);
    }

    report.push('', '--- Top Issues ---');

    const allIssues = results.flatMap(r => r.issues);
    const topIssues = allIssues
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 10);

    topIssues.forEach((issue, i) => {
      report.push(`${i + 1}. [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.message}`);
    });

    return report.join('\n');
  }

  /**
   * Parse code to AST
   */
  private parseCode(content: string, filePath: string): any {
    const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

    return parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        isTypeScript ? 'typescript' : 'flow',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'asyncGenerators',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator'
      ]
    });
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(ast: any, content: string): CodeMetrics {
    let functions = 0;
    let classes = 0;
    let complexity = 0;

    traverse(ast, {
      FunctionDeclaration() {
        functions++;
      },
      FunctionExpression() {
        functions++;
      },
      ArrowFunctionExpression() {
        functions++;
      },
      ClassDeclaration() {
        classes++;
      },
      IfStatement() {
        complexity++;
      },
      WhileStatement() {
        complexity++;
      },
      ForStatement() {
        complexity++;
      },
      SwitchCase() {
        complexity++;
      },
      ConditionalExpression() {
        complexity++;
      },
      LogicalExpression() {
        complexity++;
      }
    });

    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    const comments = lines.filter(line => line.trim().startsWith('//')).length;

    // Simplified maintainability index
    const volume = linesOfCode * Math.log2(functions + classes + 1);
    const maintainabilityIndex = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * complexity) / 171 * 100);

    return {
      linesOfCode,
      comments,
      functions,
      classes,
      complexity,
      maintainabilityIndex,
      duplicates: 0 // Would need duplicate detection algorithm
    };
  }

  /**
   * Detect code issues
   */
  private detectIssues(ast: any, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Security checks
    traverse(ast, {
      CallExpression(path) {
        // Detect eval usage
        if (t.isIdentifier(path.node.callee, { name: 'eval' })) {
          issues.push({
            type: 'error',
            category: 'security',
            message: 'Use of eval() is dangerous and should be avoided',
            line: path.node.loc?.start.line,
            severity: 'critical'
          });
        }

        // Detect innerHTML usage
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.property, { name: 'innerHTML' })
        ) {
          issues.push({
            type: 'warning',
            category: 'security',
            message: 'Direct innerHTML manipulation can lead to XSS vulnerabilities',
            line: path.node.loc?.start.line,
            severity: 'high'
          });
        }
      },

      // Detect console.log
      MemberExpression(path) {
        if (
          t.isIdentifier(path.node.object, { name: 'console' }) &&
          t.isIdentifier(path.node.property)
        ) {
          issues.push({
            type: 'warning',
            category: 'style',
            message: 'Remove console statements before production',
            line: path.node.loc?.start.line,
            severity: 'low'
          });
        }
      },

      // Detect long functions
      FunctionDeclaration(path) {
        const bodyLength = path.node.body.body.length;
        if (bodyLength > 50) {
          issues.push({
            type: 'warning',
            category: 'maintainability',
            message: `Function is too long (${bodyLength} statements). Consider refactoring.`,
            line: path.node.loc?.start.line,
            severity: 'medium'
          });
        }
      }
    });

    // Check for TODO/FIXME comments
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          type: 'info',
          category: 'maintainability',
          message: 'Unresolved TODO/FIXME comment',
          line: index + 1,
          severity: 'low'
        });
      }
    });

    return issues;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(metrics: CodeMetrics, issues: CodeIssue[]): string[] {
    const suggestions: string[] = [];

    if (metrics.complexity > 10) {
      suggestions.push(
        `High cyclomatic complexity (${metrics.complexity}). Consider breaking down complex logic.`
      );
    }

    if (metrics.maintainabilityIndex < 50) {
      suggestions.push(
        `Low maintainability index (${metrics.maintainabilityIndex.toFixed(1)}). Refactor to improve code quality.`
      );
    }

    if (metrics.linesOfCode > 300) {
      suggestions.push(
        `Large file (${metrics.linesOfCode} LOC). Consider splitting into smaller modules.`
      );
    }

    const commentRatio = metrics.comments / metrics.linesOfCode;
    if (commentRatio < 0.1) {
      suggestions.push('Add more comments to improve code documentation.');
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      suggestions.push(`Fix ${criticalIssues.length} critical security/quality issues immediately.`);
    }

    return suggestions;
  }
}
