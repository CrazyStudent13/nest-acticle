import { IsEnum, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PagingDto } from 'src/common/dto/index';

/**
 * 关注/粉丝列表方向：following=TA 关注的人，fans=关注 TA 的人
 */
export enum FollowListTypeEnum {
  FOLLOWING = 'following',
  FANS = 'fans',
}

/**
 * 指定用户的关注/粉丝列表查询 DTO（公开：个人空间关注/粉丝栏对访客开放，同掘金）
 */
export class ListGuestFollowDto extends PagingDto {
  @ApiProperty({ required: true, description: '空间主人的用户ID' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  userId: number;

  @ApiProperty({ required: true, enum: FollowListTypeEnum, description: '列表方向（following 关注列表 / fans 粉丝列表）' })
  @IsEnum(FollowListTypeEnum)
  type: FollowListTypeEnum;
}

/**
 * 收到的关注列表查询 DTO（通知中心「新增粉丝」栏，服务端按登录态过滤）
 * 排序固定按关注时间倒序
 */
export class ListMyFollowDto extends PagingDto {}

/**
 * 关注管理列表查询 DTO（管理端）
 */
export class ListFollowDto extends PagingDto {
  @ApiProperty({ required: false, description: '关注人昵称（模糊搜索，联 sys_user）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  followerName?: string;

  @ApiProperty({ required: false, description: '被关注人昵称（模糊搜索，联 sys_user）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  followingName?: string;
}
