import { NoticeService } from './notice.service';

/**
 * 前台通知详情页按 noticeId 直取（复用 list 权限）：服务端必须强制只回生效公告（status='0'），
 * 否则关闭态公告可凭 id 越权直取；管理端列表（isManager=true）不带 noticeId，过滤行为不得受影响；
 * scope=mine（前台通知中心）附行级 unread 标记（逐条已读口径），管理端视角不附；
 * 非管理侧（缺省 isManager=false）无 scope 拉列表同样强制「全员公告 + 发给我」过滤——
 * member 仅持 system:notice:list，不能凭缺省 scope 读到全部用户的定向通知（越权读修复）
 */
describe('NoticeService.findAll（noticeId 直取封死关闭态 / scope=mine 未读标记 / 非管理侧定向可见性闸门）', () => {
  const chain = {
    where: jest.fn(),
    andWhere: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repo = { createQueryBuilder: jest.fn() };
  const notifyReadRepo = { find: jest.fn() };
  let service: NoticeService;

  beforeEach(() => {
    jest.resetAllMocks();
    repo.createQueryBuilder.mockReturnValue(chain);
    for (const step of ['where', 'andWhere', 'skip', 'take']) {
      chain[step].mockReturnValue(chain);
    }
    chain.getManyAndCount.mockResolvedValue([[], 0]);
    service = new NoticeService(repo as any, notifyReadRepo as any);
  });

  // andWhere 的 status 过滤调用（[sql, params] 对；未出现则返回 undefined）
  const statusFilter = () => chain.andWhere.mock.calls.find((call) => String(call[0]).includes('entity.status'));
  const noticeIdFilter = () => chain.andWhere.mock.calls.find((call) => call[0] === 'entity.noticeId = :noticeId');
  // andWhere 的定向可见性过滤调用（「全员公告 + 发给我」或纯全员）
  const visibilityFilter = () => chain.andWhere.mock.calls.find((call) => String(call[0]).includes('entity.userId'));

  it('带 noticeId 直取：强制 status=0，显式传 status=1 也查不到关闭态公告', async () => {
    await service.findAll({ noticeId: 3, status: '1' } as any);

    expect(noticeIdFilter()).toEqual(['entity.noticeId = :noticeId', { noticeId: 3 }]);
    // 强制生效态与显式 status 同在：参数被服务端覆盖为 0，status=1 的请求必然落空（fail-closed）
    expect(statusFilter()).toEqual(['entity.status = :status', { status: '0' }]);
  });

  it('带 noticeId 直取：未传 status 时同样只回生效公告', async () => {
    await service.findAll({ noticeId: 3 } as any);

    expect(statusFilter()).toEqual(['entity.status = :status', { status: '0' }]);
  });

  it('管理端列表（isManager=true、不带 noticeId）：status 仅按查询参数透传，不被强制注入', async () => {
    await service.findAll({ status: '1' } as any, undefined, true);

    expect(noticeIdFilter()).toBeUndefined();
    expect(statusFilter()).toEqual(['entity.status = :status', { status: '1' }]);
  });

  it('管理端列表（isManager=true、不带 noticeId、不带 status）：无任何 status 过滤', async () => {
    await service.findAll({} as any, undefined, true);

    expect(noticeIdFilter()).toBeUndefined();
    expect(statusFilter()).toBeUndefined();
  });

  it('非管理侧（缺省 isManager=false）：无 scope 拉列表强制「全员公告 + 发给我」过滤', async () => {
    await service.findAll({} as any, 9);

    expect(visibilityFilter()).toEqual(['(entity.userId IS NULL OR entity.userId = :viewerId)', { viewerId: 9 }]);
  });

  it('管理侧（isManager=true）：无 scope 不注入定向可见性过滤，可见全部定向通知', async () => {
    await service.findAll({} as any, 9, true);

    expect(visibilityFilter()).toBeUndefined();
  });

  it('非管理侧且无 viewerId（防御分支）：只回全员公告', async () => {
    await service.findAll({} as any);

    expect(visibilityFilter()).toEqual(['entity.userId IS NULL', undefined]);
  });

  it('scope=mine：定向可见性过滤行为不变（全员公告 + 发给我的）', async () => {
    await service.findAll({ scope: 'mine' } as any, 7);

    expect(visibilityFilter()).toEqual(['(entity.userId IS NULL OR entity.userId = :viewerId)', { viewerId: 7 }]);
  });

  it('scope=mine：按逐条已读标记回填行级 unread（有标记=已读，无标记=未读）', async () => {
    chain.getManyAndCount.mockResolvedValue([[{ noticeId: 3 }, { noticeId: 5 }], 2]);
    // n:3 已读、n:5 未读
    notifyReadRepo.find.mockResolvedValue([{ category: 'n:3' }]);

    const res = await service.findAll({ scope: 'mine' } as any, 7);

    const list = res.data.list as Array<{ noticeId: number; unread?: boolean }>;
    // 查询按登录人过滤已读标记（userId 在 where 条件内）
    expect(notifyReadRepo.find.mock.calls[0][0].where.userId).toBe(7);
    expect(list.find((row) => row.noticeId === 3)?.unread).toBe(false);
    expect(list.find((row) => row.noticeId === 5)?.unread).toBe(true);
  });

  it('scope=mine 且本页无已读标记：全部行 unread=true', async () => {
    chain.getManyAndCount.mockResolvedValue([[{ noticeId: 3 }], 1]);
    notifyReadRepo.find.mockResolvedValue([]);

    const res = await service.findAll({ scope: 'mine' } as any, 7);

    expect((res.data.list as Array<{ unread?: boolean }>)[0]?.unread).toBe(true);
  });

  it('管理端列表（isManager=true、无 scope）：不查已读标记、不附 unread', async () => {
    chain.getManyAndCount.mockResolvedValue([[{ noticeId: 3 }], 1]);

    const res = await service.findAll({} as any, undefined, true);

    expect(notifyReadRepo.find).not.toHaveBeenCalled();
    expect('unread' in (res.data.list as Array<Record<string, unknown>>)[0]).toBe(false);
  });
});
