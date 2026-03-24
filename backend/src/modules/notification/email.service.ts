import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as postmark from 'postmark';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private postmarkClient?: postmark.ServerClient;
  private sesClient?: SESClient;

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: SendEmailParams): Promise<void> {
    const provider = this.configService.get<string>('EMAIL_PROVIDER');

    if (provider === 'postmark') {
      await this.sendViaPostmark(params);
    } else if (provider === 'ses') {
      await this.sendViaSes(params);
    } else {
      throw new Error(
        `Unknown EMAIL_PROVIDER "${provider ?? 'undefined'}" — cannot send email`,
      );
    }
  }

  private getPostmarkClient(): postmark.ServerClient {
    if (!this.postmarkClient) {
      this.postmarkClient = new postmark.ServerClient(
        this.configService.get<string>('POSTMARK_API_KEY') ?? '',
      );
    }
    return this.postmarkClient;
  }

  private getSesClient(): SESClient {
    if (!this.sesClient) {
      this.sesClient = new SESClient({
        region: this.configService.get<string>('AWS_SES_REGION'),
      });
    }
    return this.sesClient;
  }

  private async sendViaPostmark(params: SendEmailParams): Promise<void> {
    const from = this.configService.get<string>('POSTMARK_FROM_ADDRESS') ?? '';
    await this.getPostmarkClient().sendEmail({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.body,
    });
  }

  private async sendViaSes(params: SendEmailParams): Promise<void> {
    const from = this.configService.get<string>('AWS_SES_FROM_ADDRESS') ?? '';
    await this.getSesClient().send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [params.to] },
        Message: {
          Subject: { Data: params.subject },
          Body: { Text: { Data: params.body } },
        },
      }),
    );
  }
}
