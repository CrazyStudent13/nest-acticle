import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PagingDto } from 'src/common/dto/index';

/**
 * 创建评论 DTO
 */
export class CreateCommentDto {
  @ApiProperty({ required: true, description: '文章 id' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  articleId: number;

  @ApiProperty({ required: true, description: '评论内容（1-500 字）' })
  @IsString()
  @Length(1, 500, { message: '评论内容需为 1 到 500 字' })
  content: string;
}

/**
 * 评论 guest 列表查询 DTO
 */
export class ListCommentGuestDto extends PagingDto {
  @ApiProperty({ required: true, description: '文章 id' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  articleId: number;
}

/**
 * 评论管理列表查询 DTO（管理端）
 */
export class ListCommentDto extends PagingDto {
  @ApiProperty({ required: false, description: '文章标题（模糊搜索，联 post_article）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  title?: string;

  @ApiProperty({ required: false, description: '评论人昵称（模糊搜索，联 sys_user）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  nickName?: string;

  @ApiProperty({ required: false, description: '评论内容（模糊搜索）' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  content?: string;
}
