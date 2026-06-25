/**
 * Spotify Skill - Spotify player control and music management
 */

import { BaseSkill } from '../base-skill';
import { Tool, ToolResult } from '../../types';
import { SkillContext } from '../types';
import axios from 'axios';

/**
 * Spotify Skill
 */
export class SpotifySkill extends BaseSkill {
  private accessToken?: string;
  private baseURL = 'https://api.spotify.com/v1';

  constructor() {
    super({
      id: 'spotify-player',
      name: 'Spotify Player',
      description: 'Control Spotify playback and manage music',
      version: '1.0.0',
      author: 'Nexus',
      enabled: true,
    });
  }

  /**
   * Initialize skill
   */
  async initialize(context: SkillContext): Promise<void> {
    this.accessToken = context.env.SPOTIFY_ACCESS_TOKEN;
  }

  /**
   * Get tool definitions
   */
  getTools(): Tool[] {
    return [
      {
        name: 'spotify_current_playing',
        description: 'Get currently playing track',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_current_playing', params)
      },
      {
        name: 'spotify_play',
        description: 'Resume playback',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_play', params)
      },
      {
        name: 'spotify_pause',
        description: 'Pause playback',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_pause', params)
      },
      {
        name: 'spotify_next',
        description: 'Skip to next track',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_next', params)
      },
      {
        name: 'spotify_previous',
        description: 'Skip to previous track',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_previous', params)
      },
      {
        name: 'spotify_search',
        description: 'Search for tracks, albums, or artists',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_search', params)
      },
      {
        name: 'spotify_play_track',
        description: 'Play a specific track by URI',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_play_track', params)
      },
      {
        name: 'spotify_get_playlists',
        description: 'Get user playlists',
        parameters: [],
        handler: async (params) => this.executeTool('spotify_get_playlists', params)
      }
    ];
  }

  /**
   * Check if skill is properly configured
   */
  async isConfigured(): Promise<boolean> {
    return !!this.accessToken;
  }

  /**
   * Execute tool
   */
  async executeTool(toolName: string, parameters: any): Promise<ToolResult> {
    if (!this.accessToken) {
      return {
        success: false,
        error: 'Spotify access token not configured'
      };
    }

    try {
      switch (toolName) {
        case 'spotify_current_playing':
          return await this.getCurrentPlaying();
        case 'spotify_play':
          return await this.play(parameters);
        case 'spotify_pause':
          return await this.pause();
        case 'spotify_next':
          return await this.next();
        case 'spotify_previous':
          return await this.previous();
        case 'spotify_search':
          return await this.search(parameters);
        case 'spotify_play_track':
          return await this.playTrack(parameters);
        case 'spotify_get_playlists':
          return await this.getPlaylists(parameters);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get currently playing
   */
  private async getCurrentPlaying(): Promise<ToolResult> {
    const response = await this.request('GET', '/me/player/currently-playing');

    if (!response.item) {
      return {
        success: true,
        data: { playing: false, message: 'Nothing playing' }
      };
    }

    return {
      success: true,
      data: {
        playing: response.is_playing,
        track: {
          name: response.item.name,
          artists: response.item.artists.map((a: any) => a.name),
          album: response.item.album.name,
          uri: response.item.uri,
          duration: response.item.duration_ms
        },
        progress: response.progress_ms
      }
    };
  }

  /**
   * Play
   */
  private async play(params: any): Promise<ToolResult> {
    const { deviceId } = params;

    await this.request('PUT', '/me/player/play', deviceId ? { device_id: deviceId } : {});

    return {
      success: true,
      data: { message: 'Playback resumed' }
    };
  }

  /**
   * Pause
   */
  private async pause(): Promise<ToolResult> {
    await this.request('PUT', '/me/player/pause');

    return {
      success: true,
      data: { message: 'Playback paused' }
    };
  }

  /**
   * Next track
   */
  private async next(): Promise<ToolResult> {
    await this.request('POST', '/me/player/next');

    return {
      success: true,
      data: { message: 'Skipped to next track' }
    };
  }

  /**
   * Previous track
   */
  private async previous(): Promise<ToolResult> {
    await this.request('POST', '/me/player/previous');

    return {
      success: true,
      data: { message: 'Skipped to previous track' }
    };
  }

  /**
   * Search
   */
  private async search(params: any): Promise<ToolResult> {
    const { query, type = 'track', limit = 10 } = params;

    const response = await this.request('GET', '/search', {
      q: query,
      type,
      limit
    });

    const items = response[`${type}s`]?.items || [];

    return {
      success: true,
      data: {
        items: items.map((item: any) => ({
          name: item.name,
          uri: item.uri,
          ...(type === 'track' && {
            artists: item.artists.map((a: any) => a.name),
            album: item.album.name
          })
        })),
        count: items.length
      }
    };
  }

  /**
   * Play track
   */
  private async playTrack(params: any): Promise<ToolResult> {
    const { uri } = params;

    await this.request('PUT', '/me/player/play', {}, {
      uris: [uri]
    });

    return {
      success: true,
      data: { message: 'Playing track' }
    };
  }

  /**
   * Get playlists
   */
  private async getPlaylists(params: any): Promise<ToolResult> {
    const { limit = 20 } = params;

    const response = await this.request('GET', '/me/playlists', { limit });

    return {
      success: true,
      data: {
        playlists: response.items.map((item: any) => ({
          name: item.name,
          uri: item.uri,
          trackCount: item.tracks.total
        })),
        count: response.items.length
      }
    };
  }

  /**
   * Make API request
   */
  private async request(method: string, endpoint: string, params: any = {}, data?: any): Promise<any> {
    const response = await axios({
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      },
      params,
      data
    });

    return response.data;
  }
}
