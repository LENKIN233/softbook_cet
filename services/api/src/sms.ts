import {createHash, createHmac} from 'node:crypto';

import type {ApiConfig} from './config.js';
import type {SmsProvider} from './domain.js';

export class DevSmsProvider implements SmsProvider {
  readonly kind = 'development';

  constructor(readonly code: string) {}

  async sendCode(): Promise<void> {
    // Development provider deliberately performs no external delivery.
  }
}

export class TencentSmsProvider implements SmsProvider {
  readonly kind = 'tencent';

  constructor(
    private readonly config: Extract<ApiConfig['sms'], {provider: 'tencent'}>,
  ) {}

  async sendCode(phoneNumber: string, code: string): Promise<void> {
    const payload = JSON.stringify({
      PhoneNumberSet: [`+86${phoneNumber}`],
      SmsSdkAppId: this.config.sdkAppId,
      SignName: this.config.signName,
      TemplateId: this.config.templateId,
      TemplateParamSet: [code, '5'],
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const headers = createTencentCloudHeaders(
      this.config,
      payload,
      timestamp,
    );
    const response = await fetch('https://sms.tencentcloudapi.com/', {
      body: payload,
      headers,
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Tencent SMS HTTP request failed: ${response.status}`);
    }
    const result = (await response.json()) as TencentSmsResponse;
    if (result.Response.Error) {
      throw new Error(`Tencent SMS API failed: ${result.Response.Error.Code}`);
    }
    const status = result.Response.SendStatusSet?.[0];

    if (!status || status.Code !== 'Ok') {
      throw new Error(`Tencent SMS delivery failed: ${status?.Code ?? 'unknown'}`);
    }
  }
}

type TencentSmsResponse = {
  Response: {
    Error?: {Code: string; Message: string};
    RequestId?: string;
    SendStatusSet?: Array<{Code: string; Message: string}>;
  };
};

export function createTencentCloudHeaders(
  config: Extract<ApiConfig['sms'], {provider: 'tencent'}>,
  payload: string,
  timestamp: number,
): Record<string, string> {
  const algorithm = 'TC3-HMAC-SHA256';
  const endpoint = 'sms.tencentcloudapi.com';
  const service = 'sms';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const signedHeaders = 'content-type;host';
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${endpoint}\n`;
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256Hex(payload),
  ].join('\n');
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const secretDate = hmac(`TC3${config.secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign).toString('hex');
  const authorization =
    `${algorithm} Credential=${config.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
    'Content-Type': contentType,
    Host: endpoint,
    'X-TC-Action': 'SendSms',
    'X-TC-Region': config.region,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': '2021-01-11',
  };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}
