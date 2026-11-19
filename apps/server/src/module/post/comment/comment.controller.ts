import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostCommentService } from './comment.service';
import { CreateCommentDto, ListCommentDto, ListCommentGuestDto } from './dto/index';
import { RequirePermission } from 'src/common/decorators/require-premission.decorator';
import { NotRequireAuth, User, UserDto } from 'src/module/system/user/user.decorator';

/**
 * 评论控制器
 * - guest 列表公开；发表/删除自己的评论只要求 JWT，不挂权限串
 * - 管理路径（列表/批量删除）挂 post:comment:* 权限串
 * 注意：/batch/:ids 必须声明在 /:id 之前，否则会被动态段吞掉
 */
@ApiTags('评论管理')
@Controller('post/comment')
export class PostCommentController {
  constructor(private readonly commentService: PostCommentService) {}

  /**
   * 评论 guest 列表（公开）
   */
  @ApiOperation({ summary: '评论-游客列表' })
  @NotRequireAuth()
  @Get('/guest/list')
  findGuestList(@Query() query: ListCommentGuestDto) {
    return this.commentService.findGuestList(query);
  }

  /**
   * 评论管理列表（管理端）
   */
  @ApiOperation({ summary: '评论-管理列表' })
  @RequirePermission('post:comment:list')
  @Get('/list')
  findAdminList(@Query() query: ListCommentDto) {
    return this.commentService.findAdminList(query);
  }

  /**
   * 批量删除评论（管理端，回减文章评论数）
   */
  @ApiOperation({ summary: '评论-批量删除' })
  @RequirePermission('post:comment:remove')
  @Delete('/batch/:ids')
  removeByIds(@Param('ids') ids: string) {
    return this.commentService.removeByIds(ids.split(',').map((id) => +id));
  }

  /**
   * 发表评论（登录用户）
   */
  @ApiOperation({ summary: '评论-发表' })
  @HttpCode(200)
  @Post()
  create(@Body() dto: CreateCommentDto, @User() user: UserDto) {
    return this.commentService.create(dto, user.userId);
  }

  /**
   * 删除自己的评论
   */
  @ApiOperation({ summary: '评论-删除自己的评论' })
  @Delete('/:id')
  removeOwn(@Param('id') id: string, @User() user: UserDto) {
    return this.commentService.removeOwn(+id, user.userId);
  }
}
