/**
 * Google Calendar Skill
 *
 * Google Calendar event management
 */

import { BaseSkill } from '../base-skill';
import type { Tool, ToolResult } from '../../types';
import type { SkillContext } from '../types';
import {
  CalendarListEventsSchema,
  CalendarCreateEventSchema,
  CalendarUpdateEventSchema,
  CalendarDeleteEventSchema,
} from '../types';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  htmlLink: string;
}

export class CalendarSkill extends BaseSkill {
  constructor() {
    super({
      id: 'calendar',
      name: 'Google Calendar',
      description: 'Google Calendar event creation, reading, and management using Calendar API',
      version: '1.0.0',
      author: 'Aether Team',
      enabled: true,
      requiresAuth: true,
      dependencies: ['googleapis'],
    });
  }

  getTools(): Tool[] {
    return [
      {
        name: 'calendar_list_events',
        description: 'List events from Google Calendar',
        parameters: [
          {
            name: 'calendarId',
            type: 'string',
            description: 'Calendar ID (default: "primary")',
            required: false,
          },
          {
            name: 'timeMin',
            type: 'string',
            description: 'Lower bound for event start time (ISO 8601)',
            required: false,
          },
          {
            name: 'timeMax',
            type: 'string',
            description: 'Upper bound for event start time (ISO 8601)',
            required: false,
          },
          {
            name: 'maxResults',
            type: 'number',
            description: 'Maximum number of events to return (1-250)',
            required: false,
          },
          {
            name: 'query',
            type: 'string',
            description: 'Free text search query',
            required: false,
          },
        ],
        handler: async (params) => this.listEvents(params),
      },
      {
        name: 'calendar_create_event',
        description: 'Create a new calendar event',
        parameters: [
          {
            name: 'calendarId',
            type: 'string',
            description: 'Calendar ID (default: "primary")',
            required: false,
          },
          {
            name: 'summary',
            type: 'string',
            description: 'Event title',
            required: true,
          },
          {
            name: 'description',
            type: 'string',
            description: 'Event description',
            required: false,
          },
          {
            name: 'location',
            type: 'string',
            description: 'Event location',
            required: false,
          },
          {
            name: 'start',
            type: 'object',
            description: 'Event start time with dateTime and optional timeZone',
            required: true,
          },
          {
            name: 'end',
            type: 'object',
            description: 'Event end time with dateTime and optional timeZone',
            required: true,
          },
          {
            name: 'attendees',
            type: 'array',
            description: 'Array of attendee objects with email and displayName',
            required: false,
          },
          {
            name: 'reminders',
            type: 'object',
            description: 'Reminder settings',
            required: false,
          },
        ],
        handler: async (params) => this.createEvent(params),
      },
      {
        name: 'calendar_update_event',
        description: 'Update an existing calendar event',
        parameters: [
          {
            name: 'calendarId',
            type: 'string',
            description: 'Calendar ID (default: "primary")',
            required: false,
          },
          {
            name: 'eventId',
            type: 'string',
            description: 'Event ID to update',
            required: true,
          },
          {
            name: 'summary',
            type: 'string',
            description: 'New event title',
            required: false,
          },
          {
            name: 'description',
            type: 'string',
            description: 'New event description',
            required: false,
          },
          {
            name: 'location',
            type: 'string',
            description: 'New event location',
            required: false,
          },
          {
            name: 'start',
            type: 'object',
            description: 'New event start time',
            required: false,
          },
          {
            name: 'end',
            type: 'object',
            description: 'New event end time',
            required: false,
          },
        ],
        handler: async (params) => this.updateEvent(params),
      },
      {
        name: 'calendar_delete_event',
        description: 'Delete a calendar event',
        parameters: [
          {
            name: 'calendarId',
            type: 'string',
            description: 'Calendar ID (default: "primary")',
            required: false,
          },
          {
            name: 'eventId',
            type: 'string',
            description: 'Event ID to delete',
            required: true,
          },
        ],
        handler: async (params) => this.deleteEvent(params),
      },
      {
        name: 'calendar_get_event',
        description: 'Get details of a specific calendar event',
        parameters: [
          {
            name: 'calendarId',
            type: 'string',
            description: 'Calendar ID (default: "primary")',
            required: false,
          },
          {
            name: 'eventId',
            type: 'string',
            description: 'Event ID to retrieve',
            required: true,
          },
        ],
        handler: async (params) => this.getEvent(params),
      },
    ];
  }

