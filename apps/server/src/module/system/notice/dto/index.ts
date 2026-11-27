import { IsString, IsJSON, IsEnum, IsIn, IsPhoneNumber, Min, Length, IsOptional, IsBoolean, IsNumber, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

import { PagingDto } from 'src/common/dto/index';

export enum StatusEnum {
  STATIC = '0',
  DYNAMIC = '1',
}
export enum TypeEnum {
  Instruct = '1',
  Notice = '2',
  /** 举报反馈（定向私密通知，业务侧程序写入，管理端通知公告页同样可管理） */
  Report = '3',
}
export class CreateNoticeDto {
  @IsString()
  @Length(0, 50)
  noticeTitle: string;

  @IsString()
  @IsEnum(TypeEnum)
  noticeType: string;

  @ApiProperty({
    required: true,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;

  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;

  @IsOptional()
  @IsString()
  noticeContent?: string;
}

export class UpdateNoticeDto extends CreateNoticeDto {
  @IsNumber()
  noticeId: number;
}

export class ListNoticeDto extends PagingDto {
  // 前台通知详情页按 id 取单条（复用 list 权限，前台角色没有 notice:query）
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  noticeId?: number;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  noticeTitle?: string;

  @IsOptional()
  @IsString()
  @IsEnum(TypeEnum)
  noticeType?: string;

  // 0 正常 / 1 关闭：通知中心取 '0'，关闭的公告不计入分页 total
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;

  @IsOptional()
  @IsString()
  createBy?: string;

  // 可见性范围：mine=前台通知中心视角，只回「全员公告 + 发给我的定向通知」；
  // 缺省=管理端视角不过滤（管理端要能管理全部定向通知）；noticeId 直取详情时无论是否带 scope 都强制过滤
  @IsOptional()
  @IsString()
  @IsIn(['mine'])
  scope?: 'mine';
}
