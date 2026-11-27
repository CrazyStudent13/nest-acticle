<template>
  <div class="app-container dict">
    <el-card v-loading="loading" class="dict-tree fill-card" shadow="never">
      <div class="dict-tree-header">
        <div class="dict-tree-filter">
          <el-select v-model="publicFilter" class="public-select" placeholder="公开范围" style="width: 90px">
            <el-option label="全部" value="ALL" />
            <el-option label="仅公开" value="Y" />
            <el-option label="仅不公开" value="N" />
          </el-select>
          <el-input v-model="treeFilterText" clearable placeholder="筛选字典名称" />
        </div>
      </div>

      <div class="dict-tree-body">
        <el-tree ref="dictGroupRef" :data="treeData" :default-expand-all="true" :default-expanded-keys="[0]" highlight-current :indent="10" node-key="dictId" :props="dictGroup.props">
          <template #default="{ node, data }">
            <span v-if="data.isModule" class="custom-tree-node" @click="dictGroup.handleModuleSelect(data)">
              <span class="custom-tree-node-text" :title="`${data.dictName}（${data.children.length}）`">
                {{ data.dictName }}
                <span class="custom-tree-node-count">（{{ data.children.length }}）</span>
              </span>
            </span>

            <span v-else-if="node.label !== '全部字典项'" class="custom-tree-node" @click="dictGroup.handleNodeSelect(data)">
              <span class="custom-tree-node-text" :title="node.label">{{ node.label }}</span>
              <span class="custom-tree-node-icon">
                <el-button v-hasPermi="['system:dict:edit']" :icon="Edit" link :title="'编辑'" type="primary" @click.stop="dictGroup.handleUpdate(data)" />
                <el-button v-hasPermi="['system:dict:remove']" :icon="Delete" link :title="'删除'" type="primary" @click.stop="dictGroup.handleDelete(data)" />
              </span>
            </span>

            <span v-else class="custom-tree-node" @click.stop="dictGroup.handleGroupSelect(data)">
              <span class="custom-tree-node-text" :title="node.label">{{ node.label }}</span>
              <span class="custom-tree-node-icon refresh-icon">
                <el-button v-hasPermi="['system:dict:add']" :icon="Plus" link :title="'添加字典分类'" type="primary" @click.stop="dictGroup.handleAdd" />
                <el-button :icon="Refresh" link :title="'刷新'" type="primary" @click.stop="dictGroup.handleRefresh" />
              </span>
            </span>
          </template>
        </el-tree>
      </div>
    </el-card>

    <el-card v-loading="loading" class="dict-table fill-card" shadow="never">
      <div v-if="dictGroup.selectNode.dictId === 0">
        <el-form ref="queryDictGroupRef" v-no-enter :inline="true" :model="dictGroup.query">
          <el-form-item label="字典名称" prop="dictName">
            <el-input v-model="dictGroup.query.dictName" clearable placeholder="请输入字典名称" style="width: 200px" @keyup.enter="dictGroup.handleRefresh" />
          </el-form-item>
          <el-form-item label="字典类型" prop="dictType">
            <el-input v-model="dictGroup.query.dictType" clearable placeholder="请输入字典类型" style="width: 200px" @keyup.enter="dictGroup.handleRefresh" />
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select v-model="dictGroup.query.status" clearable placeholder="请选择字典状态" style="width: 200px">
              <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button :icon="Search" type="primary" @click="dictGroup.handleRefresh">搜索</el-button>
            <el-button :icon="Refresh" @click="dictGroup.handleReset">重置</el-button>
          </el-form-item>
        </el-form>

        <el-row class="mb8" :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:add']" :icon="Plus" plain type="primary" @click="dictGroup.handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:remove']" :disabled="multiple" :icon="Delete" plain type="danger" @click="dictGroup.handleDelete">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:export']" :icon="Download" plain type="warning" @click="dictGroup.handleExport">导出</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:remove']" :icon="Refresh" plain type="warning" @click="dictGroup.handleRefreshCache">刷新缓存</el-button>
          </el-col>
          <right-toolbar :show-search="false" @query-table="dictGroup.handleRefresh" />
        </el-row>

        <el-table ref="dictGroupTableRef" :data="pagedTypes" max-height="70vh" @selection-change="dictGroup.handleSelectionChange">
          <el-table-column align="center" type="selection" width="55" />
          <el-table-column align="center" label="编号" prop="dictId" width="55" />
          <el-table-column align="center" label="名称" min-width="120" prop="dictName" :show-overflow-tooltip="true" />
          <el-table-column align="center" label="字典类型" min-width="170" prop="dictType" :show-overflow-tooltip="true" />
          <el-table-column align="center" label="模块" min-width="85" prop="dictModule">
            <template #default="scope">
              <span>{{ scope.row.dictModule || '未分类' }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" label="状态" prop="status" width="70">
            <template #default="scope">
              <dict-tag type="sys_normal_disable" :value="scope.row.status" />
            </template>
          </el-table-column>
          <!-- 公开字典允许未登录游客读取（如文章来源、用户性别），其余字典仍需登录 -->
          <el-table-column align="center" label="公开" prop="isPublic" width="90">
            <template #default="scope">
              <dict-tag type="sys_dict_public" :value="scope.row.isPublic" />
            </template>
          </el-table-column>
          <el-table-column align="center" label="备注" min-width="110" prop="remark" :show-overflow-tooltip="true" />
          <el-table-column align="center" label="创建时间" prop="createTime" width="180">
            <template #default="scope">
              <span>{{ scope.row.createTime ? dayjs(scope.row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" fixed="right" label="操作" width="160">
            <template #default="scope">
              <el-button v-hasPermi="['system:dict:edit']" :icon="Edit" link type="primary" @click="dictGroup.handleUpdate(scope.row)">修改</el-button>
              <el-button v-hasPermi="['system:dict:remove']" :icon="Delete" link type="primary" @click="dictGroup.handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <pagination v-show="dictTableData.length > 0" v-model:limit="groupPage.pageSize" v-model:page="groupPage.pageNum" :total="dictTableData.length" />
      </div>

      <div v-else>
        <el-descriptions border :column="2">
          <el-descriptions-item label="字典编号">{{ dictGroup.selectNode.dictType }}</el-descriptions-item>
          <el-descriptions-item label="状态"><dict-tag type="sys_normal_disable" :value="dictGroup.selectNode.status" /></el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">
          <span class="detail-divider-content">
            <el-tooltip placement="top">
              <template #content>
                <div>所属模块：{{ dictGroup.selectNode.dictModule || '未分类' }}</div>
                <div class="tooltip-line">备注：{{ dictGroup.selectNode.remark || '暂无备注' }}</div>
              </template>
              <span class="detail-title">
                <span>{{ dictGroup.selectNode.dictName }}字典详情</span>
                <dict-tag type="sys_dict_public" :value="dictGroup.selectNode.isPublic" />
              </span>
            </el-tooltip>
          </span>
        </el-divider>

        <el-row class="mb8" :gutter="10">
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:add']" :icon="Plus" plain type="primary" @click="dictData.handleAdd">新增</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:remove']" :disabled="dataMultiple" :icon="Delete" plain type="danger" @click="dictData.handleDelete">删除</el-button>
          </el-col>
          <el-col :span="1.5">
            <el-button v-hasPermi="['system:dict:export']" :icon="Download" plain type="warning" @click="dictData.handleExport">导出</el-button>
          </el-col>
          <right-toolbar :show-search="false" @query-table="dictData.handleRefresh" />
        </el-row>

        <el-table ref="dictDataRef" :data="dictData.data" @selection-change="dictData.handleSelectionChange">
          <el-table-column align="center" type="selection" width="55" />
          <el-table-column align="center" label="字典编码" prop="dictCode" width="80" />
          <el-table-column align="center" label="字典标签" min-width="100" prop="dictLabel">
            <template #default="scope">
              <span v-if="scope.row.listClass == '' || scope.row.listClass == 'default'">{{ scope.row.dictLabel }}</span>
              <el-tag v-else :type="scope.row.listClass == 'primary' ? '' : scope.row.listClass">{{ scope.row.dictLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" label="字典键值" min-width="100" prop="dictValue" />
          <el-table-column align="center" label="字典排序" prop="dictSort" width="80" />
          <el-table-column align="center" label="状态" prop="status" width="70">
            <template #default="scope">
              <dict-tag type="sys_normal_disable" :value="scope.row.status" />
            </template>
          </el-table-column>
          <el-table-column align="center" label="备注" min-width="110" prop="remark" :show-overflow-tooltip="true" />
          <el-table-column align="center" label="创建时间" prop="createTime" width="170">
            <template #default="scope">
              <span>{{ scope.row.createTime ? dayjs(scope.row.createTime).format('YYYY-MM-DD HH:mm:ss') : '' }}</span>
            </template>
          </el-table-column>
          <el-table-column align="center" fixed="right" label="操作" width="160">
            <template #default="scope">
              <el-button v-hasPermi="['system:dict:edit']" :icon="Edit" link type="primary" @click="dictData.handleUpdate(scope.row)">修改</el-button>
              <el-button v-hasPermi="['system:dict:remove']" :icon="Delete" link type="primary" @click="dictData.handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <pagination v-show="dictData.total > 0" v-model:limit="dictData.query.pageSize" v-model:page="dictData.query.pageNum" :total="dictData.total" @pagination="dictData.handleRefresh" />
      </div>
    </el-card>
  </div>

  <dict-group-edit ref="dictGroupEditRef" @refresh="handleDictChanged(dictGroup.handleRefresh)" />
  <dict-data-edit ref="dictDataEditRef" @refresh="handleDictChanged(dictData.handleRefresh)" />
</template>

<script setup name="Dict">
import { Delete, Download, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue';

import { listData, delData } from '@/api/system/dict/data';
import { listType, delType, refreshCache } from '@/api/system/dict/type';
import { useDict } from '@/composables/useDict';
import { resetForm } from '@/composables/useForm';
import { download } from '@/composables/useRequest';
import useDictStore from '@/store/modules/dict';

import dictDataEdit from './components/dictDataEdit';
import dictGroupEdit from './components/dictGroupEdit';
import { DICT_MODULES, DICT_MODULE_FALLBACK } from './modules';

const { sys_normal_disable } = useDict('sys_normal_disable');

// 字典组树和列表的ref
const dictGroupRef = ref();
const dictGroupTableRef = ref();
const queryDictGroupRef = ref();

// 字典内容列表ref
const dictDataRef = ref();

// 左侧树筛选关键词与公开范围，与右侧表格查询条件解耦
const treeFilterText = ref('');
const publicFilter = ref('ALL');

// 当前选中的模块（'' 表示全部），用于过滤右侧类型列表
const activeModule = ref('');

// 字典类型原始列表，树与表格都由它派生
const typeList = ref([]);

const ROOT_NODE = { dictId: 0, dictName: '全部字典项' };

// 左侧树：全部字典项 -> 模块 -> 字典类型，模块只做管理端分类展示
const treeData = computed(() => {
  const keyword = treeFilterText.value.trim();
  const list = typeList.value.filter((item) => (!keyword || item.dictName.includes(keyword)) && (publicFilter.value === 'ALL' || item.isPublic === publicFilter.value));
  const grouped = new Map();
  list.forEach((item) => {
    const moduleName = item.dictModule || DICT_MODULE_FALLBACK;
    if (!grouped.has(moduleName)) grouped.set(moduleName, []);
    grouped.get(moduleName).push(item);
  });
  const extraModules = Array.from(grouped.keys())
    .filter((name) => !DICT_MODULES.includes(name) && name !== DICT_MODULE_FALLBACK)
    .sort();
  const children = [...DICT_MODULES, ...extraModules, DICT_MODULE_FALLBACK].filter((name) => grouped.has(name)).map((name) => ({ dictId: `module:${name}`, dictName: name, isModule: true, children: grouped.get(name) }));
  return [{ ...ROOT_NODE, children }];
});

// 右侧类型列表：跟随当前模块与公开范围，名称筛选只作用于左侧树
const dictTableData = computed(() =>
  typeList.value.filter((item) => {
    if (activeModule.value && (item.dictModule || DICT_MODULE_FALLBACK) !== activeModule.value) return false;
    if (publicFilter.value !== 'ALL' && item.isPublic !== publicFilter.value) return false;
    return true;
  })
);

// 全部字典项列表分页：模块/公开筛选在本地完成后切片
const groupPage = reactive({ pageNum: 1, pageSize: 10 });

const pagedTypes = computed(() => {
  const start = (groupPage.pageNum - 1) * groupPage.pageSize;
  return dictTableData.value.slice(start, start + groupPage.pageSize);
});

// 筛选条件变化回到第一页
watch([activeModule, publicFilter], () => {
  groupPage.pageNum = 1;
});

// 数据变少或每页条数变化时，页码不超过最大页
watch([() => dictTableData.value.length, () => groupPage.pageSize], () => {
  const maxPage = Math.max(1, Math.ceil(dictTableData.value.length / groupPage.pageSize));
  if (groupPage.pageNum > maxPage) groupPage.pageNum = maxPage;
});

// 工具栏删除按钮的禁用态：未选中任何数据时禁用
const multiple = ref(true);
const dataMultiple = ref(true);

// 字典组和字典内容弹窗ref
const dictGroupEditRef = ref();
const dictDataEditRef = ref();
// 页面loading效果
const loading = ref(false);

// 字典组
const dictGroup = reactive({
  query: {
    pageNum: 1,
    pageSize: 1000,
    dictName: '',
    dictType: '',
    status: ''
  },
  selectNode: { ...ROOT_NODE },
  selection: [],
  props: { label: 'dictName', children: 'children' },
  request: async () => {
    loading.value = true;
    try {
      const result = await listType(dictGroup.query);
      typeList.value = result.data.list;
      // 编辑后重新拉取时同步选中节点，避免右侧描述停留在旧值；节点已删除则回到全部
      if (dictGroup.selectNode.dictId !== 0) {
        const current = typeList.value.find((item) => item.dictId === dictGroup.selectNode.dictId);
        if (current) {
          dictGroup.selectNode = current;
        } else {
          dictGroup.selectNode = { ...ROOT_NODE };
          dictGroupRef.value?.setCurrentKey(0);
          dictData.data = [];
        }
      }
    } catch (e) {
      console.error('加载字典分组失败:', e);
    } finally {
      loading.value = false;
    }
  },
  handleAdd: () => {
    dictGroupEditRef.value.handleDialogOpen('add', null, { dictModule: activeModule.value });
  },
  handleUpdate: (row) => {
    dictGroupEditRef.value.handleDialogOpen('edit', row);
  },
  handleDelete: (row) => {
    const dictIds = row.dictId || dictGroup.selection.map((item) => item.dictId).join(',');
    ElMessageBox.confirm(`是否确认删除字典编号为"${dictIds}"的数据项？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        loading.value = true;
        return delType(dictIds);
      })
      .then(() => {
        dictGroup.request();
        refreshLocalDictCache();
        ElMessage.success('删除成功');
      });
  },
  handleExport: () => {
    download(
      'system/dict/type/export',
      {
        ...dictGroup.query
      },
      `dict_${new Date().getTime()}.xlsx`
    );
  },
  handleRefresh: () => {
    dictGroup.request();
  },
  handleReset: () => {
    resetForm(queryDictGroupRef.value);
    dictGroup.request();
  },
  handleNodeSelect: (data) => {
    dictGroup.selectNode = data;
    dictGroupRef.value?.setCurrentKey(data.dictId);
    dictData.request();
  },
  handleModuleSelect: (data) => {
    activeModule.value = data.dictName;
    dictGroup.selectNode = { ...ROOT_NODE };
    dictGroupRef.value?.setCurrentKey(data.dictId);
  },
  handleGroupSelect: () => {
    activeModule.value = '';
    dictGroup.selectNode = { ...ROOT_NODE };
    dictGroupRef.value?.setCurrentKey(0);
    dictGroup.request();
  },
  handleSelectionChange: (val) => {
    dictGroup.selection = val;
    multiple.value = val.length === 0;
  },
  handleRefreshCache: () => {
    loading.value = true;
    refreshCache()
      .then(() => useDictStore().initDict({ force: true }))
      .then(() => {
        ElMessage.success('刷新成功');
      })
      .catch((error) => {
        console.error('刷新字典缓存失败:', error);
      })
      .finally(() => {
        loading.value = false;
      });
  }
});

// 字典内容
const dictData = reactive({
  query: {
    pageNum: 1,
    pageSize: 10,
    dictName: undefined,
    dictType: undefined,
    status: undefined
  },
  data: [],
  total: 0,
  selection: [],
  request: () => {
    loading.value = true;
    const nextType = dictGroup.selectNode.dictType;
    // 切换字典类型时回到第一页，避免停留在上一个字典的空页
    if (dictData.query.dictType !== nextType) {
      dictData.query.dictType = nextType;
      dictData.query.pageNum = 1;
    }
    listData(dictData.query).then((res) => {
      dictData.data = res.data.list;
      dictData.total = res.data.total;
      loading.value = false;
    });
  },
  handleAdd: () => {
    dictDataEditRef.value.handleDialogOpen('add', dictGroup.selectNode);
  },
  handleUpdate: (row) => {
    dictDataEditRef.value.handleDialogOpen('edit', dictGroup.selectNode, row);
  },
  handleDelete: (row) => {
    const dictCodes = row.dictCode || dictData.selection.map((item) => item.dictCode).join(',');
    ElMessageBox.confirm(`是否确认删除字典编码为"${dictCodes}"的数据项？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(() => {
        return delData(dictCodes);
      })
      .then(() => {
        dictData.request();
        useDictStore().removeDict(dictData.query.dictType);
        refreshLocalDictCache();
        ElMessage.success('删除成功');
      });
  },
  handleExport: () => {
    download(
      'system/dict/data/export',
      {
        ...dictData.query
      },
      `dict_data_${new Date().getTime()}.xlsx`
    );
  },
  handleRefresh: () => {
    dictData.request();
  },
  handleSelectionChange: (selection) => {
    dictData.selection = selection;
    dataMultiple.value = selection.length === 0;
  }
});

// 字典数据变更后同步失效本地持久化缓存，并重新拉取全量字典
const refreshLocalDictCache = () => {
  useDictStore()
    .initDict({ force: true })
    .catch((error) => {
      console.error('字典缓存刷新失败:', error);
    });
};

const handleDictChanged = (refresh) => {
  refresh();
  refreshLocalDictCache();
};

dictGroup.request();
</script>

<style lang="scss" scoped>
.dict {
  width: 100%;
  height: 100%;
  display: flex;

  &-tree {
    flex: 0 0 320px;
    background-color: #ffffff;
    width: 320px;
    // 高度与内部滚动由全局 .fill-card 统一处理
    margin-right: 20px;

    &-header {
      flex-shrink: 0;
    }

    &-filter {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;

      .el-input {
        flex: 1;
        min-width: 0;
      }

      .public-select {
        flex-shrink: 0;
      }
    }

    &-body {
      // 占满卡片剩余空间，独立滚动
      flex: 1;
      min-height: 0;
      padding-right: 20px;
      overflow-y: auto;
    }
  }

  &-table {
    position: relative;
    flex: 1;
    min-width: 0;
  }
}

.custom-tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  margin: 10px 0;
  padding-right: 4px;

  &-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &-icon {
    flex-shrink: 0;
  }

  &-count {
    flex-shrink: 0;
    color: #909399;
    font-size: 12px;
  }

  .refresh-icon {
    flex-shrink: 0;
    text-align: center;
  }
}

.detail-divider-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  .detail-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: default;
  }
}

.tooltip-line {
  margin-top: 4px;
}
</style>
