import { PostArticleService } from './article.service';

/**
 * 阅读上报防刷：SET NX EX 占键成功才自增，重复上报静默返回
 */
describe('PostArticleService.recordRead', () => {
  const redisSet = jest.fn();
  const updateChain = { update: jest.fn(), set: jest.fn(), where: jest.fn(), andWhere: jest.fn(), execute: jest.fn() };
  const articleRepo = { createQueryBuilder: jest.fn(), findOne: jest.fn() };
  let service: PostArticleService;

  beforeEach(() => {
    jest.resetAllMocks();
    // createQueryBuilder().update().set().where().andWhere() 逐级返回同一链，末端 execute
    articleRepo.createQueryBuilder.mockReturnValue(updateChain);
    for (const step of ['update', 'set', 'where', 'andWhere']) {
      updateChain[step].mockReturnValue(updateChain);
    }
    // 第三参 reportRepo：阅读上报用不到，占位空对象（update() 的举报下架校验才消费）
    service = new PostArticleService(articleRepo as any, {} as any, {} as any, { getClient: () => ({ set: redisSet }) } as any);
  });

  it('首次上报：占键成功后原子自增并回读最新阅读数', async () => {
    redisSet.mockResolvedValue('OK');
    updateChain.execute.mockResolvedValue({ affected: 1 });
    articleRepo.findOne.mockResolvedValue({ readNum: 41 });

    const res = await service.recordRead(7, '1.2.3.4');

    expect(redisSet).toHaveBeenCalledWith('read:dedup:7:1.2.3.4', 1, 'EX', 86400, 'NX');
    // 占键先于自增：顺序反过来就会留下并发双计窗口
    expect(redisSet.mock.invocationCallOrder[0]).toBeLessThan(updateChain.execute.mock.invocationCallOrder[0]);
    expect(res.data).toEqual({ readNum: 41 });
    expect(articleRepo.findOne).toHaveBeenCalledWith({ where: { id: 7 }, select: ['readNum'] });
  });

  it('24 小时内重复上报：占键失败，不自增不回读，静默返回成功', async () => {
    redisSet.mockResolvedValue(null);

    const res = await service.recordRead(7, '1.2.3.4');

    expect(res.code).toBe(200);
    expect(res.data).toBeNull();
    expect(articleRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(articleRepo.findOne).not.toHaveBeenCalled();
  });

  it('去重维度为文章 + IP：不同 IP 上报互不影响', async () => {
    redisSet.mockResolvedValue('OK');
    updateChain.execute.mockResolvedValue({ affected: 1 });
    articleRepo.findOne.mockResolvedValue({ readNum: 1 });

    await service.recordRead(7, '1.2.3.4');
    await service.recordRead(7, '5.6.7.8');

    expect(redisSet.mock.calls.map((call) => call[0])).toEqual(['read:dedup:7:1.2.3.4', 'read:dedup:7:5.6.7.8']);
    expect(updateChain.execute).toHaveBeenCalledTimes(2);
  });

  it('文章不存在或未发布：自增未命中时抛业务异常', async () => {
    redisSet.mockResolvedValue('OK');
    updateChain.execute.mockResolvedValue({ affected: 0 });

    await expect(service.recordRead(7, '1.2.3.4')).rejects.toMatchObject({ code: 500, msg: '文章不存在或未发布' });
    expect(articleRepo.findOne).not.toHaveBeenCalled();
  });

  it('非法 ID：不触碰 Redis 直接拒绝', async () => {
    await expect(service.recordRead(0, '1.2.3.4')).rejects.toMatchObject({ code: 400 });

    expect(redisSet).not.toHaveBeenCalled();
  });
});

/**
 * 作者自管理上下架（举报处置的下游）：
 * - 无 post:article:publish 权限的作者只能在「已发布↔已下架」之间切换，草稿直发会绕过发布/审核端点
 * - 因举报成立被下架、或因大量举报自动下架的文章，作者不能自行恢复发布
 */
describe('PostArticleService.update（发布状态自管理）', () => {
  const articleRepo = { findOne: jest.fn(), update: jest.fn() };
  const reportRepo = { findOne: jest.fn(), query: jest.fn() };
  let service: PostArticleService;

  const author = { userId: 7, user: { userId: 7 }, roles: [], permissions: [] };
  const admin = { userId: 99, user: { userId: 99 }, roles: ['admin'], permissions: ['post:article:publish'] };
  const article = { id: 10, title: '文章', userId: 7, publishStatus: '2', auditStatus: '0' };

  beforeEach(() => {
    jest.resetAllMocks();
    articleRepo.update.mockResolvedValue({ affected: 1 });
    service = new PostArticleService(articleRepo as any, {} as any, reportRepo as any, {} as any);
  });

  it('作者草稿直接改已发布：拒绝，不落库', async () => {
    articleRepo.findOne.mockResolvedValue({ ...article, publishStatus: '0' });

    await expect(service.update({ id: 10, title: '文章', publishStatus: '2' } as any, author as any)).rejects.toMatchObject({
      msg: '仅支持已发布↔已下架切换',
    });
    expect(articleRepo.update).not.toHaveBeenCalled();
  });

  it('作者已发布→已下架：允许，不查举报记录', async () => {
    articleRepo.findOne.mockResolvedValue(article);

    await service.update({ id: 10, title: '文章', publishStatus: '3' } as any, author as any);

    expect(reportRepo.findOne).not.toHaveBeenCalled();
    expect(articleRepo.update).toHaveBeenCalledWith({ id: 10 }, expect.objectContaining({ publishStatus: '3' }));
  });

  it('因举报成立被下架：作者不能自行恢复发布', async () => {
    articleRepo.findOne.mockResolvedValue({ ...article, publishStatus: '3' });
    reportRepo.findOne.mockResolvedValue({ id: 1 });

    await expect(service.update({ id: 10, title: '文章', publishStatus: '2' } as any, author as any)).rejects.toMatchObject({
      code: 403,
      msg: '该文章因举报已下架，如需恢复发布请联系管理员申诉',
    });
    expect(articleRepo.update).not.toHaveBeenCalled();
  });

  it('因大量举报自动下架（待处理达阈值）：作者不能自行恢复发布', async () => {
    articleRepo.findOne.mockResolvedValue({ ...article, publishStatus: '3' });
    reportRepo.findOne.mockResolvedValue(null);
    reportRepo.query.mockResolvedValue([{ cnt: '100' }]);

    await expect(service.update({ id: 10, title: '文章', publishStatus: '2' } as any, author as any)).rejects.toMatchObject({
      code: 403,
      msg: '该文章被大量用户举报待复核，如需恢复发布请联系管理员',
    });
  });

  it('普通下架（无成立举报、待处理未达阈值）：作者可自行恢复发布', async () => {
    articleRepo.findOne.mockResolvedValue({ ...article, publishStatus: '3' });
    reportRepo.findOne.mockResolvedValue(null);
    reportRepo.query.mockResolvedValue([{ cnt: '1' }]);

    await service.update({ id: 10, title: '文章', publishStatus: '2' } as any, author as any);

    expect(articleRepo.update).toHaveBeenCalledWith({ id: 10 }, expect.objectContaining({ publishStatus: '2' }));
  });

  it('具备 post:article:publish 的管理角色：可任意流转（含草稿直发）', async () => {
    articleRepo.findOne.mockResolvedValue({ ...article, publishStatus: '0', publishTime: null });

    await service.update({ id: 10, title: '文章', publishStatus: '2' } as any, admin as any);

    expect(articleRepo.update).toHaveBeenCalledWith(
      { id: 10 },
      expect.objectContaining({ publishStatus: '2', publishTime: expect.any(Date) }),
    );
  });
});

/**
 * 关注 feed：只有我关注的作者、仅已发布未删除的文章，固定发布时间倒序；
 * 客户端传 orderByColumn 不生效（feed 不接受自定义排序）
 */
describe('PostArticleService.findFollowAll（关注 feed）', () => {
  const chain = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    innerJoin: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const articleRepo = { createQueryBuilder: jest.fn() };
  const userRepo = { find: jest.fn() };
  let service: PostArticleService;

  beforeEach(() => {
    jest.resetAllMocks();
    articleRepo.createQueryBuilder.mockReturnValue(chain);
    for (const step of ['select', 'where', 'andWhere', 'innerJoin', 'orderBy', 'addOrderBy', 'skip', 'take']) {
      chain[step].mockReturnValue(chain);
    }
    service = new PostArticleService(articleRepo as any, userRepo as any, {} as any, {} as any);
  });

  it('join 关注关系 + 仅已发布，按发布时间倒序并回填作者信息', async () => {
    chain.getManyAndCount.mockResolvedValue([[{ id: 1, userId: 7 }], 1]);
    userRepo.find.mockResolvedValue([{ userId: 7, nickName: '作者', avatar: 'a.png' }]);

    const res = await service.findFollowAll({ pageNum: 1, pageSize: 10 } as any, { userId: 9 } as any);

    expect(chain.innerJoin).toHaveBeenCalledWith(
      expect.any(Function),
      'follow',
      'follow.followingId = article.userId AND follow.followerId = :feedFollowerId',
      { feedFollowerId: 9 },
    );
    expect(chain.andWhere).toHaveBeenCalledWith('article.publishStatus = :publishStatus', { publishStatus: '2' });
    expect(chain.orderBy).toHaveBeenCalledWith('article.publishTime', 'DESC');
    expect(chain.addOrderBy).toHaveBeenCalledWith('article.id', 'DESC');
    expect(chain.take).toHaveBeenCalledWith(10);
    expect(res.data.total).toBe(1);
    expect(res.data.list[0].userInfo).toEqual({ userId: 7, nickName: '作者', avatar: 'a.png' });
  });

  it('未关注任何作者：空列表，不触发用户批查', async () => {
    chain.getManyAndCount.mockResolvedValue([[], 0]);

    const res = await service.findFollowAll({ pageNum: 1, pageSize: 10 } as any, { userId: 9 } as any);

    expect(res.data).toEqual({ list: [], total: 0 });
    expect(userRepo.find).not.toHaveBeenCalled();
  });

  it('客户端指定 orderByColumn 不生效：feed 固定发布时间排序', async () => {
    chain.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findFollowAll({ pageNum: 1, pageSize: 10, orderByColumn: 'createTime', isAsc: 'descending' } as any, {
      userId: 9,
    } as any);

    expect(chain.orderBy).toHaveBeenCalledWith('article.publishTime', 'DESC');
    expect(chain.addOrderBy).toHaveBeenCalledWith('article.id', 'DESC');
  });
});
