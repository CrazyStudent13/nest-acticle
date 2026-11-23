import { IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PagingDto } from 'src/common/dto/index';

const VISIBILITY_VALUES = ['0', '1'];

/**
 * 收藏集新建/更新 DTO（更新为补丁式：id 必传，其余只传变更字段）
 */
export class SaveCollectionDto {
  @ApiProperty({ required: false, description: '收藏集 id（更新时必传）' })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  id?: number;

  @ApiProperty({ required: false, description: '收藏集名称（1-32 字）' })
  @IsOptional()
  @IsString()
  @Length(1, 32, { message: '收藏集名称长度须在 1-32 字之间' })
  name?: string;

  @ApiProperty({ required: false, description: '收藏集简介' })
  @IsOptional()
  @IsString()
  @Length(0, 255, { message: '收藏集简介不能超过 255 字' })
  desc?: string;

  @ApiProperty({ required: false, description: '可见性（0 公开 1 私密）' })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES, { message: 'visibility 取值不合法' })
  visibility?: string;
}

/**
 * 收藏集列表查询 DTO（guest/list：指定用户的收藏集，可选登录识别创建者本人）
 * 排序固定按更新时间倒序（同掘金收藏集栏「最近更新在前」）
 */
export class ListGuestCollectionDto extends PagingDto {
  @ApiProperty({ required: true, description: '空间主人的用户ID' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  userId: number;
}

/**
 * 收藏集订阅列表查询 DTO（guest/subscribed：我订阅的/他人的订阅列表，仅公开收藏集）
 */
export class ListGuestSubDto extends PagingDto {
  @ApiProperty({ required: true, description: '订阅人的用户ID' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  userId: number;
}

/**
 * 收藏集内文章列表查询 DTO（guest/articles，按收藏时间倒序）
 */
export class ListCollectionArticleDto extends PagingDto {
  @ApiProperty({ required: true, description: '收藏集 id' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  collectionId: number;

  @ApiProperty({ required: false, description: '文章标题（模糊搜索）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  title?: string;
}

/**
 * 收到的收藏列表查询 DTO（通知中心赞和收藏栏，同 ListMyLikeDto 口径）
 */
export class ListReceivedCollectDto extends PagingDto {
  @ApiProperty({ required: false, description: '文章标题（模糊搜索）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  title?: string;
}

/**
 * 收藏集管理列表查询 DTO（管理端，联 sys_user 按创建者昵称过滤）
 */
export class ListAdminCollectionDto extends PagingDto {
  @ApiProperty({ required: false, description: '收藏集名称（模糊搜索）' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  name?: string;

  @ApiProperty({ required: false, description: '创建者昵称（模糊搜索，联 sys_user）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  nickName?: string;
}
