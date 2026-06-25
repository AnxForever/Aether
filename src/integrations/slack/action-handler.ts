/**
 * Slack Action Handler
 *
 * Handles Interactive Components (buttons, menus, modals)
 */

import { EventEmitter } from 'eventemitter3';
import { App } from '@slack/bolt';
import { ActionPayload, ActionHandler, ModalView } from './types';

/**
 * Action Registration
 */
interface ActionRegistration {
  actionId: string;
  handler: ActionHandler;
  description?: string;
}

/**
 * Action Handler Manager
 *
 * Features:
 * - Button interactions
 * - Select menu interactions
 * - Modal submissions
 * - Action routing
 * - Response helpers
 */
export class ActionHandlerManager extends EventEmitter {
  private app: App;
  private actions: Map<string, ActionRegistration> = new Map();

  constructor(app: App) {
    super();
    this.app = app;
  }

  /**
   * Register button action
   */
  registerAction(
    actionId: string,
    handler: ActionHandler,
    options?: {
      description?: string;
    }
  ): void {
    const registration: ActionRegistration = {
      actionId,
      handler,
      description: options?.description,
    };

    this.actions.set(actionId, registration);

    // Register with Bolt
    this.app.action(actionId, async ({ body, ack, respond }: any) => {
      try {
        // Acknowledge action immediately
        await ack();

        // Build payload
        const payload: ActionPayload = {
          type: body.type as any,
          actions: (body as any).actions || [],
          user: (body as any).user,
          channel: (body as any).channel,
          message: (body as any).message,
          response_url: (body as any).response_url,
          trigger_id: (body as any).trigger_id,
        };

        // Execute handler
        await handler(payload, respond);

        this.emit('action:executed', actionId, payload);
      } catch (error) {
        this.emit('action:error', actionId, error);

        // Send error response
        await respond({
          text: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          replace_original: false,
          response_type: 'ephemeral',
        });
      }
    });
  }

  /**
   * Unregister action
   */
  unregisterAction(actionId: string): boolean {
    return this.actions.delete(actionId);
  }

  /**
   * Get all registered actions
   */
  getActions(): ActionRegistration[] {
    return Array.from(this.actions.values());
  }

  /**
   * Open modal dialog
   */
  async openModal(triggerId: string, view: ModalView): Promise<void> {
    try {
      const result = await this.app.client.views.open({
        trigger_id: triggerId,
        view,
      });

      if (!result.ok) {
        throw new Error(`Failed to open modal: ${result.error}`);
      }
    } catch (error) {
      this.emit('modal:error', error);
      throw error;
    }
  }

  /**
   * Update modal
   */
  async updateModal(viewId: string, view: ModalView): Promise<void> {
    try {
      const result = await this.app.client.views.update({
        view_id: viewId,
        view,
      });

      if (!result.ok) {
        throw new Error(`Failed to update modal: ${result.error}`);
      }
    } catch (error) {
      this.emit('modal:error', error);
      throw error;
    }
  }

  /**
   * Close modal
   */
  async closeModal(viewId: string): Promise<void> {
    try {
      const result = await this.app.client.views.update({
        view_id: viewId,
        view: {
          type: 'modal',
          callback_id: 'closed',
          title: {
            type: 'plain_text',
            text: 'Closed',
          },
          blocks: [],
        } as any,
      });

      if (!result.ok) {
        throw new Error(`Failed to close modal: ${result.error}`);
      }
    } catch (error) {
      this.emit('modal:error', error);
      throw error;
    }
  }

  /**
   * Helper: Create button response (update message)
   */
  static createUpdateResponse(text: string, blocks?: any[]): any {
    return {
      text,
      blocks,
      replace_original: true,
    };
  }

  /**
   * Helper: Create ephemeral follow-up
   */
  static createEphemeralResponse(text: string): any {
    return {
      text,
      replace_original: false,
      response_type: 'ephemeral',
    };
  }

  /**
   * Helper: Delete original message
   */
  static createDeleteResponse(): any {
    return {
      delete_original: true,
    };
  }

  /**
   * Helper: Create confirmation modal
   */
  static createConfirmationModal(
    callbackId: string,
    title: string,
    message: string,
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ): ModalView {
    return {
      type: 'modal',
      callback_id: callbackId,
      title: {
        type: 'plain_text',
        text: title,
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
      submit: {
        type: 'plain_text',
        text: confirmText,
      },
      close: {
        type: 'plain_text',
        text: cancelText,
      },
    };
  }

  /**
   * Helper: Create input modal
   */
  static createInputModal(
    callbackId: string,
    title: string,
    fields: Array<{
      blockId: string;
      label: string;
      placeholder?: string;
      multiline?: boolean;
      required?: boolean;
    }>
  ): ModalView {
    const blocks = fields.map((field) => ({
      type: 'input',
      block_id: field.blockId,
      label: {
        type: 'plain_text',
        text: field.label,
      },
      element: {
        type: field.multiline ? 'plain_text_input' : 'plain_text_input',
        action_id: `${field.blockId}_action`,
        placeholder: field.placeholder
          ? {
              type: 'plain_text',
              text: field.placeholder,
            }
          : undefined,
        multiline: field.multiline,
      },
      optional: !field.required,
    }));

    return {
      type: 'modal',
      callback_id: callbackId,
      title: {
        type: 'plain_text',
        text: title,
      },
      blocks: blocks as any,
      submit: {
        type: 'plain_text',
        text: 'Submit',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
    };
  }

  /**
   * Helper: Create select modal
   */
  static createSelectModal(
    callbackId: string,
    title: string,
    label: string,
    options: Array<{ text: string; value: string }>,
    placeholder?: string
  ): ModalView {
    return {
      type: 'modal',
      callback_id: callbackId,
      title: {
        type: 'plain_text',
        text: title,
      },
      blocks: [
        {
          type: 'input',
          block_id: 'select_block',
          label: {
            type: 'plain_text',
            text: label,
          },
          element: {
            type: 'static_select',
            action_id: 'select_action',
            placeholder: {
              type: 'plain_text',
              text: placeholder || 'Select an option',
            },
            options: options.map((opt) => ({
              text: {
                type: 'plain_text',
                text: opt.text,
              },
              value: opt.value,
            })),
          },
        } as any,
      ],
      submit: {
        type: 'plain_text',
        text: 'Submit',
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
      },
    };
  }
}

/**
 * Example action handlers
 */
export class ExampleActions {
  /**
   * Approve button handler
   */
  static approve: ActionHandler = async (payload, respond) => {
    await respond(
      ActionHandlerManager.createUpdateResponse(
        '✅ Approved!',
        [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Approved* by <@${payload.user.id}>`,
            },
          },
        ]
      )
    );
  };

  /**
   * Reject button handler
   */
  static reject: ActionHandler = async (payload, respond) => {
    await respond(
      ActionHandlerManager.createUpdateResponse(
        '❌ Rejected!',
        [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `❌ *Rejected* by <@${payload.user.id}>`,
            },
          },
        ]
      )
    );
  };

  /**
   * Delete button handler
   */
  static delete: ActionHandler = async (payload, respond) => {
    await respond(ActionHandlerManager.createDeleteResponse());
  };

  /**
   * Select menu handler
   */
  static handleSelect: ActionHandler = async (payload, respond) => {
    const selectedOption = payload.actions[0]?.selected_option;
    if (selectedOption) {
      await respond(
        ActionHandlerManager.createEphemeralResponse(
          `You selected: ${selectedOption.text.text}`
        )
      );
    }
  };
}
