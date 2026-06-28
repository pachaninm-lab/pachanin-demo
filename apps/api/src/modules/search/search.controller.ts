import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('lots')
  async searchLots(
    @Query('q') q?: string,
    @Query('cropType') cropType?: string,
    @Query('region') region?: string,
    @Query('minVolume') minVolume?: string,
    @Query('maxVolume') maxVolume?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('size') size?: string,
  ) {
    return this.searchService.searchLots({
      q,
      cropType,
      region,
      minVolume: minVolume ? Number(minVolume) : undefined,
      maxVolume: maxVolume ? Number(maxVolume) : undefined,
      status,
      from: from ? Number(from) : undefined,
      size: size ? Math.min(Number(size), 100) : undefined,
    });
  }
}
