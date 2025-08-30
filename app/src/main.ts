import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Set global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: configService.get('app.corsOrigins'),
    credentials: true,
  });

  // Swagger documentation
  if (configService.get('app.environment') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Radar API')
      .setDescription(
        'A Slack application that connects to GitHub and tracks activity',
      )
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Health check endpoint
  app.getHttpAdapter().get('/', (req: any, res: any) => {
    res.json({
      message: 'Welcome to Radar API v2',
      status: 'healthy',
      environment: configService.get('app.environment'),
      timestamp: new Date().toISOString(),
    });
  });

  const port = configService.get('app.port');
  const host = configService.get('app.host');

  await app.listen(port, host);
  logger.log(`🚀 Application is running on: http://${host}:${port}`);

  if (configService.get('app.environment') !== 'production') {
    logger.log(
      `📚 API Documentation available at: http://${host}:${port}/api/docs`,
    );
  }
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
