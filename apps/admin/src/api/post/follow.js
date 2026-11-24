import request from '@/composables/useRequest';

export function listFollow(query) {
  return request({ url: '/post/follow/list', method: 'get', params: query });
}

export function delFollow(ids) {
  return request({ url: `/post/follow/batch/${ids}`, method: 'delete' });
}
