/** 预览作者卡统计：文章数 / 累计阅读 / 累计获赞（由宿主按作者 userId 聚合后传入） */
export interface PreviewAuthorStats {
  total: number;
  reads: number;
  likes: number;
}