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
   * 发布状态/审核状态/发布时间/点赞数/阅读数/评论数不在创建可写 DTO 内：
   * 创建时由 service 写死（免审直发布），计数由点赞/评论事务维护，
   * 防止请求体伪造状态绕过审核（mass assignment）；更新路径的状态编辑见 UpdatePostArticleDto（按权限放开）
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

  // 状态字段重新入参（2026-11-25）：此前不在可写 DTO 内、被全局白名单剥离，
  // 导致作者自上下架与管理端状态编辑静默空转（请求 200 但状态不变）。
  // service 按权限串二次把关——无 post:article:publish 的作者仅能切换自己文章的已发布↔已下架，
  // 举报下架的文章不能自行恢复发布；无 post:article:audit 者传审核状态无效。
  // publishTime 依旧不收请求体（服务端按发布状态落值）
  @ApiProperty({ required: false, description: '发布状态（0 草稿 1 待发布 2 已发布 3 已下架），按权限校验后生效', enum: PublishStatusEnum })
  @IsOptional()
  @IsEnum(PublishStatusEnum)
  publishStatus?: string;

  @ApiProperty({ required: false, description: '审核状态（0 未提交 1 审核中 2 通过 3 拒绝），仅 post:article:audit 权限生效', enum: AuditStatusEnum })
  @IsOptional()
  @IsEnum(AuditStatusEnum)
  auditStatus?: string;
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
