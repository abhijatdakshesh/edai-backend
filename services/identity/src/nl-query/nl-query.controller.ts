import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NlQueryService } from './nl-query.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';

// TODO(production): add @Throttle({ limit: 30, ttl: 60000 }) — 30 req/min per user
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'PRINCIPAL')
@Controller()
export class NlQueryController {
  constructor(private readonly svc: NlQueryService) {}

  @Post('nl-query')
  query(@Body() body: { query: string }) {
    return this.svc.query(body.query);
  }

  @Post('nl-query/suggestions')
  getSuggestions() {
    return { suggestions: NlQueryService.SUGGESTIONS };
  }
}
