import { IDirectMessageRepository } from '../domain/repositories/i-direct-message.repository';

export function buildDirectMessageRepoMock(): jest.Mocked<IDirectMessageRepository> {
  return {
    create: jest.fn(),
    findByIdWithSender: jest.fn(),
    listConversation: jest.fn(),
    hasPermissionException: jest.fn(),
    createRequest: jest.fn(),
    listInbox: jest.fn(),
    listRequests: jest.fn(),
  };
}
