import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreTokenGenerationTriggerEvent } from 'aws-lambda';

// ADR-7: MFA obligatorio para funcionarios, aplicado en el token (FR-9, AC-8).
const send = vi.fn();
vi.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: class {
    send = send;
  },
  AdminGetUserCommand: class {
    constructor(public input: unknown) {}
  },
}));

const { handler } = await import('../../amplify/auth/pre-token-generation/handler');

function evento(grupos: string[] | undefined, roles: string[] = []): PreTokenGenerationTriggerEvent {
  return {
    version: '1',
    triggerSource: 'TokenGeneration_Authentication',
    region: 'us-east-1',
    userPoolId: 'us-east-1_pool',
    userName: 'usuario-1',
    callerContext: { awsSdkVersion: 'x', clientId: 'cliente' },
    request: {
      userAttributes: {},
      groupConfiguration: {
        groupsToOverride: grupos,
        iamRolesToOverride: roles,
        preferredRole: roles[0],
      },
    },
    response: { claimsOverrideDetails: {} },
  } as unknown as PreTokenGenerationTriggerEvent;
}

const invocar = (e: PreTokenGenerationTriggerEvent) =>
  (handler as unknown as (e: PreTokenGenerationTriggerEvent) => Promise<PreTokenGenerationTriggerEvent>)(e);

describe('@AC-8 preTokenGeneration: MFA obligatorio para funcionarios', () => {
  beforeEach(() => {
    send.mockReset();
  });

  it('un afiliado no se consulta ni se modifica', async () => {
    const r = await invocar(evento(['AFILIADO']));
    expect(send).not.toHaveBeenCalled();
    expect(r.response.claimsOverrideDetails).toEqual({});
  });

  it('sin grupos (undefined) no se modifica', async () => {
    const r = await invocar(evento(undefined));
    expect(send).not.toHaveBeenCalled();
    expect(r.response.claimsOverrideDetails).toEqual({});
  });

  it('un analista con TOTP conserva sus grupos', async () => {
    send.mockResolvedValue({ UserMFASettingList: ['SOFTWARE_TOKEN_MFA'] });
    const r = await invocar(evento(['ANALISTA'], ['arn:rol-analista']));
    expect(r.response.claimsOverrideDetails).toEqual({});
  });

  it('un analista sin TOTP pierde grupos y roles IAM de funcionario y recibe requiere_mfa', async () => {
    send.mockResolvedValue({ UserMFASettingList: [] });
    const r = await invocar(evento(['ANALISTA'], ['arn:rol-analista']));
    const d = r.response.claimsOverrideDetails!;
    expect(d.groupOverrideDetails?.groupsToOverride).toEqual([]);
    expect(d.groupOverrideDetails?.iamRolesToOverride).toEqual([]);
    expect(d.groupOverrideDetails?.preferredRole).toBeUndefined();
    expect(d.claimsToAddOrOverride).toEqual({ requiere_mfa: 'true' });
  });

  it('MFA solo por SMS no cuenta como TOTP', async () => {
    send.mockResolvedValue({ UserMFASettingList: ['SMS_MFA'] });
    const r = await invocar(evento(['COORDINADOR']));
    expect(r.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
  });

  it('si AdminGetUser falla, falla cerrado: sin grupos de funcionario y con requiere_mfa', async () => {
    send.mockImplementation(async () => {
      throw new Error('throttling');
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await invocar(evento(['ANALISTA', 'AFILIADO']));
    expect(r.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual(['AFILIADO']);
    expect(r.response.claimsOverrideDetails?.claimsToAddOrOverride).toEqual({ requiere_mfa: 'true' });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
