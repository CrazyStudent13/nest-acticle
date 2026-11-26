import { Controller, Get, Post, Body, Put, Param, Query, Delete, HttpCode, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { PostArticleService } from './article.service';
import { CreatePostArticleDto, UpdatePostArticleDto, ListPostArticleDto, AuditPostArticleDto } from './dto/index';
import { RequirePermission } from 'src/common/decorators/require-premission.decorator';
import { GetClientIp } from 'src/common/utils/index';
import { NotRequireAuth, User, UserDto } from 'src/module/system/user/user.decorator';

/**
 * 文章控制器
 * 提供文章的RESTful API接口
 */
@ApiTags('文章管理')
@Controller('post/article')
export class PostArticleController {
  constructor(private readonly postArticleService: PostArticleService) {}

  /**
   * 创建文章
   */
  @ApiOperation({ summary: '文章-创建' })
  @ApiBody({ type: CreatePostArticleDto, required: true })
  @RequirePermission('post:article:add')
  @Post()
  @HttpCode(200)
  create(@Body() createDto: CreatePostArticleDto, @User() user: UserDto) {
    return this.postArticleService.create(createDto, user);
  }

  /**
   * 查询文章列表（游客可访问，默认仅返回已发布文章；带登录态看自己的空间时已下架文章一并返回）
   */
  @ApiOperation({ summary: '文章-游客-列表' })
  @NotRequireAuth()
  @Get('/guest/list')
  findGuestAll(@Query() query: ListPostArticleDto, @User() user?: UserDto) {
    return this.postArticleService.findGuestAll(query, user);
  }

  /**
   * 查询文章详情（游客可访问，仅返回已发布文章；带登录态时已下架文章对作者本人/后台角色开放）
   */
  @ApiOperation({ summary: '文章-游客-详情' })
  @NotRequireAuth()
  @Get('/guest/detail')
  findGuestOne(@Query('id') id: number, @User() user?: UserDto) {
    return this.postArticleService.findGuestOne(id, user);
  }

  /**
   * 记录一次阅读（游客可访问，详情页打开时上报，阅读数原子自增）
   * 同一 IP 对同一文章 24 小时内重复上报静默返回、不计数
   */
  @ApiOperation({ summary: '文章-游客-记录阅读' })
  @NotRequireAuth()
  @HttpCode(200)
  @Post('/guest/read/:id')
  recordRead(@Param('id', ParseIntPipe) id: number, @Req() request: Request) {
    return this.postArticleService.recordRead(id, GetClientIp(request));
  }

  /**
   * 查询文章列表（管理员）
   */
  @ApiOperation({ summary: '文章-管理员-列表' })
  @RequirePermission('post:article:list')
  @Get('/list')
  findAll(@Query() query: ListPostArticleDto) {
    return this.postArticleService.findAll(query);
  }

  /**
   * 我的文章列表（登录用户，服务端强制只查自己的；创作者中心文章管理数据源）
   * 不挂权限串（同 comment/my/list 口径）：注册用户角色（member）没有 post:article:list，
   * 而管理端 /list 可查任意人（含他人草稿/审核字段），不能下放给普通用户
   */
  @ApiOperation({ summary: '文章-我的列表' })
  @Get('/my/list')
  findMyAll(@Query() query: ListPostArticleDto, @User() user: UserDto) {
    return this.postArticleService.findMyAll(query, user);
  }

  /**
   * 关注 feed（登录用户）：我关注的作者发布的文章，按发布时间倒序
   * 不挂权限串（同 /my/list 口径）：普通注册用户即可访问，只能看到已发布文章
   */
  @ApiOperation({ summary: '文章-关注 feed' })
  @Get('/follow/list')
  findFollowAll(@Query() query: ListPostArticleDto, @User() user: UserDto) {
    return this.postArticleService.findFollowAll(query, user);
  }

  /**
   * 查询文章详情（管理员）
   */
  @ApiOperation({ summary: '文章-详情' })
  @RequirePermission('post:article:query')
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.postArticleService.findOne(id);
  }

  /**
   * 更新文章
   */
  @ApiOperation({ summary: '文章-更新' })
  @ApiBody({ type: UpdatePostArticleDto, required: true })
  @RequirePermission('post:article:edit')
  @Put()
  update(@Body() updateDto: UpdatePostArticleDto, @User() user: UserDto) {
    return this.postArticleService.update(updateDto, user);
  }

  /**
   * 删除文章（支持单个或批量删除）
   */
  @ApiOperation({ summary: '文章-删除' })
  @RequirePermission('post:article:remove')
  @Delete(':ids')
  remove(@Param('ids') ids: string, @User() user: UserDto) {
    const idList = ids.split(',').map((id) => +id);
    return this.postArticleService.remove(idList, user);
  }

  /**
   * 提交审核
   */
  @ApiOperation({ summary: '文章-提交审核' })
  @RequirePermission('post:article:submitAudit')
  @Post('/submit-audit/:id')
  submitForAudit(@Param('id') id: number, @User() user: UserDto) {
    return this.postArticleService.submitForAudit(id, user);
  }

  /**
   * 审核文章
   */
  @ApiOperation({ summary: '文章-审核' })
  @ApiBody({ type: AuditPostArticleDto, required: true })
  @RequirePermission('post:article:audit')
  @Post('/audit')
  audit(@Body() auditDto: AuditPostArticleDto, @User() user: UserDto) {
    return this.postArticleService.audit(auditDto, user.user.userId);
  }

  /**
   * 发布文章
   */
  @ApiOperation({ summary: '文章-发布' })
  @RequirePermission('post:article:publish')
  @Post('/publish/:id')
  publish(@Param('id') id: number, @User() user: UserDto) {
    return this.postArticleService.publish(id, user);
  }
}
