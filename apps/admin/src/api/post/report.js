import request from '@/composables/useRequest';

export function listReport(query) {
  return request({ url: '/post/report/list', method: 'get', params: query });
}

export function handleReport(id, data) {
  return request({ url: `/post/report/handle/${id}`, method: 'put', data });
}

export function delReport(ids) {
  return request({ url: `/post/report/batch/${ids}`, method: 'delete' });
}
