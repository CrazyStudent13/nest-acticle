import { IsOptional, IsString, IsNumber, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PagingDto } from 'src/common/dto/index';

/**
 * 点赞管理列表查询 DTO（管理端）
 */
export class ListLikeDto extends PagingDto {
  @ApiProperty({ required: false, description: '文章标题（模糊搜索，联 post_article）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  title?: string;

  @ApiProperty({ required: false, description: '点赞人昵称（模糊搜索，联 sys_user）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  nickName?: string;
}

/**
 * 我的点赞列表查询 DTO（个人空间点赞栏，按登录态返回本人点赞记录）
 * 排序固定按点赞时间，方向走 PagingDto.isAsc（ascending/descending）
 */
export class ListMyLikeDto extends PagingDto {
  @ApiProperty({ required: false, description: '文章标题（模糊搜索）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  title?: string;
}

/**
 * 他人点赞列表查询 DTO（公开：个人空间点赞栏对访客开放，同掘金「赞」栏）
 */
export class ListGuestLikeDto extends ListMyLikeDto {
  @ApiProperty({ required: true, description: '空间主人的用户ID' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  userId: number;
}
