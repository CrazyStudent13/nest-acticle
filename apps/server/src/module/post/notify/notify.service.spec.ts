import { PostNotifyService } from './notify.service';

/**
 * 互动通知已读水位（铃铛角标）：
 * - markRead 把分类水位推至当前（原子 upsert），缺省推平全部互动分类、带 category 只推该分类
 * - unreadCount 按互动 create_time > 水位严格比较；水位与互动列均为 datetime(3) 毫秒粒度，
 *   服务层只需保证毫秒精度的 Date 原样透传（不截断到秒），粒度边界由 schema 保证
 */
describe('PostNotifyService（已读水位）', () => {
  const WATERMARK = new Date('2026-11-24T10:00:00.123+08:00');

  // 每个仓库独立的链式 qb：where/andWhere/innerJoin 自返回，末端 getCount
  const makeChain = () => {
    const chain: Record<string, jest.Mock> = {};
    for (const step of ['where', 'andWhere', 'innerJoin']) {
      chain[step] = jest.fn().mockReturnValue(chain);
    }
    chain.getCount = jest.fn().mockResolvedValue(0);
    return chain;
  };
  const commentChain = makeChain();
  const likeChain = makeChain();
  const collectChain = makeChain();
  const followChain = makeChain();

  const readRepo = {
    find: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const repos = {
    commentRepo: { createQueryBuilder: jest.fn().mockReturnValue(commentChain) },
    likeRepo: { createQueryBuilder: jest.fn().mockReturnValue(likeChain) },
    collectRepo: { createQueryBuilder: jest.fn().mockReturnValue(collectChain) },
    collectionRepo: {},
    articleRepo: {},
    followRepo: { createQueryBuilder: jest.fn().mockReturnValue(followChain) },
  };
  let service: PostNotifyService;

  beforeEach(() => {
    jest.resetAllMocks();
    // resetAllMocks 会清掉 mockReturnValue，重建 qb 路由
    repos.commentRepo.createQueryBuilder.mockReturnValue(commentChain);
    repos.likeRepo.createQueryBuilder.mockReturnValue(likeChain);
    repos.collectRepo.createQueryBuilder.mockReturnValue(collectChain);
    repos.followRepo.createQueryBuilder.mockReturnValue(followChain);
    for (const chain of [commentChain, likeChain, collectChain, followChain]) {
      for (const step of ['where', 'andWhere', 'innerJoin']) {
        chain[step].mockReturnValue(chain);
      }
      chain.getCount.mockResolvedValue(0);
    }
    // transaction 直接以 mock manager 执行回调
    readRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb({ query: jest.fn() }));
    service = new PostNotifyService(readRepo as any, repos.commentRepo as any, repos.likeRepo as any, repos.collectRepo as any, repos.collectionRepo as any, repos.articleRepo as any, repos.followRepo as any);
  });

  describe('markRead', () => {
    it('缺省推平全部互动分类：comment/like/collect/follow 各 upsert 一条水位', async () => {
      const manager = { query: jest.fn() };
      readRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.markRead(7);

      const categories = manager.query.mock.calls.map((call) => call[1][1]);
      expect(categories).toEqual(['comment', 'like', 'collect', 'follow']);
      // 水位值原样透传（同一 Date 实例写满 INSERT/UPDATE 槽位），不截断不换算
      for (const call of manager.query.mock.calls) {
        expect(call[1][0]).toBe(7);
        expect(call[1][2]).toBeInstanceOf(Date);
        expect(call[1][3]).toBe(call[1][2]);
      }
    });

    it('带 category 只推该分类', async () => {
      const manager = { query: jest.fn() };
      readRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.markRead(7, 'like');

      expect(manager.query).toHaveBeenCalledTimes(1);
      expect(manager.query.mock.calls[0][1]).toEqual([7, 'like', expect.any(Date), expect.any(Date)]);
    });
  });

  describe('unreadCount', () => {
    it('无任何水位（首次进入）：四分类计数均不带水位过滤', async () => {
      readRepo.find.mockResolvedValue([]);
      likeChain.getCount.mockResolvedValue(2);
      commentChain.getCount.mockResolvedValue(3);
      followChain.getCount.mockResolvedValue(1);

      const res = await service.unreadCount(7);

      expect(readRepo.find).toHaveBeenCalledWith({ where: { userId: 7 } });
      const createTimeFilters = (chain: Record<string, jest.Mock>) => chain.andWhere.mock.calls.filter((call) => String(call[0]).includes('createTime >'));
      expect(createTimeFilters(commentChain)).toHaveLength(0);
      expect(createTimeFilters(likeChain)).toHaveLength(0);
      expect(createTimeFilters(collectChain)).toHaveLength(0);
      expect(createTimeFilters(followChain)).toHaveLength(0);
      expect(res.data).toEqual({ comment: 3, like: 2, collect: 0, follow: 1, total: 6 });
    });

    it('带 like 水位：仅 like 链挂水位过滤，毫秒精度的水位 Date 原样透传', async () => {
      readRepo.find.mockResolvedValue([{ category: 'like', readTime: WATERMARK }]);

      const res = await service.unreadCount(7);

      expect(likeChain.andWhere).toHaveBeenCalledWith('like.createTime > :likeRead', { likeRead: WATERMARK });
      const createTimeFilters = (chain: Record<string, jest.Mock>) => chain.andWhere.mock.calls.filter((call) => String(call[0]).includes('createTime >'));
      expect(createTimeFilters(commentChain)).toHaveLength(0);
      expect(createTimeFilters(collectChain)).toHaveLength(0);
      expect(createTimeFilters(followChain)).toHaveLength(0);
      expect(res.data).toEqual({ comment: 0, like: 0, collect: 0, follow: 0, total: 0 });
    });
  });
});
