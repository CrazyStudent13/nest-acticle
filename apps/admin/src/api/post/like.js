import request from '@/composables/useRequest';

export function listLike(query) {
  return request({ url: '/post/like/list', method: 'get', params: query });
}

export function delLike(ids) {
  return request({ url: `/post/like/batch/${ids}`, method: 'delete' });
}
