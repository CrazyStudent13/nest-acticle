<!-- 评论管理（交互管理/评论管理）：评论记录列表，按「类型」列区分对文章的评论与对用户评论的回复（回复行附回复对象），支持按文章标题/评论人/评论内容模糊搜索与时间范围过滤，删除会同步回减文章评论数 -->
<template>
  <div class="app-container">
    <div class="main-card">
      <el-form v-show="showSearch" :inline="true" :model="query" @submit.prevent>
        <el-form-item label="文章标题"><el-input v-model="query.title" clearable placeholder="请输入文章标题" @keyup.enter="getList" /></el-form-item>
        <el-form-item label="评论人"><el-input v-model="query.nickName" clearable placeholder="请输入评论人昵称" @keyup.enter="getList" /></el-form-item>
        <el-form-item label="评论内容"><el-input v-model="query.content" clearable placeholder="请输入评论内容关键字" @keyup.enter="getList" /></el-form-item>
        <el-form-item label="评论时间">
          <el-date-picker v-model="dateRange" :default-time="[new Date(2000, 1, 1, 0, 0, 0), new Date(2000, 1, 1, 23, 59, 59)]" end-placeholder="结束日期" range-separator="-" start-placeholder="开始日期" style="width: 240px" type="daterange" value-format="YYYY-MM-DD HH:mm:ss" @change="getList" />
        </el-form-item>
        <el-form-item>
          <el-button :icon="Search" type="primary" @click="getList">搜索</el-button>
          <el-button :icon="Refresh" @click="reset">重置</el-button>
        </el-form-item>
      </el-form>
      <el-row class="mb8">
        <el-button v-hasPermi="['post:comment:remove']" :disabled="!selected.length" :icon="Delete" plain type="danger" @click="remove()">删除</el-button>
        <right-toolbar v-model:show-search="showSearch" @query-table="getList" />
      </el-row>
      <el-table v-loading="loading" :data="list">
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
          <template #default="{ row }"><el-button v-hasPermi="['post:comment:remove']" :icon="Delete" link type="danger" @click="remove(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <pagination v-show="total > 0" v-model:limit="query.pageSize" v-model:page="query.pageNum" :total="total" @pagination="getList" />
    </div>
  </div>
</template>
<script setup name="CommentManagement">
import { Delete, Refresh, Search } from '@element-plus/icons-vue';

import { listComment, delComment } from '@/api/post/comment';

const loading = ref(false);
const showSearch = ref(true);
const list = ref([]);
const selected = ref([]);
const total = ref(0);
const query = reactive({ pageNum: 1, pageSize: 10, title: '', nickName: '', content: '' });
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
    const res = await listComment(params);
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
  query.content = '';
  dateRange.value = [];
  getList();
};
const remove = async (row) => {
  const ids = row ? row.id : selected.value.map((item) => item.id);
  await ElMessageBox.confirm(`确认删除选中的 ${ids.length} 条评论吗？删除后对应文章评论数会同步回减`);
  await delComment(ids.join(','));
  ElMessage.success('删除成功');
  getList();
};
getList();
</script>
<style scoped>
.reply-tag {
  color: var(--el-color-primary);
}
.no-target {
  color: var(--el-text-color-placeholder);
}
</style>
