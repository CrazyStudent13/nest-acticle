import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostNotifyService } from './notify.service';
import { MarkNoticesDto, MarkReadDto } from './dto/index';
import { User, UserDto } from 'src/module/system/user/user.decorator';

/**
 * 互动通知控制器
 * 面向博客前台的铃铛角标：未读计数与已读打点只要求 JWT，不挂权限串
 * （同点赞/评论的登录路径口径）；粉丝/私信等未建分类不计入
 */
@ApiTags('互动通知')
@Controller('post/notify')
export class PostNotifyController {
  constructor(private readonly notifyService: PostNotifyService) {}

  /**
   * 未读计数（铃铛红标：分类计数 + 合计；system 为逐条已读口径）
   */
  @ApiOperation({ summary: '通知-未读计数' })
  @Get('/unread/count')
  unreadCount(@User() user: UserDto) {
    return this.notifyService.unreadCount(user.userId);
  }

  /**
   * 标记已读（互动分类：通知中心逐栏清零，带 category 只推该分类，缺省推平全部互动分类）
   */
  @ApiOperation({ summary: '通知-标记已读' })
  @HttpCode(200)
  @Post('/read')
  markRead(@User() user: UserDto, @Body() dto?: MarkReadDto) {
    return this.notifyService.markRead(user.userId, dto?.category);
  }

  /**
   * 系统通知逐条标已读（进详情页标单条）
   */
  @ApiOperation({ summary: '通知-系统通知标已读' })
  @HttpCode(200)
  @Post('/read-notices')
  readNotices(@User() user: UserDto, @Body() dto: MarkNoticesDto) {
    return this.notifyService.readNotices(user.userId, dto.noticeIds);
  }

  /**
   * 系统通知全部标已读（列表「全部已读」按钮）
   */
  @ApiOperation({ summary: '通知-系统通知全部已读' })
  @HttpCode(200)
  @Post('/read-all-notices')
  readAllNotices(@User() user: UserDto) {
    return this.notifyService.readAllNotices(user.userId);
  }
}
