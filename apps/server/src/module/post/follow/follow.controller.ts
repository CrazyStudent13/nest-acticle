import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostFollowService } from './follow.service';
import { ListFollowDto, ListGuestFollowDto, ListMyFollowDto } from './dto/index';
import { RequirePermission } from 'src/common/decorators/require-premission.decorator';
import { NotRequireAuth, User, UserDto } from 'src/module/system/user/user.decorator';

/**
 * 关注控制器
 * - 写路径（关注/取消/状态）面向登录用户，只要求 JWT，不挂权限串
 * - guest/list 公开（个人空间关注/粉丝栏对访客开放，同掘金）；接口标注 NotRequireAuth
 *   后 guard 对有效 token 仍会填充 user（可选鉴权），服务端据此回填访问者视角按钮状态
 * - 管理路径（列表/批量删除）挂 post:follow:* 权限串
 * 注意：DELETE /batch/:ids 必须声明在 DELETE /:userId 之前，否则会被动态段吞掉
 */
@ApiTags('关注管理')
@Controller('post/follow')
export class PostFollowController {
  constructor(private readonly followService: PostFollowService) {}

  /**
   * 指定用户的关注/粉丝列表（公开：个人空间关注/粉丝栏本人/访客共用）
   */
  @ApiOperation({ summary: '关注-指定用户的公开关注/粉丝列表' })
  @NotRequireAuth()
  @Get('/guest/list')
  findGuestList(@Query() query: ListGuestFollowDto, @User() user?: UserDto) {
    return this.followService.findGuestList(query, user?.userId);
  }

  /**
   * 收到的关注列表（通知中心「新增粉丝」栏：谁关注了我，服务端按登录态过滤）
   */
  @ApiOperation({ summary: '关注-收到的关注列表' })
  @Get('/received/list')
  findReceivedList(@Query() query: ListMyFollowDto, @User() user: UserDto) {
    return this.followService.findReceivedList(user.userId, query);
  }

  /**
   * 关注管理列表（管理端）
   */
  @ApiOperation({ summary: '关注-管理列表' })
  @RequirePermission('post:follow:list')
  @Get('/list')
  findAdminList(@Query() query: ListFollowDto) {
    return this.followService.findAdminList(query);
  }

  /**
   * 批量删除关注记录（管理端，纯明细删除无计数回减）
   */
  @ApiOperation({ summary: '关注-批量删除' })
  @RequirePermission('post:follow:remove')
  @Delete('/batch/:ids')
  removeByIds(@Param('ids') ids: string) {
    return this.followService.removeByIds(ids.split(',').map((id) => +id));
  }

  /**
   * 当前用户对目标用户的关注状态（含互关与对方粉丝数）
   */
  @ApiOperation({ summary: '关注-状态' })
  @Get('/status/:userId')
  status(@Param('userId', ParseIntPipe) userId: number, @User() user: UserDto) {
    return this.followService.status(userId, user.userId);
  }

  /**
   * 关注
   */
  @ApiOperation({ summary: '关注-关注' })
  @HttpCode(200)
  @Post('/:userId')
  follow(@Param('userId', ParseIntPipe) userId: number, @User() user: UserDto) {
    return this.followService.follow(userId, user.userId);
  }

  /**
   * 取消关注
   */
  @ApiOperation({ summary: '关注-取消' })
  @Delete('/:userId')
  unfollow(@Param('userId', ParseIntPipe) userId: number, @User() user: UserDto) {
    return this.followService.unfollow(userId, user.userId);
  }
}
