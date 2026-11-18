import { SysRoleEntity } from '../../role/entities/role.entity';
import { UserEntity } from '../entities/sys-user.entity';

export type UserType = {
  browser: string;
  ipaddr: string;
  loginLocation: string;
  loginTime: Date;
  os: string;
  permissions: string[];
  roles: string[];
  token: string;
  user: {
    roles: Array<SysRoleEntity>;
  } & UserEntity;
  userId: number;
  username: string;
};
