import { IsString, IsJSON, IsEnum, IsPhoneNumber, IsArray, Min, Length, IsOptional, IsBoolean, IsNumber, IsNumberString, IsEmail, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { PagingDto } from 'src/common/dto/index';
import { IsPasswordComplexEnough } from 'src/common/utils/password';

export enum StatusEnum {
  STATIC = '0',
  DYNAMIC = '1',
}

export class CreateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  // @IsEmail()
  @Length(0, 50)
  email: string;

  @ApiProperty({ required: true })
  @IsString()
  @Length(0, 30)
  nickName: string;

  @ApiProperty({ required: true })
  @IsString()
  @Length(0, 30)
  userName: string;

  @ApiProperty({ required: true })
  @IsString()
  @Length(0, 200)
  password: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  // @IsPhoneNumber('CN')
  phonenumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  postIds?: Array<number>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  roleIds?: Array<number>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  sex?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  remark?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    required: true,
  })
  @IsNumber()
  userId: number;
}

export class ChangeStatusDto {
  @ApiProperty({
    required: true,
  })
  @IsNumber()
  userId: number;

  @ApiProperty({ required: true })
  @IsString()
  @IsEnum(StatusEnum)
  status: string;
}

export class ListUserDto extends PagingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  nickName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  userName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phonenumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  status?: string;
}

export class ResetPwdDto {
  @ApiProperty({
    required: true,
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    required: true,
  })
  @IsString()
  @Length(5, 20)
  password: string;
}

export class AllocatedListDto extends PagingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  userName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phonenumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  roleId?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: true })
  @IsOptional()
  @IsString()
  @Length(0, 30)
  nickName: string;

  @ApiProperty({ required: true })
  @IsOptional()
  @IsEmail()
  @Length(0, 50)
  email: string;

  @ApiProperty({ required: true })
  @IsOptional()
  @IsString()
  phonenumber: string;

  @ApiProperty({ required: true })
  @IsOptional()
  @IsString()
  @IsEnum(StatusEnum)
  sex: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  signature?: string;
}

export class UpdatePwdDto {
  // 旧密码不做复杂度校验（老账号的弱密码要能通过校验去换新密码），长度交给服务端比对
  @ApiProperty({ required: true })
  @IsString()
  @Length(0, 200)
  oldPassword: string;

  // 新密码与注册口径一致：6-20 位 + 至少两类字符
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(6, { message: '新密码长度必须为 6 到 20 个字符' })
  @MaxLength(20, { message: '新密码长度不能超过 20 个字符' })
  @IsPasswordComplexEnough()
  newPassword: string;
}

/**
 * Excel 导入用户数据 DTO
 */
export class ImportUserDto {
  /** 用户账号 */
  @ApiProperty({ required: true })
  @IsString()
  @Length(0, 30)
  userName: string;

  /** 用户昵称 */
  @ApiProperty({ required: true })
  @IsString()
  @Length(0, 30)
  nickName: string;

  /** 用户邮箱 */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  /** 手机号码 */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phonenumber?: string;

  /** 性别 */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sex?: string;

  /** 账号状态 */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  /** 备注 */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
