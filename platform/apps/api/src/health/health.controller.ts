import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';

@ApiTags('saúde')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'ok', time: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', database: 'unreachable' });
    }
  }
}
