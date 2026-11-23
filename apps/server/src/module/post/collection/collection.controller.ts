import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostCollectionService } from './collection.service';
import {
  ListAdminCollectionDto,
  ListCollectionArticleDto,
  ListGuestCollectionDto,
  ListGuestSubDto,
  ListReceivedCollectDto,
  SaveCollectionDto,
} from './dto/index';
import { RequirePermission } from 'src/common/decorators/require-premission.decorator';
import { NotRequireAuth, User, UserDto } from 'src/module/system/user/user.decorator';

/**
 * 收藏集控制器
 * - guest 端点公开（可选登录识别创建者本人：私密集对本人可见、详情带订阅状态）
 * - 写路径（新建/编辑/删除/收藏/订阅）面向登录用户，只要求 JWT，不挂权限串（同点赞/评论口径）
 * - 管理路径（列表/批量删除）挂 post:collection:* 权限串
 * - received/list 通知中心「赞和收藏」栏的收到的收藏
 * 注意：静态段与动态段的声明顺序——/guest/*、/status/:articleId、/received/list、/list、
 * /batch/:ids、/:id/subscribe 必须在 /:collectionId/:articleId 等纯动态段之前，否则会被动态段吞掉（同 like 控制器注意事项）
 */
@ApiTags('收藏集管理')
@Controller('post/collection')
export class PostCollectionController {
  constructor(private readonly collectionService: PostCollectionService) {}

  /**
   * 指定用户的收藏集列表（公开：个人空间收藏集栏本人/访客共用，本人可见自己的私密集）
   */
  @ApiOperation({ summary: '收藏集-指定用户的收藏集列表' })
  @NotRequireAuth()
  @Get('/guest/list')
  findGuestList(@Query() query: ListGuestCollectionDto, @User() user: UserDto) {
    return this.collectionService.findGuestList(query, user);
  }

  /**
   * 收藏集详情（公开：含创建者信息与当前登录者的订阅状态）
   */
  @ApiOperation({ summary: '收藏集-详情' })
  @NotRequireAuth()
  @Get('/guest/detail')
  findGuestDetail(@Query('id') id: number, @User() user: UserDto) {
    return this.collectionService.findGuestDetail(id, user);
  }

  /**
   * 收藏集内文章列表（公开：私密集仅创建者可见）
   */
  @ApiOperation({ summary: '收藏集-集内文章列表' })
  @NotRequireAuth()
  @Get('/guest/articles')
  findGuestArticles(@Query() query: ListCollectionArticleDto, @User() user: UserDto) {
    return this.collectionService.findGuestArticles(query, user);
  }

  /**
   * 指定用户订阅的收藏集列表（公开：我订阅的/他人的订阅列表，仅公开收藏集）
   */
  @ApiOperation({ summary: '收藏集-指定用户订阅的收藏集列表' })
  @NotRequireAuth()
  @Get('/guest/subscribed')
  findGuestSubscribed(@Query() query: ListGuestSubDto) {
    return this.collectionService.findGuestSubscribed(query);
  }

  /**
   * 当前用户各收藏集对某文章的收藏状态（收藏弹窗勾选数据源）
   */
  @ApiOperation({ summary: '收藏集-文章收藏状态' })
  @Get('/status/:articleId')
  status(@Param('articleId', ParseIntPipe) articleId: number, @User() user: UserDto) {
    return this.collectionService.status(articleId, user.userId);
  }

  /**
   * 收到的收藏列表（通知中心「赞和收藏」栏：他人收藏我发布的文章，服务端按登录态过滤）
   */
  @ApiOperation({ summary: '收藏集-收到的收藏列表' })
  @Get('/received/list')
  findReceivedList(@Query() query: ListReceivedCollectDto, @User() user: UserDto) {
    return this.collectionService.findReceivedList(user.userId, query);
  }

  /**
   * 收藏集管理列表（管理端，联创建者昵称）
   */
  @ApiOperation({ summary: '收藏集-管理列表' })
  @RequirePermission('post:collection:list')
  @Get('/list')
  findAdminList(@Query() query: ListAdminCollectionDto) {
    return this.collectionService.findAdminList(query);
  }

  /**
   * 新建收藏集
   */
  @ApiOperation({ summary: '收藏集-新建' })
  @ApiBody({ type: SaveCollectionDto, required: true })
  @HttpCode(200)
  @Post()
  create(@Body() dto: SaveCollectionDto, @User() user: UserDto) {
    return this.collectionService.create(dto, user);
  }

  /**
   * 更新收藏集（补丁式，仅创建者）
   */
  @ApiOperation({ summary: '收藏集-更新' })
  @ApiBody({ type: SaveCollectionDto, required: true })
  @Put()
  update(@Body() dto: SaveCollectionDto, @User() user: UserDto) {
    return this.collectionService.update(dto, user);
  }

  /**
   * 删除收藏集（软删，清理收藏/订阅关系并回减文章收藏数）
   */
  @ApiOperation({ summary: '收藏集-删除' })
  @Delete('/:id')
  remove(@Param('id', ParseIntPipe) id: number, @User() user: UserDto) {
    return this.collectionService.remove(id, user);
  }

  /**
   * 批量删除收藏集（管理端，同步清理收藏/订阅关系并回减文章收藏数）
   */
  @ApiOperation({ summary: '收藏集-批量删除' })
  @RequirePermission('post:collection:remove')
  @Delete('/batch/:ids')
  removeByIds(@Param('ids') ids: string) {
    return this.collectionService.removeByIds(ids.split(',').map((id) => +id));
  }

  /**
   * 订阅收藏集（公开集；幂等）
   */
  @ApiOperation({ summary: '收藏集-订阅' })
  @HttpCode(200)
  @Post('/:id/subscribe')
  subscribe(@Param('id', ParseIntPipe) id: number, @User() user: UserDto) {
    return this.collectionService.subscribe(id, user.userId);
  }

  /**
   * 退订收藏集（幂等）
   */
  @ApiOperation({ summary: '收藏集-退订' })
  @Delete('/:id/subscribe')
  unsubscribe(@Param('id', ParseIntPipe) id: number, @User() user: UserDto) {
    return this.collectionService.unsubscribe(id, user.userId);
  }

  /**
   * 收藏进集（仅创建者收录已发布文章；幂等，双计数维护）
   */
  @ApiOperation({ summary: '收藏集-收藏文章' })
  @HttpCode(200)
  @Post('/:collectionId/:articleId')
  collect(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Param('articleId', ParseIntPipe) articleId: number,
    @User() user: UserDto,
  ) {
    return this.collectionService.collect(collectionId, articleId, user.userId);
  }

  /**
   * 移出收藏（幂等，双计数回减）
   */
  @ApiOperation({ summary: '收藏集-移出文章' })
  @Delete('/:collectionId/:articleId')
  uncollect(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Param('articleId', ParseIntPipe) articleId: number,
    @User() user: UserDto,
  ) {
    return this.collectionService.uncollect(collectionId, articleId, user.userId);
  }
}
