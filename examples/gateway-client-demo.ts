/**
 * Gateway Client Demo
 *
 * Demonstrates how to interact with the API Gateway
 */

import axios, { AxiosInstance } from 'axios';

/**
 * API Gateway Client
 */
class GatewayClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(baseURL: string = 'http://localhost:8080') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          console.error('Unauthorized: Invalid or expired token');
        } else if (error.response?.status === 429) {
          console.error('Rate limit exceeded:', error.response.data);
        }
        throw error;
      }
    );
  }

  /**
   * Set authentication token
   */
  public setToken(token: string): void {
    this.token = token;
  }

  /**
   * Check gateway health
   */
  public async checkHealth(): Promise<any> {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * Get gateway metrics
   */
  public async getMetrics(): Promise<any> {
    const response = await this.client.get('/metrics');
    return response.data;
  }

  /**
   * Send chat message
   */
  public async chat(message: string, sessionId?: string): Promise<any> {
    const response = await this.client.post('/api/chat', {
      message,
      sessionId
    });
    return response.data;
  }

  /**
   * Get available skills
   */
  public async getSkills(): Promise<any> {
    const response = await this.client.get('/api/skills');
    return response.data;
  }

  /**
   * Get specific skill
   */
  public async getSkill(skillId: string): Promise<any> {
    const response = await this.client.get(`/api/skills/${skillId}`);
    return response.data;
  }

  /**
   * Submit user feedback
   */
  public async submitFeedback(
    sessionId: string,
    messageId: string,
    rating: number,
    comment?: string,
    correctedResponse?: string
  ): Promise<any> {
    const response = await this.client.post('/api/learning/feedback', {
      sessionId,
      messageId,
      rating,
      comment,
      correctedResponse
    });
    return response.data;
  }

  /**
   * Get learning statistics
   */
  public async getLearningStats(): Promise<any> {
    const response = await this.client.get('/api/learning/stats');
    return response.data;
  }

  /**
   * Get learning report
   */
  public async getLearningReport(days: number = 7): Promise<any> {
    const response = await this.client.get('/api/learning/report', {
      params: { days }
    });
    return response.data;
  }

  /**
   * Get improvement suggestions
   */
  public async getImprovementSuggestions(): Promise<any> {
    const response = await this.client.get('/api/learning/suggestions');
    return response.data;
  }

  /**
   * Get skill usage statistics
   */
  public async getSkillStats(skillId?: string): Promise<any> {
    const response = await this.client.get('/api/learning/skills/stats', {
      params: skillId ? { skillId } : undefined
    });
    return response.data;
  }

  /**
   * Get user satisfaction metrics
   */
  public async getUserSatisfaction(days: number = 7): Promise<any> {
    const response = await this.client.get('/api/learning/satisfaction', {
      params: { days }
    });
    return response.data;
  }
}

/**
 * Demo: Basic Usage
 */
async function demoBasicUsage() {
  console.log('\n=== Demo: Basic Usage ===\n');

  const client = new GatewayClient('http://localhost:8080');

  // Check health
  console.log('1. Checking gateway health...');
  const health = await client.checkHealth();
  console.log('Health:', health);

  // Get metrics
  console.log('\n2. Getting metrics...');
  const metrics = await client.getMetrics();
  console.log('Metrics:', JSON.stringify(metrics, null, 2));
}

/**
 * Demo: Chat API
 */
async function demoChatAPI() {
  console.log('\n=== Demo: Chat API ===\n');

  const client = new GatewayClient('http://localhost:8080');

  // For demo purposes, generate a test JWT token
  // In production, obtain this from authentication endpoint
  const testToken = generateTestToken();
  client.setToken(testToken);

  // Send chat message
  console.log('1. Sending chat message...');
  const chatResponse = await client.chat('Hello, how are you?');
  console.log('Response:', chatResponse);

  // Send follow-up message in same session
  console.log('\n2. Sending follow-up message...');
  const followUp = await client.chat(
    'Tell me more',
    chatResponse.data.sessionId
  );
  console.log('Follow-up:', followUp);
}

/**
 * Demo: Skills API
 */
