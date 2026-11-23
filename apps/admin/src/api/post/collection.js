import request from '@/composables/useRequest';

export function listCollection(query) {
  return request({ url: '/post/collection/list', method: 'get', params: query });
}

export function delCollection(ids) {
  return request({ url: `/post/collection/batch/${ids}`, method: 'delete' });
}
