import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserExcelService } from './user-excel.service';
import { UserController } from './user.controller';
import { UserEntity } from './entities/sys-user.entity';
import { SysUserWithRoleEntity } from './entities/user-width-role.entity';
import { SysRoleEntity } from '../role/entities/role.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, SysRoleEntity, SysUserWithRoleEntity])],
  controllers: [UserController],
  providers: [UserService, UserExcelService],
  exports: [UserService, UserExcelService],
})
export class UserModule {}
