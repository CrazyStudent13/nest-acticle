<!-- 关注管理（交互管理/关注管理）：关注关系明细列表，支持按关注人/被关注人昵称模糊搜索与时间范围过滤；纯明细删除，无计数回减（粉丝数读时 COUNT） -->
<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="follow.showSearch" :inline="true" :model="follow.queryParams" @submit.prevent>
        <el-form-item label="关注人"><el-input v-model="follow.queryParams.followerName" clearable placeholder="请输入关注人昵称" @keyup.enter="follow.handleQuery" /></el-form-item>
        <el-form-item label="被关注人"><el-input v-model="follow.queryParams.followingName" clearable placeholder="请输入被关注人昵称" @keyup.enter="follow.handleQuery" /></el-form-item>
        <el-form-item label="关注时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="follow.handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="follow.handleQuery">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:follow:remove']" :disabled="follow.multiple" :icon="Delete" plain type="danger" @click="follow.handleDelete">删除</el-button>
        <right-toolbar v-model:show-search="follow.showSearch" @query-table="follow.getList" />
      </el-row>
      <el-table v-loading="follow.loading" :data="follow.list" @selection-change="follow.handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="关注人" prop="followerName" show-overflow-tooltip width="160" />
        <el-table-column label="被关注人" prop="followingName" show-overflow-tooltip width="160" />
        <el-table-column label="关注时间" prop="createTime" width="180">
          <template #default="{ row }">{{ row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button v-hasPermi="['post:follow:remove']" :icon="Delete" link type="danger" @click="follow.handleDelete(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="follow.total > 0" v-model:limit="follow.queryParams.pageSize" v-model:page="follow.queryParams.pageNum" :total="follow.total" @pagination="follow.getList" />
    </div>
  </div>
</template>
<script setup name="FollowManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { listFollow, delFollow } from '@/api/post/follow';
import { addDateRange } from '@/composables/useCommon';
import { useCrud } from '@/composables/useCrud';

const dateRange = ref([]);

// 关注管理列表（无新增/编辑）
const follow = useCrud({
  api: {
    // 列表查询注入日期范围参数
    list: (params) => listFollow(addDateRange(params, dateRange.value)),
    del: delFollow
  },
  idKey: 'id',
  name: '关注记录',
  query: { followerName: '', followingName: '' },
  texts: {
    // 纯明细删除：粉丝数/关注数读时 COUNT，删除后自然回落，无需同步回减
    deleteConfirm: (ids) => `确认删除选中的 ${Array.isArray(ids) ? ids.length : 1} 条关注记录吗？删除后双方的关注/粉丝列表与计数会同步回落`
  }
});

// 重置按钮操作：额外清空日期范围
const resetQuery = () => {
  dateRange.value = [];
  follow.resetQuery();
};

// 初始化加载
follow.getList();
</script>
