import { IDirectMessageRepository } from '../domain/repositories/i-direct-message.repository';

export function buildDirectMessageRepoMock(): jest.Mocked<IDirectMessageRepository> {
  return {
    create: jest.fn(),
    findByIdWithSender: jest.fn(),
    listConversation: jest.fn(),
  };
}
