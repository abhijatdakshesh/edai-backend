import { Module, forwardRef } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesGuard } from '../roles/roles.guard';
import { ParentPortalModule } from '../parent-portal/parent-portal.module';

@Module({
  // KAN-26: ParentPortalModule is imported via forwardRef so UsersService.create
  // can register an explicit parent → student link when role=PARENT.
  imports: [forwardRef(() => ParentPortalModule)],
  controllers: [UsersController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
