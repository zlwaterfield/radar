import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { auth } from '../auth.config';
import * as crypto from 'crypto-js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Get Better Auth instance
   */
  getAuth() {
    return auth;
  }

  /**
   * Get user by ID with decrypted tokens
   */
  async getUserWithTokens(userId: string, decryptTokens = false) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      include: {
        accounts: true,
      },
    });

    if (!user || !decryptTokens) {
      return user;
    }

    // Decrypt tokens if requested
    return {
      ...user,
      slackBotToken: user.slackBotToken
        ? this.decryptToken(user.slackBotToken)
        : null,
      slackUserToken: user.slackUserToken
        ? this.decryptToken(user.slackUserToken)
        : null,
      slackRefreshToken: user.slackRefreshToken
        ? this.decryptToken(user.slackRefreshToken)
        : null,
      githubAccessToken: user.githubAccessToken
        ? this.decryptToken(user.githubAccessToken)
        : null,
      githubRefreshToken: user.githubRefreshToken
        ? this.decryptToken(user.githubRefreshToken)
        : null,
    };
  }

  /**
   * Encrypt external service tokens
   */
  private encryptToken(token: string): string {
    const secretKey = this.configService.get('app.secretKey')!;
    return crypto.AES.encrypt(token, secretKey).toString();
  }

  /**
   * Decrypt external service tokens
   */
  private decryptToken(encryptedToken: string): string {
    const secretKey = this.configService.get('app.secretKey')!;
    const bytes = crypto.AES.decrypt(encryptedToken, secretKey);
    return bytes.toString(crypto.enc.Utf8);
  }

  /**
   * Validate user session
   */
  async validateSession(sessionId: string) {
    try {
      const session = await this.databaseService.session.findUnique({
        where: { id: sessionId },
        include: {
          user: true,
        },
      });

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error('Error validating session:', error);
      return null;
    }
  }

  /**
   * Sign out user and cleanup sessions
   */
  async signOut(userId: string) {
    try {
      await this.databaseService.session.deleteMany({
        where: { userId },
      });

      this.logger.log(`User ${userId} signed out`);
    } catch (error) {
      this.logger.error(`Error signing out user ${userId}:`, error);
      throw error;
    }
  }
}