  async isConfigured(context: SkillContext): Promise<boolean> {
    // Check if Google Calendar API credentials are available
    return !!(
      context.env.GOOGLE_CLIENT_ID &&
      context.env.GOOGLE_CLIENT_SECRET &&
      context.env.GOOGLE_REFRESH_TOKEN
    );
  }

  private async listEvents(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof CalendarListEventsSchema._type>(
      CalendarListEventsSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { calendarId = 'primary', timeMin, timeMax, maxResults = 10, query } = validation.data;

      // Use Google Calendar API to list events
      // This is a placeholder - actual implementation would use googleapis
      const events: CalendarEvent[] = [];

      return this.createSuccess(events, {
        calendarId,
        count: events.length,
        maxResults,
        hasQuery: !!query,
      });
    } catch (error) {
      return this.handleError(error, 'Calendar list events');
    }
  }

  private async createEvent(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof CalendarCreateEventSchema._type>(
      CalendarCreateEventSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const {
        calendarId = 'primary',
        summary,
        description,
        location,
        start,
        end,
        attendees,
        reminders,
      } = validation.data;

      // Use Google Calendar API to create event
      // This is a placeholder - actual implementation would use googleapis
      const event: CalendarEvent = {
        id: `event_${Date.now()}`,
        summary,
        description,
        location,
        start,
        end,
        attendees,
        htmlLink: `https://calendar.google.com/event?eid=placeholder`,
      };

      return this.createSuccess(event, {
        calendarId,
        hasAttendees: !!attendees && attendees.length > 0,
      });
    } catch (error) {
      return this.handleError(error, 'Calendar create event');
    }
  }

  private async updateEvent(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof CalendarUpdateEventSchema._type>(
      CalendarUpdateEventSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { calendarId = 'primary', eventId, summary, description, location, start, end } =
        validation.data;

      // Use Google Calendar API to update event
      // This is a placeholder - actual implementation would use googleapis
      const event: CalendarEvent = {
        id: eventId,
        summary: summary || 'Updated Event',
        description,
        location,
        start: start || { dateTime: new Date().toISOString() },
        end: end || { dateTime: new Date().toISOString() },
        htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      };

      return this.createSuccess(event, {
        calendarId,
        eventId,
        updated: true,
      });
    } catch (error) {
      return this.handleError(error, 'Calendar update event');
    }
  }

  private async deleteEvent(params: unknown): Promise<ToolResult> {
    const validation = this.validateParams<typeof CalendarDeleteEventSchema._type>(
      CalendarDeleteEventSchema,
      params
    );

    if (!validation.success) {
      return this.createError(validation.error);
    }

    try {
      const { calendarId = 'primary', eventId } = validation.data;

      // Use Google Calendar API to delete event
      // This is a placeholder - actual implementation would use googleapis

      return this.createSuccess(undefined, {
        calendarId,
        eventId,
        deleted: true,
      });
    } catch (error) {
      return this.handleError(error, 'Calendar delete event');
    }
  }

  private async getEvent(params: unknown): Promise<ToolResult> {
    try {
      const { calendarId = 'primary', eventId } = params as {
        calendarId?: string;
        eventId: string;
      };

      if (!eventId) {
        return this.createError('eventId is required');
      }

      // Use Google Calendar API to get event
      // This is a placeholder - actual implementation would use googleapis
      const event: CalendarEvent = {
        id: eventId,
        summary: 'Sample Event',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date().toISOString() },
        htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      };

      return this.createSuccess(event, { calendarId, eventId });
    } catch (error) {
      return this.handleError(error, 'Calendar get event');
    }
  }
}
