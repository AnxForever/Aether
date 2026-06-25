/**
 * CLI Module - HTTP Server, Command Handlers, and CLI Tools
 *
 * Zero third-party dependencies implementation with:
 * - Native http.createServer for RESTful API
 * - Manual argument parsing
 * - ANSI color output
 * - Integration with PiAgentAdapter and SkillRegistry
 */

export type { HttpServerConfig, AgentExecuteRequest, AgentContinueRequest, AgentAbortRequest, SkillInvokeRequest, ApiResponse } from './http-server';
export { HttpServer } from './http-server';
export type { CommandContext, CommandResult, CommandHandler } from './command-handler';
export { CommandHandlerRegistry, createDefaultHandlers, executeHandler, skillListHandler, skillInvokeHandler, skillInfoHandler, helpHandler } from './command-handler';
export type { ParsedArgs } from './cli-tool';
export { CliTool } from './cli-tool';
export type { CliManagerConfig } from './cli-manager';
export { CliManager } from './cli-manager';
