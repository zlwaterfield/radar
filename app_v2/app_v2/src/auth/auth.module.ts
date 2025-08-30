import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { TokenService } from './services/token.service';
import { AuthGuard } from './guards/auth.guard';
import { auth } from './auth.config';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('app.secretKey'),
        signOptions: {
          algorithm: configService.get('app.algorithm') as any,
        },
      }),
      inject: [ConfigService],
    }),
    BetterAuthModule.forRoot(auth),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuthGuard,
  ],
  exports: [
    AuthService,
    TokenService,
    AuthGuard,
  ],
})
export class RadarAuthModule {}