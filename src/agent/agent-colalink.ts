/**
 * Agent ColaLink API
 *
 * Extracted from NexusAgent to reduce the God Object.
 * Functions accept a ColaLink host object for access to the ColaLinkManager.
 */

import type { ColaLinkManager } from '../colalink/colalink-manager';
import type { Message as ColaLinkMessage } from '../colalink/message-manager';
import type { Contact, ContactRequest } from '../colalink/contact-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('AgentColaLink');

/**
 * Minimal interface that a host must expose for ColaLink API functions.
 */
export interface ColaLinkHost {
  colaLinkManager?: ColaLinkManager;
}

// ============================================================================
// ColaLink API
// ============================================================================

/** Send a message via ColaLink */
export async function sendColaLinkMessage(
  host: ColaLinkHost,
  toHandle: string,
  content: string
): Promise<ColaLinkMessage> {
  if (!host.colaLinkManager) throw new Error('ColaLink is not initialized');
  return await host.colaLinkManager.sendMessage(toHandle, content);
}

/** Get conversation history with a contact */
export async function getColaLinkHistory(
  host: ColaLinkHost,
  handle: string,
  limit?: number
): Promise<ColaLinkMessage[]> {
  if (!host.colaLinkManager) throw new Error('ColaLink is not initialized');
  return await host.colaLinkManager.getHistory(handle, limit);
}

/** List all contacts */
export function listColaLinkContacts(
  host: ColaLinkHost,
  status?: Contact['status']
): Contact[] {
  if (!host.colaLinkManager) return [];
  return host.colaLinkManager.listContacts(status);
}

/** Add a contact */
export function addColaLinkContact(
  host: ColaLinkHost,
  contact: Omit<Contact, 'addedAt' | 'updatedAt'>
): Contact {
  if (!host.colaLinkManager) throw new Error('ColaLink is not initialized');
  return host.colaLinkManager.addContact(contact);
}

/** Send a contact request */
export function sendColaLinkContactRequest(
  host: ColaLinkHost,
  toHandle: string,
  message?: string
): ContactRequest {
  if (!host.colaLinkManager) throw new Error('ColaLink is not initialized');
  return host.colaLinkManager.sendContactRequest(toHandle, message);
}

/** List pending contact requests */
export function listColaLinkPendingRequests(
  host: ColaLinkHost
): ContactRequest[] {
  if (!host.colaLinkManager) return [];
  return host.colaLinkManager.listPendingRequests();
}

/** Get unread message count */
export function getColaLinkUnreadCount(
  host: ColaLinkHost
): number {
  if (!host.colaLinkManager) return 0;
  return host.colaLinkManager.getUnreadCount();
}

/** Get recent conversations */
export async function getColaLinkRecentConversations(
  host: ColaLinkHost,
  limit?: number
) {
  if (!host.colaLinkManager) return [];
  return await host.colaLinkManager.getRecentConversations(limit);
}

/** Check if ColaLink is active */
export function isColaLinkActive(
  host: ColaLinkHost
): boolean {
  return host.colaLinkManager !== undefined;
}
