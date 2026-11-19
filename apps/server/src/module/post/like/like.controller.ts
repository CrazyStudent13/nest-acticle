import { Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostLikeService } from './like.service';
import { ListLikeDto, ListMyLikeDto } from './dto/index';
import { RequirePermission } from 'src/common/decorators/require-premission.decorator';
import { User, UserDto } from 'src/module/system/user/user.decorator';

/**
 * 点赞控制器
 * - 写路径（点赞/取消/状态）与我的点赞列表面向登录用户，只要求 JWT，不挂权限串
 * - 管理路径（列表/批量删除）挂 post:like:* 权限串
 * 注意：/batch/:ids 必须声明在 /:articleId 之前，否则会被动态段吞掉
 */
@ApiTags('点赞管理')
@Controller('post/like')
export class PostLikeController {
  constructor(private readonly likeService: PostLikeService) {}

  /**
   * 我的点赞文章列表（个人空间点赞栏，按登录态返回本人数据）
   */
  @ApiOperation({ summary: '点赞-我的点赞文章列表' })
  @Get('/my/list')
  findMyList(@Query() query: ListMyLikeDto, @User() user: UserDto) {
    return this.likeService.findMyList(user.userId, query);
  }

  /**
   * 点赞管理列表（管理端）
   */
  @ApiOperation({ summary: '点赞-管理列表' })
  @RequirePermission('post:like:list')
  @Get('/list')
  findAdminList(@Query() query: ListLikeDto) {
    return this.likeService.findAdminList(query);
  }

  /**
   * 批量删除点赞记录（管理端，回减文章点赞数）
   */
  @ApiOperation({ summary: '点赞-批量删除' })
  @RequirePermission('post:like:remove')
  @Delete('/batch/:ids')
  removeByIds(@Param('ids') ids: string) {
    return this.likeService.removeByIds(ids.split(',').map((id) => +id));
  }

  /**
   * 点赞
   */
  @ApiOperation({ summary: '点赞-点赞' })
  @HttpCode(200)
  @Post('/:articleId')
  like(@Param('articleId') articleId: string, @User() user: UserDto) {
    return this.likeService.like(+articleId, user.userId);
  }

  /**
   * 取消点赞
   */
  @ApiOperation({ summary: '点赞-取消' })
  @Delete('/:articleId')
  unlike(@Param('articleId') articleId: string, @User() user: UserDto) {
    return this.likeService.unlike(+articleId, user.userId);
  }

  /**
   * 当前用户对文章的点赞状态
   */
  @ApiOperation({ summary: '点赞-状态' })
  @Get('/status/:articleId')
  status(@Param('articleId') articleId: string, @User() user: UserDto) {
    return this.likeService.status(+articleId, user.userId);
  }
}
