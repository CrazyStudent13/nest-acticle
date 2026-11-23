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
    service = new PostArticleService(articleRepo as any, {} as any, { getClient: () => ({ set: redisSet }) } as any);
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
