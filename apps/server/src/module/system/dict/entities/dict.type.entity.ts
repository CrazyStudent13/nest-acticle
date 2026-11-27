export class Dict {}
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from 'src/common/entities/base';

@Entity('sys_dict_type', {
  comment: '字典类型表',
})
export class SysDictTypeEntity extends BaseEntity {
  @ApiProperty({ type: String, description: '字典主键' })
  @PrimaryGeneratedColumn({ type: 'int', name: 'dict_id', comment: '字典主键' })
  public dictId: number;

  @Column({ type: 'varchar', name: 'dict_name', length: 100, comment: '字典名称' })
  public dictName: string;

  @Column({ type: 'varchar', name: 'dict_type', unique: true, length: 100, comment: '字典类型' })
  public dictType: string;

  @ApiProperty({ type: String, description: '是否公开（Y 公开，游客可读；N 不公开）' })
  @Column({ type: 'char', name: 'is_public', default: 'N', length: 1, comment: '是否公开（Y 公开游客可读 N 不公开）' })
  public isPublic: string;

  @ApiProperty({ type: String, description: '所属模块（仅管理端分组展示，不参与接口读取）' })
  @Column({ type: 'varchar', name: 'dict_module', default: '', length: 50, comment: '所属模块（仅管理端分类展示）' })
  public dictModule: string;
}