async function demoSkillsAPI() {
  console.log('\n=== Demo: Skills API ===\n');

  const client = new GatewayClient('http://localhost:8080');
  const testToken = generateTestToken();
  client.setToken(testToken);

  // Get all skills
  console.log('1. Getting all skills...');
  const skills = await client.getSkills();
  console.log(`Found ${skills.data.count} skills`);
  console.log('First 3 skills:', skills.data.skills.slice(0, 3));

  // Get specific skill
  if (skills.data.skills.length > 0) {
    const skillId = skills.data.skills[0].id;
    console.log(`\n2. Getting skill details for: ${skillId}`);
    const skill = await client.getSkill(skillId);
    console.log('Skill:', skill.data);
  }
}

/**
 * Demo: Learning API
 */
async function demoLearningAPI() {
  console.log('\n=== Demo: Learning API ===\n');

  const client = new GatewayClient('http://localhost:8080');
  const testToken = generateTestToken();
  client.setToken(testToken);

  // Get learning stats
  console.log('1. Getting learning statistics...');
  const stats = await client.getLearningStats();
  console.log('Stats:', JSON.stringify(stats, null, 2));

  // Submit feedback
  console.log('\n2. Submitting user feedback...');
  const feedback = await client.submitFeedback(
    'session-123',
    'message-456',
    5,
    'Great response!',
    undefined
  );
  console.log('Feedback:', feedback);

  // Get improvement suggestions
  console.log('\n3. Getting improvement suggestions...');
  const suggestions = await client.getImprovementSuggestions();
  console.log('Suggestions:', suggestions);

  // Get satisfaction metrics
  console.log('\n4. Getting user satisfaction...');
  const satisfaction = await client.getUserSatisfaction(30);
  console.log('Satisfaction:', satisfaction);

  // Get learning report
  console.log('\n5. Getting learning report (7 days)...');
  const report = await client.getLearningReport(7);
  console.log('Report:', JSON.stringify(report, null, 2));
}

/**
 * Demo: Rate Limiting
 */
async function demoRateLimiting() {
  console.log('\n=== Demo: Rate Limiting ===\n');

  const client = new GatewayClient('http://localhost:8080');
  const testToken = generateTestToken();
  client.setToken(testToken);

  console.log('Sending 10 rapid requests to test rate limiting...\n');

  for (let i = 1; i <= 10; i++) {
    try {
      const response = await client.chat(`Test message ${i}`);
      console.log(`Request ${i}: Success (remaining: ${response.headers['x-ratelimit-remaining']})`);
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log(`Request ${i}: Rate limited! ${error.response.data.message}`);
      } else {
        console.error(`Request ${i}: Error -`, error.message);
      }
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Demo: Error Handling
 */
async function demoErrorHandling() {
  console.log('\n=== Demo: Error Handling ===\n');

  const client = new GatewayClient('http://localhost:8080');

  // Test without token (should fail)
  console.log('1. Testing request without auth token...');
  try {
    await client.chat('Hello');
  } catch (error: any) {
    console.log('Expected error:', error.response?.status, error.response?.data);
  }

  // Test with invalid token
  console.log('\n2. Testing request with invalid token...');
  client.setToken('invalid-token-12345');
  try {
    await client.chat('Hello');
  } catch (error: any) {
    console.log('Expected error:', error.response?.status, error.response?.data);
  }

  // Test invalid endpoint
  console.log('\n3. Testing invalid endpoint...');
  const testToken = generateTestToken();
  client.setToken(testToken);
  try {
    await client.client.get('/api/nonexistent');
  } catch (error: any) {
    console.log('Expected error:', error.response?.status, error.response?.data);
  }
}

/**
 * Generate test JWT token (for demo purposes only)
 * In production, obtain tokens from authentication service
 */
function generateTestToken(): string {
  const jwt = require('jsonwebtoken');

  // This secret should match the one in gateway.json
  const secret = 'your-secret-key-at-least-32-characters-long-change-in-production';

  const payload = {
    userId: 'demo-user-123',
    role: 'user',
    permissions: ['chat', 'read:skills', 'write:feedback']
  };

  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

/**
 * Run all demos
 */
async function runAllDemos() {
  try {
    await demoBasicUsage();
    await demoChatAPI();
    await demoSkillsAPI();
    await demoLearningAPI();
    await demoRateLimiting();
    await demoErrorHandling();

    console.log('\n✅ All demos completed!\n');
  } catch (error: any) {
    console.error('\n❌ Demo failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nMake sure the Gateway Server is running on http://localhost:8080');
    }
  }
}

/**
 * Main entry point
 */
if (require.main === module) {
  runAllDemos();
}

export { GatewayClient };
