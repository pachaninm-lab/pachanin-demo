import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      useFactory: () => ({
        node: process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200',
        auth: process.env.ELASTICSEARCH_PASSWORD
          ? { username: 'elastic', password: process.env.ELASTICSEARCH_PASSWORD }
          : undefined,
        maxRetries: 3,
        requestTimeout: 10000,
      }),
    }),
  ],
  providers: [SearchService],
  controllers: [SearchController],
  exports: [SearchService],
})
export class SearchModule {}
