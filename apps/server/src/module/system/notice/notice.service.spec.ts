import { NoticeService } from './notice.service';

/**
 * 前台通知详情页按 noticeId 直取（复用 list 权限）：服务端必须强制只回生效公告（status='0'），
 * 否则关闭态公告可凭 id 越权直取；管理端列表不带 noticeId，过滤行为不得受影响
 */
describe('NoticeService.findAll（noticeId 直取封死关闭态）', () => {
  const chain = {
    where: jest.fn(),
    andWhere: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repo = { createQueryBuilder: jest.fn() };
  let service: NoticeService;

  beforeEach(() => {
    jest.resetAllMocks();
    repo.createQueryBuilder.mockReturnValue(chain);
    for (const step of ['where', 'andWhere', 'skip', 'take']) {
      chain[step].mockReturnValue(chain);
    }
    chain.getManyAndCount.mockResolvedValue([[], 0]);
    service = new NoticeService(repo as any);
  });

  // andWhere 的 status 过滤调用（[sql, params] 对；未出现则返回 undefined）
  const statusFilter = () => chain.andWhere.mock.calls.find((call) => String(call[0]).includes('entity.status'));
  const noticeIdFilter = () => chain.andWhere.mock.calls.find((call) => call[0] === 'entity.noticeId = :noticeId');

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

  it('管理端列表（不带 noticeId）：status 仅按查询参数透传，不被强制注入', async () => {
    await service.findAll({ status: '1' } as any);

    expect(noticeIdFilter()).toBeUndefined();
    expect(statusFilter()).toEqual(['entity.status = :status', { status: '1' }]);
  });

  it('管理端列表（不带 noticeId、不带 status）：无任何 status 过滤', async () => {
    await service.findAll({} as any);

    expect(noticeIdFilter()).toBeUndefined();
    expect(statusFilter()).toBeUndefined();
  });
});
