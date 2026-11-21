import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { PagingDto } from 'src/common/dto/index';
import { Transform } from 'class-transformer';
import { ArticleSourceEnum, AuditStatusEnum, PublishStatusEnum } from '@nest-acticle/shared';

// 发布/审核状态与文章来源枚举收敛到共享契约包，server 与前端共用同一份取值定义
export { ArticleSourceEnum, AuditStatusEnum, PublishStatusEnum };

/**
 * 创建文章 DTO
 */
export class CreatePostArticleDto {
  @ApiProperty({ required: true, description: '文章标题' })
  @IsString()
  title: string;

  @ApiProperty({ required: false, description: '文章简介' })
  @IsOptional()
  @IsString()
  desc?: string;

  @ApiProperty({ required: false, description: '专栏ID（无可用专栏时可省略，落库为 0 表示未归类）' })
  @IsOptional()
  @IsNumber()
  subjectId?: number;

  @ApiProperty({ required: false, description: '文章内容' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false, description: '封面图片' })
  @IsOptional()
  @IsString()
  cover?: string;

  @ApiProperty({ required: false, description: '作者昵称' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiProperty({ required: false, description: '文章来源', enum: ArticleSourceEnum })
  @IsOptional()
  @IsEnum(ArticleSourceEnum)
  source?: string;

  /**
   * 发布状态/审核状态/发布时间/点赞数/阅读数/评论数不在可写 DTO 内：
   * 状态只能经 /publish/:id 与 /audit 端点流转，计数由点赞/评论事务维护，
   * 落库值由 service 写死，防止请求体伪造状态绕过审核（mass assignment）
   */

  @ApiProperty({ required: false, description: '定时发布时间' })
  @IsOptional()
  scheduledPublishTime?: Date;

  @ApiProperty({ required: false, description: '排序' })
  @IsOptional()
  @IsNumber()
  sort?: number;
}

/**
 * 更新文章 DTO
 */
export class UpdatePostArticleDto extends CreatePostArticleDto {
  @ApiProperty({ required: true, description: '文章ID' })
  @IsNumber()
  id: number;
}

/**
 * 文章列表查询 DTO
 */
export class ListPostArticleDto extends PagingDto {
  @ApiProperty({ required: false, description: '文章标题（模糊搜索）' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false, description: '专栏ID' })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  subjectId?: number;

  @ApiProperty({ required: false, description: '作者用户ID' })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  userId?: number;

  @ApiProperty({ required: false, description: '发布状态', enum: PublishStatusEnum })
  @IsOptional()
  @IsEnum(PublishStatusEnum)
  publishStatus?: string;

  @ApiProperty({ required: false, description: '审核状态', enum: AuditStatusEnum })
  @IsOptional()
  @IsEnum(AuditStatusEnum)
  auditStatus?: string;

  @ApiProperty({ required: false, description: '文章来源', enum: ArticleSourceEnum })
  @IsOptional()
  @IsEnum(ArticleSourceEnum)
  source?: string;
}

/**
 * 文章详情 DTO
 */
export class DetailPostArticleDto {
  @ApiProperty({ required: true, description: '文章ID' })
  @IsNumber()
  id: number;
}

/**
 * 审核文章 DTO
 */
export class AuditPostArticleDto {
  @ApiProperty({ required: true, description: '文章ID' })
  @IsNumber()
  id: number;

  @ApiProperty({ required: true, description: '审核状态', enum: AuditStatusEnum })
  @IsEnum(AuditStatusEnum)
  auditStatus: string;

  @ApiProperty({ required: false, description: '审核备注' })
  @IsOptional()
  @IsString()
  auditRemark?: string;
}
