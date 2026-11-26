import { PostNotifyService } from './notify.service';

/**
 * 通知已读水位（铃铛角标）：
 * - markRead 把互动分类水位推至当前（原子 upsert），缺省推平全部互动分类、带 category 只推该分类
 * - unreadCount：互动四分类按 create_time > 水位严格比较；system（sys_notice）走**逐条已读**——
 *   NOT EXISTS post_notify_read(category='n:<noticeId>') 标记，无水位比较（见 notify.service 注释）
 * - 水位与互动列均为 datetime(3) 毫秒粒度，服务层只需保证毫秒精度的 Date 原样透传（不截断到秒）
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
  const systemChain = makeChain();

  const readRepo = {
    find: jest.fn(),
    manager: { transaction: jest.fn(), query: jest.fn() },
  };
  const repos = {
    commentRepo: { createQueryBuilder: jest.fn().mockReturnValue(commentChain) },
    likeRepo: { createQueryBuilder: jest.fn().mockReturnValue(likeChain) },
    collectRepo: { createQueryBuilder: jest.fn().mockReturnValue(collectChain) },
    collectionRepo: {},
    articleRepo: {},
    followRepo: { createQueryBuilder: jest.fn().mockReturnValue(followChain) },
    noticeRepo: { createQueryBuilder: jest.fn().mockReturnValue(systemChain) },
  };
  let service: PostNotifyService;

  beforeEach(() => {
    jest.resetAllMocks();
    // resetAllMocks 会清掉 mockReturnValue，重建 qb 路由
    repos.commentRepo.createQueryBuilder.mockReturnValue(commentChain);
    repos.likeRepo.createQueryBuilder.mockReturnValue(likeChain);
    repos.collectRepo.createQueryBuilder.mockReturnValue(collectChain);
    repos.followRepo.createQueryBuilder.mockReturnValue(followChain);
    repos.noticeRepo.createQueryBuilder.mockReturnValue(systemChain);
    for (const chain of [commentChain, likeChain, collectChain, followChain, systemChain]) {
      for (const step of ['where', 'andWhere', 'innerJoin']) {
        chain[step].mockReturnValue(chain);
      }
      chain.getCount.mockResolvedValue(0);
    }
    // transaction 直接以 mock manager 执行回调
    readRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb({ query: jest.fn() }));
    service = new PostNotifyService(readRepo as any, repos.commentRepo as any, repos.likeRepo as any, repos.collectRepo as any, repos.collectionRepo as any, repos.articleRepo as any, repos.followRepo as any, repos.noticeRepo as any);
  });

  describe('markRead', () => {
    it('缺省推平全部互动分类：comment/like/collect/follow 各 upsert 一条水位（system 走逐条已读不占水位）', async () => {
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

  describe('readNotices', () => {
    it('逐条写已读标记：category=n:<noticeId>，去重且最多 100 条', async () => {
      const manager = { query: jest.fn() };
      readRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.readNotices(7, [3, 3, 5]);

      expect(manager.query).toHaveBeenCalledTimes(2);
      expect(manager.query.mock.calls[0][1]).toEqual([7, 'n:3', expect.any(Date)]);
      expect(manager.query.mock.calls[1][1]).toEqual([7, 'n:5', expect.any(Date)]);
    });

    it('无有效 id（越界/非正整数）直接返回，不发查询', async () => {
      const manager = { query: jest.fn() };
      readRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.readNotices(7, [0, -1]);

      expect(manager.query).not.toHaveBeenCalled();
    });

    it('全部已读：一条 INSERT...SELECT 覆盖可见公告，登录人参数贯穿写入与可见性过滤', async () => {
      // readAllNotices 不走事务，直接 readRepo.manager.query
      const managerQuery = jest.fn();
      readRepo.manager.query = managerQuery;

      await service.readAllNotices(7);

      expect(managerQuery).toHaveBeenCalledTimes(1);
      expect(String(managerQuery.mock.calls[0][0])).toContain('INSERT INTO post_notify_read');
      expect(managerQuery.mock.calls[0][1]).toEqual([7, expect.any(Date), 7]);
    });
  });

  describe('unreadCount', () => {
    it('互动四分类按水位比较；system 链挂 NOT EXISTS 逐条已读过滤且不计水位', async () => {
      readRepo.find.mockResolvedValue([{ category: 'like', readTime: WATERMARK }]);
      likeChain.getCount.mockResolvedValue(2);
      commentChain.getCount.mockResolvedValue(3);
      followChain.getCount.mockResolvedValue(1);
      systemChain.getCount.mockResolvedValue(4);

      const res = await service.unreadCount(7);

      expect(likeChain.andWhere).toHaveBeenCalledWith('like.createTime > :likeRead', { likeRead: WATERMARK });
      const createTimeFilters = (chain: Record<string, jest.Mock>) => chain.andWhere.mock.calls.filter((call) => String(call[0]).includes('createTime >'));
      expect(createTimeFilters(commentChain)).toHaveLength(0);
      expect(createTimeFilters(collectChain)).toHaveLength(0);
      expect(createTimeFilters(followChain)).toHaveLength(0);
      // system：无水位比较，但必须挂逐条已读排除（NOT EXISTS），否则角标永远清不掉
      expect(createTimeFilters(systemChain)).toHaveLength(0);
      const notExistsFilters = systemChain.andWhere.mock.calls.filter((call) => String(call[0]).includes('NOT EXISTS'));
      expect(notExistsFilters).toHaveLength(1);
      expect(res.data).toEqual({ comment: 3, like: 2, collect: 0, follow: 1, system: 4, total: 10 });
    });
  });
});
