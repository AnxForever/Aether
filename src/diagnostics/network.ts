/**
 * Network Diagnostics - Network connectivity and performance testing
 */

import { createLogger } from '../utils/logger';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { lookup } from 'dns/promises';

const logger = createLogger('NetworkDiagnostics');
const execFileAsync = promisify(execFile);

/**
 * Diagnostic result
 */
export interface DiagnosticResult {
  timestamp: number;
  network: {
    online: boolean;
    latency?: number;
    dnsResolution: boolean;
    proxyDetected: boolean;
  };
  apis: {
    provider: string;
    endpoint: string;
    available: boolean;
    latency?: number;
    error?: string;
  }[];
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
  };
}

/**
 * Network Diagnostics
 */
export class NetworkDiagnostics {
  /**
   * Run full diagnostics
   */
  async runDiagnostics(apiEndpoints: { provider: string; endpoint: string }[]): Promise<DiagnosticResult> {
    logger.info('Starting network diagnostics...');

    const result: DiagnosticResult = {
      timestamp: Date.now(),
      network: {
        online: false,
        dnsResolution: false,
        proxyDetected: false
      },
      apis: [],
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      }
    };

    // Test network connectivity
    try {
      const latency = await this.testLatency('8.8.8.8');
      result.network.online = true;
      result.network.latency = latency;
      logger.info(`Network online, latency: ${latency}ms`);
    } catch (error) {
      logger.error('Network connectivity test failed:', error instanceof Error ? error : undefined);
    }

    // Test DNS resolution
    try {
      await this.testDNS('google.com');
      result.network.dnsResolution = true;
      logger.info('DNS resolution: OK');
    } catch (error) {
      logger.error('DNS resolution failed:', error instanceof Error ? error : undefined);
    }

    // Detect proxy
    result.network.proxyDetected = this.detectProxy();

    // Test API endpoints
    for (const api of apiEndpoints) {
      const apiResult = await this.testAPIEndpoint(api.provider, api.endpoint);
      result.apis.push(apiResult);
    }

    logger.info('Network diagnostics completed');
    return result;
  }

  /**
   * Test latency (ping)
   */
  private async testLatency(host: string): Promise<number> {
    const startTime = Date.now();

    if (process.platform === 'win32') {
      await execFileAsync('ping', ['-n', '1', host]);
    } else {
      await execFileAsync('ping', ['-c', '1', host]);
    }

    return Date.now() - startTime;
  }

  /**
   * Test DNS resolution
   */
  private async testDNS(hostname: string): Promise<void> {
    await lookup(hostname);
  }

  /**
   * Detect proxy configuration
   */
  private detectProxy(): boolean {
    const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy'];

    for (const varName of proxyVars) {
      if (process.env[varName]) {
        logger.info(`Proxy detected: ${varName}=${process.env[varName]}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Test API endpoint
   */
  private async testAPIEndpoint(
    provider: string,
    endpoint: string
  ): Promise<{
    provider: string;
    endpoint: string;
    available: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      const response = await axios.get(endpoint, {
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });

      const latency = Date.now() - startTime;
      const available = response.status < 500;

      logger.info(`${provider} API: ${available ? 'available' : 'unavailable'} (${latency}ms, status: ${response.status})`);

      return {
        provider,
        endpoint,
        available,
        latency,
        error: available ? undefined : `HTTP ${response.status}`
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      logger.error(`${provider} API test failed:`, error.message);

      return {
        provider,
        endpoint,
        available: false,
        latency,
        error: error.message
      };
    }
  }

  /**
   * Test bandwidth (simplified)
   */
  async testBandwidth(): Promise<{ downloadSpeed: number; uploadSpeed: number }> {
    // Simplified bandwidth test
    const testUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';

    const startTime = Date.now();
    const response = await axios.get(testUrl, { responseType: 'arraybuffer' });
    const downloadTime = Date.now() - startTime;

    const sizeInBytes = response.data.length;
    const sizeInMegabits = (sizeInBytes * 8) / 1000000;
    const timeInSeconds = downloadTime / 1000;
    const downloadSpeed = sizeInMegabits / timeInSeconds;

    logger.info(`Bandwidth test: ${downloadSpeed.toFixed(2)} Mbps`);

    return {
      downloadSpeed: parseFloat(downloadSpeed.toFixed(2)),
      uploadSpeed: 0 // Upload test not implemented
    };
  }

  /**
   * Generate diagnostic report
   */
  async generateReport(apiEndpoints: { provider: string; endpoint: string }[]): Promise<string> {
    const result = await this.runDiagnostics(apiEndpoints);

    const report = {
      ...result,
      summary: this.generateSummary(result),
      recommendations: this.generateRecommendations(result)
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate summary
   */
  private generateSummary(result: DiagnosticResult): string {
    const issues: string[] = [];

    if (!result.network.online) {
      issues.push('Network connectivity issue detected');
    }

    if (!result.network.dnsResolution) {
      issues.push('DNS resolution failing');
    }

    const unavailableAPIs = result.apis.filter(api => !api.available);
    if (unavailableAPIs.length > 0) {
      issues.push(`${unavailableAPIs.length} API endpoint(s) unavailable`);
    }

    if (issues.length === 0) {
      return 'All network diagnostics passed';
    }

    return `Found ${issues.length} issue(s): ${issues.join(', ')}`;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(result: DiagnosticResult): string[] {
    const recommendations: string[] = [];

    if (!result.network.online) {
      recommendations.push('Check network connection and firewall settings');
    }

    if (!result.network.dnsResolution) {
      recommendations.push('Check DNS settings (try using 8.8.8.8 or 1.1.1.1)');
    }

    if (result.network.proxyDetected) {
      recommendations.push('Proxy detected - ensure proxy settings are correct');
    }

    if (result.network.latency && result.network.latency > 1000) {
      recommendations.push('High latency detected - consider switching to a faster network');
    }

    const unavailableAPIs = result.apis.filter(api => !api.available);
    if (unavailableAPIs.length > 0) {
      recommendations.push(`Check API keys and quota for: ${unavailableAPIs.map(a => a.provider).join(', ')}`);
    }

    return recommendations;
  }
}
