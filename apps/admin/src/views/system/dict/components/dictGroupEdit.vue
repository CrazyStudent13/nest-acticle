<template>
  <!-- 添加或修改数据字典项配置 -->
  <el-dialog v-model="dialogTableVisible" append-to-body :title="form.title" width="600px">
    <el-form ref="formRef" v-no-enter label-width="100px" :model="form.model" :rules="form.rules">
      <el-form-item label="字典名称" prop="dictName">
        <el-input v-model="form.model.dictName" placeholder="请输入字典名称" />
      </el-form-item>
      <el-form-item label="字典类型" prop="dictType">
        <el-input v-model="form.model.dictType" placeholder="请输入字典类型" />
      </el-form-item>
      <el-form-item label="所属模块" prop="dictModule">
        <el-select v-model="form.model.dictModule" clearable allow-create default-first-option filterable placeholder="请选择所属模块" style="width: 100%">
          <el-option v-for="item in DICT_MODULES" :key="item" :label="item" :value="item" />
        </el-select>
        <div class="form-item-tip">仅用于管理端左侧树分组展示，不影响任何接口读取；不填归入「未分类」</div>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.model.status">
          <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.value">{{ dict.label }}</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="公开" prop="isPublic">
        <el-radio-group v-model="form.model.isPublic">
          <el-radio v-for="dict in sys_dict_public" :key="dict.value" :label="dict.value">{{ dict.label }}</el-radio>
        </el-radio-group>
        <div class="form-item-tip">公开后未登录游客也能读取该字典（适用于文章来源、用户性别等展示类字典）</div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.model.remark" placeholder="请输入内容" type="textarea" />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button :loading="form.loading" type="primary" @click="form.submit">确 定</el-button>
        <el-button type="warning" @click="form.reset">重置</el-button>
        <el-button @click="form.cancel">取 消</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { addType, updateType } from '@/api/system/dict/type';
import { useDict } from '@/composables/useDict';
import { resetForm } from '@/composables/useForm';

import { DICT_MODULES } from '../modules';

const { sys_normal_disable, sys_dict_public } = useDict('sys_normal_disable', 'sys_dict_public') as any;

const dialogTableVisible = ref(false);
const formRef = ref();
const emit = defineEmits(['refresh']);

const form = reactive({
  loading: false,
  title: '',
  model: {
    dictId: undefined as number | undefined,
    dictName: '',
    dictType: '',
    dictModule: '',
    status: '0',
    isPublic: 'N',
    remark: ''
  },
  rules: {
    dictName: [{ required: true, message: '字典名称不能为空', trigger: 'blur' }],
    dictType: [{ required: true, message: '字典类型不能为空', trigger: 'blur' }],
    dictModule: [
      {
        // 选填（不填归入「未分类」），但填了不能是纯空白、长度对齐服务端 @Length(0,50)；
        // el-select(allow-create) 不支持 maxlength 透传到内部输入框，长度上限由校验兜底
        validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
          const trimmed = (value ?? '').trim();
          if (value && !trimmed) {
            callback(new Error('所属模块不能为空白字符'));
          } else if (trimmed.length > 50) {
            callback(new Error('所属模块长度不能超过 50 个字符'));
          } else {
            callback();
          }
        },
        trigger: ['blur', 'change']
      }
    ]
  },
  reset: () => {
    form.loading = false;
    nextTick(() => {
      resetForm(formRef.value);
    });
  },
  submit: () => {
    formRef.value.validate((valid) => {
      if (valid) {
        form.loading = true;
        // 手填模块去掉首尾空白再入库，避免树分组出现仅空格差异的重复模块
        form.model.dictModule = (form.model.dictModule || '').trim();
        if (form.model.dictId != undefined) {
          updateType(form.model).then(() => {
            ElMessage.success('修改成功');
            form.reset();
            dialogTableVisible.value = false;
            emit('refresh');
          });
        } else {
          addType(form.model).then(() => {
            ElMessage.success('新增成功');
            form.reset();
            dialogTableVisible.value = false;
            emit('refresh');
          });
        }
      }
    });
  },
  cancel: () => {
    form.reset();
    dialogTableVisible.value = false;
  }
});

const handleDialogOpen = (type, row, defaults = {}) => {
  form.title = type === 'add' ? '新增字典类型' : '修改字典类型';
  dialogTableVisible.value = true;
  if (type === 'edit') {
    form.model = { ...row };
  } else {
    form.reset();
    nextTick(() => {
      Object.assign(form.model, defaults);
    });
  }
};

defineExpose({
  handleDialogOpen
});
</script>

<style lang="scss" scoped>
.form-item-tip {
  margin-top: 2px;
  font-size: 12px;
  line-height: 18px;
  color: #909399;
}
</style>
