import { Repository, In, Not, DataSource } from 'typeorm';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from 'src/module/common/redis/redis.service';
import { UploadService } from 'src/module/upload/upload.service';
import * as bcrypt from 'bcryptjs';
import { Uniq } from 'src/common/utils/index';

import { CacheEnum, DelFlagEnum, StatusEnum } from 'src/common/enum/index';
import { SYS_USER_TYPE, LOGIN_TOKEN_EXPIRESIN } from 'src/common/constant/index';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, paginate } from 'src/common/query';
import { CreateUserDto, UpdateUserDto, ListUserDto, ChangeStatusDto, ResetPwdDto, UpdateProfileDto, UpdatePwdDto } from './dto/index';

import { UserEntity } from './entities/sys-user.entity';
import { SysUserWithRoleEntity } from './entities/user-width-role.entity';
import { RoleService } from '../role/role.service';

import { SysRoleEntity } from '../role/entities/role.entity';
import { SysMenuEntity } from '../menu/entities/menu.entity';
import { UserType } from './dto/user';
import { Cacheable, CacheEvict } from 'src/common/decorators/redis.decorator';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SysUserWithRoleEntity)
    private readonly sysUserWithRoleEntityRep: Repository<SysUserWithRoleEntity>,
    private readonly roleService: RoleService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly uploadService: UploadService,
  ) {}
  /**
   * 后台创建用户
   * @param createUserDto
   * @returns
   */
  async create(createUserDto: CreateUserDto) {
    // 检查用户账号是否已存在
    const existUser = await this.userRepo.findOne({
      where: {
        userName: createUserDto.userName,
        delFlag: '0',
      },
      select: ['userId', 'userName'],
    });

    if (existUser) {
      throw new BadRequestException(`新增用户'${createUserDto.userName}'失败，登录账号已存在`);
    }

    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    }

    let res;
    try {
      // 用户与角色关联写入打包为事务，任一步失败整体回滚
      res = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(UserEntity, { ...createUserDto, userType: SYS_USER_TYPE.CUSTOM });
        if (createUserDto.roleIds?.length) {
          await manager.insert(SysUserWithRoleEntity, createUserDto.roleIds.map((id) => ({ userId: user.userId, roleId: id })));
        }
        return user;
      });
    } catch (error) {
      // 并发新增撞车时前置查重拦不住，靠 user_name 唯一索引兜底（ER_DUP_ENTRY）
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(`新增用户'${createUserDto.userName}'失败，登录账号已存在`);
      }
      throw error;
    }

    return ResultData.ok();
  }

  /**
   * 用户列表
   * @param query
   * @returns
   */
  async findAll(query: ListUserDto) {
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where('user.delFlag = :delFlag', { delFlag: '0' });

    applyLike(entity, 'user.userName', query.userName);
    applyLike(entity, 'user.phonenumber', query.phonenumber);
    applyLike(entity, 'user.signature', query.signature);

    if (query.status) {
      entity.andWhere('user.status = :status', { status: query.status });
    }

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('user.createTime BETWEEN :start AND :end', { start: query.params.beginTime, end: query.params.endTime });
    }

    paginate(entity, query);

    const [list, total] = await entity.getManyAndCount();

    const safeList = list.map(({ password: _password, ...user }) => user);

    return ResultData.ok({
      list: safeList,
      total,
    });
  }

  /**
   * 用户角色信息
   * @returns
   */
  async findRoleAll() {
    const roles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
      },
    });

    return ResultData.ok({
      roles,
    });
  }

  /**
   * 用户公开资料（guest 公开）：仅昵称与头像，与文章列表携带的 userInfo 同口径；
   * 供他人空间资料卡使用——零文章用户的空间此前只能从文章行捎带资料，取不到时显示占位名。
   * 用户不存在/已删除时返回 null，前端降级占位展示
   */
  async findGuestProfile(userId: number) {
    if (!userId || userId < 1) {
      return ResultData.ok(null);
    }
    const data = await this.userRepo.findOne({
      where: { userId, delFlag: '0' },
      select: ['userId', 'nickName', 'avatar'],
    });
    return ResultData.ok(data ? { userId: data.userId, nickName: data.nickName, avatar: data.avatar || null } : null);
  }

  @Cacheable(CacheEnum.SYS_USER_KEY, '{userId}')
  async findOne(userId: number) {
    const data = await this.userRepo.findOne({
      where: {
        delFlag: '0',
        userId: userId,
      },
    });
    if (!data) throw new BadRequestException('用户不存在');

    const roleIds = await this.getRoleIds([userId]);
    const allRoles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
      },
    });

    data['roles'] = allRoles.filter((item) => roleIds.includes(item.roleId));

    // 剥离密码哈希，避免泄漏到响应与缓存值
    const { password: _password, ...safeData } = data;
    return ResultData.ok({
      data: safeData,
      roles: allRoles,
      roleIds,
    });
  }

  /**
   * 更新用户
   * @param updateUserDto
   * @returns
   */
  @CacheEvict(CacheEnum.SYS_USER_KEY, '{updateUserDto.userId}')
  async update(updateUserDto: UpdateUserDto, userId: number) {
    //不能修改超级管理员
    if (updateUserDto.userId === 1) throw new BadRequestException('非法操作！');

    //过滤掉设置超级管理员角色
    if (updateUserDto.roleIds && Array.isArray(updateUserDto.roleIds)) {
      updateUserDto.roleIds = updateUserDto.roleIds.filter((v) => v !== 1);
    }

    //当前用户不能修改自己的状态
    if (updateUserDto.userId === userId) {
      delete updateUserDto.status;
    }

    // 角色关联的"先删后插"与用户信息更新打包为事务，任一步失败整体回滚
    // （原实现散装多表写入且插入漏 await，中断时会留下删了旧关联但没插新关联的半成品）
    const data = await this.dataSource.transaction(async (manager) => {
      if (updateUserDto?.roleIds !== undefined) {
        //用户已有角色，先删除所有关联角色
        await manager.delete(SysUserWithRoleEntity, {
          userId: updateUserDto.userId,
        });
        // 只有当 roleIds 不为空时才插入新记录
        if (updateUserDto.roleIds && updateUserDto.roleIds.length > 0) {
          await manager.insert(
            SysUserWithRoleEntity,
            updateUserDto.roleIds.map((id) => ({ userId: updateUserDto.userId, roleId: id })),
          );
        }
      }

      const dto = { ...updateUserDto };
      delete dto.password;
      delete (dto as any).dept;
      delete (dto as any).roles;
      delete (dto as any).roleIds;

      //更新用户信息
      return await manager.update(UserEntity, { userId: updateUserDto.userId }, dto);
    });
    return ResultData.ok(data);
  }

  @CacheEvict(CacheEnum.SYS_USER_KEY, '{userId}')
  clearCacheByUserId(userId: number) {
    return userId;
  }

  /**
   * 清除用户菜单缓存
   * @param userId
   */
  async clearUserMenuCache(userId: number) {
    const cacheKey = `${CacheEnum.SYS_MENU_KEY}${userId}`;
    await this.redisService.del(cacheKey);
  }

  /**
   * 获取角色Id列表
   * @param userId
   * @returns
   */
  async getRoleIds(userIds: Array<number>) {
    const roleList = await this.sysUserWithRoleEntityRep.find({
      where: {
        userId: In(userIds),
      },
      select: ['roleId'],
    });
    const roleIds = roleList.map((item) => item.roleId);
    return Uniq(roleIds);
  }

  /**
   * 获取权限列表
   * @param userId
   * @returns
   */
  async getUserPermissions(userId: number) {
    // 超级管理员 - 根据角色赋予 权限
    // if (userId === 1) {
    //   return ['*:*:*'];
    // }
    const roleIds = await this.getRoleIds([userId]);
    const list = await this.roleService.getPermissionsByRoleIds(roleIds);
    const permissions = Uniq(list.map((item: SysMenuEntity) => item.perms)).filter((item) => {
      return item;
    });
    return permissions;
  }

  /**
   * 获取用户信息
   */
  async getUserinfo(userId: number): Promise<{ roles: Array<SysRoleEntity> } & UserEntity> {
    const roleIds = await this.getRoleIds([userId]);

    const roles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
        roleId: In(roleIds),
      },
    });

    const data = await this.userRepo.findOne({
      where: {
        userId: userId,
        delFlag: DelFlagEnum.NORMAL,
      },
    });
    if (!data) throw new BadRequestException('用户不存在');

    const result = {
      ...data,
      roles,
    };

    return result;
  }

  /**
   * 踢掉指定用户的全部在线会话
   * 删除/停用/重置密码后必须调用：身份验证只查 Redis 会话快照、不回查用户表，不踢则已登录会话在过期前持续有效
   * @param userIds
   */
  private async kickUserSessions(userIds: number[]) {
    if (!userIds?.length) return;
    const keys = await this.redisService.keys(`${CacheEnum.LOGIN_TOKEN_KEY}*`);
    if (!keys.length) return;
    const sessions = await this.redisService.mget(keys);
    const delKeys = keys.filter((key, index) => userIds.includes(sessions[index]?.userId));
    if (delKeys.length) {
      await this.redisService.del(delKeys);
    }
  }

  /**
   * 重置密码
   * @param body
   * @returns
   */
  @CacheEvict(CacheEnum.SYS_USER_KEY, '{body.userId}')
  async resetPwd(body: ResetPwdDto) {
    if (body.userId === 1) {
      throw new BusinessException(500, '系统用户不能重置密码');
    }
    if (body.password) {
      body.password = await bcrypt.hash(body.password, 10);
    }
    await this.userRepo.update(
      {
        userId: body.userId,
      },
      {
        password: body.password,
      },
    );
    // 重置密码后立即踢掉全部在线会话，确保旧凭据即刻失效
    await this.kickUserSessions([body.userId]);
    return ResultData.ok();
  }

  /**
   * 批量删除用户
   * @param ids
   * @returns
   */
  async remove(ids: number[]) {
    // 忽略系统用户的删除
    const targets = await this.userRepo.find({
      where: {
        userId: In(ids),
        userType: Not(SYS_USER_TYPE.SYS),
      },
      select: ['userId'],
    });
    let data = null;
    if (targets.length) {
      data = await this.userRepo.update(
        { userId: In(targets.map((t) => t.userId)) },
        {
          delFlag: '1',
        },
      );
      // 被删用户的在线会话立即失效，避免已登录会话继续操作
      await this.kickUserSessions(targets.map((t) => t.userId));
    }
    return ResultData.ok(data);
  }

  /**
   * 角色详情
   * @param id
   * @returns
   */
  async authRole(userId: number) {
    const allRoles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
      },
    });

    const user = await this.userRepo.findOne({
      where: {
        delFlag: '0',
        userId: userId,
      },
    });

    const roleIds = await this.getRoleIds([userId]);
    // flag 给前端表格标记选中状态
    // 原写法 filter 两分支都 return true（恒真），语义实为「全量标记 flag」：改 forEach 只做标记
    allRoles.forEach((item) => {
      if (roleIds.includes(item.roleId)) {
        item['flag'] = true;
      }
    });
    user['roles'] = allRoles;

    return ResultData.ok({
      roles: allRoles,
      user,
    });
  }

  /**
   * 更新用户角色信息
   * @param query
   * @returns
   */
  async updateAuthRole(query) {
    const roleIds = query.roleIds.split(',');
    if (roleIds?.length > 0) {
      // 角色关联"先删后插"打包为事务，任一步失败整体回滚
      await this.dataSource.transaction(async (manager) => {
        //用户已有角色,先删除所有关联角色
        await manager.delete(SysUserWithRoleEntity, {
          userId: query.userId,
        });
        await manager.insert(
          SysUserWithRoleEntity,
          roleIds.map((id) => ({ userId: query.userId, roleId: id })),
        );
      });
    }

    // 清除用户菜单缓存
    await this.clearUserMenuCache(query.userId);

    return ResultData.ok();
  }

  /**
   * 修改用户状态
   * @param changeStatusDto
   * @returns
   */
  @CacheEvict(CacheEnum.SYS_USER_KEY, '{changeStatusDto.userId}')
  async changeStatus(changeStatusDto: ChangeStatusDto) {
    const userData = await this.userRepo.findOne({
      where: {
        userId: changeStatusDto.userId,
      },
      select: ['userType'],
    });
    if (!userData) throw new BadRequestException('用户不存在');
    if (userData.userType === SYS_USER_TYPE.SYS) {
      throw new BusinessException(500, '系统角色不可停用');
    }

    const res = await this.userRepo.update(
      { userId: changeStatusDto.userId },
      {
        status: changeStatusDto.status,
      },
    );
    // 停用用户的在线会话立即失效（启用无需处理）
    if (changeStatusDto.status === StatusEnum.STOP) {
      await this.kickUserSessions([changeStatusDto.userId]);
    }
    return ResultData.ok(res);
  }

  /**
   * 更新 Redis 会话中的角色/权限快照
   * 管理端修改用户角色后调用，使新授权对在线会话即刻生效（原下沉自 auth.service，会话刷新统一收口到本服务）
   * @param uuid 当前会话 token
   * @param userId 被更新的用户 ID
   */
  async updateRedisUserRolesAndPermissions(uuid: string, userId: number) {
    const userData = await this.getUserinfo(userId);

    const permissions = await this.getUserPermissions(userId);
    const roles = userData.roles.map((item) => item.roleKey);

    const cacheKey = `${CacheEnum.LOGIN_TOKEN_KEY}${uuid}`;
    const oldMetaData = await this.redisService.get(cacheKey);
    const newMetaData = { permissions, roles };
    if (oldMetaData) {
      Object.assign(oldMetaData, newMetaData);
    }
    await this.redisService.set(cacheKey, oldMetaData ?? newMetaData, LOGIN_TOKEN_EXPIRESIN);
  }

  /**
   * 个人中心 - 上传头像：文件落地（复用 upload 模块）+ 头像字段落库 + 刷新当前会话快照
   * @param userId 用户 ID
   * @param file 头像文件（FileInterceptor 挂到 /profile/avatar）
   * @param authorName 上传记录的作者名（用户昵称或用户名）
   * @param token 当前用户的 token（可选）
   * @returns 头像访问 URL
   */
  async uploadAvatar(userId: number, file: Express.Multer.File, authorName: string, token?: string): Promise<string> {
    // 上传失败（超限/类型不合规）由 singleFileUpload throw BusinessException 统一出信封，不再有失败信封返回值
    const res = await this.uploadService.singleFileUpload(file, 'avatar', authorName);
    await this.updateUserAvatar(userId, res.url, token);
    return res.url;
  }

  /**
   * 个人中心-用户信息
   * @param user
   * @returns
   */
  async profile(user) {
    return ResultData.ok(user);
  }

  /**
   * 个人中心 - 用户信息
   * @param user
   * @returns
   */
  async updateProfile(user: UserType, updateProfileDto: UpdateProfileDto) {
    // 只允许更新允许的字段；未提交（undefined）的字段不参与更新——否则刷 Redis 会话时会把没传的旧值（如 avatar）洗掉
    const allowedFields = Object.fromEntries(
      Object.entries({
        nickName: updateProfileDto.nickName,
        email: updateProfileDto.email,
        phonenumber: updateProfileDto.phonenumber,
        sex: updateProfileDto.sex,
        avatar: updateProfileDto.avatar,
        signature: updateProfileDto.signature,
      }).filter(([, value]) => value !== undefined),
    );

    await this.userRepo.update({ userId: user.user.userId }, allowedFields);

    // 更新 Redis 中的用户信息
    const userData = await this.redisService.get(`${CacheEnum.LOGIN_TOKEN_KEY}${user.token}`);
    if (userData) {
      userData.user = Object.assign(userData.user, allowedFields);
      await this.redisService.set(`${CacheEnum.LOGIN_TOKEN_KEY}${user.token}`, userData);
    }

    return ResultData.ok();
  }

  /**
   * 个人中心 - 更新用户头像
   * @param userId 用户 ID
   * @param avatarUrl 头像 URL
   * @param token 当前用户的 token（可选）
   */
  async updateUserAvatar(userId: number, avatarUrl: string, token?: string) {
    try {
      // 方式 2: 使用 queryRunner 显式事务
      const queryRunner = this.userRepo.manager.connection.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // 查询用户
        const user = await queryRunner.manager.findOne(UserEntity, { where: { userId } });
        if (!user) {
          throw new Error(`用户 ${userId} 不存在`);
        }

        // 修改头像
        user.avatar = avatarUrl;

        // 保存
        await queryRunner.manager.save(user);

        // 提交事务
        await queryRunner.commitTransaction();

        // 再次查询确认（直接查数据库）
        const verifyUser = await this.userRepo.findOne({ where: { userId } });
      } catch (error) {
        // 回滚事务
        await queryRunner.rollbackTransaction();
        console.error('❌ [updateUserAvatar] 事务回滚:', error);
        throw error;
      } finally {
        await queryRunner.release();
      }

      // 更新 Redis 中的用户信息 - 只更新当前 token 对应的数据
      if (token) {
        const cacheKey = `${CacheEnum.LOGIN_TOKEN_KEY}${token}`;
        const userData = await this.redisService.get(cacheKey);

        if (userData && userData.user?.userId === userId) {
          userData.user.avatar = avatarUrl;

          const setResult = await this.redisService.set(cacheKey, userData);

          // 验证是否真的更新了
          const verifyData = await this.redisService.get(cacheKey);
        } else {
          console.warn('⚠️ [updateUserAvatar] 未找到匹配的 token 数据');
        }
      }
    } catch (error) {
      console.error('❌ [updateUserAvatar] 更新失败:', error);
      throw error;
    }
  }

  /**
   * 个人中心-修改密码
   * @param user
   * @param updatePwdDto
   * @returns
   */
  async updatePwd(user: UserType, updatePwdDto: UpdatePwdDto) {
    if (updatePwdDto.oldPassword === updatePwdDto.newPassword) {
      throw new BusinessException(500, '新密码不能与旧密码相同');
    }
    // 旧密码校验：compare(明文, 哈希)——此前参数顺序颠倒导致校验形同虚设
    if (!(await bcrypt.compare(updatePwdDto.oldPassword, user.user.password))) {
      throw new BusinessException(500, '修改密码失败，旧密码错误');
    }

    const password = await bcrypt.hash(updatePwdDto.newPassword, 10);
    await this.userRepo.update({ userId: user.user.userId }, { password: password });
    return ResultData.ok();
  }

}
