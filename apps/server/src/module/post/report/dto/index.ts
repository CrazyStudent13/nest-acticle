import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PagingDto } from 'src/common/dto/index';
import { ReportStatusEnum } from '@nest-acticle/shared';

/**
 * 举报目标类型（字典 post_report_target 的 dictValue）
 * 处置能力按值写死：unpublish 仅 post、disableUser 仅 user；扩评论举报时字典与本枚举同步加值
 */
export enum ReportTargetTypeEnum {
  POST = 'post',
  USER = 'user',
}

/**
 * 处置动作（成立时可选执行）：下架文章 / 停用用户
 */
export enum ReportHandleActionEnum {
  UNPUBLISH = 'unpublish',
  DISABLE_USER = 'disableUser',
}

/**
 * 提交举报 DTO（同一目标同时至多一条待处理举报，uk_reporter_pending 唯一索引兜底并发）
 */
export class CreateReportDto {
  @ApiProperty({ required: true, enum: ReportTargetTypeEnum, description: '举报目标类型（post 文章 / user 用户）' })
  @IsEnum(ReportTargetTypeEnum)
  targetType: ReportTargetTypeEnum;

  @ApiProperty({ required: true, description: '举报目标ID' })
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsNumber()
  @Min(1)
  targetId: number;

  @ApiProperty({ required: true, description: '举报理由（字典 post_report_reason 的 dictValue，服务端按字典缓存校验合法性）' })
  @IsString()
  @Length(1, 32)
  reasonType: string;

  @ApiProperty({ required: false, description: '补充说明（可空，抄袭出处链接等）' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reasonContent?: string;
}

/**
 * 举报管理列表查询 DTO（管理端）
 */
export class ListReportDto extends PagingDto {
  @ApiProperty({ required: false, description: '举报目标类型（post/user）' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  targetType?: string;

  @ApiProperty({ required: false, description: '举报理由（dictValue 精确匹配）' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  reasonType?: string;

  @ApiProperty({ required: false, description: '处理状态（0 待处理 1 成立 2 驳回）' })
  @IsOptional()
  @IsString()
  @Length(1, 1)
  status?: string;

  @ApiProperty({ required: false, description: '举报人昵称（模糊搜索，联 sys_user）' })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  reporterName?: string;
}

/**
 * 处理举报 DTO（管理端）：结论必填（成立/驳回），处置动作可选
 * 驳回时不携带处置动作（服务端强制置空）；unpublish 仅文章目标、disableUser 仅用户目标
 */
export class HandleReportDto {
  @ApiProperty({ required: true, enum: [ReportStatusEnum.UPHELD, ReportStatusEnum.DISMISSED], description: '处理结论（1 成立 2 驳回）' })
  @IsIn([ReportStatusEnum.UPHELD, ReportStatusEnum.DISMISSED])
  status: string;

  @ApiProperty({ required: false, enum: ReportHandleActionEnum, description: '处置动作（unpublish 下架文章 / disableUser 停用用户，须与目标类型匹配）' })
  @IsOptional()
  @IsIn([ReportHandleActionEnum.UNPUBLISH, ReportHandleActionEnum.DISABLE_USER])
  handleAction?: string;

  @ApiProperty({ required: false, description: '处理备注' })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  handleRemark?: string;
}
