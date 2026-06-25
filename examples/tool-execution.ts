/**
 * Tool Execution Example
 * 
 * Demonstrates how to use Aether's skill system for tool execution
 */

import { Pipeline } from '../src/core/pipeline';
import { SkillRegistry } from '../src/skills/registry';
import { ConnectorRegistry } from '../src/connectors';

async function main() {
  // Initialize components
  const skillRegistry = new SkillRegistry();
  const connectorRegistry = new ConnectorRegistry();
  const pipeline = new Pipeline();

  // Register a custom skill
  skillRegistry.register({
    id: 'weather',
    name: 'Weather Tool',
    description: 'Get weather information',
    version: '1.0.0',
    author: 'Example',
    enabled: true,
    tools: [{
      name: 'get_weather',
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' }
        },
        required: ['location']
      },
      handler: async (input, context) => {
        const { location } = input;
        return {
          success: true,
          data: {
            location,
            temperature: 20,
            condition: 'Sunny'
          }
        };
      }
    }]
  });

  // Execute pipeline with tool support
  const context = {
    cycle: {
      input: { transcript: 'What\'s the weather in Beijing?' }
    },
    config: { defaultProvider: 'claude' },
    connectorRegistry,
    skillRegistry
  };

  const result = await pipeline.execute(context);
  console.log('Result:', result);
}

main().catch(console.error);
