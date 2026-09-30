import { describe, expect, it } from 'vitest';
import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { validarRegistro, VERSION_AUTORIZACION, MENSAJES_REGISTRO } from '../../amplify/shared/dominio/registro';
import { CoreFake } from '../fakes/core-fake';
import { handler } from '../../amplify/auth/pre-sign-up/handler';

const core = new CoreFake({
  afiliados: [
    { documento: '10010001', nombre: 'Ana', activo: true, categoria: 'A' },
    { documento: '20020002', nombre: 'Pedro', activo: false, categoria: 'B' },
  ],
  beneficiarios: {},
});

describe('regla de registro (validarRegistro)', () => {
  it('@AC-1 permite registrar a un afiliado activo que aceptó la autorización', async () => {
    await expect(
      validarRegistro({ documento: '10010001', autorizacionDatos: VERSION_AUTORIZACION }, core),
    ).resolves.toBeUndefined();
  });

  it('@AC-2 rechaza el registro sin aceptar la autorización de datos', async () => {
    await expect(validarRegistro({ documento: '10010001', autorizacionDatos: undefined }, core)).rejects.toThrow(
      MENSAJES_REGISTRO.sinAutorizacion,
    );
  });

  it('@AC-2 rechaza una versión de autorización distinta a la vigente', async () => {
    await expect(validarRegistro({ documento: '10010001', autorizacionDatos: 'v0' }, core)).rejects.toThrow(
      MENSAJES_REGISTRO.sinAutorizacion,
    );
  });

  it.each([
    ['20020002', 'inactivo'],
    ['99999999', 'inexistente'],
  ])('@AC-3 rechaza el documento %s (%s) sin revelar datos del core', async (documento) => {
    const error = await validarRegistro({ documento, autorizacionDatos: VERSION_AUTORIZACION }, core).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(MENSAJES_REGISTRO.sinAfiliacionActiva);
    expect(error.message).toBe('No encontramos una afiliación activa con este documento');
  });

  it('rechaza un registro sin documento', async () => {
    await expect(validarRegistro({ documento: undefined, autorizacionDatos: VERSION_AUTORIZACION }, core)).rejects.toThrow(
      MENSAJES_REGISTRO.sinAfiliacionActiva,
    );
  });
});

function eventoRegistro(atributos: Record<string, string>): PreSignUpTriggerEvent {
  return {
    version: '1',
    triggerSource: 'PreSignUp_SignUp',
    region: 'us-east-1',
    userPoolId: 'us-east-1_pool',
    userName: 'nuevo',
    callerContext: { awsSdkVersion: 'x', clientId: 'cliente' },
    request: { userAttributes: { email: 'ana@example.com', ...atributos } },
    response: { autoConfirmUser: false, autoVerifyEmail: false, autoVerifyPhone: false },
  } as PreSignUpTriggerEvent;
}

const invocar = (e: PreSignUpTriggerEvent) =>
  (handler as unknown as (e: PreSignUpTriggerEvent) => Promise<PreSignUpTriggerEvent>)(e);

describe('trigger preSignUp (usa el CoreSimulado real)', () => {
  it('@AC-1 deja pasar al afiliado activo 10010001 sin autoconfirmar (debe verificar su correo)', async () => {
    const r = await invocar(
      eventoRegistro({ 'custom:documento': '10010001', 'custom:autorizacionDatos': VERSION_AUTORIZACION }),
    );
    expect(r.response.autoConfirmUser).toBe(false);
    expect(r.response.autoVerifyEmail).toBe(false);
  });

  it('@AC-3 rechaza al inactivo 20020002', async () => {
    await expect(
      invocar(eventoRegistro({ 'custom:documento': '20020002', 'custom:autorizacionDatos': VERSION_AUTORIZACION })),
    ).rejects.toThrow(MENSAJES_REGISTRO.sinAfiliacionActiva);
  });

  it('solo actúa en el autorregistro: un usuario creado por TI (AdminCreateUser) no se valida contra el core', async () => {
    const e = eventoRegistro({});
    e.triggerSource = 'PreSignUp_AdminCreateUser';
    await expect(invocar(e)).resolves.toBeDefined();
  });
});
