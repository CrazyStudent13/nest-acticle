import { IsString, IsJSON, IsEnum, IsEmail, IsPhoneNumber, Min, IsOptional, IsBoolean, IsNumber, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsPasswordComplexEnough } from 'src/common/utils/password';

export enum StatusEnum {
  STATIC = '0',
  DYNAMIC = '1',
}

export class LoginDto {
  @ApiProperty({
    required: false,
  })
  @IsOptional()
  @IsString({ message: '验证码必须是字符串' })
  code?: string;

  @ApiProperty({
    required: true,
  })
  @IsString({ message: '账号必须是字符串' })
  @MinLength(2, { message: '账号长度必须为 2 到 50 个字符' })
  @MaxLength(50, { message: '账号长度必须为 2 到 50 个字符' })
  username: string;

  @ApiProperty({
    required: true,
  })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(5, { message: '密码长度必须为 5 到 20 个字符' })
  @MaxLength(20, { message: '密码长度必须为 5 到 20 个字符' })
  password: string;

  @ApiProperty({
    required: true,
  })
  @IsOptional()
  @IsString({ message: 'uuid 必须是字符串' })
  uuid?: string;
}

export class RegisterDto extends LoginDto {
  // 覆写 password：注册比登录更严——最少 6 位（与前台提示一致）+ 至少两类字符；登录不校验复杂度，老账号弱密码可正常登录
  @ApiProperty({ required: true })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度必须为 6 到 20 个字符' })
  @MaxLength(20, { message: '密码长度必须为 20 个字符' })
  @IsPasswordComplexEnough()
  password: string;

  @ApiProperty({
    required: false,
    description: '邮箱，开启邮箱验证码注册时必填',
  })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(50, { message: '邮箱长度不能超过 50 个字符' })
  email?: string;

  @ApiProperty({
    required: false,
    description: '邮箱验证码，开启邮箱验证码注册时必填',
  })
  @IsOptional()
  @IsString({ message: '邮箱验证码必须是字符串' })
  @MaxLength(6, { message: '邮箱验证码必须是 6 位数字' })
  emailCode?: string;
}

export class SendEmailCodeDto {
  @ApiProperty({
    required: true,
    description: '接收验证码的邮箱',
  })
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(50, { message: '邮箱长度不能超过 50 个字符' })
  email: string;
}
