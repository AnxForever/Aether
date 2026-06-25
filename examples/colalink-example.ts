/**
 * ColaLink Example - Demonstration of complete system usage with E2EE
 */

import { join } from 'path';
import { ColaLinkManager } from './colalink-manager';
import { createLogger } from '../utils/logger';

const logger = createLogger('ColaLink:Example');

/**
 * Example usage of ColaLink system with E2EE
 */
async function main() {
  logger.info('=== ColaLink Example Started ===');

  // 1. Initialize ColaLink Manager (no encryptionKey needed - E2EE auto-generated)
  const colalink = new ColaLinkManager({
    dataDir: join(process.cwd(), 'data'),
    myHandle: 'alice',
    wechatPlugin: {
      myHandle: 'alice',
      autoSync: true,
      syncInterval: 60000,
      handlePrefix: 'wx_'
    }
  });

  // Get this instance's E2EE public key for distribution
  const alicePublicKey = colalink.getPublicKey();
  logger.info(`My E2EE public key: ${alicePublicKey.substring(0, 32)}...`);

  // 2. Setup event listeners
  colalink.on('ready', () => {
    logger.info('ColaLink is ready!');
  });

  colalink.on('contact:added', contact => {
    logger.info(`New contact added: @${contact.handle} (${contact.displayName})`);
  });

  colalink.on('message:received', message => {
    logger.info(`Message received: @${message.fromHandle} → @${message.toHandle}: ${message.content}`);
  });

  colalink.on('message:sent', message => {
    logger.info(`Message sent (E2EE): @${message.fromHandle} → @${message.toHandle}`);
  });

  colalink.on('request:received', request => {
    logger.info(`Contact request received from @${request.fromHandle}`);
  });

  // 3. Add contacts (with E2EE public keys)
  logger.info('\n=== Adding Contacts ===');

  // In a real scenario, bobPublicKey would be obtained through a key exchange
  // (e.g., during contact request/accept flow or out-of-band)
  const bobPublicKey = 'BOB_ECDH_PUBLIC_KEY_PLACEHOLDER';
  const bob = colalink.addContact({
    handle: 'bob',
    displayName: 'Bob Smith',
    publicKey: bobPublicKey,
    status: 'friend'
  });
  logger.info(`Added: @${bob.handle}`);

  const carolPublicKey = 'CAROL_ECDH_PUBLIC_KEY_PLACEHOLDER';
  const carol = colalink.addContact({
    handle: 'carol',
    displayName: 'Carol Johnson',
    publicKey: carolPublicKey,
    remark: 'Met at conference',
    status: 'friend'
  });
  logger.info(`Added: @${carol.handle}`);

  // Set peer public keys for E2EE (auto-done by addContact, but explicit for demo)
  colalink.setPeerPublicKey('bob', bobPublicKey);
  colalink.setPeerPublicKey('carol', carolPublicKey);

  // 4. List all contacts
  logger.info('\n=== Listing Contacts ===');
  const contacts = colalink.listContacts();
  logger.info(`Total contacts: ${contacts.length}`);
  contacts.forEach(c => {
    logger.info(`  @${c.handle} - ${c.displayName} (${c.status})`);
  });

  // 5. Send messages (E2EE encrypted)
  logger.info('\n=== Sending Messages ===');

  const msg1 = await colalink.sendMessage('bob', 'Hello Bob! How are you?');
  logger.info(`Sent message (E2EE): ${msg1.id}`);

  const msg2 = await colalink.sendMessage('bob', 'Are you free for coffee tomorrow?');
  logger.info(`Sent message (E2EE): ${msg2.id}`);

  const msg3 = await colalink.sendMessage('carol', 'Hi Carol! Nice to meet you at the conference!');
  logger.info(`Sent message (E2EE): ${msg3.id}`);

  // 6. Simulate receiving messages
  logger.info('\n=== Simulating Received Messages ===');

  const messageManager = colalink.getMessageManager();

  // In real usage, received messages would be E2EE encrypted by the sender.
  // For this demo, we simulate receiving messages that were encrypted by bob
  // using alice's public key. Since we don't have bob's actual E2EE instance,
  // we'll note that in production the relay would deliver pre-encrypted messages.

  await messageManager.receiveMessage({
    id: 'msg_bob_1',
    fromHandle: 'bob',
    toHandle: 'alice',
    content: 'Hey Alice! I\'m doing great, thanks!',
    encrypted: false,
    status: 'delivered',
    createdAt: Date.now()
  });

  await messageManager.receiveMessage({
    id: 'msg_bob_2',
    fromHandle: 'bob',
    toHandle: 'alice',
    content: 'Sure! How about 10am at the usual spot?',
    encrypted: false,
    status: 'delivered',
    createdAt: Date.now()
  });

  // 7. Get conversation history (decrypted on read)
  logger.info('\n=== Conversation History ===');

  const history = await colalink.getHistory('bob');
  logger.info(`Conversation with @bob (${history.length} messages):`);
  history.forEach(msg => {
    const direction = msg.fromHandle === 'alice' ? '→' : '←';
    logger.info(`  ${direction} ${msg.content}`);
  });

  // 8. Get recent conversations
  logger.info('\n=== Recent Conversations ===');

  const conversations = await colalink.getRecentConversations();
  logger.info(`Recent conversations: ${conversations.length}`);
  conversations.forEach(conv => {
    logger.info(`  @${conv.handle}: ${conv.lastMessage.content.substring(0, 30)}... (${conv.unreadCount} unread)`);
  });

  // 9. Contact requests
  logger.info('\n=== Contact Requests ===');

  const request = colalink.sendContactRequest('dave', 'Hi Dave, can we connect?');
  logger.info(`Sent request: ${request.id} → @dave`);

  // Simulate receiving request
  const contactManager = colalink.getContactManager();
  contactManager.receiveRequest({
    id: 'req_eve_123',
    fromHandle: 'eve',
    toHandle: 'alice',
    message: 'Hi Alice! Found you through Carol.',
    status: 'pending',
    createdAt: Date.now()
  });

  const pendingRequests = colalink.listPendingRequests();
  logger.info(`Pending requests: ${pendingRequests.length}`);
  pendingRequests.forEach(req => {
    logger.info(`  ${req.id}: @${req.fromHandle} → @${req.toHandle}`);
    logger.info(`    Message: ${req.message}`);
  });

  // Accept request
  if (pendingRequests.length > 0) {
    const accepted = colalink.acceptContactRequest(pendingRequests[0].id);
    logger.info(`Accepted request: ${accepted.id}`);

    // In production, key exchange would happen here:
    // - Alice sends her public key to eve
    // - Eve sends her public key to alice
    // colalink.setPeerPublicKey('eve', evePublicKey);
  }

  // 10. Mark messages as read
  logger.info('\n=== Message Status ===');

  const unreadCount = colalink.getUnreadCount();
  logger.info(`Unread messages: ${unreadCount}`);

  if (history.length > 0) {
    const firstMsg = history[0];
    if (firstMsg.status !== 'read' && firstMsg.toHandle === 'alice') {
      colalink.markAsRead(firstMsg.id);
      logger.info(`Marked as read: ${firstMsg.id}`);
    }
  }

  // 11. WeChat plugin demo
  logger.info('\n=== WeChat Plugin ===');

  const wechatPlugin = colalink.getWeChatPlugin();
  if (wechatPlugin) {
    logger.info('WeChat plugin is enabled');

    // Sync WeChat contact
    await wechatPlugin.syncWeChatContact({
      wxid: 'wxid_test123',
      nickname: 'WeChat Friend',
      avatar: 'https://example.com/avatar.jpg',
      remark: 'From WeChat'
    });

    // Sync WeChat message
    await wechatPlugin.syncWeChatMessage({
      id: 'wx_msg_001',
      from: 'wxid_test123',
      to: 'alice',
      content: 'Hello from WeChat!',
      timestamp: Date.now(),
      type: 'text'
    });

    const wechatContacts = wechatPlugin.getWeChatContacts();
    logger.info(`WeChat contacts: ${wechatContacts.length}`);
    wechatContacts.forEach(c => {
      logger.info(`  @${c.handle} - ${c.displayName}`);
    });
  } else {
    logger.info('WeChat plugin is not enabled');
  }

  // 12. Block/unblock contact
  logger.info('\n=== Contact Management ===');

  logger.info('Blocking @bob...');
  colalink.blockContact('bob');

  try {
    await colalink.sendMessage('bob', 'This should fail');
  } catch (error) {
    logger.info(`Expected error: ${(error as Error).message}`);
  }

  logger.info('Unblocking @bob...');
  colalink.unblockContact('bob');

  const msg4 = await colalink.sendMessage('bob', 'Now this works again!');
  logger.info(`Sent message (E2EE): ${msg4.id}`);

  // 13. Withdraw message
  logger.info('\n=== Message Withdrawal ===');

  logger.info(`Withdrawing message: ${msg4.id}`);
  colalink.withdrawMessage(msg4.id);

  // 14. Final stats
  logger.info('\n=== Final Statistics ===');

  const finalContacts = colalink.listContacts();
  const finalUnread = colalink.getUnreadCount();
  const finalConversations = await colalink.getRecentConversations();

  logger.info(`Total contacts: ${finalContacts.length}`);
  logger.info(`Unread messages: ${finalUnread}`);
  logger.info(`Active conversations: ${finalConversations.length}`);

  // 15. Cleanup
  logger.info('\n=== Cleanup ===');
  colalink.destroy();
  logger.info('ColaLink destroyed');

  logger.info('\n=== Example Complete ===');
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Example failed:', error);
    process.exit(1);
  });
}

export { main as runColaLinkExample };
