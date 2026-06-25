/**
 * Skill Creator Demo
 *
 * Demonstrates dynamic skill creation capabilities
 */

import { createNexusAgent } from '../src/agent';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
  console.log('=== Nexus Agent - Skill Creator Demo ===\n');

  // Create agent with learning enabled
  const agent = createNexusAgent({
    model: 'claude-sonnet-4-20250514',
    provider: 'claude',
    apiKeys: {
      claude: process.env.ANTHROPIC_API_KEY || ''
    },
    dataDir: './data',
    enableLearning: true // Required for skill creator
  });

  await agent.initialize();

  console.log('✅ Agent initialized with learning and skill creator enabled\n');

  // Example 1: Natural language skill creation
  console.log('--- Example 1: Natural Language Intent Detection ---');
  console.log('User: 我需要一个能计算两个数字之和的工具\n');

  const response1 = await agent.chat('我需要一个能计算两个数字之和的工具');
  console.log('Assistant:', response1);
  console.log();

  // Example 2: Direct API call
  console.log('--- Example 2: Direct API Call ---');
  console.log('Creating skill: "获取当前时间并格式化"\n');

  const result = await agent.createSkill('获取当前时间并格式化');
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log();

  // Example 3: List dynamic skills
  console.log('--- Example 3: List Dynamic Skills ---');
  const dynamicSkills = agent.listDynamicSkills();
  console.log(`Found ${dynamicSkills.length} dynamically created skills:`);
  dynamicSkills.forEach(skill => {
    console.log(`  - ${skill.name} (${skill.id})`);
    console.log(`    Tools: ${skill.tools.map((t: any) => t.name).join(', ')}`);
  });
  console.log();

  // Example 4: Skill creator statistics
  console.log('--- Example 4: Skill Creator Statistics ---');
  const stats = agent.getSkillCreatorStats();
  if (stats) {
    console.log('Stats:', JSON.stringify(stats, null, 2));
  } else {
    console.log('Skill creator not enabled');
  }
  console.log();

  // Example 5: English intent detection
  console.log('--- Example 5: English Intent Detection ---');
  console.log('User: Create a tool to convert temperature from Celsius to Fahrenheit\n');

  const response2 = await agent.chat('Create a tool to convert temperature from Celsius to Fahrenheit');
  console.log('Assistant:', response2);
  console.log();

  // Cleanup
  await agent.cleanup();
  console.log('✅ Demo completed');
}

// Run demo
main().catch(error => {
  console.error('❌ Demo failed:', error);
  process.exit(1);
});
