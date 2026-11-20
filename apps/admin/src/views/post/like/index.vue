<!-- 点赞管理（交互管理/点赞管理）：点赞记录列表，支持按文章标题/点赞人昵称模糊搜索与时间范围过滤，删除会同步回减文章点赞数 -->
<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="like.showSearch" :inline="true" :model="like.queryParams" @submit.prevent>
        <el-form-item label="文章标题"><el-input v-model="like.queryParams.title" clearable placeholder="请输入文章标题" @keyup.enter="like.handleQuery" /></el-form-item>
        <el-form-item label="点赞人"><el-input v-model="like.queryParams.nickName" clearable placeholder="请输入点赞人昵称" @keyup.enter="like.handleQuery" /></el-form-item>
        <el-form-item label="点赞时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="like.handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="like.handleQuery">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:like:remove']" :disabled="like.multiple" :icon="Delete" plain type="danger" @click="like.handleDelete">删除</el-button>
        <right-toolbar v-model:show-search="like.showSearch" @query-table="like.getList" />
      </el-row>
      <el-table v-loading="like.loading" :data="like.list" @selection-change="like.handleSelectionChange">
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
          <template #default="{ row }"><el-button v-hasPermi="['post:like:remove']" :icon="Delete" link type="danger" @click="like.handleDelete(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="like.total > 0" v-model:limit="like.queryParams.pageSize" v-model:page="like.queryParams.pageNum" :total="like.total" @pagination="like.getList" />
    </div>
  </div>
</template>
<script setup name="LikeManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { listLike, delLike } from '@/api/post/like';
import { addDateRange } from '@/composables/useCommon';
import { useCrud } from '@/composables/useCrud';

const dateRange = ref([]);

// 点赞管理列表（无新增/编辑）
const like = useCrud({
  api: {
    // 列表查询注入日期范围参数
    list: (params) => listLike(addDateRange(params, dateRange.value)),
    del: delLike
  },
  idKey: 'id',
  name: '点赞记录',
  query: { title: '', nickName: '' },
  texts: {
    // 删除会级联回减文章点赞数；单行删除 deleteIds 为主键值、批量为主键数组
    deleteConfirm: (ids) => `确认删除选中的 ${Array.isArray(ids) ? ids.length : 1} 条点赞记录吗？删除后对应文章点赞数会同步回减`
  }
});

// 重置按钮操作：额外清空日期范围
const resetQuery = () => {
  dateRange.value = [];
  like.resetQuery();
};

// 初始化加载
like.getList();
</script>
