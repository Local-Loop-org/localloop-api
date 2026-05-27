import { RealtimeEventsService } from './realtime-events.service';

describe('RealtimeEventsService', () => {
  let service: RealtimeEventsService;

  beforeEach(() => {
    service = new RealtimeEventsService();
  });

  it('notifies all active subscribers', () => {
    const first = jest.fn();
    const second = jest.fn();

    service.on(first);
    service.on(second);

    service.emit({
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });

    expect(first).toHaveBeenCalledWith({
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });
    expect(second).toHaveBeenCalledWith({
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });
  });

  it('unsubscribes handlers', () => {
    const handler = jest.fn();
    const unsubscribe = service.on(handler);

    unsubscribe();
    service.emit({
      type: 'dm_summary_requested',
      userId: 'user-1',
      peerId: 'user-2',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when a handler fails', () => {
    service.on(() => {
      throw new Error('boom');
    });

    expect(() =>
      service.emit({
        type: 'dm_summary_requested',
        userId: 'user-1',
        peerId: 'user-2',
      }),
    ).not.toThrow();
  });
});
