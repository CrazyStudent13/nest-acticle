<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="file.showSearch" :inline="true" :model="file.queryParams" @submit.prevent>
        <el-form-item label="文件名"><el-input v-model="file.queryParams.fileName" clearable placeholder="请输入文件名" @keyup.enter="file.handleQuery" /></el-form-item>
        <el-form-item label="扩展名">
          <el-select v-model="file.queryParams.ext" clearable filterable placeholder="全部类型" style="width: 140px" @change="file.handleQuery">
            <el-option v-for="item in extOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="上传时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="file.handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="file.handleQuery">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:file:remove']" :disabled="file.multiple" :icon="Delete" plain type="danger" @click="file.handleDelete">删除</el-button>
        <right-toolbar v-model:show-search="file.showSearch" @query-table="file.getList" />
      </el-row>
      <el-table v-loading="file.loading" :data="file.list" :default-sort="{ prop: 'createTime', order: 'descending' }" @selection-change="file.handleSelectionChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="预览" width="80">
          <template #default="{ row }">
            <el-image v-if="isImage(row.ext) && row.url" :src="row.url" :preview-src-list="previewList" :initial-index="previewList.indexOf(row.url)" class="file-thumb" fit="cover" preview-teleported hide-on-click-modal />
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="文件名" prop="newFileName" show-overflow-tooltip />
        <el-table-column label="类型" prop="ext" width="100" />
        <el-table-column label="大小" prop="size" sortable="custom" width="120">
          <template #default="{ row }">{{ formatSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="上传时间" prop="createTime" sortable="custom" width="180">
          <template #default="{ row }">{{ row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button v-hasPermi="['post:file:remove']" :icon="Delete" link type="danger" @click="file.handleDelete(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="file.total > 0" v-model:limit="file.queryParams.pageSize" v-model:page="file.queryParams.pageNum" :total="file.total" @pagination="file.getList" />
    </div>
  </div>
</template>
<script setup name="FileManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { listFile, listFileExts, delFile } from '@/api/post/file';
import { useCrud } from '@/composables/useCrud';

const dateRange = ref([]);
const extOptions = ref([]);
listFileExts()
  .then((res) => (extOptions.value = res.data))
  .catch(() => ElMessage.error('获取文件类型失败'));

// 文件管理列表（无新增/编辑）；此接口日期范围为顶层 beginTime/endTime 参数，非其他页面的嵌套 params
const file = useCrud({
  api: {
    list: (params) => listFile({ ...params, beginTime: dateRange.value?.[0], endTime: dateRange.value?.[1] }),
    del: delFile
  },
  idKey: 'uploadId',
  name: '文件',
  query: { fileName: '', ext: '', orderByColumn: undefined, isAsc: undefined },
  texts: {
    deleteConfirm: () => '确认删除选中的文件吗？'
  }
});

// 排序触发事件
const handleSortChange = ({ prop, order }) => {
  file.queryParams.orderByColumn = order ? prop : undefined;
  file.queryParams.isAsc = order || undefined;
  file.getList();
};

// 重置按钮操作：额外清空日期范围
const resetQuery = () => {
  dateRange.value = [];
  file.resetQuery();
};

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'];
const isImage = (ext) => IMAGE_EXTS.includes((ext || '').toLowerCase());
const previewList = computed(() => file.list.filter((item) => isImage(item.ext) && item.url).map((item) => item.url));
const formatSize = (size = 0) => (size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`);

// 初始化加载
file.getList();
</script>
<style scoped>
.file-thumb {
  display: block;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  cursor: pointer;
}
</style>
