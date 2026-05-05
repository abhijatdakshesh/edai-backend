import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    JwtModule.register({
      secret: (() => {
        const s = process.env['JWT_SECRET'];
        if (!s) throw new Error('JWT_SECRET environment variable is required');
        return s;
      })(),
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
