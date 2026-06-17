import { ConfigService } from '@nestjs/config';

import { POS_JOBS } from './pos-queue.constants';
import { PosJobsService } from './pos-jobs.service';

describe('PosJobsService', () => {
  const config = {
    get: (key: string) => {
      if (key === 'POS_QUEUES_ENABLED') return 'true';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as ConfigService;

  it('uses the sync run id as the BullMQ job id (no colons)', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'run-uuid' });
    const service = new PosJobsService(
      config,
      { add } as never,
      {} as never,
      { runSync: jest.fn() } as never,
      { recomputeSnapshots: jest.fn() } as never,
    );

    await service.enqueueSync({
      connectionId: 'conn-1',
      trigger: 'MANUAL',
      syncRunId: '7c2aef31-6357-4ff1-b8dd-09df1f174fdc',
    });

    expect(add).toHaveBeenCalledWith(
      POS_JOBS.SYNC_CONNECTION,
      expect.objectContaining({ syncRunId: '7c2aef31-6357-4ff1-b8dd-09df1f174fdc' }),
      { jobId: '7c2aef31-6357-4ff1-b8dd-09df1f174fdc' },
    );
  });

  it('runs sync inline when queues are disabled', async () => {
    const inlineConfig = {
      get: (key: string) => {
        if (key === 'POS_QUEUES_ENABLED') return 'false';
        if (key === 'NODE_ENV') return 'development';
        return undefined;
      },
    } as ConfigService;
    const runSync = jest.fn().mockResolvedValue(undefined);
    const service = new PosJobsService(
      inlineConfig,
      null,
      null,
      { runSync } as never,
      { recomputeSnapshots: jest.fn() } as never,
    );

    await service.enqueueSync({
      connectionId: 'conn-1',
      trigger: 'MANUAL',
      syncRunId: '7c2aef31-6357-4ff1-b8dd-09df1f174fdc',
    });

    await new Promise((r) => setImmediate(r));
    expect(runSync).toHaveBeenCalled();
  });
});
