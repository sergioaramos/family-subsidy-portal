import { describe, expect, it } from 'vitest';
import { esCodigoTotp } from '../../src/auth/totp';

describe('esCodigoTotp', () => {
  it.each(['123456', '000000'])('acepta %s', (c) => expect(esCodigoTotp(c)).toBe(true));
  it.each(['12345', '1234567', '12a456', ' 123456', ''])('rechaza "%s"', (c) => expect(esCodigoTotp(c)).toBe(false));
});
