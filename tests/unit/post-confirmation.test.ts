import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';

const send = vi.fn();
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class {
    send = send;
  },
  AdminAddUserToGroupCommand: class {
    readonly tipo = 'AddUserToGroup';
    constructor(public input: Record<string, unknown>) {}
  },
  AdminUpdateUserAttributesCommand: class {
    readonly tipo = 'UpdateUserAttributes';
    constructor(public input: Record<string, unknown>) {}
  },
}));

const { handler } = await import('../../amplify/auth/post-confirmation/handler');

function evento(triggerSource: string): PostConfirmationTriggerEvent {
  return {
    version: '1',
    triggerSource,
    region: 'us-east-1',
    userPoolId: 'us-east-1_pool',
    userName: 'usuario-1',
    callerContext: { awsSdkVersion: 'x', clientId: 'cliente' },
    request: { userAttributes: { 'custom:autorizacionDatos': 'v1' } },
    response: {},
  } as PostConfirmationTriggerEvent;
}

const invocar = (e: PostConfirmationTriggerEvent) =>
  (handler as unknown as (e: PostConfirmationTriggerEvent) => Promise<PostConfirmationTriggerEvent>)(e);

describe('trigger postConfirmation', () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({});
  });

  it('@AC-1 @AC-6 agrega al usuario confirmado SOLO al grupo AFILIADO', async () => {
    await invocar(evento('PostConfirmation_ConfirmSignUp'));
    const grupos = send.mock.calls.map(([c]) => c).filter((c) => c.tipo === 'AddUserToGroup');
    expect(grupos).toHaveLength(1);
    expect(grupos[0].input).toMatchObject({ UserPoolId: 'us-east-1_pool', Username: 'usuario-1', GroupName: 'AFILIADO' });
  });

  it('@AC-1 guarda la versión y la fecha (del servidor) de la autorización aceptada', async () => {
    await invocar(evento('PostConfirmation_ConfirmSignUp'));
    const update = send.mock.calls.map(([c]) => c).find((c) => c.tipo === 'UpdateUserAttributes');
    const valor = (update.input.UserAttributes as { Name: string; Value: string }[]).find(
      (a) => a.Name === 'custom:autorizacionDatos',
    )!.Value;
    const [version, fecha] = valor.split('|');
    expect(version).toBe('v1');
    expect(Number.isNaN(Date.parse(fecha))).toBe(false);
    expect(valor.length).toBeLessThanOrEqual(64);
  });

  it('no hace nada al confirmar una recuperación de contraseña', async () => {
    await invocar(evento('PostConfirmation_ConfirmForgotPassword'));
    expect(send).not.toHaveBeenCalled();
  });
});
