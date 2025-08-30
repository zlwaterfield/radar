import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto-js';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Create a JWT token for API access
   */
  createApiToken(payload: {
    userId: string;
    provider?: string;
    [key: string]: any;
  }): string {
    return this.jwtService.sign(
      {
        sub: payload.userId,
        type: 'api_access',
        ...payload,
      },
      {
        expiresIn: `${this.configService.get('app.accessTokenExpire')}m`,
        issuer: this.configService.get('app.name'),
      },
    );
  }

  /**
   * Verify and decode JWT token
   */
  verifyApiToken(token: string): any {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.debug('Token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Encrypt external service tokens
   */
  encryptExternalToken(token: string): string {
    const secretKey = this.configService.get('app.secretKey')!;
    return crypto.AES.encrypt(token, secretKey).toString();
  }

  /**
   * Decrypt external service tokens
   */
  decryptExternalToken(encryptedToken: string): string {
    try {
      const secretKey = this.configService.get('app.secretKey')!;
      const bytes = crypto.AES.decrypt(encryptedToken, secretKey);
      return bytes.toString(crypto.enc.Utf8);
    } catch (error) {
      this.logger.error('Token decryption failed:', error);
      throw new Error('Failed to decrypt token');
    }
  }

  /**
   * Generate secure state token for OAuth flows
   */
  generateStateToken(data: Record<string, any>): string {
    const payload = {
      ...data,
      timestamp: Date.now(),
      nonce: crypto.lib.WordArray.random(16).toString(),
    };

    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return encoded;
  }

  /**
   * Verify and decode state token
   */
  verifyStateToken(token: string, maxAge = 600000): any {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      
      // Check if token is not too old (default 10 minutes)
      if (Date.now() - decoded.timestamp > maxAge) {
        throw new Error('State token expired');
      }

      return decoded;
    } catch (error) {
      this.logger.error('State token verification failed:', error);
      return null;
    }
  }
}