import request from '@/composables/useRequest';

export function listCollection(query) {
  return request({ url: '/post/collection/list', method: 'get', params: query });
}

// 收藏集内文章列表（guest 接口，管理员会话可查看私密集）
export function listCollectionArticles(query) {
  return request({ url: '/post/collection/guest/articles', method: 'get', params: query });
}

export function delCollection(ids) {
  return request({ url: `/post/collection/batch/${ids}`, method: 'delete' });
}
