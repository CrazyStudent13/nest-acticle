import request from '@/composables/useRequest';

export function listComment(query) {
  return request({ url: '/post/comment/list', method: 'get', params: query });
}

export function delComment(ids) {
  return request({ url: `/post/comment/batch/${ids}`, method: 'delete' });
}
