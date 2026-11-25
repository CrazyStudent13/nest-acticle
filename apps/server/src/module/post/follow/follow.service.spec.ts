import { In } from 'typeorm';
import { PostFollowService } from './follow.service';

/**
 * 关注服务核心路径：
 * - 写路径幂等（INSERT IGNORE + 唯一索引）、自关注/目标不存在拦截、fanNum 读时 COUNT
 * - status 的互关短路（未关注不再回查反向关系）
 * - 管理删除纯明细删除（无计数回减）
 * 查询构建器 mock 与 notify spec 同款：链式自返回 + 末端取数
 */
describe('PostFollowService', () => {
  // qb 链工厂：select/addSelect/where/andWhere/leftJoin/groupBy/skip/take/orderBy 自返回
  const makeChain = () => {
    const chain: Record<string, jest.Mock> = {};
    for (const step of ['select', 'addSelect', 'leftJoin', 'where', 'andWhere', 'groupBy', 'skip', 'take', 'orderBy']) {
      chain[step] = jest.fn().mockReturnValue(chain);
    }
    chain.getRawMany = jest.fn().mockResolvedValue([]);
    chain.getRawAndEntities = jest.fn().mockResolvedValue({ raw: [], entities: [] });
    chain.getCount = jest.fn().mockResolvedValue(0);
    return chain;
  };

  const followChain = makeChain();
  const countChain = makeChain();

  const followRepo = {
    // guest list 主链与 countFans 聚合链各取各的 builder
    createQueryBuilder: jest.fn().mockImplementation(() => (followChain as any)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    manager: { transaction: jest.fn() },
  };
  const userRepo = {
    manager: { transaction: jest.fn() },
  };
  let service: PostFollowService;

  beforeEach(() => {
    jest.resetAllMocks();
    followRepo.createQueryBuilder.mockImplementation(() => followChain);
    followRepo.find.mockResolvedValue([]);
    followRepo.findOne.mockResolvedValue(null);
    for (const step of ['select', 'addSelect', 'leftJoin', 'where', 'andWhere', 'groupBy', 'skip', 'take', 'orderBy']) {
      followChain[step].mockReturnValue(followChain);
      countChain[step].mockReturnValue(countChain);
    }
    followChain.getRawMany.mockResolvedValue([]);
    followChain.getRawAndEntities.mockResolvedValue({ raw: [], entities: [] });
    followChain.getCount.mockResolvedValue(0);
    countChain.getRawMany.mockResolvedValue([]);
    countChain.getCount.mockResolvedValue(0);
    // 事务直接以 mock manager 执行回调（follow/unfocus 用 userRepo.manager，removeByIds 用 followRepo.manager）
    const manager = makeManager();
    userRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));
    followRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));
    service = new PostFollowService(followRepo as any, userRepo as any);
  });

  // 事务内 manager：findOne/query/count/delete 各自独立 mock，测试内按需覆写
  const makeManager = () => ({
    findOne: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue({ affectedRows: 1 }),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
  });

  describe('follow', () => {
    it('不能关注自己：直接抛业务异常，不发任何查询', async () => {
      await expect(service.follow(7, 7)).rejects.toMatchObject({ msg: '不能关注自己' });
      expect(userRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('目标用户不存在：抛业务异常', async () => {
      const manager = makeManager();
      manager.findOne.mockResolvedValue(null);
      userRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await expect(service.follow(404, 7)).rejects.toMatchObject({ msg: '用户不存在' });
    });

    it('关注成功：INSERT IGNORE 参数为（关注人, 被关注人），fanNum 读时 COUNT', async () => {
      const manager = makeManager();
      manager.findOne.mockResolvedValue({ userId: 8 }); // 目标用户存在
      manager.query.mockResolvedValue({ affectedRows: 1 }); // 新插入
      manager.count.mockResolvedValue(2);
      userRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      const res = await service.follow(8, 7);

      expect(manager.query).toHaveBeenCalledWith('INSERT IGNORE INTO post_follow (follower_id, following_id) VALUES (?, ?)', [7, 8]);
      expect(manager.count).toHaveBeenCalledWith(expect.anything(), { where: { followingId: 8 } });
      expect(res.data).toEqual({ followed: true, fanNum: 2 });
    });

    it('重复关注幂等：affectedRows=0 仍返回已关注（不回读区分）', async () => {
      const manager = makeManager();
      manager.findOne.mockResolvedValue({ userId: 8 });
      manager.query.mockResolvedValue({ affectedRows: 0 });
      manager.count.mockResolvedValue(5);
      userRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      const res = await service.follow(8, 7);

      expect(res.data).toEqual({ followed: true, fanNum: 5 });
    });
  });

  describe('unfollow', () => {
    it('取关：按（关注人, 被关注人）物理删除，fanNum 随行数回落', async () => {
      const manager = makeManager();
      manager.count.mockResolvedValue(1);
      userRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      const res = await service.unfollow(8, 7);

      expect(manager.delete).toHaveBeenCalledWith(expect.anything(), { followerId: 7, followingId: 8 });
      expect(res.data).toEqual({ followed: false, fanNum: 1 });
    });
  });

  describe('status', () => {
    beforeEach(() => {
      // status 只走 countFans 一条 qb 链，指向聚合链（默认 implementation 指向主查询链）
      followRepo.createQueryBuilder.mockReturnValue(countChain);
    });

    it('未关注：不再回查反向关系（互关短路），fanNum 走 GROUP BY 聚合', async () => {
      countChain.getRawMany.mockResolvedValue([{ fid: 8, cnt: '3' }]);

      const res = await service.status(8, 7);

      // 只有一次 findOne（我→TA），第二次（TA→我）未被触发
      expect(followRepo.findOne).toHaveBeenCalledTimes(1);
      expect(followRepo.findOne).toHaveBeenCalledWith({ where: { followerId: 7, followingId: 8 }, select: ['id'] });
      expect(res.data).toEqual({ followed: false, mutual: false, fanNum: 3 });
    });

    it('已关注且互关：双向 findOne 命中，mutual=true', async () => {
      followRepo.findOne
        .mockResolvedValueOnce({ id: 1 }) // 我→TA 存在
        .mockResolvedValueOnce({ id: 2 }); // TA→我 存在
      countChain.getRawMany.mockResolvedValue([{ fid: 8, cnt: '9' }]);

      const res = await service.status(8, 7);

      expect(followRepo.findOne).toHaveBeenCalledTimes(2);
      expect(res.data).toEqual({ followed: true, mutual: true, fanNum: 9 });
    });

    it('已关注但未互关：第二次 findOne 落空，mutual=false', async () => {
      followRepo.findOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      countChain.getRawMany.mockResolvedValue([]);

      const res = await service.status(8, 7);

      expect(res.data).toEqual({ followed: true, mutual: false, fanNum: 0 });
    });
  });

  describe('removeByIds', () => {
    it('空行集：不执行删除', async () => {
      const manager = makeManager();
      manager.find.mockResolvedValue([]);
      followRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.removeByIds([1, 2, 3]);

      expect(manager.delete).not.toHaveBeenCalled();
    });

    it('有行：按主键批量物理删除（无计数回减——读时 COUNT 口径）', async () => {
      const manager = makeManager();
      manager.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      followRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.removeByIds([1, 2, 999]);

      // 服务端用 In([...]) 构造删除条件（FindOperator，结构相等比较）
      expect(manager.delete).toHaveBeenCalledWith(expect.anything(), { id: In([1, 2]) });
    });
  });
});
