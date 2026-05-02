import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TokenBlocklistService } from './token-blocklist.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env['JWT_SECRET'] ?? 'edai-dev-secret-change-in-production',
      signOptions: {
        expiresIn: '15m',
        issuer: 'edai-identity',
        audience: 'edai-services',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, TokenBlocklistService],
  exports: [AuthService, JwtAuthGuard, JwtModule, TokenBlocklistService],
})
export class AuthModule {}
