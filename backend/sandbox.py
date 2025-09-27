import ast, multiprocessing as mp, traceback, builtins as _bi, os, tempfile
from pathlib import Path

ALLOWED_MODULES = {"abc","json"}


def _safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    module_name = name or ''
    root = module_name.split('.', 1)[0]
    if level != 0 or root not in ALLOWED_MODULES:
        raise ImportError(f"Import non permesso per il modulo: {name}")
    return _bi.__import__(name, globals, locals, fromlist, level)


SAFE_BUILTINS = {
    'abs': abs, 'all': all, 'any': any, 'bool': bool, 'dict': dict, 'enumerate': enumerate,
    'filter': filter, 'float': float, 'int': int, 'len': len, 'list': list, 'map': map,
    'max': max, 'min': min, 'pow': pow, 'range': range, 'repr': repr, 'reversed': reversed,
    'round': round, 'set': set, 'sum': sum, 'tuple': tuple, 'zip': zip, 'print': print,
    'str': str, 'isinstance': isinstance, 'super': super, 'sorted': sorted, 'type': type, 'hasattr': hasattr, 'callable': callable,
    '__build_class__': _bi.__build_class__, '__import__': _safe_import,
    'object': object,
    'Exception': Exception, 'ValueError': ValueError, 'TypeError': TypeError, 'IndexError': IndexError
}

class Guard(ast.NodeVisitor):
    def visit_Attribute(self, node):
        if isinstance(node.attr, str) and node.attr.startswith('__') and node.attr != '__init__':
            raise ValueError("Uso di attributi speciali non permesso")
        self.generic_visit(node)
    def visit_Import(self, node):
        for alias in node.names:
            root = alias.name.split('.', 1)[0]
            if root not in ALLOWED_MODULES:
                raise ValueError(f"Import non permesso per il modulo: {alias.name}")
        self.generic_visit(node)
    def visit_ImportFrom(self, node):
        module = node.module or ''
        root = module.split('.', 1)[0]
        if root not in ALLOWED_MODULES:
            raise ValueError(f"Import non permesso per il modulo: {module}")
        self.generic_visit(node)
    def visit_Call(self, node):
        if isinstance(node.func, ast.Name) and node.func.id in ('exec','eval','compile','__import__'):
            raise ValueError(f"Chiamata non permessa: {node.func.id}")
        self.generic_visit(node)

def _run(code: str, tests: list[str]):
    tree = ast.parse(code, mode='exec')
    Guard().visit(tree)
    compiled = compile(tree, '<student>', 'exec')
    sandbox_root = Path(tempfile.mkdtemp(prefix="sandbox_fs_"))
    sandbox_root = sandbox_root.resolve()

    def _resolve_path(path_like):
        p = Path(path_like)
        if not p.is_absolute():
            p = sandbox_root / p
        try:
            resolved = p.resolve()
        except FileNotFoundError:
            resolved = p.parent.resolve() / p.name
        try:
            resolved.relative_to(sandbox_root)
        except ValueError:
            raise PermissionError("Accesso al file negato")
        return resolved

    open_log = []

    def _safe_open(file, mode='r', buffering=-1, encoding=None,
                   errors=None, newline=None, closefd=True, opener=None):
        resolved = _resolve_path(file)
        if any(flag in mode for flag in ('w', 'a', 'x', '+')):
            resolved.parent.mkdir(parents=True, exist_ok=True)
        open_log.append({'path': str(resolved), 'mode': mode})
        return _bi.open(resolved, mode, buffering=buffering, encoding=encoding,
                        errors=errors, newline=newline, closefd=closefd, opener=opener)

    env = {
        '__builtins__': {**SAFE_BUILTINS, 'open': _safe_open},
        '__name__': '__main__',
        'SANDBOX_DIR': str(sandbox_root),
        '_sandbox_open_log': open_log
    }

    old_cwd = Path.cwd()
    os.chdir(sandbox_root)
    exec(compiled, env, env)

    failures = []
    for t in tests:
        try:
            exec(t, env, env)
        except Exception as e:
            failures.append({
                'test': t,
                'error': ''.join(traceback.format_exception_only(type(e), e)).strip()
            })
    os.chdir(old_cwd)
    return failures

# ---------- TARGET A LIVELLO DI MODULO (picklabile con spawn) ----------
def _sandbox_target(code: str, tests: list[str], q: "mp.Queue") -> None:
    try:
        failures = _run(code, tests)
        q.put({'ok': True, 'failures': failures})
    except Exception as e:
        q.put({'ok': False, 'error': str(e), 'traceback': traceback.format_exc()})

def run_safely(code: str, tests: list[str], timeout_sec: int = 4):
    # Usa esplicitamente lo start method 'spawn' (portabile; su Linux equivale al default 'fork' solo se lo forzi)
    ctx = mp.get_context("spawn")
    q = ctx.Queue()

    p = ctx.Process(target=_sandbox_target, args=(code, tests, q), daemon=True)
    p.start()
    p.join(timeout=timeout_sec)

    if p.is_alive():
        p.terminate()
        p.join(1)
        return {'ok': False, 'timeout': True, 'error': 'Timeout di esecuzione'}

    # Se il figlio è morto senza mettere nulla in coda, restituisci un errore pulito
    if q.empty():
        return {'ok': False, 'error': 'Nessun risultato dal sandbox', 'exitcode': p.exitcode}

    return q.get()
