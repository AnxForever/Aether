/**
 * Chart Generator - Generate various types of charts
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('ChartGenerator');

/**
 * Chart types
 */
export type ChartType = 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'radar' | 'heatmap';

/**
 * Chart data point
 */
export interface DataPoint {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}

/**
 * Chart series
 */
export interface ChartSeries {
  name: string;
  data: DataPoint[];
  color?: string;
}

/**
 * Chart options
 */
export interface ChartOptions {
  title?: string;
  width?: number;
  height?: number;
  theme?: 'light' | 'dark';
  showLegend?: boolean;
  showGrid?: boolean;
  animated?: boolean;
  colors?: string[];
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  type: ChartType;
  series: ChartSeries[];
  options: ChartOptions;
}

/**
 * Chart output
 */
export interface ChartOutput {
  type: 'svg' | 'png' | 'json';
  data: string | Buffer;
  width: number;
  height: number;
}

/**
 * Chart Generator
 */
export class ChartGenerator {
  private defaultOptions: ChartOptions = {
    width: 800,
    height: 600,
    theme: 'light',
    showLegend: true,
    showGrid: true,
    animated: false,
    colors: ['#3C5A78', '#6B7077', '#E7E3DA', '#1E2227', '#F7F5F1']
  };

  /**
   * Generate chart
   */
  async generate(config: ChartConfig, format: 'svg' | 'png' | 'json' = 'svg'): Promise<ChartOutput> {
    logger.info(`Generating ${config.type} chart (${format})`);

    const options = { ...this.defaultOptions, ...config.options };

    switch (config.type) {
      case 'line':
        return await this.generateLineChart(config.series, options, format);
      case 'bar':
        return await this.generateBarChart(config.series, options, format);
      case 'pie':
        return await this.generatePieChart(config.series, options, format);
      case 'scatter':
        return await this.generateScatterChart(config.series, options, format);
      case 'area':
        return await this.generateAreaChart(config.series, options, format);
      case 'radar':
        return await this.generateRadarChart(config.series, options, format);
      case 'heatmap':
        return await this.generateHeatmapChart(config.series, options, format);
      default:
        throw new Error(`Unsupported chart type: ${config.type}`);
    }
  }

