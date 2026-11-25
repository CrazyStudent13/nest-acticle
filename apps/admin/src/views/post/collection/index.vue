<!-- 收藏管理（交互管理/收藏管理）：收藏集列表，支持按收藏集名称/创建者昵称模糊搜索与时间范围过滤；
     可见性与类型（默认/自建）标签走数据字典（sys_collection_visibility / sys_collection_type），
     删除会软删收藏集并清理收藏/订阅关系、回减文章收藏数 -->
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
            <!-- 类型标签走字典（默认 warning / 自建 primary），文案与颜色可在字典管理维护 -->
            <dict-tag type="sys_collection_type" :value="row.isDefault ? '1' : '0'" />
            <span class="name-text">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="简介" min-width="200" prop="desc" show-overflow-tooltip />
        <el-table-column label="可见性" prop="visibility" width="90">
          <template #default="{ row }">
            <dict-tag type="sys_collection_visibility" :value="row.visibility" />
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
        <el-table-column fixed="right" label="操作" width="160">
          <template #default="{ row }">
            <el-button :icon="Document" link type="primary" @click="openArticles(row)">文章</el-button>
            <el-button v-hasPermi="['post:collection:remove']" :icon="Delete" link type="danger" @click="collection.handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination v-show="collection.total > 0" v-model:limit="collection.queryParams.pageSize" v-model:page="collection.queryParams.pageNum" :total="collection.total" @pagination="collection.getList" />
    </div>

    <!-- 收藏文章抽屉：查看收藏集收录的文章（guest 接口，管理员可看私密集） -->
    <el-drawer v-model="articlesVisible" size="720px" :title="`收藏文章 · ${currentCollection?.name || ''}`">
      <div class="drawer-flex">
        <el-table v-loading="articlesLoading" :data="articles">
          <el-table-column label="文章标题" min-width="200" prop="title" show-overflow-tooltip />
          <el-table-column label="作者" prop="author" show-overflow-tooltip width="120" />
          <el-table-column label="收藏时间" prop="collectTime" width="160">
            <template #default="{ row }">{{ row.collectTime ? dayjs(row.collectTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
          </el-table-column>
          <el-table-column align="center" label="阅读" prop="readNum" width="70" />
          <el-table-column align="center" label="点赞" prop="likeNum" width="70" />
        </el-table>
        <div v-show="articlesTotal > 0" class="drawer-pagination">
          <pagination v-model:limit="articlesQuery.pageSize" v-model:page="articlesQuery.pageNum" :total="articlesTotal" @pagination="loadArticles" />
        </div>
      </div>
    </el-drawer>
  </div>
</template>
<script setup name="CollectionManagement">
import dayjs from 'dayjs';
import { Delete, Document, Refresh, Search } from '@element-plus/icons-vue';

import { ElMessage } from 'element-plus';

import { delCollection, listCollection, listCollectionArticles } from '@/api/post/collection';
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
      `确认删除选中的 ${Array.isArray(ids) ? ids.length : 1} 个收藏集吗？其下收藏与订阅关系会一并清理，对应文章收藏数同步回减`,
    // 服务端对默认收藏夹不可删除会跳过（data 携带 {purged, skippedDefault}），按实际结果提示，不再一律「删除成功」
    deleteSuccess: (res) => {
      const purged = res?.data?.purged ?? 0;
      const skippedDefault = res?.data?.skippedDefault ?? 0;
      if (skippedDefault > 0) {
        return purged > 0
          ? `已删除 ${purged} 个收藏集；${skippedDefault} 个默认收藏夹不可删除已跳过`
          : `未删除任何收藏集：${skippedDefault} 个默认收藏夹不可删除`;
      }
      return '删除成功';
    }
  }
});

// 重置按钮操作：额外清空日期范围
const resetQuery = () => {
  dateRange.value = [];
  collection.resetQuery();
};

// ---------- 收藏文章抽屉：查看收藏集收录的文章（含私密集，分页） ----------
const articlesVisible = ref(false);
const currentCollection = ref(null);
const articles = ref([]);
const articlesTotal = ref(0);
const articlesLoading = ref(false);
const articlesQuery = reactive({ pageNum: 1, pageSize: 10, collectionId: 0 });

const openArticles = (row) => {
  currentCollection.value = row;
  articlesQuery.collectionId = row.id;
  articlesQuery.pageNum = 1;
  articlesVisible.value = true;
  loadArticles();
};

const loadArticles = async () => {
  articlesLoading.value = true;
  try {
    const res = await listCollectionArticles({
      collectionId: articlesQuery.collectionId,
      pageNum: articlesQuery.pageNum,
      pageSize: articlesQuery.pageSize
    });
    articles.value = res.data?.list || [];
    articlesTotal.value = res.data?.total || 0;
  } catch {
    // 失败也要有反馈：静默清空会让用户误以为该收藏集没有文章
    ElMessage.error('加载收藏文章失败');
    articles.value = [];
    articlesTotal.value = 0;
  } finally {
    articlesLoading.value = false;
  }
};

// 初始化加载
collection.getList();
</script>

<style lang="scss" scoped>
// 「默认」标签与收藏集名称的间距
.name-text {
  margin-left: 8px;
}

// 抽屉内容纵向布局：表格占满，分页沉底右下角
.drawer-flex {
  display: flex;
  flex-direction: column;
  height: 100%;

  .drawer-pagination {
    margin-top: auto;

    // 分页容器自带 margin-top/background，沉底场景下收紧
    :deep(.pagination-container) {
      margin-top: 0;
      margin-bottom: 0;
      padding: 10px 0;
    }
  }
}
</style>
