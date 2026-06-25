/**
 * ColaLink - Export all social layer modules
 */

// Legacy modules (deprecated)
export * from './profile';
export {
  ContactsManager as LegacyContactsManager,
} from './contacts';
export type {
  Contact as LegacyContact,
  ContactRequest as LegacyContactRequest
} from './contacts';
export {
  MessagesManager as LegacyMessagesManager,
} from './messages';
export type {
  Message as LegacyMessage
} from './messages';
export * from './relay-client';

// New EventEmitter-based architecture
export * from './contact-manager';
export * from './message-manager';
export * from './wechat-plugin';
export * from './colalink-manager';