  /**
   * Generate line chart
   */
  private async generateLineChart(series: ChartSeries[], options: ChartOptions, format: string): Promise<ChartOutput> {
    // Validate data
    if (!series || series.length === 0 || series.every(s => s.data.length === 0)) {
      throw new Error('No data to visualize');
    }

    // Simplified SVG generation (in production, use a charting library like D3.js or Chart.js)
    const svg = this.createSVGContainer(options);

    const padding = 60;
    const chartWidth = (options.width || 800) - padding * 2;
    const chartHeight = (options.height || 600) - padding * 2;

    // Find data bounds
    const allValues = series.flatMap(s => s.data.map(d => d.y));

    if (allValues.length === 0) {
      throw new Error('No data points to visualize');
    }

    const minY = Math.min(...allValues);
    const maxY = Math.max(...allValues);
    const yRange = maxY - minY || 1; // Prevent division by zero

    let paths = '';
    series.forEach((s, index) => {
      if (s.data.length === 0) return; // Skip empty series

      const color = s.color || options.colors![index % options.colors!.length];
      const points = s.data
        .map((d, i) => {
          const x = padding + (s.data.length > 1 ? (i / (s.data.length - 1)) * chartWidth : chartWidth / 2);
          const y = padding + chartHeight - ((d.y - minY) / yRange) * chartHeight;
          return `${x},${y}`;
        })
        .join(' ');

      paths += `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>`;
    });

    const svgContent = `${svg}${paths}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Generate bar chart
   */
  private async generateBarChart(series: ChartSeries[], options: ChartOptions, format: string): Promise<ChartOutput> {
    // Validate data
    if (!series || series.length === 0 || series.every(s => s.data.length === 0)) {
      throw new Error('No data to visualize');
    }

    const svg = this.createSVGContainer(options);

    const padding = 60;
    const chartWidth = (options.width || 800) - padding * 2;
    const chartHeight = (options.height || 600) - padding * 2;

    const allValues = series.flatMap(s => s.data.map(d => d.y));

    if (allValues.length === 0) {
      throw new Error('No data points to visualize');
    }

    const maxY = Math.max(...allValues);

    if (maxY === 0) {
      // All values are zero, just draw the axes
      return {
        type: 'svg',
        data: `${svg}</svg>`,
        width: options.width || 800,
        height: options.height || 600
      };
    }

    let bars = '';
    const firstSeries = series.find(s => s.data.length > 0);
    if (!firstSeries) {
      throw new Error('No valid data series found');
    }

    const barWidth = chartWidth / (firstSeries.data.length * series.length + firstSeries.data.length);

    series.forEach((s, seriesIndex) => {
      if (s.data.length === 0) return; // Skip empty series

      const color = s.color || options.colors![seriesIndex % options.colors!.length];

      s.data.forEach((d, i) => {
        const x = padding + i * (barWidth * series.length + barWidth) + seriesIndex * barWidth;
        const height = (d.y / maxY) * chartHeight;
        const y = padding + chartHeight - height;

        bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${height}" fill="${color}"/>`;
      });
    });

    const svgContent = `${svg}${bars}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Generate pie chart
   */
  private async generatePieChart(series: ChartSeries[], options: ChartOptions, _format: string): Promise<ChartOutput> {
    const svg = this.createSVGContainer(options);

    const centerX = (options.width || 800) / 2;
    const centerY = (options.height || 600) / 2;
    const radius = Math.min(centerX, centerY) - 40;

    const data = series[0].data;
    const total = data.reduce((sum, d) => sum + d.y, 0);

    let slices = '';
    let currentAngle = -Math.PI / 2;

    data.forEach((d, i) => {
      const color = d.color || options.colors![i % options.colors!.length];
      const angle = (d.y / total) * 2 * Math.PI;

      const x1 = centerX + radius * Math.cos(currentAngle);
      const y1 = centerY + radius * Math.sin(currentAngle);

      currentAngle += angle;

      const x2 = centerX + radius * Math.cos(currentAngle);
      const y2 = centerY + radius * Math.sin(currentAngle);

      const largeArc = angle > Math.PI ? 1 : 0;

      slices += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}"/>`;
    });

    const svgContent = `${svg}${slices}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Generate scatter chart
   */
  private async generateScatterChart(series: ChartSeries[], options: ChartOptions, _format: string): Promise<ChartOutput> {
    const svg = this.createSVGContainer(options);

    const padding = 60;
    const chartWidth = (options.width || 800) - padding * 2;
    const chartHeight = (options.height || 600) - padding * 2;

    const allX = series.flatMap(s => s.data.map(d => typeof d.x === 'number' ? d.x : 0));
    const allY = series.flatMap(s => s.data.map(d => d.y));

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);

    const xRange = maxX - minX;
    const yRange = maxY - minY;

    let points = '';
    series.forEach((s, index) => {
      const color = s.color || options.colors![index % options.colors!.length];

      s.data.forEach(d => {
        const xVal = typeof d.x === 'number' ? d.x : 0;
        const x = padding + ((xVal - minX) / xRange) * chartWidth;
        const y = padding + chartHeight - ((d.y - minY) / yRange) * chartHeight;

        points += `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`;
      });
    });

    const svgContent = `${svg}${points}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Generate area chart
   */
  private async generateAreaChart(series: ChartSeries[], options: ChartOptions, _format: string): Promise<ChartOutput> {
    const svg = this.createSVGContainer(options);

    const padding = 60;
    const chartWidth = (options.width || 800) - padding * 2;
    const chartHeight = (options.height || 600) - padding * 2;

    const allValues = series.flatMap(s => s.data.map(d => d.y));
    const minY = Math.min(...allValues);
    const maxY = Math.max(...allValues);
    const yRange = maxY - minY;

    let areas = '';
    series.forEach((s, index) => {
      const color = s.color || options.colors![index % options.colors!.length];

      const topPoints = s.data
        .map((d, i) => {
          const x = padding + (i / (s.data.length - 1)) * chartWidth;
          const y = padding + chartHeight - ((d.y - minY) / yRange) * chartHeight;
          return `${x},${y}`;
        })
        .join(' ');

      const bottomRight = `${padding + chartWidth},${padding + chartHeight}`;
      const bottomLeft = `${padding},${padding + chartHeight}`;

      areas += `<polygon points="${topPoints} ${bottomRight} ${bottomLeft}" fill="${color}" opacity="0.5"/>`;
    });

    const svgContent = `${svg}${areas}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Generate radar chart
   */
  private async generateRadarChart(series: ChartSeries[], options: ChartOptions, _format: string): Promise<ChartOutput> {
    const svg = this.createSVGContainer(options);

    const centerX = (options.width || 800) / 2;
    const centerY = (options.height || 600) / 2;
    const radius = Math.min(centerX, centerY) - 60;

    const data = series[0].data;
    const angles = data.map((_, i) => (i / data.length) * 2 * Math.PI - Math.PI / 2);

    const maxValue = Math.max(...data.map(d => d.y));

    let polygons = '';
    series.forEach((s, index) => {
      const color = s.color || options.colors![index % options.colors!.length];

      const points = s.data.map((d, i) => {
        const r = (d.y / maxValue) * radius;
        const x = centerX + r * Math.cos(angles[i]);
        const y = centerY + r * Math.sin(angles[i]);
        return `${x},${y}`;
      }).join(' ');

      polygons += `<polygon points="${points}" fill="${color}" opacity="0.3" stroke="${color}" stroke-width="2"/>`;
    });

    const svgContent = `${svg}${polygons}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Generate heatmap chart
   */
  private async generateHeatmapChart(series: ChartSeries[], options: ChartOptions, _format: string): Promise<ChartOutput> {
    const svg = this.createSVGContainer(options);

    const padding = 60;
    const chartWidth = (options.width || 800) - padding * 2;
    const chartHeight = (options.height || 600) - padding * 2;

    const allValues = series.flatMap(s => s.data.map(d => d.y));
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const valueRange = maxValue - minValue;

    const cellWidth = chartWidth / series.length;
    const cellHeight = chartHeight / series[0].data.length;

    let cells = '';
    series.forEach((s, col) => {
      s.data.forEach((d, row) => {
        const intensity = (d.y - minValue) / valueRange;
        const color = this.interpolateColor('#E7E3DA', '#3C5A78', intensity);

        const x = padding + col * cellWidth;
        const y = padding + row * cellHeight;

        cells += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${color}"/>`;
      });
    });

    const svgContent = `${svg}${cells}</svg>`;

    return {
      type: 'svg',
      data: svgContent,
      width: options.width || 800,
      height: options.height || 600
    };
  }

  /**
   * Create SVG container
   */
  private createSVGContainer(options: ChartOptions): string {
    const width = options.width || 800;
    const height = options.height || 600;
    const bg = options.theme === 'dark' ? '#1E2227' : '#F7F5F1';

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="${bg}"/>`;
  }

  /**
   * Interpolate color
   */
  private interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);

    return `rgb(${r},${g},${b})`;
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
      : { r: 0, g: 0, b: 0 };
  }
}
