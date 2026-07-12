import {createProductionApi} from './app.js';
import {loadApiConfig} from './config.js';
import {PostgresProductionRepository} from './postgresRepository.js';
import {PhoneProtector, SecretHasher} from './security.js';
import {DevSmsProvider, TencentSmsProvider} from './sms.js';

async function main() {
  const config = loadApiConfig();
  const repository = PostgresProductionRepository.fromConnectionString(
    config.databaseUrl,
    config.databaseSsl,
  );
  const smsProvider =
    config.sms.provider === 'tencent'
      ? new TencentSmsProvider(config.sms)
      : new DevSmsProvider(config.sms.code);
  const developmentSmsCode =
    config.sms.provider === 'dev' ? config.sms.code : null;
  const generateSmsCode = developmentSmsCode
    ? () => developmentSmsCode
    : undefined;
  const app = await createProductionApi({
    allowedOrigins: config.allowedOrigins,
    codeHasher: new SecretHasher(`${config.tokenHashSecret}:sms`),
    environment: config.environment,
    generateSmsCode,
    logger: true,
    phoneProtector: new PhoneProtector(
      config.phoneLookupSecret,
      config.phoneEncryptionKeyBase64,
    ),
    repository,
    smsProvider,
    tokenHasher: new SecretHasher(`${config.tokenHashSecret}:token`),
  });

  const shutdown = async (signal: string) => {
    app.log.info({signal}, 'shutting down');
    await app.close();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({host: config.host, port: config.port});
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
