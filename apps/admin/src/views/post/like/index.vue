<!-- 点赞管理（交互管理/点赞管理）：点赞记录列表，支持按文章标题/点赞人昵称模糊搜索与时间范围过滤，删除会同步回减文章点赞数 -->
<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="showSearch" :inline="true" :model="query" @submit.prevent>
        <el-form-item label="文章标题"><el-input v-model="query.title" clearable placeholder="请输入文章标题" @keyup.enter="getList" /></el-form-item>
        <el-form-item label="点赞人"><el-input v-model="query.nickName" clearable placeholder="请输入点赞人昵称" @keyup.enter="getList" /></el-form-item>
        <el-form-item label="点赞时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="getList" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="getList">搜索</el-button>
          <el-button :icon="Refresh" @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:like:remove']" :disabled="!selected.length" :icon="Delete" plain type="danger" @click="remove()">删除</el-button>
        <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
      </el-row>
      <el-table v-loading="loading" :data="list">
        <el-table-column type="selection" width="55" />
        <el-table-column label="文章标题" min-width="220" prop="articleTitle" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.articleTitle">{{ row.articleTitle }}</span>
            <el-tag v-else size="small" type="info">文章已删除</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="点赞人" prop="nickName" show-overflow-tooltip width="160" />
        <el-table-column label="点赞时间" prop="createTime" width="180">
          <template #default="{ row }">{{ row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button v-hasPermi="['post:like:remove']" :icon="Delete" link type="danger" @click="remove(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="getList" />
    </div>
  </div>
</template>
<script setup name="LikeManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { listLike, delLike } from '@/api/post/like';

const loading = ref(false);
const showSearch = ref(true);
const list = ref([]);
const selected = ref([]);
const total = ref(0);
const query = reactive({ pageNum: 1, pageSize: 10, title: '', nickName: '' });
const dateRange = ref([]);

// 请求序号：快速翻页/连续搜索时丢弃过期响应，防止慢请求覆盖新数据
let requestSeq = 0;
const getList = async () => {
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const params = {
      ...query,
      params: { beginTime: dateRange.value?.[0], endTime: dateRange.value?.[1] }
    };
    const res = await listLike(params);
    if (seq !== requestSeq) return;
    list.value = res.data.list;
    total.value = res.data.total;
  } finally {
    if (seq === requestSeq) loading.value = false;
  }
};
const reset = () => {
  query.pageNum = 1;
  query.title = '';
  query.nickName = '';
  dateRange.value = [];
  getList();
};
const remove = async (row) => {
  const ids = row ? row.id : selected.value.map((item) => item.id);
  await ElMessageBox.confirm(`确认删除选中的 ${ids.length} 条点赞记录吗？删除后对应文章点赞数会同步回减`);
  await delLike(ids.join(','));
  ElMessage.success('删除成功');
  getList();
};
getList();
</script>
