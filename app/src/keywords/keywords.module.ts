import { Module } from '@nestjs/common';
import { KeywordService } from './services/keyword.service';
import { KeywordsController } from './controllers/keywords.controller';
import { DatabaseModule } from '../database/database.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [DatabaseModule, StripeModule],
  controllers: [KeywordsController],
  providers: [KeywordService],
  exports: [KeywordService],
})
export class KeywordsModule {}
