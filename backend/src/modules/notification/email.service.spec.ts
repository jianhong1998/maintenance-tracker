import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockSendEmail, mockSend, mockServerClient, mockSESClient } = vi.hoisted(
  () => ({
    mockSendEmail: vi.fn().mockResolvedValue({}),
    mockSend: vi.fn().mockResolvedValue({}),
    mockServerClient: vi.fn(),
    mockSESClient: vi.fn(),
  }),
);

vi.mock('postmark', () => ({
  ServerClient: mockServerClient.mockImplementation(() => ({
    sendEmail: mockSendEmail,
  })),
}));

vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: mockSESClient.mockImplementation(() => ({ send: mockSend })),
  SendEmailCommand: vi.fn().mockImplementation((input: unknown) => input),
}));

import { EmailService } from './email.service';

const mockConfigService = {
  get: vi.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('#sendEmail', () => {
    it('sends via Postmark when EMAIL_PROVIDER is "postmark"', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'postmark';
        if (key === 'POSTMARK_API_KEY') return 'test-key';
        if (key === 'POSTMARK_FROM_ADDRESS') return 'from@example.com';
        return undefined;
      });

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(mockSendEmail).toHaveBeenCalledWith({
        From: 'from@example.com',
        To: 'user@example.com',
        Subject: 'Test Subject',
        TextBody: 'Test body',
      });
    });

    it('sends via SES when EMAIL_PROVIDER is "ses"', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'ses';
        if (key === 'AWS_SES_REGION') return 'ap-southeast-1';
        if (key === 'AWS_SES_FROM_ADDRESS') return 'from@example.com';
        return undefined;
      });

      await service.sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        body: 'Test body',
      });

      expect(mockSend).toHaveBeenCalled();
    });

    it('throws for unknown EMAIL_PROVIDER', async () => {
      mockConfigService.get.mockReturnValue('unknown-provider');

      await expect(
        service.sendEmail({
          to: 'user@example.com',
          subject: 'Test Subject',
          body: 'Test body',
        }),
      ).rejects.toThrow('Unknown EMAIL_PROVIDER');

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('does not re-instantiate Postmark client on repeated sends', async () => {
      const callCountAfterInit = mockServerClient.mock.calls.length;

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'postmark';
        if (key === 'POSTMARK_FROM_ADDRESS') return 'from@example.com';
        return undefined;
      });

      await service.sendEmail({ to: 'a@b.com', subject: 'S', body: 'B' });
      await service.sendEmail({ to: 'a@b.com', subject: 'S', body: 'B' });

      expect(mockServerClient.mock.calls.length).toBe(callCountAfterInit);
    });

    it('does not re-instantiate SES client on repeated sends', async () => {
      const callCountAfterInit = mockSESClient.mock.calls.length;

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'EMAIL_PROVIDER') return 'ses';
        if (key === 'AWS_SES_FROM_ADDRESS') return 'from@example.com';
        return undefined;
      });

      await service.sendEmail({ to: 'a@b.com', subject: 'S', body: 'B' });
      await service.sendEmail({ to: 'a@b.com', subject: 'S', body: 'B' });

      expect(mockSESClient.mock.calls.length).toBe(callCountAfterInit);
    });
  });
});
