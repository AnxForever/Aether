/**
 * GitHub Skill
 *
 * GitHub repository and issue management using GitHub CLI
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';
import {
  GitHubRepoInfoSchema,
  GitHubCreateIssueSchema,
  GitHubListIssuesSchema,
  GitHubCreatePRSchema,
  GitHubSearchReposSchema,
} from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitHubRepo {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  url: string;
  createdAt: string;
  author: string;
  labels: string[];
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
  head: string;
  base: string;
  createdAt: string;
  author: string;
}

export class GitHubSkill extends BaseSkill {
  constructor() {
    super({
      id: 'github',
      name: 'GitHub',
      description: 'GitHub repository, issue, and PR management using GitHub CLI',
      version: '1.0.0',
      author: 'Aether Team',
      enabled: true,
      requiresAuth: true,
      dependencies: ['gh'],
    });
  }

  getTools(): Tool[] {
    return [
      {
        name: 'github_repo_info',
        description: 'Get information about a GitHub repository',
        parameters: [
          {
            name: 'owner',
            type: 'string',
            description: 'Repository owner (username or organization)',
            required: true,
          },
          {
            name: 'repo',
            type: 'string',
            description: 'Repository name',
            required: true,
          },
        ],
        handler: async (params) => this.getRepoInfo(params),
      },
      {
        name: 'github_create_issue',
        description: 'Create a new issue in a GitHub repository',
        parameters: [
          {
            name: 'owner',
            type: 'string',
            description: 'Repository owner',
            required: true,
          },
          {
            name: 'repo',
            type: 'string',
            description: 'Repository name',
            required: true,
          },
          {
            name: 'title',
            type: 'string',
            description: 'Issue title',
            required: true,
          },
          {
            name: 'body',
            type: 'string',
            description: 'Issue body/description',
            required: false,
          },
          {
            name: 'labels',
            type: 'array',
            description: 'Array of label names',
            required: false,
          },
          {
            name: 'assignees',
            type: 'array',
            description: 'Array of usernames to assign',
            required: false,
          },
        ],
        handler: async (params) => this.createIssue(params),
      },
      {
        name: 'github_list_issues',
        description: 'List issues from a GitHub repository',
        parameters: [
          {
            name: 'owner',
            type: 'string',
            description: 'Repository owner',
            required: true,
          },
          {
            name: 'repo',
            type: 'string',
            description: 'Repository name',
            required: true,
          },
          {
            name: 'state',
            type: 'string',
            description: 'Issue state: open, closed, or all',
            required: false,
          },
          {
            name: 'labels',
            type: 'string',
            description: 'Comma-separated list of label names',
            required: false,
          },
          {
            name: 'per_page',
            type: 'number',
            description: 'Number of results per page (1-100)',
            required: false,
          },
        ],
        handler: async (params) => this.listIssues(params),
      },
      {
        name: 'github_create_pr',
        description: 'Create a new pull request in a GitHub repository',
        parameters: [
          {
            name: 'owner',
            type: 'string',
            description: 'Repository owner',
            required: true,
          },
          {
            name: 'repo',
            type: 'string',
            description: 'Repository name',
            required: true,
          },
          {
            name: 'title',
            type: 'string',
            description: 'Pull request title',
            required: true,
          },
          {
            name: 'body',
            type: 'string',
            description: 'Pull request description',
            required: false,
          },
          {
            name: 'head',
            type: 'string',
            description: 'The name of the branch with changes',
            required: true,
          },
          {
            name: 'base',
            type: 'string',
            description: 'The name of the branch to merge into',
            required: true,
          },
          {
            name: 'draft',
            type: 'boolean',
            description: 'Create as draft pull request',
            required: false,
          },
        ],
        handler: async (params) => this.createPR(params),
      },
      {
        name: 'github_search_repos',
        description: 'Search GitHub repositories',
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'Search query',
            required: true,
          },
          {
            name: 'sort',
            type: 'string',
            description: 'Sort by: stars, forks, or updated',
            required: false,
          },
          {
            name: 'order',
            type: 'string',
            description: 'Sort order: asc or desc',
            required: false,
          },
          {
            name: 'per_page',
            type: 'number',
            description: 'Number of results per page (1-100)',
            required: false,
          },
        ],
        handler: async (params) => this.searchRepos(params),
      },
      {
        name: 'github_clone_repo',
        description: 'Clone a GitHub repository to local directory',
        parameters: [
          {
            name: 'owner',
            type: 'string',
            description: 'Repository owner',
            required: true,
          },
          {
            name: 'repo',
            type: 'string',
            description: 'Repository name',
            required: true,
          },
          {
            name: 'destination',
            type: 'string',
            description: 'Local directory path to clone into',
            required: false,
          },
        ],
        handler: async (params) => this.cloneRepo(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    try {
      // Check if gh CLI is installed and authenticated
      await execAsync('gh auth status');
      return true;
    } catch {
      return false;
    }
  }

  private async getRepoInfo(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GitHubRepoInfoSchema._type>(
      GitHubRepoInfoSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { owner, repo } = validation.data;

      // Use gh CLI to get repo info
      const { stdout } = await execAsync(
        `gh repo view ${owner}/${repo} --json name,owner,description,url,stargazerCount,forkCount,primaryLanguage`
      );

      const data = JSON.parse(stdout);

      const repoInfo: GitHubRepo = {
        owner: data.owner.login,
        name: data.name,
        fullName: `${data.owner.login}/${data.name}`,
        description: data.description || '',
        url: data.url,
        stars: data.stargazerCount,
        forks: data.forkCount,
        language: data.primaryLanguage?.name || 'Unknown',
      };

      return this.createSuccess(repoInfo);
    } catch (error) {
      return this.handleError(error, 'GitHub repo info');
    }
  }

  private async createIssue(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GitHubCreateIssueSchema._type>(
      GitHubCreateIssueSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { owner, repo, title, body, labels, assignees } = validation.data;

      let command = `gh issue create --repo ${owner}/${repo} --title "${title}"`;

      if (body) {
        command += ` --body "${body}"`;
      }

      if (labels && labels.length > 0) {
        command += ` --label "${labels.join(',')}"`;
      }

      if (assignees && assignees.length > 0) {
        command += ` --assignee "${assignees.join(',')}"`;
      }

      const { stdout } = await execAsync(command);

      // Parse issue URL from output
      const issueUrl = stdout.trim();
      const issueNumber = parseInt(issueUrl.split('/').pop() || '0');

      const issue: GitHubIssue = {
        number: issueNumber,
        title,
        body: body || '',
        state: 'open',
        url: issueUrl,
        createdAt: new Date().toISOString(),
        author: 'current-user',
        labels: labels || [],
      };

      return this.createSuccess(issue);
    } catch (error) {
      return this.handleError(error, 'GitHub create issue');
    }
  }

  private async listIssues(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GitHubListIssuesSchema._type>(
      GitHubListIssuesSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { owner, repo, state = 'open', labels, per_page = 30 } = validation.data;

      let command = `gh issue list --repo ${owner}/${repo} --state ${state} --limit ${per_page} --json number,title,body,state,url,createdAt,author,labels`;

      if (labels) {
        command += ` --label "${labels}"`;
      }

      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);

      const issues: GitHubIssue[] = data.map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state,
        url: issue.url,
        createdAt: issue.createdAt,
        author: issue.author.login,
        labels: issue.labels.map((l: any) => l.name),
      }));

      return this.createSuccess(issues, { count: issues.length });
    } catch (error) {
      return this.handleError(error, 'GitHub list issues');
    }
  }

  private async createPR(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GitHubCreatePRSchema._type>(
      GitHubCreatePRSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { owner, repo, title, body, head, base, draft = false } = validation.data;

      let command = `gh pr create --repo ${owner}/${repo} --title "${title}" --head ${head} --base ${base}`;

      if (body) {
        command += ` --body "${body}"`;
      }

      if (draft) {
        command += ` --draft`;
      }

      const { stdout } = await execAsync(command);

      // Parse PR URL from output
      const prUrl = stdout.trim();
      const prNumber = parseInt(prUrl.split('/').pop() || '0');

      const pr: GitHubPullRequest = {
        number: prNumber,
        title,
        body: body || '',
        state: 'open',
        url: prUrl,
        head,
        base,
        createdAt: new Date().toISOString(),
        author: 'current-user',
      };

      return this.createSuccess(pr);
    } catch (error) {
      return this.handleError(error, 'GitHub create PR');
    }
  }

  private async searchRepos(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof GitHubSearchReposSchema._type>(
      GitHubSearchReposSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { query, sort, order = 'desc', per_page = 30 } = validation.data;

      let command = `gh search repos "${query}" --limit ${per_page} --json name,owner,description,url,stargazerCount,forkCount,primaryLanguage`;

      if (sort) {
        command += ` --sort ${sort} --order ${order}`;
      }

      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);

      const repos: GitHubRepo[] = data.map((repo: any) => ({
        owner: repo.owner.login,
        name: repo.name,
        fullName: `${repo.owner.login}/${repo.name}`,
        description: repo.description || '',
        url: repo.url,
        stars: repo.stargazerCount,
        forks: repo.forkCount,
        language: repo.primaryLanguage?.name || 'Unknown',
      }));

      return this.createSuccess(repos, { count: repos.length });
    } catch (error) {
      return this.handleError(error, 'GitHub search repos');
    }
  }

  private async cloneRepo(params: unknown): Promise<ToolResult> {
    try {
      const { owner, repo, destination } = params as {
        owner: string;
        repo: string;
        destination?: string;
      };

      if (!owner || !repo) {
        return this.createError('owner and repo are required');
      }

      let command = `gh repo clone ${owner}/${repo}`;

      if (destination) {
        command += ` ${destination}`;
      }

      await execAsync(command);

      const path = destination || repo;

      return this.createSuccess({ path }, { owner, repo });
    } catch (error) {
      return this.handleError(error, 'GitHub clone repo');
    }
  }
}
