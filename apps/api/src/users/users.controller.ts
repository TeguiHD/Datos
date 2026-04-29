import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsEnum } from 'class-validator';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { UsersService } from './users.service';
import { requestContext } from '../common/request-context';

class CreateUserDto {
  @IsEmail() email!: string;
  @IsEnum(Role) role!: Role;
}

class SetRoleDto {
  @IsEnum(Role) role!: Role;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@CurrentUser() u: { id: string }, @Body() body: CreateUserDto, @Req() req: Request) {
    return this.users.create(u.id, body.email, body.role, requestContext(req));
  }

  @Patch(':id/role')
  setRole(
    @CurrentUser() u: { id: string },
    @Param('id') id: string,
    @Body() body: SetRoleDto,
    @Req() req: Request,
  ) {
    return this.users.setRole(u.id, id, body.role, requestContext(req));
  }

  @Post(':id/unlock')
  unlock(@CurrentUser() u: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.users.unlock(u.id, id, requestContext(req));
  }

  @Post(':id/totp/reset')
  resetTotp(@CurrentUser() u: { id: string }, @Param('id') id: string, @Req() req: Request) {
    return this.users.resetTotp(u.id, id, requestContext(req));
  }
}
