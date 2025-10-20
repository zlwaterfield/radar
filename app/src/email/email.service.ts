import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import PasswordResetEmail from './templates/password-reset';
import DigestEmail from './templates/digest';
import type { DigestPRCategory } from '../common/types/digest.types';

export interface SendPasswordResetEmailParams {
  to: string;
  resetUrl: string;
  expirationTime?: string;
}

export interface SendDigestEmailParams {
  to: string;
  configName?: string;
  scopeType?: string;
  teamName?: string;
  currentUserLogin?: string;
  digest: DigestPRCategory;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not found in environment variables. Email functionality will be disabled.',
      );
    }
    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@radar.app';
  }

  /**
   * Send a password reset email to the user
   */
  async sendPasswordResetEmail({
    to,
    resetUrl,
    expirationTime = '1 hour',
  }: SendPasswordResetEmailParams): Promise<void> {
    try {
      this.logger.log(`Sending password reset email to ${to}`);

      const emailHtml = await render(
        PasswordResetEmail({
          userEmail: to,
          resetUrl,
          expirationTime,
        }),
      );

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: 'Reset your Radar password',
        html: emailHtml,
      });

      if (error) {
        this.logger.error(
          `Failed to send password reset email to ${to}`,
          error,
        );
        throw new Error(`Failed to send email: ${error.message}`);
      }

      this.logger.log(
        `Password reset email sent successfully to ${to}. Email ID: ${data?.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error sending password reset email to ${to}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send a digest email to the user
   */
  async sendDigestEmail({
    to,
    configName,
    scopeType,
    teamName,
    currentUserLogin,
    digest,
  }: SendDigestEmailParams): Promise<{ id?: string }> {
    try {
      this.logger.log(`Sending digest email to ${to}`);

      const emailHtml = await render(
        DigestEmail({
          configName,
          scopeType,
          teamName,
          currentUserLogin,
          waitingOnUser: digest.waitingOnUser,
          approvedReadyToMerge: digest.approvedReadyToMerge,
          userOpenPRs: digest.userOpenPRs,
          userDraftPRs: digest.userDraftPRs,
          date: new Date().toLocaleDateString(),
        }),
      );

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject: configName
          ? `${configName} - Radar digest`
          : 'Radar digest - Your GitHub updates',
        html: emailHtml,
      });

      if (error) {
        this.logger.error(`Failed to send digest email to ${to}`, error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      this.logger.log(
        `Digest email sent successfully to ${to}. Email ID: ${data?.id}`,
      );
      return { id: data?.id };
    } catch (error) {
      this.logger.error(`Error sending digest email to ${to}`, error.stack);
      throw error;
    }
  }

  /**
   * Check if email service is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }
}
