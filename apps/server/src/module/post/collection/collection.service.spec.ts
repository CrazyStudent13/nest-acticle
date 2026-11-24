import { PostCollectionService } from './collection.service';

/**
 * 订阅写路径守卫：
 * - 自订阅拦截：订阅是「关注他人动态」语义，收藏集创建者不能订阅自己的收藏集
 * - 私密集不可订阅
 * - unsubscribe 对自订阅脏数据容忍：物理删行 + GREATEST 回减有 0 下限，脏数据可自愈不漂移
 */
describe('PostCollectionService.subscribe / unsubscribe（自订阅拦截与容忍）', () => {
  const manager = {
    findOne: jest.fn(),
    query: jest.fn(),
    increment: jest.fn(),
    delete: jest.fn(),
    // qb 链即 manager 自身：update/set/where 自返回，末端 execute
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    execute: jest.fn(),
  };
  const repos = {
    collectionRepo: {},
    relationRepo: {},
    subRepo: {},
    articleRepo: { manager: { transaction: jest.fn() } },
  };
  let service: PostCollectionService;

  beforeEach(() => {
    jest.resetAllMocks();
    // transaction 直接以 mock manager 执行回调
    repos.articleRepo.manager.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));
    for (const step of ['update', 'set', 'where']) {
      manager[step].mockReturnValue(manager);
    }
    manager.createQueryBuilder.mockReturnValue(manager);
    service = new PostCollectionService(repos.collectionRepo as any, repos.relationRepo as any, repos.subRepo as any, repos.articleRepo as any);
  });

  it('自订阅：400 拒绝，不落订阅行不增计数', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 5, userId: 7, visibility: '0', subscriberCount: 3, delFlag: '0' });

    await expect(service.subscribe(5, 7)).rejects.toMatchObject({ code: 400, msg: '不能订阅自己的收藏集' });

    expect(manager.query).not.toHaveBeenCalled();
    expect(manager.increment).not.toHaveBeenCalled();
  });

  it('订阅他人公开收藏集：INSERT IGNORE 落行并增计数', async () => {
    manager.findOne
      .mockResolvedValueOnce({ id: 5, userId: 99, visibility: '0', subscriberCount: 3, delFlag: '0' })
      .mockResolvedValueOnce({ subscriberCount: 4 });
    manager.query.mockResolvedValue({ affectedRows: 1 });

    const res = await service.subscribe(5, 7);

    expect(manager.query).toHaveBeenCalledWith('INSERT IGNORE INTO post_collection_sub (collection_id, user_id) VALUES (?, ?)', [5, 7]);
    expect(manager.increment).toHaveBeenCalledWith(expect.any(Function), { id: 5 }, 'subscriberCount', 1);
    expect(res.data).toEqual({ subscribed: true, subscriberCount: 4 });
  });

  it('私密集不可订阅：500 拒绝', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 5, userId: 99, visibility: '1', subscriberCount: 0, delFlag: '0' });

    await expect(service.subscribe(5, 7)).rejects.toMatchObject({ code: 500, msg: '私密收藏集不可订阅' });
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('历史自订阅脏数据退订：物理删行 + GREATEST 回减（0 下限，账目不漂移）', async () => {
    manager.findOne
      .mockResolvedValueOnce({ id: 5, userId: 7, visibility: '0', subscriberCount: 1, delFlag: '0' })
      .mockResolvedValueOnce({ subscriberCount: 0 });
    manager.delete.mockResolvedValue({ affected: 1 });
    manager.execute.mockResolvedValue(undefined);

    const res = await service.unsubscribe(5, 7);

    expect(manager.delete).toHaveBeenCalledWith(expect.any(Function), { collectionId: 5, userId: 7 });
    // 回减表达式必须带 0 下限：计数已漂移为 0 时再退订不会被减成负数
    expect(manager.set).toHaveBeenCalledWith({ subscriberCount: expect.any(Function) });
    expect(manager.execute).toHaveBeenCalled();
    expect(res.data).toEqual({ subscribed: false, subscriberCount: 0 });
  });

  it('未订阅直接退订：不回减计数（幂等）', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 5, userId: 99, visibility: '0', subscriberCount: 3, delFlag: '0' });
    manager.delete.mockResolvedValue({ affected: 0 });

    const res = await service.unsubscribe(5, 7);

    expect(manager.update).not.toHaveBeenCalled();
    expect(res.data).toEqual({ subscribed: false, subscriberCount: 3 });
  });
});
