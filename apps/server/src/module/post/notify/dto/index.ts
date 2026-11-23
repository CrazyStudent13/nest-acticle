import { IsIn, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 标记已读 DTO
 * 通知中心逐栏清零：带 category 只推该分类水位，缺省=全部互动分类一次推平
 */
export class MarkReadDto {
  @ApiProperty({ required: false, enum: ['comment', 'like', 'collect'], description: '通知分类（缺省标记全部互动分类）' })
  @IsOptional()
  @IsIn(['comment', 'like', 'collect'], { message: '通知分类仅支持 comment/like/collect' })
  category?: string;
}
