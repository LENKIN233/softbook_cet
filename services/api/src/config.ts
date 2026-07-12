import {z} from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('true'),
  ALLOWED_ORIGINS: z.string().min(1),
  PHONE_LOOKUP_SECRET: z.string().min(32).refine(value => !/replace/i.test(value)),
  PHONE_ENCRYPTION_KEY_BASE64: z
    .string()
    .refine(value => Buffer.from(value, 'base64').length === 32),
  TOKEN_HASH_SECRET: z.string().min(32).refine(value => !/replace/i.test(value)),
  SMS_PROVIDER: z.enum(['dev', 'tencent']),
  SMS_DEV_CODE: z.string().regex(/^\d{4,8}$/).optional(),
  TENCENT_SECRET_ID: z.string().optional(),
  TENCENT_SECRET_KEY: z.string().optional(),
  TENCENT_SMS_REGION: z.string().default('ap-guangzhou'),
  TENCENT_SMS_SDK_APP_ID: z.string().optional(),
  TENCENT_SMS_SIGN_NAME: z.string().optional(),
  TENCENT_SMS_TEMPLATE_ID: z.string().optional(),
});

export type ApiConfig = {
  allowedOrigins: string[];
  databaseSsl: boolean;
  databaseUrl: string;
  environment: 'development' | 'test' | 'production';
  host: string;
  phoneEncryptionKeyBase64: string;
  phoneLookupSecret: string;
  port: number;
  sms:
    | {provider: 'dev'; code: string}
    | {
        provider: 'tencent';
        region: string;
        sdkAppId: string;
        secretId: string;
        secretKey: string;
        signName: string;
        templateId: string;
      };
  tokenHashSecret: string;
};

export function loadApiConfig(
  input: NodeJS.ProcessEnv = process.env,
): ApiConfig {
  const env = environmentSchema.parse(input);
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
    .map(value => value.trim())
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must include at least one origin.');
  }
  if (env.PHONE_LOOKUP_SECRET === env.TOKEN_HASH_SECRET) {
    throw new Error('Phone lookup and token hashing secrets must be distinct.');
  }

  if (env.NODE_ENV === 'production') {
    if (env.SMS_PROVIDER !== 'tencent') {
      throw new Error('Production requires SMS_PROVIDER=tencent.');
    }
    if (allowedOrigins.includes('*')) {
      throw new Error('Production ALLOWED_ORIGINS must not contain *.');
    }
    if (!env.DATABASE_URL.startsWith('postgresql://')) {
      throw new Error('Production DATABASE_URL must use postgresql://.');
    }
    if (env.DATABASE_SSL !== 'true') {
      throw new Error('Production requires DATABASE_SSL=true.');
    }
  }

  const sms =
    env.SMS_PROVIDER === 'dev'
      ? {
          provider: 'dev' as const,
          code: requireValue(env.SMS_DEV_CODE, 'SMS_DEV_CODE'),
        }
      : {
          provider: 'tencent' as const,
          region: env.TENCENT_SMS_REGION,
          sdkAppId: requireValue(
            env.TENCENT_SMS_SDK_APP_ID,
            'TENCENT_SMS_SDK_APP_ID',
          ),
          secretId: requireValue(env.TENCENT_SECRET_ID, 'TENCENT_SECRET_ID'),
          secretKey: requireValue(
            env.TENCENT_SECRET_KEY,
            'TENCENT_SECRET_KEY',
          ),
          signName: requireValue(
            env.TENCENT_SMS_SIGN_NAME,
            'TENCENT_SMS_SIGN_NAME',
          ),
          templateId: requireValue(
            env.TENCENT_SMS_TEMPLATE_ID,
            'TENCENT_SMS_TEMPLATE_ID',
          ),
        };

  return {
    allowedOrigins,
    databaseSsl: env.DATABASE_SSL === 'true',
    databaseUrl: env.DATABASE_URL,
    environment: env.NODE_ENV,
    host: env.HOST,
    phoneEncryptionKeyBase64: env.PHONE_ENCRYPTION_KEY_BASE64,
    phoneLookupSecret: env.PHONE_LOOKUP_SECRET,
    port: env.PORT,
    sms,
    tokenHashSecret: env.TOKEN_HASH_SECRET,
  };
}

function requireValue(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`${label} is required for the selected SMS provider.`);
  }
  return value;
}
