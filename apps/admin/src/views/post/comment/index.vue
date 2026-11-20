<!-- 评论管理（交互管理/评论管理）：评论记录列表，按「类型」列区分对文章的评论与对用户评论的回复（回复行附回复对象），支持按文章标题/评论人/评论内容模糊搜索与时间范围过滤，删除会同步回减文章评论数 -->
<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="comment.showSearch" :inline="true" :model="comment.queryParams" @submit.prevent>
        <el-form-item label="文章标题"><el-input v-model="comment.queryParams.title" clearable placeholder="请输入文章标题" @keyup.enter="comment.handleQuery" /></el-form-item>
        <el-form-item label="评论人"><el-input v-model="comment.queryParams.nickName" clearable placeholder="请输入评论人昵称" @keyup.enter="comment.handleQuery" /></el-form-item>
        <el-form-item label="评论内容"><el-input v-model="comment.queryParams.content" clearable placeholder="请输入评论内容关键字" @keyup.enter="comment.handleQuery" /></el-form-item>
        <el-form-item label="评论时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="comment.handleQuery" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="comment.handleQuery">搜索</el-button>
          <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:comment:remove']" :disabled="comment.multiple" :icon="Delete" plain type="danger" @click="comment.handleDelete">删除</el-button>
        <right-toolbar v-model:show-search="comment.showSearch" @query-table="comment.getList" />
      </el-row>
      <el-table v-loading="comment.loading" :data="comment.list" @selection-change="comment.handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column label="文章标题" min-width="180" prop="articleTitle" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.articleTitle">{{ row.articleTitle }}</span>
            <el-tag v-else size="small" type="info">文章已删除</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <!-- parentId 为空即对文章的根评论,否则是对已有评论的回复 -->
            <el-tag v-if="row.parentId" size="small" type="warning">回复</el-tag>
            <el-tag v-else size="small" type="primary">评论</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评论人" prop="nickName" show-overflow-tooltip width="130" />
        <el-table-column label="回复对象" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <!-- 被回复人昵称由服务端联查;账号被删时降级提示 -->
            <span v-if="row.parentId" class="reply-tag">@{{ row.replyNickName || '未知用户' }}</span>
            <span v-else class="no-target">—</span>
          </template>
        </el-table-column>
        <el-table-column label="评论内容" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">{{ row.content }}</template>
        </el-table-column>
        <el-table-column label="评论时间" prop="createTime" width="180">
          <template #default="{ row }">{{ row.createTime ? dayjs(row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }"><el-button v-hasPermi="['post:comment:remove']" :icon="Delete" link type="danger" @click="comment.handleDelete(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="comment.total > 0" v-model:limit="comment.queryParams.pageSize" v-model:page="comment.queryParams.pageNum" :total="comment.total" @pagination="comment.getList" />
    </div>
  </div>
</template>
<script setup name="CommentManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { listComment, delComment } from '@/api/post/comment';
import { addDateRange } from '@/composables/useCommon';
import { useCrud } from '@/composables/useCrud';

const dateRange = ref([]);

// 评论管理列表（无新增/编辑）
const comment = useCrud({
  api: {
    // 列表查询注入日期范围参数
    list: (params) => listComment(addDateRange(params, dateRange.value)),
    del: delComment
  },
  idKey: 'id',
  name: '评论',
  query: { title: '', nickName: '', content: '' },
  texts: {
    // 删除会级联回减文章评论数；单行删除 deleteIds 为主键值、批量为主键数组
    deleteConfirm: (ids) => `确认删除选中的 ${Array.isArray(ids) ? ids.length : 1} 条评论吗？删除后对应文章评论数会同步回减`
  }
});

// 重置按钮操作：额外清空日期范围
const resetQuery = () => {
  dateRange.value = [];
  comment.resetQuery();
};

// 初始化加载
comment.getList();
</script>
<style scoped>
.reply-tag {
  color: var(--el-color-primary);
}
.no-target {
  color: var(--el-text-color-placeholder);
}
</style>
