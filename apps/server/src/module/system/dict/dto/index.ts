import { IsString, IsJSON, IsEnum, IsPhoneNumber, Min, Length, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { PagingDto } from 'src/common/dto/index';

export enum StatusEnum {
  STATIC = '0',
  DYNAMIC = '1',
}

// 是否公开：Y 公开（游客可读） N 不公开（需登录），取值对齐字典 sys_yes_no
export enum YesNoEnum {
  YES = 'Y',
  NO = 'N',
}

export class CreateDictTypeDto {
  @ApiProperty({
    required: true,
  })
  @IsString()
  @Length(0, 100)
  dictName: string;

  @ApiProperty({
    required: true,
  })
  @IsString()
  @Length(0, 100)
  dictType: string;

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

  @ApiProperty({
    required: false,
    description: '是否公开（Y 公开，游客可读；N 不公开）',
  })
  @IsOptional()
  @IsString()
  @IsEnum(YesNoEnum)
  isPublic?: string;

  @ApiProperty({
    required: false,
    description: '所属模块（仅管理端分组展示）',
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  dictModule?: string;
}

export class UpdateDictTypeDto extends CreateDictTypeDto {
  @IsNumber()
  dictId: number;
}

export class ListDictType extends PagingDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  dictName?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  dictType?: string;

  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;
}

export class CreateDictDataDto {
  @IsString()
  @Length(0, 100)
  dictType: string;

  @IsString()
  @Length(0, 100)
  dictLabel: string;

  @IsString()
  @Length(0, 100)
  dictValue: string;

  @IsString()
  @Length(0, 100)
  listClass: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  cssClass: string;

  @IsOptional()
  @IsNumber()
  dictSort?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;

  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;
}

export class UpdateDictDataDto extends CreateDictDataDto {
  @IsNumber()
  dictCode: number;
}

export class ListDictData extends PagingDto {
  @IsOptional()
  @IsString()
  @Length(0, 100)
  dictLabel?: string;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  dictType?: string;

  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;
}
