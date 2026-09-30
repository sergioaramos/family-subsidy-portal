export type GrupoFuncionario = 'ANALISTA' | 'COORDINADOR';

/** Lee `--correo <c> --grupo <ANALISTA|COORDINADOR>`. AFILIADO no se permite: sale del autorregistro. */
export function leerArgumentosFuncionario(argv: string[]): { correo: string; grupo: GrupoFuncionario } {
  const valor = (nombre: string) => {
    const i = argv.indexOf(nombre);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const correo = valor('--correo');
  const grupo = valor('--grupo');
  if (!correo) throw new Error('Falta --correo');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) throw new Error('Correo no válido');
  if (grupo !== 'ANALISTA' && grupo !== 'COORDINADOR') throw new Error('El grupo debe ser ANALISTA o COORDINADOR');
  return { correo, grupo };
}
