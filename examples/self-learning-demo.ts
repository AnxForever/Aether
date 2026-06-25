/**
 * Self-Learning System Demo
 *
 * Demonstrates how to use the integrated self-learning system
 */

import { createNexusAgent } from '../src/agent';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🧠 Self-Learning System Demo\n');

  // Create agent with learning enabled
  const agent = createNexusAgent({
    model: 'claude-sonnet-4-20250514',
    provider: 'claude',
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY || ''
    },
    dataDir: './data',
    enableLearning: true // Enable learning system
  });

  await agent.initialize();

  // Example 1: Basic chat with automatic learning
  console.log('1️⃣ Basic Chat (learning happens automatically):\n');

  const response1 = await agent.chat('What is TypeScript?');
  console.log('AI:', response1.substring(0, 200) + '...\n');

  // Example 2: Record user feedback
  console.log('2️⃣ Recording User Feedback:\n');

  const messageId = randomUUID();
  const feedbackId = await agent.recordFeedback(
    messageId,
    5, // 5-star rating
    'Great explanation!',
    undefined
  );

  console.log(`✅ Feedback recorded: ${feedbackId}\n`);

  // Example 3: Low rating feedback (triggers improvement suggestion)
  console.log('3️⃣ Low Rating (triggers improvement analysis):\n');

  const badMessageId = randomUUID();
  await agent.recordFeedback(
    badMessageId,
    2, // Low rating
    'Too slow and unclear',
    undefined
  );

  console.log('⚠️ Low rating recorded - system will analyze for improvements\n');

  // Example 4: Get learning statistics
  console.log('4️⃣ Learning Statistics:\n');

  const stats = await agent.getLearningStats();
  console.log('Current Stats:');
  console.log(`  - Total Interactions: ${stats?.feedbackLoop?.totalInteractions || 0}`);
  console.log(`  - Success Rate: ${((stats?.feedbackLoop?.successRate || 0) * 100).toFixed(1)}%`);
  console.log(`  - Average Response Time: ${(stats?.feedbackLoop?.averageResponseTime || 0).toFixed(0)}ms`);
  console.log(`  - Average Satisfaction: ${(stats?.averageSatisfaction || 0).toFixed(2)}/5.0\n`);

  // Example 5: Generate learning report
  console.log('5️⃣ Learning Report (Last 7 Days):\n');

  const report = await agent.generateLearningReport(7);
  if (report) {
    console.log(report);
  }

  // Cleanup
  await agent.cleanup();

  console.log('\n✨ Demo completed!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('   - Automatic cycle recording');
  console.log('   - User feedback collection');
  console.log('   - Low-rating detection');
  console.log('   - Real-time statistics');
  console.log('   - Learning reports');
}

main().catch(console.error);
