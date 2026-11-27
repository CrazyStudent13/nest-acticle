import { IsIn, IsOptional, IsArray, IsInt, ArrayMaxSize, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 标记已读 DTO（互动分类水位打点）
 * 通知中心逐栏清零：带 category 只推该分类水位，缺省=全部互动分类一次推平；
 * 系统通知不走水位（逐条已读见 MarkNoticesDto）
 */
export class MarkReadDto {
  @ApiProperty({ required: false, enum: ['comment', 'like', 'collect', 'follow'], description: '通知分类（缺省标记全部互动分类）' })
  @IsOptional()
  @IsIn(['comment', 'like', 'collect', 'follow'], { message: '通知分类仅支持 comment/like/collect/follow' })
  category?: string;
}

/**
 * 系统通知逐条已读 DTO（进系统通知栏标当前页、进详情页标单条）
 */
export class MarkNoticesDto {
  @ApiProperty({ required: true, type: [Number], description: '系统通知 id 列表（最多 100 条）' })
  @Type(() => Number)
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  noticeIds: number[];
}
