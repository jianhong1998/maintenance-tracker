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

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(params: SendEmailParams): Promise<void> {
    const provider = this.configService.get<string>('EMAIL_PROVIDER');

    if (provider === 'postmark') {
      await this.sendViaPostmark(params);
    } else if (provider === 'ses') {
      await this.sendViaSes(params);
    } else {
      this.logger.warn(
        `Unknown EMAIL_PROVIDER "${provider ?? 'undefined'}" — email not sent`,
      );
    }
  }

  private async sendViaPostmark(params: SendEmailParams): Promise<void> {
    const apiKey = this.configService.get<string>('POSTMARK_API_KEY') ?? '';
    const from = this.configService.get<string>('POSTMARK_FROM_ADDRESS') ?? '';

    const client = new postmark.ServerClient(apiKey);
    await client.sendEmail({
      From: from,
      To: params.to,
      Subject: params.subject,
      TextBody: params.body,
    });
  }

  private async sendViaSes(params: SendEmailParams): Promise<void> {
    const region = this.configService.get<string>('AWS_SES_REGION');
    const from = this.configService.get<string>('AWS_SES_FROM_ADDRESS') ?? '';

    const client = new SESClient({ region });
    await client.send(
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
