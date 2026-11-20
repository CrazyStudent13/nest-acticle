import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, FindManyOptions, DataSource } from 'typeorm';
import { Response } from 'express';
import { ResultData } from 'src/common/utils/result';
import { applyLike, paginate } from 'src/common/query';
import { ExportTable } from 'src/common/utils/export';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CacheEnum } from 'src/common/enum/index';
import { SysUserWithRoleEntity } from '../user/entities/user-width-role.entity';
import { UserEntity } from '../user/entities/sys-user.entity';
import { AllocatedListDto } from '../user/dto/index';

import { SysRoleEntity } from './entities/role.entity';
import { SysRoleWithMenuEntity } from './entities/role-width-menu.entity';
import { MenuService } from '../menu/menu.service';
import { CreateRoleDto, UpdateRoleDto, ListRoleDto, ChangeStatusDto, AuthUserCancelDto, AuthUserCancelAllDto, AuthUserSelectAllDto } from './dto/index';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(SysRoleEntity)
    private readonly sysRoleEntityRep: Repository<SysRoleEntity>,
    @InjectRepository(SysRoleWithMenuEntity)
    private readonly sysRoleWithMenuEntityRep: Repository<SysRoleWithMenuEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SysUserWithRoleEntity)
    private readonly sysUserWithRoleEntityRep: Repository<SysUserWithRoleEntity>,
    private readonly menuService: MenuService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}
  async create(createRoleDto: CreateRoleDto) {
    // 角色与菜单关联写入打包为事务，任一步失败整体回滚
    const res = await this.dataSource.transaction(async (manager) => {
      const role = await manager.save(SysRoleEntity, createRoleDto);
      if (createRoleDto.menuIds?.length) {
        await manager.insert(SysRoleWithMenuEntity, createRoleDto.menuIds.map((id) => ({ roleId: role.roleId, menuId: id })));
      }
      return role;
    });
    return ResultData.ok(res);
  }

  async findAll(query: ListRoleDto) {
    const entity = this.sysRoleEntityRep.createQueryBuilder('entity');
    entity.where('entity.delFlag = :delFlag', { delFlag: '0' });

    applyLike(entity, 'entity.roleName', query.roleName);
    applyLike(entity, 'entity.roleKey', query.roleKey);

    if (query.roleId) {
      entity.andWhere('entity.roleId = :roleId', { roleId: query.roleId });
    }

    if (query.status) {
      entity.andWhere('entity.status = :status', { status: query.status });
    }

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('entity.createTime BETWEEN :start AND :end', { start: query.params.beginTime, end: query.params.endTime });
    }

    paginate(entity, query);
    const [list, total] = await entity.getManyAndCount();

    return ResultData.ok({
      list,
      total,
    });
  }

  async findOne(roleId: number) {
    const res = await this.sysRoleEntityRep.findOne({
      where: {
        roleId: roleId,
        delFlag: '0',
      },
    });
    return ResultData.ok(res);
  }

  async update(updateRoleDto: UpdateRoleDto) {
    const values = (updateRoleDto.menuIds ?? []).map((id) => {
      return {
        roleId: updateRoleDto.roleId,
        menuId: id,
      };
    });
    const dto = { ...updateRoleDto };
    delete (dto as any).menuIds;

    // 菜单关联"先删后插"与角色信息更新打包为事务，任一步失败整体回滚
    const res = await this.dataSource.transaction(async (manager) => {
      //角色已关联菜单，直接删除（无关联时删除为空操作，等价于原"查有则删"）
      await manager.delete(SysRoleWithMenuEntity, {
        roleId: updateRoleDto.roleId,
      });
      if (values.length) {
        await manager.insert(SysRoleWithMenuEntity, values);
      }
      return await manager.update(SysRoleEntity, { roleId: updateRoleDto.roleId }, dto);
    });

    // 清除拥有该角色的所有用户的菜单缓存
    await this.clearRoleMenuCache(updateRoleDto.roleId);

    return ResultData.ok(res);
  }

  async changeStatus(changeStatusDto: ChangeStatusDto) {
    const res = await this.sysRoleEntityRep.update(
      { roleId: changeStatusDto.roleId },
      {
        status: changeStatusDto.status,
      },
    );
    return ResultData.ok(res);
  }

  async remove(roleIds: number[]) {
    const data = await this.sysRoleEntityRep.update(
      { roleId: In(roleIds) },
      {
        delFlag: '1',
      },
    );
    return ResultData.ok(data);
  }

  async findRoles(where: FindManyOptions<SysRoleEntity>) {
    return await this.sysRoleEntityRep.find(where);
  }
  /**
   * 根据角色获取用户权限列表
   */
  async getPermissionsByRoleIds(roleIds: number[]) {
    if (roleIds.includes(1)) return [{ perms: '*:*:*' }]; //当角色为超级管理员时，开放所有权限
    const list = await this.sysRoleWithMenuEntityRep.find({
      where: {
        roleId: In(roleIds),
      },
      select: ['menuId'],
    });
    const menuIds = list.map((item) => item.menuId);
    const permission = await this.menuService.findMany({
      where: { delFlag: '0', status: '0', menuId: In(menuIds) },
    });
    return permission;
  }

  /**
   * 清除拥有该角色的所有用户的菜单缓存
   * @param roleId
   */
  async clearRoleMenuCache(roleId: number) {
    try {
      // 查询拥有该角色的所有用户
      const usersWithRole = await this.sysRoleWithMenuEntityRep.manager.query('SELECT DISTINCT userId FROM sys_user_with_role WHERE roleId = ?', [roleId]);

      // 清除每个用户的菜单缓存
      for (const user of usersWithRole) {
        const cacheKey = `${CacheEnum.SYS_MENU_KEY}${user.userId}`;
        await this.redisService.del(cacheKey);
      }
    } catch (error) {
      console.error('清除角色菜单缓存失败:', error);
    }
  }

  /**
   * 导出角色管理数据为xlsx
   * @param res
   */
  async export(res: Response, body: ListRoleDto) {
    delete body.pageNum;
    delete body.pageSize;
    const list = await this.findAll(body);
    const options = {
      sheetName: '角色数据',
      data: list.data.list,
      header: [
        { title: '角色编号', dataIndex: 'roleId' },
        { title: '角色名称', dataIndex: 'roleName', width: 15 },
        { title: '权限字符', dataIndex: 'roleKey' },
        { title: '显示顺序', dataIndex: 'roleSort' },
        { title: '状态', dataIndex: 'status' },
        { title: '创建时间', dataIndex: 'createTime', width: 15 },
      ],
    };
    ExportTable(options, res);
  }

  // ---------- 角色↔用户绑定（原在 user.service，端点属 /system/role 域；迁入后 RoleModule 不再依赖 UserModule） ----------

  /**
   * 获取角色已分配用户
   * @param query
   * @returns
   */
  async allocatedList(query: AllocatedListDto) {
    const roleWidthRoleList = await this.sysUserWithRoleEntityRep.find({
      where: {
        roleId: +query.roleId,
      },
      select: ['userId'],
    });
    if (roleWidthRoleList.length === 0) {
      return ResultData.ok({
        list: [],
        total: 0,
      });
    }
    const userIds = roleWidthRoleList.map((item) => item.userId);
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where('user.delFlag = :delFlag', { delFlag: '0' });
    entity.andWhere('user.status = :status', { status: '0' });
    entity.andWhere('user.userId IN (:...userIds)', { userIds: userIds });
    applyLike(entity, 'user.userName', query.userName);
    applyLike(entity, 'user.phonenumber', query.phonenumber);
    entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    const [list, total] = await entity.getManyAndCount();
    const safeList = list.map(({ password: _password, ...user }) => user);
    return ResultData.ok({
      list: safeList,
      total,
    });
  }

  /**
   * 获取角色未分配用户
   * @param query
   * @returns
   */
  async unallocatedList(query: AllocatedListDto) {
    const roleWidthRoleList = await this.sysUserWithRoleEntityRep.find({
      where: {
        roleId: +query.roleId,
      },
      select: ['userId'],
    });

    const userIds = roleWidthRoleList.map((item) => item.userId);
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where('user.delFlag = :delFlag', { delFlag: '0' });
    entity.andWhere('user.status = :status', { status: '0' });
    entity.andWhere({
      userId: Not(In(userIds)),
    });
    applyLike(entity, 'user.userName', query.userName);
    applyLike(entity, 'user.phonenumber', query.phonenumber);
    entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    const [list, total] = await entity.getManyAndCount();
    const safeList = list.map(({ password: _password, ...user }) => user);
    return ResultData.ok({
      list: safeList,
      total,
    });
  }

  /**
   * 用户解绑角色
   * @param data
   * @returns
   */
  async authUserCancel(data: AuthUserCancelDto) {
    await this.sysUserWithRoleEntityRep.delete({
      userId: data.userId,
      roleId: data.roleId,
    });
    return ResultData.ok();
  }

  /**
   * 用户批量解绑角色
   * @param data
   * @returns
   */
  async authUserCancelAll(data: AuthUserCancelAllDto) {
    const userIds = data.userIds.split(',').map((id) => +id);
    await this.sysUserWithRoleEntityRep.delete({
      userId: In(userIds),
      roleId: +data.roleId,
    });
    return ResultData.ok();
  }

  /**
   * 用户批量绑定角色
   * @param data
   * @returns
   */
  async authUserSelectAll(data: AuthUserSelectAllDto) {
    const userIds = data.userIds.split(',');
    const entitys = userIds.map((userId) => {
      const sysDeptEntityEntity = new SysUserWithRoleEntity();
      return Object.assign(sysDeptEntityEntity, {
        userId: userId,
        roleId: +data.roleId,
      });
    });
    await this.sysUserWithRoleEntityRep.save(entitys);
    return ResultData.ok();
  }
}
