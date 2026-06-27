import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExportTradeService, Currency, IncotermsCode } from './export-trade.service';

@UseGuards(RolesGuard)
@Roles('FARMER', 'BUYER', 'ADMIN', 'EXECUTIVE', 'ACCOUNTING', 'SUPPORT_MANAGER')
@Controller('export-trade')
export class ExportTradeController {
  constructor(private readonly exportTrade: ExportTradeService) {}

  @Get('incoterms')
  listIncoterms() {
    return this.exportTrade.listIncoterms();
  }

  @Post('incoterms/calculate')
  calculateIncoterms(
    @Body() body: {
      priceRub: number;
      incoterms: IncotermsCode;
      currency: Currency;
      distanceKm?: number;
      volumeTons?: number;
      includeInsurancePct?: number;
    },
  ) {
    return this.exportTrade.calculateIncotermsPrice(body);
  }

  @Get('exchange-rates')
  getExchangeRates() {
    return this.exportTrade.getExchangeRates();
  }

  @Post('convert')
  convert(@Body() body: { amountRub: number; toCurrency: Currency }) {
    return this.exportTrade.convertCurrency(body.amountRub, body.toCurrency);
  }

  @Get('customs/:dtNumber')
  getCustomsStatus(@Param('dtNumber') dtNumber: string) {
    return this.exportTrade.getCustomsDeclarationStatus(dtNumber);
  }

  @Post('customs/submit')
  submitCustoms(
    @Body() body: { goodsDescription: string; tnvedCode: string; totalValueRub: number },
  ) {
    return this.exportTrade.submitCustomsDeclaration(body);
  }

  @Post('phyto/apply')
  applyPhyto(
    @Body() body: { culture: string; volumeTons: number; producerInn: string; destinationCountry: string },
    @CurrentUser() user: any,
  ) {
    return this.exportTrade.applyForPhytoCertificate(body);
  }

  @Get('phyto/:certId')
  getPhytoStatus(@Param('certId') certId: string) {
    return this.exportTrade.getPhytoCertificateStatus(certId);
  }

  @Get('phyto')
  listPhyto(@Query('producerInn') producerInn: string) {
    return this.exportTrade.listPhytoCertificates(producerInn);
  }

  @Get('sanctions/:country')
  checkSanctions(@Param('country') country: string) {
    return this.exportTrade.checkSanctionedCountry(country);
  }

  @Get('vessels/:mmsi')
  getVesselPosition(@Param('mmsi') mmsi: string) {
    return this.exportTrade.getVesselPosition(mmsi);
  }

  @Get('vessels/:mmsi/route')
  getVesselRoute(@Param('mmsi') mmsi: string) {
    return this.exportTrade.getVesselRoute(mmsi);
  }

  @Get('vessels/:mmsi/port-calls')
  getVesselPortCalls(@Param('mmsi') mmsi: string) {
    return this.exportTrade.getVesselPortCalls(mmsi);
  }

  @Get('vessels')
  searchVessels(@Query('q') query: string, @Query('type') type?: string) {
    return this.exportTrade.searchVessels(query ?? '', type);
  }
}
