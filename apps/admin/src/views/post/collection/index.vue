<!-- 收藏管理（交互管理/收藏管理）：收藏集列表，支持按收藏集名称/创建者昵称模糊搜索与时间范围过滤；
     私密集同样可见（visibility 标识），删除会软删收藏集并清理收藏/订阅关系、回减文章收藏数 -->
<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="collection.showSearch" :inline="true" :model="collection.queryParams" @submit.prevent>
        <el-form-item label="收藏集名称"><el-input v-model="collection.queryParams.name" clearable placeholder="请输入收藏集名称" @keyup.enter="collection.handleQuery" /></el-form-item>
        <el-form-item label="创建者"><el-input v-model="collection.queryParams.nickName" clearable placeholder="请输入创建者昵称" @keyup.enter="collection.handleQuery" /></el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="collection.handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="collection.handleQuery">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:collection:remove']" :disabled="collection.multiple" :icon="Delete" plain type="danger" @click="collection.handleDelete">删除</el-button>
        <right-toolbar v-model:show-search="collection.showSearch" @query-table="collection.getList" />
      </el-row>
      <el-table v-loading="collection.loading" :data="collection.list" @selection-change="collection.handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="收藏集名称" min-width="180" prop="name" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" size="small" type="primary">默认</el-tag>
            <span>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="简介" min-width="200" prop="desc" show-overflow-tooltip />
        <el-table-column label="可见性" prop="visibility" width="90">
          <template #default="{ row }">
            <el-tag :type="row.visibility === '1' ? 'info' : 'success'" size="small">{{ row.visibility === '1' ? '私密' : '公开' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column align="center" label="收录文章" prop="articleCount" width="90" />
        <el-table-column align="center" label="订阅数" prop="subscriberCount" width="80" />
        <el-table-column label="创建者" prop="nickName" show-overflow-tooltip width="160" />
        <el-table-column label="创建时间" prop="createTime" width="170">
          <template #default="{ row }">{{ row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
        </el-table-column>
        <el-table-column label="更新时间" prop="updateTime" width="170">
          <template #default="{ row }">{{ row.updateTime ? dayjs(row.updateTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button v-hasPermi="['post:collection:remove']" :icon="Delete" link type="danger" @click="collection.handleDelete(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="collection.total > 0" v-model:limit="collection.queryParams.pageSize" v-model:page="collection.queryParams.pageNum" :total="collection.total" @pagination="collection.getList" />
    </div>
  </div>
</template>
<script setup name="CollectionManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { delCollection, listCollection } from '@/api/post/collection';
import { addDateRange } from '@/composables/useCommon';
import { useCrud } from '@/composables/useCrud';

const dateRange = ref([]);

// 收藏管理列表（无新增/编辑；私密集对管理员同样可见）
const collection = useCrud({
  api: {
    // 列表查询注入日期范围参数
    list: (params) => listCollection(addDateRange(params, dateRange.value)),
    del: delCollection
  },
  idKey: 'id',
  name: '收藏集',
  query: { name: '', nickName: '' },
  texts: {
    // 删除会软删收藏集并清理其收藏/订阅关系；单行删除 deleteIds 为主键值、批量为主键数组
    deleteConfirm: (ids) =>
      `确认删除选中的 ${Array.isArray(ids) ? ids.length : 1} 个收藏集吗？其下收藏与订阅关系会一并清理，对应文章收藏数同步回减`
  }
});

// 重置按钮操作：额外清空日期范围
const resetQuery = () => {
  dateRange.value = [];
  collection.resetQuery();
};

// 初始化加载
collection.getList();
</script>
